"""Le référentiel d'un produit n'est pas un paramètre avancé.

Défaut remonté par un testeur producteur : sans compte Expert, seul « Jus de
pomme » était utilisable — tout choix de cidre renvoyait « Vous devez être
connecté avec un compte Expert ou Admin ».

Cause : le sélecteur de produit renseignait automatiquement le microorganisme
de référence, son Tref et son z. Ces trois champs, invisibles pour un compte
non expert, partaient malgré tout dans la requête, et le garde-fou les prenait
pour une surcharge experte. « Jus de pomme » échappait au refus uniquement
parce qu'il est présélectionné au chargement : aucun événement de changement
n'était déclenché.
"""

import pytest
from fastapi import HTTPException

import pasto
from auth import verify_advanced_access

UTILISATEUR = {"role": "ROLE_USER"}
EXPERT = {"role": "ROLE_EXPERT"}
ADMIN = {"role": "ROLE_ADMIN"}


def _reference(produit):
    return pasto.MICROORGANISMES[pasto.PRODUITS[produit]["microorganisme_defaut"]]


class TestChoixDuProduit:
    """Le cas du testeur : choisir son produit, sans rien d'autre."""

    @pytest.mark.parametrize("produit", ["jus_pomme", "cidre_doux", "cidre_brut"])
    def test_aucun_parametre_transmis(self, produit):
        verify_advanced_access(UTILISATEUR, None, None, None, produit)

    @pytest.mark.parametrize("produit", ["jus_pomme", "cidre_doux", "cidre_brut"])
    def test_le_microorganisme_de_reference_du_produit(self, produit):
        # Ce que le sélecteur envoyait automatiquement.
        verify_advanced_access(
            UTILISATEUR, None, None, pasto.PRODUITS[produit]["microorganisme_defaut"], produit
        )

    @pytest.mark.parametrize("produit", ["jus_pomme", "cidre_doux", "cidre_brut"])
    def test_le_triplet_complet_du_referentiel(self, produit):
        # Microorganisme, Tref et z, tous égaux aux valeurs de référence.
        reference = _reference(produit)
        verify_advanced_access(
            UTILISATEUR, reference["t_ref"], reference["z"],
            pasto.PRODUITS[produit]["microorganisme_defaut"], produit,
        )

    @pytest.mark.parametrize("produit, herite", [
        ("cidre_doux", "cidre_demi_sec"), ("cidre_brut", "cidre_extra_brut"),
    ])
    def test_un_type_de_produit_herite_est_reconnu(self, produit, herite):
        verify_advanced_access(
            UTILISATEUR, None, None, pasto.PRODUITS[produit]["microorganisme_defaut"], herite
        )


class TestVraieSurcharge:
    """Ce qui s'écarte du référentiel reste réservé aux experts."""

    @pytest.mark.parametrize("parametres", [
        {"microorganisme": "ecoli"},
        {"t_ref": 72.0},
        {"z": 8.0},
        {"microorganisme": "saccharo_cidre", "t_ref": 72.0},
    ])
    def test_un_utilisateur_simple_est_refuse(self, parametres):
        with pytest.raises(HTTPException) as e:
            verify_advanced_access(
                UTILISATEUR, parametres.get("t_ref"), parametres.get("z"),
                parametres.get("microorganisme"), "cidre_doux",
            )
        assert e.value.status_code == 403

    @pytest.mark.parametrize("compte", [EXPERT, ADMIN])
    def test_un_expert_ou_un_admin_passe(self, compte):
        verify_advanced_access(compte, 72.0, 8.0, "ecoli", "cidre_doux")

    def test_un_anonyme_est_refuse(self):
        with pytest.raises(HTTPException) as e:
            verify_advanced_access(None, None, None, "ecoli", "cidre_doux")
        assert e.value.status_code == 403

    def test_un_produit_inconnu_exige_le_role(self):
        # Rien à quoi comparer : on ne relâche pas le garde-fou par défaut.
        with pytest.raises(HTTPException):
            verify_advanced_access(UTILISATEUR, None, None, "saccharo_cidre", "produit_inconnu")

    def test_sans_produit_precise_le_role_reste_exige(self):
        with pytest.raises(HTTPException):
            verify_advanced_access(UTILISATEUR, None, None, "saccharo_cidre", None)


class TestNonRegression:
    """Le test qui aurait arrêté le défaut."""

    @pytest.mark.parametrize("produit", ["jus_pomme", "cidre_doux", "cidre_brut"])
    def test_tout_produit_est_analysable_sans_compte_expert(self, produit):
        # Aucun produit du référentiel ne doit exiger le rôle Expert pour être
        # analysé avec ses propres paramètres de référence.
        reference = _reference(produit)
        for parametres in (
            (None, None, None),
            (None, None, pasto.PRODUITS[produit]["microorganisme_defaut"]),
            (reference["t_ref"], reference["z"], pasto.PRODUITS[produit]["microorganisme_defaut"]),
        ):
            verify_advanced_access(UTILISATEUR, *parametres, produit)
