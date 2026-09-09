"""Tests d'intégration : niveaux d'accès à travers l'API HTTP.

Les tests unitaires vérifient le garde-fou en isolation. Ceux-ci passent par
les endpoints réels, avec un jeton d'authentification signé comme le fait le
Core API, et couvrent les trois modes d'entrée d'un relevé : saisie collée,
import de fichier, et appel direct.

Ce qu'ils fixent :
  - un compte quelconque analyse n'importe quel produit du référentiel, en
    mode classique, sans jamais rencontrer de refus ;
  - seule une valeur qui s'écarte du référentiel exige le rôle Expert ;
  - le refus, quand il tombe, porte un message lisible et un code 403.
"""

import time

import jwt
import pytest
from fastapi.testclient import TestClient

import auth
import main
import pasto

client = TestClient(main.app)

RELEVE_COLLE = "\n".join(
    f"{t}\t{temp}" for t, temp in
    [(0, 20.0), (1, 45.0), (5, 64.0), (10, 64.0), (11, 40.0), (12, 20.0)]
)


def _jeton(role: str | None) -> dict:
    """En-tête d'authentification pour un rôle donné, ou aucun si anonyme."""
    if role is None:
        return {}
    maintenant = int(time.time())
    charge = {"sub": "testeur@ifpc.eu", "role": role,
              "iat": maintenant, "exp": maintenant + 600}
    return {"Authorization": "Bearer " + jwt.encode(charge, auth.SECRET_KEY, algorithm=auth.ALGORITHM)}


def _coller(role, **params):
    corps = {"raw_text": RELEVE_COLLE, "unite_temps": "minute", **params}
    return client.post("/api/pasteurisation/coller", json=corps, headers=_jeton(role))


TOUS_LES_ROLES = [None, "ROLE_USER", "ROLE_EXPERT", "ROLE_ADMIN"]
PRODUITS = ["jus_pomme", "cidre_doux", "cidre_brut"]


class TestModeClassique:
    """Le retour du testeur : analyser son produit ne demande aucun rôle."""

    @pytest.mark.parametrize("role", TOUS_LES_ROLES)
    @pytest.mark.parametrize("produit", PRODUITS)
    def test_tout_produit_pour_tout_role(self, role, produit):
        reponse = _coller(role, product_type=produit)
        assert reponse.status_code == 200, reponse.text
        assert reponse.json()["parametres"]["product_type"] == produit

    @pytest.mark.parametrize("produit", PRODUITS)
    def test_le_referentiel_du_produit_transmis_explicitement(self, produit):
        # Ce que le sélecteur envoyait : microorganisme, Tref et z de référence.
        reference = pasto.MICROORGANISMES[pasto.PRODUITS[produit]["microorganisme_defaut"]]
        reponse = _coller(
            "ROLE_USER", product_type=produit,
            microorganisme=pasto.PRODUITS[produit]["microorganisme_defaut"],
            t_ref=reference["t_ref"], z=reference["z"],
        )
        assert reponse.status_code == 200, reponse.text

    @pytest.mark.parametrize("produit", PRODUITS)
    def test_le_resultat_est_scelle(self, produit):
        resultat = _coller("ROLE_USER", product_type=produit).json()
        claims = auth.verifier_jeton_resultat(resultat["jeton_resultat"])
        assert claims["typ_resultat"] == "controle"
        assert claims["statut"] == resultat["statut"]


class TestModeExpert:
    """Une valeur qui s'écarte du référentiel exige le rôle."""

    ECARTS = [
        {"microorganisme": "ecoli"},
        {"t_ref": 72.0},
        {"z": 8.0},
        {"microorganisme": "listeria", "t_ref": 62.0, "z": 5.6},
    ]

    @pytest.mark.parametrize("ecart", ECARTS)
    @pytest.mark.parametrize("role", [None, "ROLE_USER"])
    def test_refuse_sans_le_role(self, role, ecart):
        reponse = _coller(role, product_type="jus_pomme", **ecart)
        assert reponse.status_code == 403
        assert "Expert" in reponse.json()["detail"]

    @pytest.mark.parametrize("ecart", ECARTS)
    @pytest.mark.parametrize("role", ["ROLE_EXPERT", "ROLE_ADMIN"])
    def test_accepte_avec_le_role(self, role, ecart):
        assert _coller(role, product_type="jus_pomme", **ecart).status_code == 200

    def test_un_jeton_invalide_vaut_anonyme(self):
        reponse = client.post(
            "/api/pasteurisation/coller",
            json={"raw_text": RELEVE_COLLE, "unite_temps": "minute",
                  "product_type": "jus_pomme", "microorganisme": "ecoli"},
            headers={"Authorization": "Bearer jeton.forge.par.un.tiers"},
        )
        assert reponse.status_code == 403

    def test_un_jeton_expire_vaut_anonyme(self):
        passe = int(time.time()) - 3600
        expire = jwt.encode({"sub": "x@ifpc.eu", "role": "ROLE_ADMIN",
                             "iat": passe, "exp": passe + 60},
                            auth.SECRET_KEY, algorithm=auth.ALGORITHM)
        reponse = client.post(
            "/api/pasteurisation/coller",
            json={"raw_text": RELEVE_COLLE, "unite_temps": "minute",
                  "product_type": "jus_pomme", "t_ref": 72.0},
            headers={"Authorization": f"Bearer {expire}"},
        )
        assert reponse.status_code == 403


class TestImportDeFichier:
    """Le même garde-fou s'applique au chemin d'import."""

    CSV = ("Date / Heure;Valeur\n"
           "09/09/2026 14:00:00;20.0\n09/09/2026 14:01:00;45.0\n"
           "09/09/2026 14:05:00;64.0\n09/09/2026 14:10:00;64.0\n"
           "09/09/2026 14:11:00;40.0\n")

    def _televerser(self, role, **params):
        return client.post(
            "/api/pasteurisation/upload",
            params={"unite_temps": "minute", **params},
            files={"file": ("releve.csv", self.CSV, "text/csv")},
            headers=_jeton(role),
        )

    @pytest.mark.parametrize("produit", PRODUITS)
    def test_import_en_mode_classique(self, produit):
        reponse = self._televerser("ROLE_USER", product_type=produit)
        assert reponse.status_code == 200, reponse.text
        assert reponse.json()["nb_points"] == 5

    def test_import_avec_ecart_refuse_sans_le_role(self):
        reponse = self._televerser("ROLE_USER", product_type="jus_pomme", microorganisme="ecoli")
        assert reponse.status_code == 403

    def test_la_colonne_mesure_non_nommee_est_acceptee(self):
        # « Valeur » : le cas remonté par le testeur.
        assert self._televerser("ROLE_USER", product_type="cidre_doux").status_code == 200

    def test_un_entete_incomprehensible_est_refuse_avec_un_message(self):
        reponse = client.post(
            "/api/pasteurisation/upload",
            params={"unite_temps": "minute", "product_type": "jus_pomme"},
            files={"file": ("releve.csv", "Colonne A;Colonne B\n1;2\n3;4\n", "text/csv")},
            headers=_jeton("ROLE_USER"),
        )
        assert reponse.status_code == 400
        assert "Colonne A" in reponse.json()["detail"]


class TestReferentielsPublics:
    """Les référentiels de consultation restent ouverts."""

    @pytest.mark.parametrize("chemin", [
        "/api/referentiels/produits",
        "/api/referentiels/microorganismes",
        "/api/referentiels/procedes",
        "/api/referentiels/unites-temps",
    ])
    def test_lecture_sans_authentification(self, chemin):
        reponse = client.get(chemin)
        assert reponse.status_code == 200
        assert len(reponse.json()) > 0
