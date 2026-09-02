"""Verdict d'un produit évalué sur plusieurs cibles microbiologiques.

Le défaut d'origine : le jus de pomme est évalué sur quatre microorganismes et
affiche une carte par cible, mais le champ ``statut`` — celui qui part dans
l'historique et sert de verdict du lot — ne venait que du microorganisme par
défaut, *Byssochlamys fulva*. Un palier de 30 min à 95 °C était donc archivé
« conforme » alors qu'*Alicyclobacillus acidoterrestris* n'atteignait que
k = 1,1 pour un seuil de 15.

referentiel-scientifique.md §5 : « Le produit est diagnostiqué globalement
conforme uniquement si la condition k ≥ 15,0 est validée pour l'ensemble des
cibles. »
"""

import pytest

import pasto

# Palier 95 °C pendant 30 min : suffisant pour Byssochlamys (k = 17,1),
# très insuffisant pour Alicyclobacillus (k = 1,1).
PALIER_95 = {
    "temperatures": [20.0, 95.0, 95.0, 95.0, 20.0],
    "temps": [0.0, 1.0, 16.0, 31.0, 32.0],
}

# Traitement franchement suffisant pour les quatre cibles.
PALIER_LONG = {
    "temperatures": [20.0, 95.0, 95.0, 95.0, 20.0],
    "temps": [0.0, 1.0, 300.0, 600.0, 601.0],
}


def _evaluer(cycle, **kwargs):
    return pasto.evaluer_pasteurisation(
        product_type="jus_pomme", unite_temps="minute", **cycle, **kwargs
    )


class TestVerdictSuitLeFacteurLimitant:

    def test_une_cible_insuffisante_rend_le_produit_insuffisant(self):
        resultat = _evaluer(PALIER_95)
        assert resultat["statut"] == "insuffisant"
        assert resultat["facteur_limitant"]["key"] == "alicyclo_std"
        assert resultat["facteur_limitant"]["k_calc"] < 15.0

    def test_le_verdict_ne_contredit_jamais_les_cartes_affichees(self):
        for cycle in (PALIER_95, PALIER_LONG):
            resultat = _evaluer(cycle)
            statuts = {e["statut"] for e in resultat["evaluations_multimicro"]}
            attendu = "insuffisant" if "insuffisant" in statuts else "conforme"
            assert resultat["statut"] == attendu

    def test_toutes_les_cibles_conformes_rendent_le_produit_conforme(self):
        resultat = _evaluer(PALIER_LONG)
        assert resultat["statut"] == "conforme"
        assert all(e["statut"] == "conforme" for e in resultat["evaluations_multimicro"])

    def test_le_facteur_limitant_est_celui_de_k_minimal(self):
        resultat = _evaluer(PALIER_95)
        k_min = min(e["k_calc"] for e in resultat["evaluations_multimicro"])
        assert resultat["facteur_limitant"]["k_calc"] == k_min

    def test_le_message_nomme_la_cible_qui_decide(self):
        resultat = _evaluer(PALIER_95)
        # Alicyclobacillus : bactéries acidophiles thermotolérantes.
        assert "acidophiles" in resultat["message"]
        assert "moisissures" not in resultat["message"]  # ce serait Byssochlamys


class TestCoherenceDesChiffresRapportes:
    """VP, cible et courbe décrivent la cible qui porte le verdict."""

    def test_la_vp_rapportee_est_celle_du_facteur_limitant(self):
        resultat = _evaluer(PALIER_95)
        limitant = next(e for e in resultat["evaluations_multimicro"]
                        if e["key"] == resultat["facteur_limitant"]["key"])
        assert resultat["vp"] == limitant["vp"]
        assert resultat["k_calc"] == limitant["k_calc"]
        assert resultat["parametres"]["microorganisme_key"] == limitant["key"]

    def test_la_cible_correspond_au_microorganisme_rapporte(self):
        resultat = _evaluer(PALIER_95)
        micro = pasto.MICROORGANISMES[resultat["parametres"]["microorganisme_key"]]
        assert resultat["vp_cible"] == micro["vp_cible_min"]
        assert resultat["parametres"]["t_ref"] == micro["t_ref"]
        assert resultat["parametres"]["z"] == micro["z"]

    def test_le_risque_est_evalue_sur_la_meme_cible(self):
        # Un « conforme » assorti d'un « risque élevé » n'était pas lisible.
        resultat = _evaluer(PALIER_95)
        assert resultat["statut"] == "insuffisant"
        assert resultat["risque"]["niveau"] in ("modéré", "élevé")


class TestModeExpert:
    """Un expert qui désigne une cible reprend la main sur les chiffres."""

    def test_une_cible_designee_porte_la_vp_et_la_courbe(self):
        resultat = _evaluer(PALIER_95, microorganisme="saccharo_jus")
        assert resultat["parametres"]["microorganisme_key"] == "saccharo_jus"
        assert resultat["parametres"]["t_ref"] == 60.0

    def test_mais_le_verdict_couvre_toujours_les_cibles_affichees(self):
        # Saccharomyces est très largement conforme sur ce palier ; le produit
        # ne l'est pas, et l'enregistrement ne doit pas dire le contraire.
        resultat = _evaluer(PALIER_95, microorganisme="saccharo_jus")
        saccharo = next(e for e in resultat["evaluations_multimicro"]
                        if e["key"] == "saccharo_jus")
        assert saccharo["statut"] == "conforme"
        assert resultat["statut"] == "insuffisant"
        assert resultat["facteur_limitant"]["key"] == "alicyclo_std"


class TestProduitsMonoCible:
    """Les cidres n'ont qu'une cible : rien ne change pour eux."""

    @pytest.mark.parametrize("produit, micro_attendu", [
        ("cidre_doux", "saccharo_cidre"),
        ("cidre_brut", "saccharo_cidre_low"),
    ])
    def test_le_microorganisme_par_defaut_reste_celui_du_produit(self, produit, micro_attendu):
        resultat = pasto.evaluer_pasteurisation(
            temperatures=[20.0, 72.0, 72.0, 20.0], temps=[0.0, 1.0, 11.0, 12.0],
            product_type=produit, unite_temps="minute",
        )
        assert resultat["parametres"]["microorganisme_key"] == micro_attendu
        assert "evaluations_multimicro" not in resultat
        assert "facteur_limitant" not in resultat
        assert resultat["statut"] == "conforme"
