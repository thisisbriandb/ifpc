"""Le sens des schémas : transcriptions, mise en phrases, synchronisation.

Deux familles de vérifications. Les transcriptions versionnées doivent toutes
se charger : une faute de saisie dans un fichier TOML doit casser la CI, pas le
démarrage du service en production. Et la mise en phrases ne doit jamais
présenter un enchaînement faux — l'ordre du procédé, les branches facultatives,
la suite d'une étape vue depuis le schéma qui l'englobe.
"""

from __future__ import annotations

from pathlib import Path

import pytest

from ascocid.application.ingestion import schemas
from ascocid.application.requete.prompt import carte_du_corpus
from ascocid.domain.modeles import Carte, Corpus, Fiche, TypeFiche, Zone
from ascocid.infrastructure.graphe.sqlite import MagasinSqlite
from ascocid.infrastructure.index.memoire import IndexMemoire

CONFIG = Path(__file__).resolve().parent.parent / "config" / "schemas"


def transcription(**champs) -> schemas.Transcription:
    base = {"idoc": 1, "code": "PROCESS_TEST", "titre": "Procédé test", "svg_sha256": "x"}
    return schemas.Transcription(**(base | champs))


# Récolte → Extraction → (Clarification facultative) → Fermentation → fin.
SIMPLE = dict(
    etapes=[
        {"id": "fermentation", "libelle": "Étape fermentaire"},     # volontairement pas en premier
        {"id": "recolte", "libelle": "Récolte"},
        {"id": "extraction", "libelle": "Extraction des moûts", "fiche": 2,
         "synonymes": ["extraction du jus"]},
        {"id": "clarification", "libelle": "Clarification des moûts"},
    ],
    transitions=[
        {"vers": "recolte", "produit": "Pommes dans l'arbre"},
        {"de": "recolte", "vers": "extraction", "produit": "Pommes à presser"},
        {"de": "extraction", "vers": "clarification", "produit": "Moûts bruts"},
        {"de": "extraction", "vers": "fermentation", "produit": "Moûts bruts",
         "condition": "sans clarification"},
        {"de": "clarification", "vers": "fermentation", "produit": "Moûts clarifiés"},
        {"de": "fermentation", "produit": "Cidres à assembler"},
    ],
)


class EmbedderFactice:
    def encoder(self, textes, *, requete=False):  # noqa: ANN001, ANN201
        return [[1.0, float(len(t) % 5), 0.5] for t in textes]


# ── Les transcriptions du dépôt ──────────────────────────────────────────────


def test_toutes_les_transcriptions_du_depot_se_chargent():
    transcriptions = schemas.charger(CONFIG)
    assert len(transcriptions) >= 12
    assert len({t.idoc for t in transcriptions}) == len(transcriptions), "un schéma transcrit deux fois"
    for t in transcriptions:
        assert len(t.svg_sha256) == 64, f"{t.code} : empreinte SVG manquante"
        assert schemas.passages(t), f"{t.code} : aucun passage produit"


def test_le_diagramme_general_dit_ce_qui_suit_l_extraction():
    """Le cas qui a motivé ce module : la réponse n'existait que dans le dessin."""
    general = next(t for t in schemas.charger(CONFIG) if t.code == "PROCESS_FABRICATION_GENERAL")
    texte = next(p.texte for p in schemas.passages(general) if p.section == "Extraction des moûts")
    assert "suivie de l'étape « Clarification des moûts »" in texte
    assert "Étape fermentaire" in texte
    assert texte.index("Clarification des moûts") < texte.index("Étape d'assemblage")


def test_aucune_transcription_ne_reference_une_etape_inconnue():
    with pytest.raises(ValueError, match="inconnue"):
        transcription(etapes=[{"id": "a", "libelle": "A"}],
                      transitions=[{"de": "a", "vers": "b"}])
    with pytest.raises(ValueError, match="double"):
        transcription(etapes=[{"id": "a", "libelle": "A"}, {"id": "a", "libelle": "B"}])


# ── Mise en phrases ──────────────────────────────────────────────────────────


def test_ordre_du_procede_et_non_ordre_du_fichier():
    t = transcription(**SIMPLE)
    assert [e.id for e in schemas.ordre(t)] == ["recolte", "extraction", "clarification", "fermentation"]


def test_une_boucle_ne_change_pas_l_ordre():
    t = transcription(
        etapes=[{"id": "a", "libelle": "A"}, {"id": "b", "libelle": "B"}],
        transitions=[{"vers": "a"}, {"de": "a", "vers": "b"},
                     {"de": "b", "vers": "a", "condition": "en cas de re-croissance"}, {"de": "b"}])
    assert [e.id for e in schemas.ordre(t)] == ["a", "b"]


def test_seule_une_etape_contournable_est_dite_facultative():
    t = transcription(**SIMPLE)
    facultatives = {e.id for e in t.etapes if schemas._facultative(t, e)}
    # La fermentation n'a que des entrées alternatives, mais tout y passe.
    assert facultatives == {"clarification"}
    ensemble = next(p.texte for p in schemas.passages(t) if p.section == "Enchaînement des étapes")
    assert "Clarification des moûts (selon le cas)" in ensemble
    assert "Étape fermentaire (selon le cas)" not in ensemble


def test_passage_d_etape_precedent_suivant_et_suite():
    t = transcription(**SIMPLE)
    texte = next(p.texte for p in schemas.passages(t) if p.section == "Extraction des moûts")
    assert "Elle vient après l'étape « Récolte », dont elle reçoit : Pommes à presser." in texte
    assert "suivie de « Étape fermentaire » ; produit transmis : Moûts bruts (sans clarification)" in texte
    assert "Étapes suivantes, jusqu'à la fin du schéma : Clarification des moûts (selon le cas) → Étape fermentaire." in texte


def test_les_synonymes_aident_la_recherche_sans_etre_montres():
    t = transcription(**SIMPLE)
    chunk = next(c for c in schemas.chunks(t) if c.titre_section == "Extraction des moûts")
    assert "extraction du jus" not in chunk.texte          # ce que lit le modèle
    assert "extraction du jus" in chunk.texte_indexe       # ce qui est cherché


def test_graphe_d_influence_en_chaines_de_causes():
    t = transcription(chaines=[{"contexte": "Cause d'échec", "maillons": [
        "Mauvais état sanitaire", "Présence de polygalacturonase", "Échec de la gélification"]}])
    [p] = schemas.passages(t)
    assert p.texte.endswith("Mauvais état sanitaire, qui entraîne : Présence de polygalacturonase, "
                            "qui entraîne : Échec de la gélification.")


def test_le_detail_d_une_etape_sait_ce_qui_l_entoure():
    """Le schéma « Extraction » dit ce qui suit l'extraction, grâce au schéma général."""
    general = transcription(**SIMPLE)
    detail = transcription(idoc=2, code="PROCESS_EXTRACTION", titre="Extraction des moûts",
                           etapes=[{"id": "rapage", "libelle": "Râpage"},
                                   {"id": "pressage", "libelle": "Pressage"}],
                           transitions=[{"vers": "rapage"}, {"de": "rapage", "vers": "pressage"},
                                        {"de": "pressage"}])
    liens = schemas.passages_de_liaison([general, detail])
    [lien] = liens[2]
    assert lien.section == "Place dans le schéma « Procédé test »"
    assert "détaille l'étape « Extraction des moûts »" in lien.texte
    assert "suivie de l'étape « Clarification des moûts »" in lien.texte

    # Dans le détail, la suite complète n'est pas répétée à chaque étape.
    textes = [c.texte for c in schemas.chunks(detail, supplementaires=liens[2])]
    rapage = next(x for x in textes if "« Râpage »" in x and "détaille" not in x)
    assert "Étapes suivantes" not in rapage


# ── Synchronisation et carte du corpus ───────────────────────────────────────


@pytest.fixture
def magasin(tmp_path):
    m = MagasinSqlite(tmp_path / "base.sqlite")
    m.ecrire(Corpus(
        fiches=[Fiche(idoc=1, code="PROCESS_TEST", type=TypeFiche.PROCESS, titre="Procédé test"),
                Fiche(idoc=2, code="PROCESS_X", type=TypeFiche.PROCESS, titre="Autre procédé")],
        cartes=[Carte(idoc=1, svg="", largeur=1, hauteur=1),
                Carte(idoc=2, svg="", largeur=1, hauteur=1)],
        zones=[Zone(carte_idoc=1, ordre=0, libelle="Étape fermentaire", x=0, y=0, cible_idoc=1),
               Zone(carte_idoc=1, ordre=1, libelle="Récolte", x=0, y=0, cible_idoc=1),
               Zone(carte_idoc=2, ordre=0, libelle="Zone B", x=0, y=0, cible_idoc=2),
               Zone(carte_idoc=2, ordre=1, libelle="Zone A", x=0, y=0, cible_idoc=2)],
    ))
    yield m
    m.cx.close()


def test_synchronisation_idempotente_puis_remplacement(magasin, tmp_path):
    index = IndexMemoire(tmp_path / "index")
    index.construire(["ascocid://chunk/existant"], [[1.0, 0.0, 0.0]])
    t = transcription(**SIMPLE)

    n, anomalies = schemas.synchroniser([t], magasin, EmbedderFactice(), index)
    assert n == len(schemas.chunks(t)) and anomalies == []
    assert index.taille == 1 + n
    assert schemas.synchroniser([t], magasin, EmbedderFactice(), index) == (None, [])

    # Une transcription modifiée remplace les anciens passages, sans doublon.
    modifiee = transcription(**(SIMPLE | {"note": "Schéma relu."}))
    n2, _ = schemas.synchroniser([modifiee], magasin, EmbedderFactice(), index)
    assert n2 == n + 1
    assert index.taille == 1 + n2
    assert magasin.cx.execute("SELECT count(*) FROM chunk WHERE type='schema'").fetchone()[0] == n2

    # Une base reconstruite (ingest extraire) efface aussi l'empreinte : tout est refait.
    magasin.vider()
    assert magasin.lire_meta(schemas.CLE_META) is None


def test_sans_index_vectoriel_les_passages_seront_refaits_avec_vecteurs(magasin, tmp_path):
    t = transcription(**SIMPLE)
    n, _ = schemas.synchroniser([t], magasin)                 # mode lexical seul
    assert n and magasin.lire_meta(schemas.CLE_META).endswith(":lexical")
    index = IndexMemoire(tmp_path / "index")
    n2, _ = schemas.synchroniser([t], magasin, EmbedderFactice(), index)
    assert n2 == n and index.taille == n


def test_schema_absent_du_corpus_signale(magasin):
    _, anomalies = schemas.synchroniser([transcription(idoc=999, code="PROCESS_ABSENT")], magasin)
    assert "absente du corpus" in anomalies[0]


def test_svg_modifie_signale():
    t = transcription()
    assert schemas.schemas_modifies([t], {"1:img": "x"}) == []
    assert "a changé" in schemas.schemas_modifies([t], {"1:img": "autre"})[0]


def test_carte_du_corpus_n_affiche_plus_un_ordre_faux(magasin):
    carte = carte_du_corpus(magasin, [transcription(**SIMPLE)])
    # Ordre réel pour un schéma transcrit…
    assert ("Procédé test (dans l'ordre) : Récolte → Extraction des moûts → "
            "Clarification des moûts → Étape fermentaire") in carte
    # …et plus de flèches pour un schéma dont l'ordre n'est pas connu.
    assert "Autre procédé — rubriques : Zone B, Zone A" in carte
    assert "Zone B → Zone A" not in carte
