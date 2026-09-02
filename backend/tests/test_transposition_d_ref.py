"""Critère de conformité k = VP / D en mode expert.

Le défaut d'origine : la VP est calculée à la température de référence retenue,
mais le D venait tel quel de la table, mesuré au Tref du microorganisme. Quand
un expert saisissait un autre Tref, k mélangeait deux références et se trouvait
faussé de 10^((Tref_table − Tref_saisi)/z). Sur une souche de z = 4, saisir
72 °C au lieu de 60 °C divisait k par 1000, et le même traitement basculait de
« conforme » à « insuffisant » — alors que le résultat physique est invariant
par changement de référence.
"""

import pytest

import pasto

CYCLE = {"temperatures": [20.0, 72.0, 72.0, 20.0], "temps": [0.0, 1.0, 11.0, 12.0]}


def _evaluer(**kwargs):
    return pasto.evaluer_pasteurisation(
        product_type="cidre_doux", unite_temps="minute", **CYCLE, **kwargs
    )


class TestTranspositionDRef:

    def test_sans_changement_de_reference_le_d_est_inchange(self):
        assert pasto.transposer_d_ref(1.1, 60.0, 60.0, 4.0) == 1.1

    def test_une_reference_plus_haute_donne_un_d_plus_court(self):
        # D(72) = 1,1 × 10^((60−72)/4) = 1,1 × 10⁻³
        assert pasto.transposer_d_ref(1.1, 60.0, 72.0, 4.0) == pytest.approx(0.0011)

    def test_une_reference_plus_basse_donne_un_d_plus_long(self):
        assert pasto.transposer_d_ref(1.1, 60.0, 48.0, 4.0) == pytest.approx(1100.0)

    def test_la_transposition_est_reversible(self):
        d72 = pasto.transposer_d_ref(1.1, 60.0, 72.0, 4.0)
        assert pasto.transposer_d_ref(d72, 72.0, 60.0, 4.0) == pytest.approx(1.1)

    @pytest.mark.parametrize("d_ref, z", [(None, 4.0), (0.0, 4.0), (-1.0, 4.0), (1.1, 0.0), (1.1, -4.0)])
    def test_parametres_inexploitables_ne_produisent_pas_de_d(self, d_ref, z):
        assert pasto.transposer_d_ref(d_ref, 60.0, 72.0, z) is None

    def test_un_ecart_absurde_ne_fait_pas_planter(self):
        # 10^(−5000) s'annule en flottant : ne pas statuer vaut mieux
        # qu'une division par zéro.
        assert pasto.transposer_d_ref(1.1, 60.0, 5060.0, 1.0) is None


class TestInvarianceDuVerdict:
    """Le test qui aurait arrêté le défaut."""

    def test_k_ne_depend_pas_de_la_reference_choisie(self):
        reference = _evaluer()
        transpose = _evaluer(microorganisme="saccharo_cidre", t_ref=72.0)
        assert transpose["k_calc"] == pytest.approx(reference["k_calc"], rel=1e-3)

    def test_le_verdict_ne_depend_pas_de_la_reference_choisie(self):
        assert _evaluer()["statut"] == _evaluer(microorganisme="saccharo_cidre", t_ref=72.0)["statut"]

    @pytest.mark.parametrize("t_ref_saisi", [48.0, 55.0, 60.0, 65.0, 72.0])
    def test_invariance_sur_toute_une_plage_de_references(self, t_ref_saisi):
        reference = _evaluer()
        transpose = _evaluer(microorganisme="saccharo_cidre", t_ref=t_ref_saisi)
        assert transpose["k_calc"] == pytest.approx(reference["k_calc"], rel=1e-3)

    def test_la_vp_change_bien_avec_la_reference(self):
        # La VP dépend de la référence — c'est k, le rapport, qui n'en dépend pas.
        assert _evaluer(microorganisme="saccharo_cidre", t_ref=72.0)["vp"] < _evaluer()["vp"]


class TestFicheDeParametres:

    def test_le_d_affiche_accompagne_le_tref_affiche(self):
        resultat = _evaluer(microorganisme="saccharo_cidre", t_ref=72.0)
        assert resultat["parametres"]["t_ref"] == 72.0
        assert resultat["parametres"]["d_ref"] == pytest.approx(0.0011, rel=1e-3)

    def test_hors_mode_expert_le_d_reste_celui_de_la_table(self):
        resultat = _evaluer()
        assert resultat["parametres"]["t_ref"] == 60.0
        assert resultat["parametres"]["d_ref"] == 1.1

    def test_un_d_transpose_tres_court_ne_s_affiche_pas_zero(self):
        resultat = _evaluer(microorganisme="saccharo_cidre", t_ref=90.0)
        assert resultat["parametres"]["d_ref"] > 0

    def test_le_z_saisi_sert_a_la_transposition(self):
        # Changer z change la pente de la courbe de résistance, donc le D
        # transposé : deux z différents ne peuvent pas donner le même k.
        k_z4 = _evaluer(microorganisme="saccharo_cidre", t_ref=72.0, z=4.0)["k_calc"]
        k_z8 = _evaluer(microorganisme="saccharo_cidre", t_ref=72.0, z=8.0)["k_calc"]
        assert k_z4 != k_z8
