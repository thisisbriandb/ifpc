"""Le moteur refuse plutôt que d'inventer des paramètres.

Le défaut d'origine : une clé de micro-organisme inconnue faisait retomber le
moteur sur $T_{ref}$ = 60 °C et z = 7,0 — un z qui n'appartient à aucune souche
du référentiel — et un verdict était rendu malgré tout. Un $D_{ref}$ absent
faisait de même avec un facteur 5 là où la règle en pose 15.

Le chemin n'était pas théorique : la page de contrôle restaurait le nom affiché
du micro-organisme là où le sélecteur attend sa clé technique. Rouvrir une
analyse depuis l'historique puis la relancer suffisait à basculer un cidre de
« conforme » à « insuffisant », sans message.
"""

import pytest

import pasto

CYCLE = {
    "temperatures": [20.0, 64.0, 64.0, 20.0],
    "temps": [0.0, 1.0, 6.0, 7.0],
    "product_type": "cidre_doux",
    "unite_temps": "minute",
}


def _evaluer(**kwargs):
    return pasto.evaluer_pasteurisation(**CYCLE, **kwargs)


class TestMicroorganismeInconnu:

    @pytest.mark.parametrize("cle", [
        "inconnu_xyz",
        "Saccharomyces cerevisiae 1",   # le nom affiché, pas la clé
        "Byssochlamys fulva",
        "SACCHARO_CIDRE",               # la casse compte
    ])
    def test_une_cle_inconnue_est_refusee(self, cle):
        with pytest.raises(ValueError, match="Microorganisme inconnu"):
            _evaluer(microorganisme=cle)

    def test_le_message_enumere_les_valeurs_acceptees(self):
        with pytest.raises(ValueError) as e:
            _evaluer(microorganisme="inconnu_xyz")
        for attendue in pasto.MICROORGANISMES:
            assert attendue in str(e.value)

    def test_une_chaine_vide_vaut_absence_de_choix(self):
        # Le sélecteur produit "" quand rien n'est choisi : c'est le
        # microorganisme de référence du produit qui s'applique, sans refus.
        assert _evaluer(microorganisme="")["parametres"]["microorganisme_key"] == "saccharo_cidre"

    def test_une_cle_connue_passe(self):
        assert _evaluer(microorganisme="saccharo_cidre")["statut"] == "conforme"

    def test_une_cle_heritee_passe_par_son_alias(self):
        resultat = pasto.evaluer_pasteurisation(
            temperatures=[20.0, 95.0, 95.0, 20.0], temps=[0.0, 1.0, 31.0, 32.0],
            product_type="jus_pomme", microorganisme="alicyclo_res", unite_temps="minute",
        )
        assert resultat["parametres"]["microorganisme_key"] == "alicyclo_std"


class TestParametresInexploitables:

    @pytest.mark.parametrize("z", [0.0, -4.0])
    def test_un_z_nul_ou_negatif_est_refuse(self, z):
        # z est au dénominateur du taux létal : sans ce garde-fou, le calcul
        # échouait plus loin sur une division par zéro.
        with pytest.raises(ValueError, match="strictement positif"):
            _evaluer(microorganisme="saccharo_cidre", z=z)

    def test_un_ecart_de_reference_absurde_est_refuse(self):
        # 10^(-5000) s'annule en flottant : le D transposé n'existe plus.
        with pytest.raises(ValueError, match="[Ii]mpossible de ramener"):
            _evaluer(microorganisme="saccharo_cidre", t_ref=5060.0, z=1.0)


class TestAucunVerdictSurParametresInventes:
    """Le test qui aurait arrêté le défaut."""

    def test_le_nom_affiche_ne_produit_plus_de_verdict(self):
        reference = _evaluer()
        assert reference["statut"] == "conforme"

        # Ce que la page de contrôle renvoyait après restauration d'une analyse.
        with pytest.raises(ValueError):
            _evaluer(microorganisme=reference["parametres"]["microorganisme"])

    def test_la_cle_restauree_redonne_le_meme_verdict(self):
        reference = _evaluer()
        rejoue = _evaluer(microorganisme=reference["parametres"]["microorganisme_key"])
        assert rejoue["vp"] == reference["vp"]
        assert rejoue["k_calc"] == reference["k_calc"]
        assert rejoue["statut"] == reference["statut"]

    def test_aucun_parametre_du_resultat_n_est_etranger_au_referentiel(self):
        parametres = _evaluer()["parametres"]
        micro = pasto.MICROORGANISMES[parametres["microorganisme_key"]]
        assert parametres["t_ref"] == micro["t_ref"]
        assert parametres["z"] == micro["z"]
        assert parametres["d_ref"] == pytest.approx(micro["d_ref"])


class TestCibleNonParametrable:
    """La VP cible vient du référentiel, jamais de l'appelant.

    Elle était transmise par l'interface depuis la configuration produit de
    l'administration. Elle ne décidait pas du verdict — celui-ci repose sur
    k >= 15 — mais s'affichait comme « cible » à côté de lui : l'écran
    annonçait un objectif qui n'était pas celui sur lequel on jugeait.
    """

    def test_la_cible_est_celle_du_microorganisme(self):
        resultat = _evaluer()
        micro = pasto.MICROORGANISMES[resultat["parametres"]["microorganisme_key"]]
        assert resultat["vp_cible"] == micro["vp_cible_min"]

    def test_la_cible_vaut_quinze_fois_le_d(self):
        resultat = _evaluer()
        micro = pasto.MICROORGANISMES[resultat["parametres"]["microorganisme_key"]]
        assert resultat["vp_cible"] == pytest.approx(15.0 * micro["d_ref"])

    def test_aucune_cible_ne_peut_etre_imposee(self):
        with pytest.raises(TypeError):
            pasto.evaluer_pasteurisation(**CYCLE, vp_cible=1000.0)

    @pytest.mark.parametrize("produit, attendue", [
        ("jus_pomme", 27.15), ("cidre_doux", 16.5), ("cidre_brut", 6.0),
    ])
    def test_chaque_produit_porte_la_cible_de_sa_souche(self, produit, attendue):
        resultat = pasto.evaluer_pasteurisation(
            temperatures=[20.0, 64.0, 64.0, 20.0], temps=[0.0, 1.0, 6.0, 7.0],
            product_type=produit, unite_temps="minute",
            microorganisme=pasto.PRODUITS[produit]["microorganisme_defaut"],
        )
        assert resultat["vp_cible"] == pytest.approx(attendue)
