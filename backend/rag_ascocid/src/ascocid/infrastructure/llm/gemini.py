"""Adaptateur Gemini (google-genai).

⚠️ Différence structurelle avec Anthropic : Gemini n'expose pas de mécanisme de
citation pour des documents fournis par l'appelant. Les citations sont donc
demandées dans le prompt sous forme de marqueurs [Sn], et **vérifiées après
coup** (`application/requete/verification.py`). Sans cette vérification, rien
ne garantit qu'une source citée existe ou soutient l'affirmation.

Le préfixe stable (règles + carte du corpus) est placé en `system_instruction` :
c'est ce qui permet au cache implicite du fournisseur de s'appliquer.
"""

from __future__ import annotations

import os
import random
import re
import time
from collections.abc import Iterator

from ascocid.application.requete import prompt as p
from ascocid.domain.ports.llm import Citation, Reponse, Usage
from ascocid.domain.ports.recherche import Passage

MODELE_DEFAUT = "gemini-2.5-pro"
# $/million de tokens — à réviser si la tarification change.
TARIFS = {
    "gemini-2.5-pro": (1.25, 10.0),
    "gemini-3.1-pro-preview": (2.0, 12.0),
    "gemini-2.5-flash": (0.30, 2.50),
    "gemini-3.8-flash": (0.30, 2.50),
}


class GenerateurGemini:
    def __init__(self, modele: str | None = None, cle: str | None = None) -> None:
        from google import genai

        self._nom = modele or os.environ.get("GEMINI_MODELE") or MODELE_DEFAUT
        self._client = genai.Client(api_key=cle or os.environ["GEMINI_API_KEY"])

    @property
    def identifiant_modele(self) -> str:
        return self._nom

    def _flux_avec_reprise(self, *, tentatives: int = 4, **kwargs):  # noqa: ANN202
        from google.genai import errors

        for essai in range(tentatives):
            try:
                return self._client.models.generate_content_stream(**kwargs)
            except errors.ServerError:
                if essai == tentatives - 1:
                    raise
                # exponentiel + gigue, pour ne pas resynchroniser les reprises
                time.sleep((2 ** essai) + random.random())
            except errors.ClientError as exc:
                if getattr(exc, "code", None) != 429 or essai == tentatives - 1:
                    raise
                time.sleep((2 ** essai) * 2 + random.random())
        raise RuntimeError("reprises épuisées")

    def repondre(
        self, question: str, passages: list[Passage], contexte: dict, carte: str,
    ) -> Iterator[dict]:
        from google.genai import types

        systeme = p.REGLES + ("\n\n" + carte if carte else "")
        morceaux = [p.passages_en_texte(passages)]
        if (graphe := p.contexte_en_texte(contexte, passages)):
            morceaux.append(graphe)
        morceaux.append(f"Question : {question}")

        config = types.GenerateContentConfig(
            system_instruction=systeme,
            # Les jetons de réflexion du modèle s'imputent sur ce budget :
            # mesuré à ~1 250 pour une question de routine, contre ~200 pour la
            # réponse elle-même. À 2 048, une question à réflexion un peu plus
            # longue faisait couper le texte au milieu d'une phrase
            # (FinishReason.MAX_TOKENS), sans que rien ne le signale.
            max_output_tokens=4096,
            temperature=0.2,   # une réponse sourcée n'a pas à être créative
        )
        # Les 503 « high demand » sont fréquents et transitoires sur les modèles
        # pro : sans reprise, la moitié d'une campagne d'évaluation est perdue.
        flux = self._flux_avec_reprise(
            model=self._nom, contents="\n\n".join(morceaux), config=config)

        texte = ""
        usage = Usage()
        tronquee = False
        for evenement in flux:
            if evenement.text:
                texte += evenement.text
                yield {"type": "delta", "texte": evenement.text}
            for candidat in (evenement.candidates or []):
                if candidat.finish_reason and candidat.finish_reason.name != "STOP":
                    tronquee = True
            if (u := getattr(evenement, "usage_metadata", None)):
                usage = Usage(
                    entree=u.prompt_token_count or 0,
                    cache_lu=getattr(u, "cached_content_token_count", 0) or 0,
                    sortie=u.candidates_token_count or 0,
                )

        entree_usd, sortie_usd = TARIFS.get(self._nom, (0.0, 0.0))
        usage.cout_usd = (usage.entree * entree_usd + usage.sortie * sortie_usd) / 1e6

        yield {
            "type": "fin",
            "reponse": Reponse(
                texte=texte.strip(),
                citations=[
                    Citation(source_index=int(n))
                    for n in dict.fromkeys(re.findall(r"\[S(\d+)\]", texte))
                ],
                usage=usage,
                modele=self._nom,
                tronquee=tronquee,
            ),
        }
