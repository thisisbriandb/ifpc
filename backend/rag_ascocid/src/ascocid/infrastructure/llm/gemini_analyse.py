"""Analyse de la demande par un modèle rapide, en une requête.

Sortie structurée imposée par schéma : intention, requête de recherche réécrite,
outil concerné, entités. La réécriture est ce qui rend le multi-tours possible
sans appel supplémentaire — « et pour les pommes douces ? » devient une requête
autonome.

Modèle volontairement plus petit que celui de rédaction : la tâche est un
étiquetage, pas une synthèse. Elle doit coûter quelques centaines de
millisecondes, pas quelques secondes.
"""

from __future__ import annotations

import json
import os

from ascocid.domain.ports.analyse import Analyse, Intention

# Un modèle « lite » suffit largement pour un étiquetage, et il est trois fois
# plus rapide : 1,0 s de médiane contre 3,2 s pour le flash complet, à qualité
# de classification égale sur les cas de test.
MODELE_DEFAUT = "gemini-3.1-flash-lite"

CONSIGNE = """\
Tu analyses la demande d'un producteur ou technicien cidricole adressée à un \
assistant adossé au Livre de Connaissances AsCoCid (IFPC / INRAE).

Tu ne réponds pas à la question. Tu la classes et tu la reformules.

INTENTIONS possibles :
- corpus : question de fond sur le cidre, ses procédés, ses phénomènes. Cas par défaut.
- lookup : l'utilisateur demande une fiche précise par son nom.
- navigation : il demande la structure d'un processus, l'enchaînement des étapes, \
ce qui vient avant ou après.
- outil : il veut un CALCUL SUR SES PROPRES DONNÉES (son lot, sa cuve, sa mesure), \
que seul un outil de la plateforme peut faire.
- conversation : salutation, remerciement, question sur l'assistant lui-même.
- clarification : demande trop vague ou ambiguë pour lancer une recherche.

DISTINCTION DÉCISIVE entre corpus et outil :
- « Pourquoi pasteuriser un cidre ? » → corpus (c'est une explication)
- « Quel barème pour mon lot à 65 °C ? » → outil (c'est un calcul sur son cas)
Le sujet ne tranche pas ; c'est la présence d'un cas particulier à calculer qui \
tranche. En cas d'hésitation, choisis corpus : mieux vaut répondre et proposer \
l'outil que de retenir une information que le Livre contenait.

REQUETE_RECHERCHE : reformule la demande en une requête autonome et explicite, \
en vocabulaire du référentiel. Si la demande est une relance qui s'appuie sur \
l'échange précédent, intègre le contexte manquant. Développe les abréviations \
d'atelier (brett → Brettanomyces, ferm → fermentation, MV → masse volumique, \
TAV → titre alcoométrique volumique). Garde-la courte.

OUTILS DISPONIBLES SUR LA PLATEFORME :
{outils}

CONFIANCE : entre 0 et 1, ta certitude sur l'intention.\
"""

SCHEMA = {
    "type": "object",
    "properties": {
        "intention": {"type": "string", "enum": [i.value for i in Intention]},
        "requete_recherche": {"type": "string"},
        "outil_suggere": {"type": "string"},
        "entites": {
            "type": "object",
            "properties": {
                "processus": {"type": "string"},
                "variete": {"type": "string"},
                "produit": {"type": "string"},
            },
        },
        "confiance": {"type": "number"},
    },
    "required": ["intention", "requete_recherche", "confiance"],
}


class AnalyseurGemini:
    def __init__(self, registre, modele: str | None = None,  # noqa: ANN001
                 cle: str | None = None) -> None:
        from google import genai

        self._nom = modele or os.environ.get("GEMINI_MODELE_ANALYSE") or MODELE_DEFAUT
        self._client = genai.Client(api_key=cle or os.environ["GEMINI_API_KEY"])
        self._consigne = CONSIGNE.format(outils=registre.resume_pour_prompt())

    @property
    def identifiant_modele(self) -> str:
        return self._nom

    def analyser(self, question: str, historique: list[str] | None = None) -> Analyse:
        from google.genai import types

        contenu = question
        if historique:
            # Deux tours suffisent : au-delà, le contexte dérive plus qu'il n'aide.
            echange = "\n".join(historique[-2:])
            contenu = f"Échange précédent :\n{echange}\n\nNouvelle demande : {question}"

        r = self._client.models.generate_content(
            model=self._nom,
            contents=contenu,
            config=types.GenerateContentConfig(
                system_instruction=self._consigne,
                response_mime_type="application/json",
                response_schema=SCHEMA,
                temperature=0.0,      # un étiquetage n'a pas à varier
                max_output_tokens=300,
                # Sans cela le modèle délibère plusieurs secondes sur une tâche
                # d'étiquetage : mesuré jusqu'à 16 s, pour un gain nul.
                thinking_config=types.ThinkingConfig(thinking_budget=0),
            ),
        )
        # Une réponse vide ou tronquée arrive (modèle saturé, sortie coupée) :
        # on lève, l'orchestrateur retombe alors sur le chemin corpus.
        texte = (r.text or "").strip()
        if not texte:
            raise ValueError("réponse d'analyse vide")
        brut = json.loads(texte)
        outil = (brut.get("outil_suggere") or "").strip().lower()
        # Le modèle écrit volontiers « aucun » là où le schéma attend l'absence.
        outil = None if outil in ("", "aucun", "none", "null", "n/a") else outil
        return Analyse(
            intention=Intention(brut.get("intention", "corpus")),
            requete_recherche=brut.get("requete_recherche", question),
            outil_suggere=outil,
            entites={k: v for k, v in (brut.get("entites") or {}).items() if v},
            confiance=float(brut.get("confiance", 0.5)),
            origine="modele",
        )
