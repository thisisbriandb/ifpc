"""Scellement des résultats de calcul par le moteur.

Le défaut d'origine : l'enregistrement d'une analyse reprenait le statut, la VP
et les paramètres tels qu'ils arrivaient du poste client, sans jamais rejouer
ni vérifier le calcul. Tout utilisateur authentifié pouvait donc archiver un
« conforme » de son choix — un registre de contrôle de pasteurisation dont les
valeurs sont fournies par le client n'a aucune valeur probante.

Le moteur signe désormais ce qu'il a calculé avec le secret déjà partagé avec
le Core API, qui refuse d'archiver un contrôle sans jeton valide.
"""

import time

import jwt
import pytest

import auth
import main
import pasto

CYCLE = {
    "temperatures": [20.0, 72.0, 72.0, 20.0],
    "temps": [0.0, 1.0, 11.0, 12.0],
    "product_type": "cidre_doux",
    "unite_temps": "minute",
}


def _resultat_scelle():
    return main._sceller_resultat(pasto.evaluer_pasteurisation(**CYCLE))


class TestJetonDeResultat:

    def test_le_moteur_scelle_ce_qu_il_a_calcule(self):
        resultat = _resultat_scelle()
        claims = auth.verifier_jeton_resultat(resultat["jeton_resultat"])
        assert claims["typ_resultat"] == "controle"
        assert claims["statut"] == resultat["statut"]
        assert claims["vp"] == resultat["vp"]
        assert claims["vp_cible"] == resultat["vp_cible"]
        assert claims["k_calc"] == resultat["k_calc"]

    def test_les_parametres_voyagent_dans_le_jeton(self):
        resultat = _resultat_scelle()
        claims = auth.verifier_jeton_resultat(resultat["jeton_resultat"])
        assert claims["parametres"]["microorganisme_key"] == "saccharo_cidre"
        assert claims["parametres"]["t_ref"] == 60.0

    def test_chaque_resultat_porte_un_identifiant_unique(self):
        # Le Core API refuse un jti déjà archivé : sans unicité, un même
        # résultat pourrait être rejoué sur plusieurs numéros de lot.
        jtis = {auth.verifier_jeton_resultat(_resultat_scelle()["jeton_resultat"])["jti"]
                for _ in range(20)}
        assert len(jtis) == 20

    def test_le_jeton_expire(self):
        claims = auth.verifier_jeton_resultat(_resultat_scelle()["jeton_resultat"])
        duree = claims["exp"] - claims["iat"]
        assert duree == auth.VALIDITE_JETON_RESULTAT_S
        assert 0 < duree <= 24 * 3600

    def test_un_jeton_perime_est_rejete(self):
        jeton = auth.signer_resultat("controle", {"statut": "conforme"}, duree_validite_s=-1)
        with pytest.raises(jwt.ExpiredSignatureError):
            auth.verifier_jeton_resultat(jeton)


class TestResistanceALaFalsification:
    """Le test qui aurait arrêté le défaut."""

    def test_un_verdict_forge_ne_produit_pas_de_jeton_valide(self):
        # Un client qui voudrait archiver « conforme » devrait signer lui-même :
        # sans le secret partagé, la signature ne tient pas.
        faux = jwt.encode(
            {"typ_resultat": "controle", "statut": "conforme", "vp": 9999.0,
             "jti": "forge", "iat": int(time.time()), "exp": int(time.time()) + 600},
            b"mauvaise-cle", algorithm="HS256",
        )
        with pytest.raises(jwt.InvalidSignatureError):
            auth.verifier_jeton_resultat(faux)

    def test_un_jeton_modifie_ne_tient_plus(self):
        jeton = _resultat_scelle()["jeton_resultat"]
        entete, charge, signature = jeton.split(".")
        with pytest.raises(jwt.PyJWTError):
            auth.verifier_jeton_resultat(f"{entete}.{charge}.{signature[:-4]}AAAA")

    def test_le_verdict_scelle_est_bien_celui_du_calcul(self):
        # Un traitement insuffisant ne peut pas ressortir « conforme » du jeton.
        resultat = main._sceller_resultat(pasto.evaluer_pasteurisation(
            temperatures=[20.0, 40.0, 40.0, 20.0], temps=[0.0, 1.0, 11.0, 12.0],
            product_type="cidre_doux", unite_temps="minute",
        ))
        claims = auth.verifier_jeton_resultat(resultat["jeton_resultat"])
        assert resultat["statut"] == "insuffisant"
        assert claims["statut"] == "insuffisant"


class TestPointsDeSortie:
    """Les trois endpoints d'évaluation scellent leur résultat."""

    def test_le_scellement_ne_deforme_pas_le_resultat(self):
        brut = pasto.evaluer_pasteurisation(**CYCLE)
        scelle = main._sceller_resultat(pasto.evaluer_pasteurisation(**CYCLE))
        del scelle["jeton_resultat"]
        assert scelle == brut

    def test_un_jeton_est_attache_a_chaque_evaluation(self):
        assert _resultat_scelle()["jeton_resultat"]
