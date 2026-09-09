"""Assemblage du prompt — indépendant du fournisseur.

Ce qui est ici ne dépend d'aucune API : les règles de réponse, la carte du
corpus, la mise en forme des passages et du contexte de graphe. Les adaptateurs
(`infrastructure/llm/*`) traduisent ces éléments dans la forme qu'attend leur
fournisseur.
"""

from __future__ import annotations

from ascocid.domain.ports.recherche import Passage

REGLES = """\
Tu réponds à des producteurs et techniciens cidricoles à partir du Livre de \
Connaissances AsCoCid (IFPC / INRAE).

Ta réponse doit traiter la demande, pas indiquer où chercher.

Règles absolues :
1. N'affirme rien qui ne provienne des passages fournis. Aucune connaissance externe.
2. Si les passages ne permettent pas de répondre, dis-le franchement et propose la \
fiche ou le thème le plus proche. Une abstention nette vaut mieux qu'une réponse \
plausible. Commence alors ta réponse par « Le Livre de Connaissances ne traite pas ».
3. N'invente jamais un titre de fiche, un chiffre ou une valeur qui ne figure pas \
dans les passages. Aucune valeur numérique ne doit apparaître dans ta réponse si \
elle n'est pas écrite telle quelle dans un passage.
4. Si deux passages se contredisent, présente les deux et cite-les, sans arbitrer.
5. Réponds en français, avec le vocabulaire exact du référentiel.

CITATIONS — obligatoire :
Chaque phrase contenant une information issue des passages se termine par le \
marqueur de sa source, sous la forme [S1], [S2]… en reprenant le numéro indiqué \
devant le passage. Une phrase sans marqueur sera rejetée. N'utilise jamais un \
numéro qui ne correspond à aucun passage fourni.

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
    """Vue d'ensemble du livre, destinée au préfixe mis en cache."""
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
    lignes += ["", "Fiches de connaissance disponibles :"]
    for f in magasin.cx.execute(
        "SELECT titre FROM fiche WHERE type IN ('FICHE','FDC') ORDER BY titre"
    ):
        lignes.append(f"- {f['titre']}")
    return "\n".join(lignes)


def titre_passage(p: Passage) -> str:
    titre = p.titre_fiche
    if p.titre_section:
        titre += f" — {p.titre_section}"
    elif p.terme:
        titre += f" — définition de « {p.terme} »"
    return titre


def passages_en_texte(passages: list[Passage]) -> str:
    """Passages numérotés — la numérotation est le support des citations."""
    blocs = []
    for i, p in enumerate(passages, 1):
        blocs.append(f"[S{i}] {titre_passage(p)}\n{p.texte}")
    return "\n\n".join(blocs)


def contexte_en_texte(contexte: dict[int, dict], passages: list[Passage]) -> str:
    """Voisinage de graphe — pour situer, jamais pour affirmer."""
    vus = []
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
