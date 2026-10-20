"""Cartes conceptuelles lues depuis le SVG : relations, cases, suites, niveaux.

Chaque test dessine une carte miniature — cases en images incrustées, comme
dans l'export d'AsCoCid, libellés en texte, flèches pleines — et vérifie un
des pièges rencontrés sur les vraies cartes : libellé coupé en morceaux ou sur
deux lignes, relation à deux colonnes, suite ordonnée, carte à deux niveaux,
nombres incohérents (signalés plutôt que devinés).
"""

from __future__ import annotations

import base64

import pytest

pymupdf = pytest.importorskip("pymupdf")

from ascocid.application.ingestion import transcriptions_images as ti  # noqa: E402
from ascocid.infrastructure.parsing import carte_svg  # noqa: E402


def _png() -> str:
    pix = pymupdf.Pixmap(pymupdf.csRGB, pymupdf.IRect(0, 0, 8, 8), False)
    pix.set_rect(pix.irect, (230, 240, 250))
    return base64.b64encode(pix.tobytes("png")).decode()


PNG = _png()


def case(x: float, y: float, l: float, h: float, *textes: str) -> str:
    lignes = "".join(f'<text x="{x + 6}" y="{y + 16 + 15 * i}" font-size="12">{t}</text>'
                     for i, t in enumerate(textes))
    return (f'<image x="{x}" y="{y}" width="{l}" height="{h}" '
            f'href="data:image/png;base64,{PNG}"/>{lignes}')


def libelle(x: float, y: float, texte: str) -> str:
    return f'<text x="{x}" y="{y}" font-size="12">{texte}</text>'


def fleche(x: float, y: float) -> str:
    return f'<path d="M {x} {y} L {x + 6} {y} L {x + 6} {y + 14} L {x} {y + 14} Z" fill="#000000"/>'


def carte(*elements: str) -> bytes:
    return ('<svg xmlns="http://www.w3.org/2000/svg" width="1000" height="700">'
            + "".join(elements) + "</svg>").encode()


NOTION = case(300, 20, 200, 40, "La notion")


def test_relations_et_colonnes_appariees_de_gauche_a_droite():
    lue = carte_svg.lire(carte(
        NOTION,
        libelle(40, 150, "est une"), libelle(400, 150, "a pour causes"),
        case(20, 180, 150, 40, "Une modalité"),
        case(380, 180, 160, 40, "Cause A"), case(380, 240, 160, 40, "Cause B"),
    ))
    assert lue.notion == "La notion" and lue.anomalies == []
    assert [(r.libelle, [e.texte for e in r.elements]) for r in lue.relations] == [
        ("est une", ["Une modalité"]), ("a pour causes", ["Cause A", "Cause B"])]
    assert not lue.relations[1].ordonnee            # pas de flèches : une simple liste


def test_libelle_coupe_en_morceaux_ou_sur_deux_lignes_est_recolle():
    lue = carte_svg.lire(carte(
        NOTION,
        libelle(30, 150, "a pour"), libelle(78, 150, "fonctions"),     # grands espaces
        libelle(420, 142, "est constituée"), libelle(455, 154, "de"),  # deux lignes
        case(20, 180, 160, 40, "Fonction 1"),
        case(400, 180, 160, 40, "Partie 1"),
    ))
    assert [r.libelle for r in lue.relations] == ["a pour fonctions", "est constituée de"]
    assert lue.anomalies == []


def test_suite_ordonnee_quand_des_fleches_relient_les_cases():
    lue = carte_svg.lire(carte(
        NOTION,
        libelle(420, 150, "regroupent"),
        case(400, 180, 160, 40, "La pomme dans l'arbre"), fleche(477, 222),
        case(400, 240, 160, 40, "La pomme au sol"), fleche(477, 282),
        case(400, 300, 160, 40, "La pomme livrée"),
    ))
    [r] = lue.relations
    assert r.ordonnee
    t = ti.depuis_carte(1310, "CMAP_POMMES", "Les pommes", "sha", lue)
    phrase = dict(ti.passages(t))["regroupent"]
    assert phrase == ("« Les pommes » regroupent (dans l'ordre) : La pomme dans l'arbre → "
                      "La pomme au sol → La pomme livrée.")


def test_une_relation_peut_avoir_deux_colonnes_cote_a_cote():
    lue = carte_svg.lire(carte(
        NOTION,
        libelle(60, 150, "est une"), libelle(330, 150, "regroupe"), libelle(700, 150, "a pour fonction"),
        case(20, 180, 140, 40, "Opération"),
        case(230, 180, 140, 40, "En échangeur"), case(380, 180, 140, 40, "En cuves"),
        case(680, 180, 160, 40, "Refroidir"),
    ))
    assert lue.anomalies == []
    assert {r.libelle: [e.texte for e in r.elements] for r in lue.relations}["regroupe"] == [
        "En échangeur", "En cuves"]


def test_carte_a_deux_niveaux():
    lue = carte_svg.lire(carte(
        NOTION,
        libelle(200, 150, "regroupe"),
        case(150, 180, 200, 40, "Procédures du matériel"),
        case(230, 230, 200, 30, "La chaîne de pressage"),
        case(230, 265, 200, 30, "Les cuves"),
        case(500, 180, 200, 40, "Procédures des sols"),
        case(580, 230, 200, 30, "Le local de pressage"),
    ))
    [r] = lue.relations
    assert [(e.parent, e.texte) for e in r.elements] == [
        ("", "Procédures du matériel"),
        ("Procédures du matériel", "La chaîne de pressage"),
        ("Procédures du matériel", "Les cuves"),
        ("", "Procédures des sols"),
        ("Procédures des sols", "Le local de pressage"),
    ]
    t = ti.depuis_carte(1, "CMAP_NETTOYAGE", "Le plan de nettoyage", "sha", lue)
    assert dict(ti.passages(t))["regroupe"] == (
        "« Le plan de nettoyage » regroupe : Procédures du matériel (détail : La chaîne de "
        "pressage ; Les cuves) ; Procédures des sols (détail : Le local de pressage).")


def test_moins_de_colonnes_que_de_relations_signale_et_non_indexe():
    lue = carte_svg.lire(carte(
        NOTION,
        libelle(40, 150, "est une"), libelle(300, 150, "a pour"), libelle(600, 150, "entraîne"),
        case(20, 180, 150, 40, "Une seule colonne"),
    ))
    assert lue.anomalies and "rattachement à vérifier" in lue.anomalies[0]
    t = ti.depuis_carte(1, "CMAP_X", "X", "sha", lue)
    assert not t.indexable
    # Une fois relue, elle entre dans l'assistant.
    assert t.model_copy(update={"statut": "valide"}).indexable


def test_carte_transcrite_relue_a_l_identique(tmp_path):
    lue = carte_svg.lire(carte(
        NOTION, libelle(420, 150, "regroupent"),
        case(400, 180, 160, 40, "A"), fleche(477, 222), case(400, 240, 160, 40, "B"),
    ))
    t = ti.depuis_carte(1, "CMAP_X", "X", "sha", lue)
    chemin = tmp_path / "CMAP_X.toml"
    chemin.write_text(ti.en_toml(t), encoding="utf-8")
    relue = ti.charger(chemin)
    assert relue == t and relue.rubriques[0].ordonnee
