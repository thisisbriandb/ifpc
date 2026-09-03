"""Les deux entrées de l'assemblage décrivent la même physique.

Le module d'assemblage a deux points d'entrée : la lecture d'un fichier de
spectres, et le recalcul depuis les spectres enregistrés avec les lots. Ils
appliquaient des règles différentes — correction de dilution faite par le
frontend d'un côté, par le moteur de l'autre ; longueur minimale de spectre
exigée d'un côté seulement ; volume par défaut divergent.

Un assemblage recalculé depuis l'historique ne redonnait donc pas exactement
le résultat d'origine, et un spectre de deux points produisait un L*a*b*
d'apparence normale à partir d'un simple segment de droite.
"""

import numpy as np
import pytest

import colori

# Spectre plausible de cidre : 380 à 780 nm par pas de 10 nm.
LONGUEURS = colori.CIE_WAVELENGTHS.tolist()
DO_BRUTE = [round(0.9 * np.exp(-((wl - 380) / 260.0)), 4) for wl in LONGUEURS]


def _spectre(nom="Cuve A", do=None, wl=None):
    return {"name": nom, "wavelengths": wl or LONGUEURS, "do": do or DO_BRUTE}


def _assembler(spectra, **kwargs):
    return colori.assembler_donnees(
        spectra=spectra, target_L=50.0, target_a=10.0, target_b=30.0, **kwargs
    )


class TestLongueurDeSpectre:

    def test_un_spectre_trop_court_est_refuse(self):
        # Interpolé sur les 41 points de la grille CIE, il se réduit à une
        # droite : le Lab* obtenu ressemble à une mesure sans en être une.
        with pytest.raises(ValueError, match="trop court"):
            _assembler([_spectre(wl=[400.0, 700.0], do=[0.8, 0.2])])

    def test_le_seuil_est_le_meme_que_pour_un_fichier(self):
        assert colori.MIN_POINTS_SPECTRE == 10

    def test_un_spectre_de_longueur_suffisante_passe(self):
        assert _assembler([_spectre()])["cuves"][0]["L"] > 0

    def test_longueurs_d_onde_et_densites_de_tailles_differentes(self):
        with pytest.raises(ValueError, match="incohérent"):
            _assembler([_spectre(do=DO_BRUTE[:-1])])


class TestCorrectionDeDilution:

    def test_sans_facteur_la_densite_optique_est_prise_telle_quelle(self):
        sans = _assembler([_spectre()])["cuves"][0]
        neutre = _assembler([_spectre()], dilution_factors={"Cuve A": 1.0})["cuves"][0]
        assert sans == neutre

    def test_le_facteur_assombrit_la_couleur(self):
        # DO plus élevée = moins de lumière transmise = L* plus faible.
        clair = _assembler([_spectre()])["cuves"][0]
        dilue = _assembler([_spectre()], dilution_factors={"Cuve A": 2.0})["cuves"][0]
        assert dilue["L"] < clair["L"]

    def test_la_correction_equivaut_a_multiplier_la_densite_optique(self):
        # C'est ce que le frontend faisait avant : le moteur doit donner le
        # même résultat, à l'arrondi d'affichage près.
        pre_multiplie = _assembler([_spectre(do=[v * 2.0 for v in DO_BRUTE])])["cuves"][0]
        par_le_moteur = _assembler([_spectre()], dilution_factors={"Cuve A": 2.0})["cuves"][0]
        for axe in ("L", "a", "b"):
            assert par_le_moteur[axe] == pytest.approx(pre_multiplie[axe], abs=0.01)

    def test_le_facteur_ne_s_applique_qu_a_la_cuve_nommee(self):
        spectres = [_spectre("Cuve A"), _spectre("Cuve B")]
        resultat = _assembler(spectres, dilution_factors={"Cuve A": 3.0})
        a, b = resultat["cuves"]
        assert a["L"] < b["L"]

    @pytest.mark.parametrize("facteur", [0.0, -1.0])
    def test_un_facteur_nul_ou_negatif_est_refuse(self, facteur):
        with pytest.raises(ValueError, match="[Ff]acteur de dilution invalide"):
            _assembler([_spectre()], dilution_factors={"Cuve A": facteur})

    def test_les_facteurs_employes_sont_rapportes(self):
        facteurs = {"Cuve A": 2.5}
        assert _assembler([_spectre()], dilution_factors=facteurs)["spectre"]["dilution_factors"] == facteurs


class TestEquivalenceDesDeuxChemins:
    """Le test qui aurait arrêté la divergence."""

    def _via_fichier(self, facteur):
        entetes = "longueur_onde,Cuve A\n"
        lignes = "\n".join(f"{wl},{do}" for wl, do in zip(LONGUEURS, DO_BRUTE))
        return colori.assembler(
            file_content=(entetes + lignes).encode("utf-8"), filename="spectres.csv",
            target_L=50.0, target_a=10.0, target_b=30.0, volume_total=0.0,
            dilution_factors={"Cuve A": facteur},
        )

    @pytest.mark.parametrize("facteur", [1.0, 2.0, 5.0])
    def test_meme_lab_par_fichier_et_depuis_la_base(self, facteur):
        fichier = self._via_fichier(facteur)["cuves"][0]
        base = _assembler([_spectre()], dilution_factors={"Cuve A": facteur},
                          volume_total=0.0)["cuves"][0]
        for axe in ("L", "a", "b"):
            assert base[axe] == pytest.approx(fichier[axe], abs=0.01), axe

    def test_meme_ecart_a_la_cible(self):
        fichier = self._via_fichier(2.0)
        base = _assembler([_spectre()], dilution_factors={"Cuve A": 2.0}, volume_total=0.0)
        assert base["delta_e"] == pytest.approx(fichier["delta_e"], abs=0.01)
        assert base["delta_e_method"] == fichier["delta_e_method"]
