"""Génération de la réponse (spec 05).

Le modèle ne sert qu'à **formuler** et **rattacher**. Il n'apporte aucune
connaissance propre : tout ce qu'il affirme vient des passages fournis, et
chaque affirmation porte sa source. C'est la contrainte qui rend l'outil
utilisable sur un référentiel technique.

Ordre du prompt (le plus stable en premier — c'est ce qui rend le cache
exploitable) : system figé → carte du corpus → passages → question.
"""

from __future__ import annotations

from collections.abc import Iterator

from ascocid.domain.ports.recherche import Passage

MODELE = "claude-opus-5"

REGLES = """\
Tu réponds à des producteurs et techniciens cidricoles à partir du Livre de \
Connaissances AsCoCid (IFPC / INRAE).

Ta réponse doit traiter la demande, pas indiquer où chercher.

Règles absolues :
1. N'affirme rien qui ne provienne des passages fournis. Aucune connaissance externe.
2. Si les passages ne permettent pas de répondre, dis-le franchement et propose la \
fiche ou le thème le plus proche. Une abstention nette vaut mieux qu'une réponse \
plausible.
3. N'invente jamais un titre de fiche, un chiffre ou une référence qui ne figure pas \
dans les passages.
4. Si deux passages se contredisent, présente les deux et cite-les, sans arbitrer.
5. Réponds en français, avec le vocabulaire exact du référentiel.

Forme de la réponse — adapte-la à la demande :
- question factuelle → la réponse directe, en une à trois phrases ;
- procédure → les étapes dans l'ordre, en liste ;
- question d'arbitrage → dis explicitement de quoi cela dépend, puis donne les \
plages ou les cas. Ne donne jamais une valeur unique quand le référentiel en fait \
une question de contexte : ce serait répondre à côté de la demande.

Reste bref : trois à huit phrases sauf si la demande appelle une liste d'étapes. \
Quand le contexte de navigation le permet, situe la réponse dans le processus \
(« cette opération intervient après la clarification »).\
"""


def carte_du_corpus(magasin) -> str:  # noqa: ANN001
    """Vue d'ensemble du livre, placée dans le préfixe mis en cache.

    Quelques milliers de tokens identiques pour toutes les requêtes : elle donne
    au modèle la structure d'ensemble qu'aucun passage récupéré ne contient, et
    ne coûte qu'une lecture de cache (~0,1× le prix d'entrée).
    """
    lignes = ["Structure du Livre de Connaissances AsCoCid.", ""]
    cartes = magasin.cx.execute(
        "SELECT f.idoc, f.titre FROM fiche f JOIN carte c ON c.idoc=f.idoc"
        " WHERE f.type IN ('PROCESS','MENU','GRAPHE') ORDER BY f.idoc"
    ).fetchall()
    lignes.append("Diagrammes de procédé :")
    for c in cartes:
        etapes = magasin.cx.execute(
            "SELECT libelle FROM zone WHERE carte_idoc=? ORDER BY ordre", (c["idoc"],)
        ).fetchall()
        lignes.append(f"- {c['titre']} : " + " → ".join(e["libelle"] for e in etapes[:12]))
    lignes.append("")
    lignes.append("Fiches de connaissance disponibles :")
    for f in magasin.cx.execute(
        "SELECT titre FROM fiche WHERE type IN ('FICHE','FDC') ORDER BY titre"
    ):
        lignes.append(f"- {f['titre']}")
    return "\n".join(lignes)


def _bloc_document(p: Passage, index: int) -> dict:
    """Un passage → bloc `document` à contenu personnalisé, citations activées.

    Le type « content » (plutôt que texte brut) fait remonter des citations
    localisées au bloc près, que le modèle de données retraduit en fiche +
    section (spec 05 §4).
    """
    titre = p.titre_fiche
    if p.titre_section:
        titre += f" — {p.titre_section}"
    elif p.terme:
        titre += f" — définition de « {p.terme} »"
    return {
        "type": "document",
        "title": titre[:200],
        "context": f"Fiche AsCoCid n°{p.fiche_idoc} (source {index + 1})",
        "source": {"type": "content", "content": [{"type": "text", "text": p.texte}]},
        "citations": {"enabled": True},
    }


def _bloc_contexte_graphe(contexte: dict[int, dict], passages: list[Passage]) -> str:
    """Le voisinage de graphe, en texte, séparé des documents cités.

    Volontairement hors des blocs `document` : c'est du contexte de navigation,
    pas une source citable. Le modèle peut s'en servir pour situer, jamais pour
    affirmer.
    """
    vus: list[str] = []
    for idoc in dict.fromkeys(p.fiche_idoc for p in passages):
        c = contexte.get(idoc)
        if not c:
            continue
        titre = next(p.titre_fiche for p in passages if p.fiche_idoc == idoc)
        morceaux = []
        if c["cartes_parentes"]:
            morceaux.append("atteinte depuis : "
                            + ", ".join(f"{t} ({z})" for t, z in c["cartes_parentes"]))
        if c["mene_vers"]:
            morceaux.append("mène vers : " + ", ".join(c["mene_vers"]))
        if c["voir_aussi"]:
            morceaux.append("voir aussi : " + ", ".join(c["voir_aussi"]))
        if morceaux:
            vus.append(f"- {titre} — " + " ; ".join(morceaux))
    if not vus:
        return ""
    return ("Contexte de navigation (pour situer la réponse dans le processus ; "
            "ne pas citer comme source) :\n" + "\n".join(vus))


def construire_requete(
    question: str, passages: list[Passage], contexte: dict[int, dict], carte: str,
) -> dict:
    contenu: list[dict] = [_bloc_document(p, i) for i, p in enumerate(passages)]
    graphe = _bloc_contexte_graphe(contexte, passages)
    if graphe:
        contenu.append({"type": "text", "text": graphe})
    contenu.append({"type": "text", "text": f"Question : {question}"})

    return {
        "model": MODELE,
        "max_tokens": 2048,
        "system": [
            # Deux points de coupure, aux deux frontières de stabilité :
            # les règles ne bougent jamais, la carte à chaque réindexation.
            {"type": "text", "text": REGLES,
             "cache_control": {"type": "ephemeral"}},
            {"type": "text", "text": carte,
             "cache_control": {"type": "ephemeral"}},
        ],
        "thinking": {"type": "adaptive"},
        "output_config": {"effort": "medium"},
        "messages": [{"role": "user", "content": contenu}],
    }


def repondre_en_flux(client, requete: dict) -> Iterator[dict]:  # noqa: ANN001
    """Diffuse la réponse. Le TTFT est ce que l'utilisateur perçoit."""
    with client.messages.stream(**requete) as flux:
        for evenement in flux:
            if evenement.type == "content_block_delta":
                d = evenement.delta
                if getattr(d, "type", "") == "text_delta":
                    yield {"type": "delta", "texte": d.text}
                elif getattr(d, "type", "") == "citations_delta":
                    yield {"type": "citation", "citation": d.citation}
        final = flux.get_final_message()
    yield {
        "type": "fin",
        "usage": final.usage,
        "stop_reason": final.stop_reason,
        "citations": [
            c for bloc in final.content
            if getattr(bloc, "type", "") == "text"
            for c in (getattr(bloc, "citations", None) or [])
        ],
    }
