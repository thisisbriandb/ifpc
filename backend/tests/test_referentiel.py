"""Le code suit le référentiel scientifique, et rien d'autre.

Ces tests lisent directement les tableaux de `referentiel-scientifique.md` §4
et vérifient que le moteur emploie exactement ces valeurs. Le document fait
autorité : un paramètre scientifique se modifie dans le document, et le code
suit — jamais l'inverse.

Ce qu'ils empêchent : la dérive silencieuse entre l'énoncé scientifique et son
implémentation. Elle s'était déjà produite — la majoration de 20 % pour
produits troubles avait disparu du code tout en occupant une section entière
et une colonne de chaque tableau du document. Un ingénieur vérifiant un calcul
contre le document en aurait conclu à un défaut de l'application.
"""

import re
from pathlib import Path

import pytest

import pasto

REFERENTIEL = Path(__file__).resolve().parents[2] / "referentiel-scientifique.md"


# ── Lecture du document ─────────────────────────────────────────────────────

def _lire_tableau(titre_section: str) -> list[list[str]]:
    """Renvoie les lignes de données du premier tableau suivant une section."""
    texte = REFERENTIEL.read_text(encoding="utf-8")
    depart = texte.index(titre_section)
    lignes = []
    dans_le_tableau = False
    for ligne in texte[depart:].splitlines()[1:]:
        ligne = ligne.strip()
        if ligne.startswith("|"):
            dans_le_tableau = True
            cellules = [c.strip() for c in ligne.strip("|").split("|")]
            # Ignorer la ligne de séparation (| :--- | ---: | …)
            if not all(set(c) <= set(":- ") for c in cellules):
                lignes.append(cellules)
        elif dans_le_tableau:
            break
    return lignes[1:]  # sans l'en-tête


def _cle(cellule: str) -> str:
    return cellule.strip("`")


def _nombre(cellule: str) -> float:
    return float(cellule.replace(",", ".").replace(" ", "").replace(" ", ""))


MICRO_DOCUMENTES = {
    _cle(l[0]): {
        "nom": l[1],
        "t_ref": _nombre(l[2]),
        "d_ref": _nombre(l[3]),
        "z": _nombre(l[4]),
        "vp_cible_min": _nombre(l[5]),
    }
    for l in _lire_tableau("### 4.1.")
}

PRODUITS_DOCUMENTES = {
    _cle(l[0]): {
        "nom": l[1],
        "microorganisme_defaut": _cle(l[2]),
        "vp_cible_min": _nombre(l[3]),
    }
    for l in _lire_tableau("### 4.2.")
}


class TestLectureDuDocument:
    """Garde-fou sur l'extraction elle-même : un tableau mal lu invaliderait tout."""

    def test_le_document_est_trouve(self):
        assert REFERENTIEL.is_file(), f"référentiel introuvable : {REFERENTIEL}"

    def test_les_deux_tableaux_sont_lus(self):
        assert len(MICRO_DOCUMENTES) == 9
        assert len(PRODUITS_DOCUMENTES) == 3

    def test_la_majoration_trouble_ne_figure_plus_au_document(self):
        # Retirée du code, elle doit l'être du document : c'est la divergence
        # qui a motivé ce liage.
        texte = REFERENTIEL.read_text(encoding="utf-8")
        section_courante = texte.split("## 6. Historique")[0]
        assert "trouble" not in section_courante.lower()
        assert "+20" not in section_courante
        # L'historique des révisions, lui, doit en garder la trace.
        assert "trouble" in texte.lower()


class TestMicroorganismes:

    def test_aucune_entree_en_trop_ni_manquante(self):
        assert set(pasto.MICROORGANISMES) == set(MICRO_DOCUMENTES)

    @pytest.mark.parametrize("cle", sorted(MICRO_DOCUMENTES))
    @pytest.mark.parametrize("champ", ["t_ref", "d_ref", "z", "vp_cible_min"])
    def test_les_parametres_correspondent(self, cle, champ):
        assert pasto.MICROORGANISMES[cle][champ] == pytest.approx(MICRO_DOCUMENTES[cle][champ]), (
            f"{cle}.{champ} : le moteur dit {pasto.MICROORGANISMES[cle][champ]}, "
            f"le référentiel dit {MICRO_DOCUMENTES[cle][champ]}"
        )

    @pytest.mark.parametrize("cle", sorted(MICRO_DOCUMENTES))
    def test_les_noms_correspondent(self, cle):
        assert pasto.MICROORGANISMES[cle]["nom"] == MICRO_DOCUMENTES[cle]["nom"]

    @pytest.mark.parametrize("cle", sorted(MICRO_DOCUMENTES))
    def test_la_vp_cible_vaut_quinze_fois_le_d(self, cle):
        # §3.1 : VP cible = 15 × D_ref. Une VP cible saisie à la main qui
        # s'écarterait de cette règle serait une incohérence du document.
        documente = MICRO_DOCUMENTES[cle]
        assert documente["vp_cible_min"] == pytest.approx(15.0 * documente["d_ref"])


class TestProduits:

    def test_aucun_produit_en_trop_ni_manquant(self):
        assert set(pasto.PRODUITS) == set(PRODUITS_DOCUMENTES)

    @pytest.mark.parametrize("cle", sorted(PRODUITS_DOCUMENTES))
    def test_le_microorganisme_de_reference_correspond(self, cle):
        assert pasto.PRODUITS[cle]["microorganisme_defaut"] == PRODUITS_DOCUMENTES[cle]["microorganisme_defaut"]

    @pytest.mark.parametrize("cle", sorted(PRODUITS_DOCUMENTES))
    def test_la_vp_cible_correspond(self, cle):
        assert pasto.PRODUITS[cle]["vp_cible_min"] == pytest.approx(PRODUITS_DOCUMENTES[cle]["vp_cible_min"])

    @pytest.mark.parametrize("cle", sorted(PRODUITS_DOCUMENTES))
    def test_le_nom_correspond(self, cle):
        assert pasto.PRODUITS[cle]["nom"] == PRODUITS_DOCUMENTES[cle]["nom"]

    @pytest.mark.parametrize("cle", sorted(PRODUITS_DOCUMENTES))
    def test_la_cible_du_produit_est_celle_de_son_microorganisme(self, cle):
        micro = PRODUITS_DOCUMENTES[cle]["microorganisme_defaut"]
        assert PRODUITS_DOCUMENTES[cle]["vp_cible_min"] == pytest.approx(
            MICRO_DOCUMENTES[micro]["vp_cible_min"]
        )

    def test_les_types_herites_sont_ramenes_a_leur_entree(self):
        # §4.2 : les anciens types restent acceptés en entrée.
        assert pasto.normaliser_product_type("cidre_demi_sec") == "cidre_doux"
        assert pasto.normaliser_product_type("cidre_extra_brut") == "cidre_brut"
        for cible in pasto.ALIAS_PRODUITS.values():
            assert cible in PRODUITS_DOCUMENTES


class TestCiblesEvaluees:
    """§4.3 : quelles cibles sont évaluées, et dans quel mode."""

    def test_le_jus_de_pomme_est_evalue_sur_ses_quatre_cibles(self):
        classiques = [m["key"] for m in pasto.PRODUITS["jus_pomme"]["microorganismes_associes"]
                      if m["classique"]]
        assert set(classiques) == {"byssochlamys_fulva", "alicyclo_std", "saccharo_jus", "ecoli"}

    @pytest.mark.parametrize("produit, cible", [
        ("cidre_doux", "saccharo_cidre"),
        ("cidre_brut", "saccharo_cidre_low"),
    ])
    def test_les_cidres_ont_une_cible_classique_unique(self, produit, cible):
        classiques = [m["key"] for m in pasto.PRODUITS[produit]["microorganismes_associes"]
                      if m["classique"]]
        assert classiques == [cible]

    @pytest.mark.parametrize("produit", ["jus_pomme", "cidre_doux", "cidre_brut"])
    def test_toute_cible_associee_existe_au_referentiel(self, produit):
        for associe in pasto.PRODUITS[produit]["microorganismes_associes"]:
            assert associe["key"] in MICRO_DOCUMENTES
