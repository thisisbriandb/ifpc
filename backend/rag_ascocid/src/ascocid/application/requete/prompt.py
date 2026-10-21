"""Assemblage du prompt — indépendant du fournisseur.

Ce qui est ici ne dépend d'aucune API : les règles de réponse, la carte du
corpus, la mise en forme des passages et du contexte de graphe. Les adaptateurs
(`infrastructure/llm/*`) traduisent ces éléments dans la forme qu'attend leur
fournisseur.
"""

from __future__ import annotations

import re
from collections.abc import Iterable

from ascocid.application.ingestion.schemas import Transcription, ordre
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

Quand le contexte de navigation le permet, situe la réponse dans le processus \
(« cette opération intervient après la clarification »).

Notations : écris les formules chimiques, puissances et unités avec les \
caractères Unicode — H₂SO₄, SO₂, CO₂, 10⁶, 10⁻³, m³, °C, µm, ±. Jamais de LaTeX : \
ni $…$, ni \\mathrm, ni ^{…} ou _{…}, que la page n'affiche pas. Les valeurs \
numériques restent exactement celles des passages.\
"""

# Longueur : courte par défaut ; détaillée quand l'utilisateur clique « Voir
# plus ». Placée après les règles, pour que le préfixe commun (règles + carte du
# corpus) reste le même dans les deux cas.
LONGUEUR_COURTE = """Longueur : réponse courte, de cinq à huit lignes au plus — une liste compte une \
ligne par élément, huit éléments au plus. Va à l'essentiel de la demande, sans \
développer ce qui n'est pas demandé : l'utilisateur peut demander une réponse \
détaillée s'il veut en savoir plus.\
"""

LONGUEUR_DETAILLEE = """Longueur : l'utilisateur a demandé une réponse détaillée. Développe en quinze à \
trente lignes : mécanismes, conditions, valeurs, cas particuliers et étapes, \
tels que les passages les donnent, organisés en courtes parties ou en listes. \
Les règles de citation et d'abstention restent les mêmes : n'ajoute rien que les \
passages ne contiennent, et ne délaie pas — si les passages ne permettent pas \
d'aller plus loin, dis-le.\
"""


def reponse_courte_en_texte(texte: str) -> str:
    """La réponse courte déjà donnée, pour que « Voir plus » la complète.

    Sans elle, la réponse détaillée repartait de zéro et pouvait perdre ce que
    la courte disait (la conservation sous 4 °C jusqu'au conditionnement,
    disparue d'une réponse détaillée sur la température de fermentation).

    Ses numéros [S…] sont retirés : ils renvoient à la liste de passages de la
    réponse courte, que la réponse détaillée, plus fournie, numérote autrement.
    Recopiés, ils pointeraient vers de mauvais passages.
    """
    sans_marqueurs = re.sub(r"\s*\[\s*S[^\]]*\]", "", texte).strip()
    return ("Réponse courte déjà donnée à l'utilisateur. Reprends TOUT ce qu'elle "
            "contient — rien ne doit disparaître —, puis développe à partir des passages. "
            "Cite à nouveau chaque information avec les numéros des passages ci-dessus ; "
            "n'ajoute rien qu'ils ne contiennent :\n" + sans_marqueurs)


def systeme(carte: str = "", detaille: bool = False) -> str:
    """Le prompt système complet : règles, longueur demandée, carte du corpus."""
    morceaux = [REGLES, LONGUEUR_DETAILLEE if detaille else LONGUEUR_COURTE]
    if carte:
        morceaux.append(carte)
    return "\n\n".join(morceaux)


def carte_du_corpus(magasin, transcriptions: Iterable[Transcription] = ()) -> str:  # noqa: ANN001
    """Vue d'ensemble du livre, destinée au préfixe mis en cache.

    L'ordre des étapes vient de la transcription du schéma quand elle existe.
    Sans elle, les zones cliquables sont listées sans flèches : leur ordre dans
    la page n'est pas celui du procédé (« Récolte » y arrive neuvième), et une
    suite « A → B » présentée au modèle serait un enchaînement faux.
    """
    transcrits = {t.idoc: t for t in transcriptions}
    lignes = ["Structure du Livre de Connaissances AsCoCid.", ""]
    cartes = magasin.cx.execute(
        "SELECT f.idoc, f.titre FROM fiche f JOIN carte c ON c.idoc=f.idoc"
        " WHERE f.type IN ('PROCESS','MENU','GRAPHE') ORDER BY f.idoc"
    ).fetchall()
    lignes.append("Diagrammes de procédé :")
    for c in cartes:
        t = transcrits.get(c["idoc"])
        if t is not None and t.etapes:
            lignes.append(f"- {c['titre']} (dans l'ordre) : "
                          + " → ".join(e.libelle for e in ordre(t)[:14]))
            continue
        etapes = magasin.cx.execute(
            "SELECT libelle FROM zone WHERE carte_idoc=? ORDER BY ordre", (c["idoc"],)
        ).fetchall()
        lignes.append(f"- {c['titre']} — rubriques : "
                      + ", ".join(e["libelle"] for e in etapes[:12]))
    lignes += ["", "Fiches de connaissance disponibles :"]
    for f in magasin.cx.execute(
        "SELECT titre FROM fiche WHERE type IN ('FICHE','FDC') ORDER BY titre"
    ):
        lignes.append(f"- {f['titre']}")
    documents = magasin.cx.execute(
        "SELECT titre FROM fiche WHERE type='DOC' ORDER BY titre").fetchall()
    if documents:
        lignes += ["", "Documents ajoutés par l'IFPC (hors AsCoCid) :"]
        lignes += [f"- {d['titre']}" for d in documents]
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
