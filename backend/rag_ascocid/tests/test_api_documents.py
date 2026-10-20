"""Routes d'administration des documents : qui peut quoi, et ce qui en sort.

Le point qui compte le plus est l'accès : ajouter un document, c'est modifier
ce que l'assistant répond à tous les producteurs. Seul le rôle ADMIN du Core
API y a droit ; un compte ordinaire, même connecté, est refusé.
"""

from __future__ import annotations

import base64
import time

import jwt
import pytest
from fastapi.testclient import TestClient

from ascocid.application.ingestion.documents import Bibliotheque
from ascocid.infrastructure.graphe.sqlite import MagasinSqlite
from ascocid.infrastructure.index.memoire import IndexMemoire
from ascocid.interfaces.web import api
from test_documents import PARAGRAPHE, EmbedderFactice, docx

SECRET = base64.b64encode(b"secret-de-test-assez-long-pour-hs256").decode()


def jeton(role: str) -> dict:
    charge = {"sub": "admin@ifpc.com", "role": role, "exp": int(time.time()) + 600}
    return {"Authorization": "Bearer " + jwt.encode(
        charge, base64.b64decode(SECRET), algorithm="HS256")}


class AtelierImmediat:
    """L'intégration s'exécute tout de suite : le test voit l'état final."""

    def submit(self, fonction, *args):  # noqa: ANN001, ANN201
        fonction(*args)


@pytest.fixture
def client(tmp_path, monkeypatch):
    monkeypatch.setenv("JWT_SECRET", SECRET)
    monkeypatch.delenv("LDC_AUTH", raising=False)
    base = tmp_path / "ascocid.sqlite"
    MagasinSqlite(base).cx.close()
    index = IndexMemoire(tmp_path / "index")
    index.construire(["ascocid://chunk/existant"], [[1.0, 0.0, 0.0, 0.0]])

    monkeypatch.setattr(api, "BASE_DONNEES", str(base))
    monkeypatch.setattr(api, "BIBLIOTHEQUE", Bibliotheque(tmp_path / "documents"))
    monkeypatch.setattr(api, "ATELIER", AtelierImmediat())
    monkeypatch.setattr(api.moteur, "embedder", EmbedderFactice())
    monkeypatch.setattr(api.moteur, "index", index)
    monkeypatch.setattr(api.moteur, "generateur", None)
    # Sans `with` : le cycle de vie (chargement du modèle) n'est pas lancé.
    return TestClient(api.app)


def test_routes_d_administration_reservees_au_role_admin(client):
    assert client.get("/api/ldc/documents").status_code == 401
    assert client.get("/api/ldc/documents", headers=jeton("ROLE_USER")).status_code == 403
    assert client.get("/api/ldc/documents", headers=jeton("ROLE_EXPERT")).status_code == 403
    assert client.post("/api/ldc/documents?nom=a.docx", content=b"x",
                       headers=jeton("ROLE_USER")).status_code == 403
    assert client.delete("/api/ldc/documents/1000000",
                         headers=jeton("ROLE_USER")).status_code == 403
    assert client.get("/api/ldc/documents", headers=jeton("ROLE_ADMIN")).status_code == 200


def test_ajout_consultation_et_retrait(client):
    admin = jeton("ROLE_ADMIN")
    r = client.post("/api/ldc/documents", params={"nom": "Note été.docx", "titre": "Note"},
                    content=docx([("titre", "Fermentation"), ("texte", PARAGRAPHE * 2)]),
                    headers=admin)
    assert r.status_code == 202, r.text
    idoc = r.json()["idoc"]

    liste = client.get("/api/ldc/documents", headers=admin).json()["documents"]
    assert [(d["idoc"], d["etat"], d["ajoute_par"]) for d in liste] == [
        (idoc, "pret", "admin@ifpc.com")]

    # La fiche se lit comme une fiche AsCoCid, mais renvoie vers le fichier.
    fiche = client.get(f"/api/ldc/fiche/{idoc}").json()
    assert fiche["provenance"] == "document"
    assert fiche["source_url"] == f"/api/ldc/document/{idoc}/fichier"
    # Le fichier s'ouvre sans jeton : le lien part dans un nouvel onglet.
    fichier = client.get(fiche["source_url"])
    assert fichier.status_code == 200
    assert fichier.headers["content-disposition"].startswith("inline")

    assert client.delete(f"/api/ldc/documents/{idoc}", headers=admin).status_code == 200
    assert client.get("/api/ldc/documents", headers=admin).json()["documents"] == []
    assert client.get(f"/api/ldc/fiche/{idoc}").status_code == 404
    assert client.get(f"/api/ldc/document/{idoc}/fichier").status_code == 404
    assert client.delete(f"/api/ldc/documents/{idoc}", headers=admin).status_code == 404


def test_refus_explique_a_l_administrateur(client):
    r = client.post("/api/ldc/documents", params={"nom": "tableau.xlsx"},
                    content=b"contenu", headers=jeton("ROLE_ADMIN"))
    assert r.status_code == 422
    assert "PDF et Word" in r.json()["detail"]


def test_fichier_trop_gros_refuse(client, monkeypatch):
    monkeypatch.setattr(api, "TAILLE_MAX", 10)
    r = client.post("/api/ldc/documents", params={"nom": "a.pdf"},
                    content=b"x" * 11, headers=jeton("ROLE_ADMIN"))
    assert r.status_code == 413


# ── Relecture des transcriptions d'illustrations ─────────────────────────────


@pytest.fixture
def relecture(client, tmp_path, monkeypatch):
    from ascocid.application.ingestion import transcriptions_images as ti
    from ascocid.domain.modeles import Corpus, Fiche, TypeFiche

    dossier = tmp_path / "transcriptions"
    dossier.mkdir()
    monkeypatch.setattr(api, "TRANSCRIPTIONS_IMAGES", dossier)
    with MagasinSqlite(api.BASE_DONNEES) as m:
        m.ecrire(Corpus(fiches=[Fiche(idoc=1416, code="FDC_ARMAGNAC", type=TypeFiche.VARIETE,
                                      titre="Armagnac")]))
    ti.enregistrer(dossier, ti.TranscriptionImage(
        idoc=1416, code="FDC_ARMAGNAC", titre="Armagnac", image_sha256="sha",
        texte_ocr="Densité du jus : 1 065,5.",
        rubriques=[ti.Rubrique(titre="QUALITES TECHNOLOGIQUES DU FRUIT", lignes=[
            ti.Ligne(intitule="Densité du jus", valeur="1 O65,5.", douteux=["O65,5."])])]))
    return client, dossier


def test_relecture_reservee_aux_admins(relecture):
    client, _ = relecture
    assert client.get("/api/ldc/transcriptions", headers=jeton("ROLE_USER")).status_code == 403
    assert client.put("/api/ldc/transcriptions/FDC_ARMAGNAC", headers=jeton("ROLE_USER"),
                      json={"titre": "x", "statut": "valide", "rubriques": []}).status_code == 403


def test_correction_enregistree_et_reindexee(relecture):
    client, dossier = relecture
    admin = jeton("ROLE_ADMIN")
    liste = client.get("/api/ldc/transcriptions", headers=admin).json()["transcriptions"]
    assert [(t["code"], t["statut"], t["douteux"]) for t in liste] == [("FDC_ARMAGNAC", "a_verifier", 1)]

    lue = client.get("/api/ldc/transcriptions/FDC_ARMAGNAC", headers=admin).json()
    assert lue["image"] == "/api/ldc/illustration/1416"
    rubriques = lue["rubriques"]
    rubriques[0]["lignes"][0] |= {"valeur": "1 065,5.", "douteux": []}   # « O » lu pour « 0 »

    r = client.put("/api/ldc/transcriptions/FDC_ARMAGNAC", headers=admin,
                   json={"titre": "Armagnac", "statut": "valide", "rubriques": rubriques,
                         # Tentatives de modifier ce qui vient de l'OCR : ignorées.
                         "image_sha256": "pirate", "texte_ocr": "pirate"})
    assert r.status_code == 200, r.text
    assert r.json()["passages"] == 1

    from ascocid.application.ingestion import transcriptions_images as ti
    relue = ti.charger(dossier / "FDC_ARMAGNAC.toml")
    assert (relue.statut, relue.verifie_par) == ("valide", "admin@ifpc.com")
    assert relue.image_sha256 == "sha" and relue.texte_ocr.startswith("Densité")
    with MagasinSqlite(api.BASE_DONNEES) as m:
        textes = [r["texte"] for r in m.cx.execute("SELECT texte FROM chunk WHERE type='illustration'")]
    assert textes and "Densité du jus : 1 065,5." in textes[0] and "O65" not in textes[0]


def test_code_de_transcription_ne_sort_pas_du_dossier(relecture):
    client, _ = relecture
    for code in ("..%2F..%2Fetc", "inconnu"):
        assert client.get(f"/api/ldc/transcriptions/{code}",
                          headers=jeton("ROLE_ADMIN")).status_code == 404


def test_statut_invalide_refuse(relecture):
    client, _ = relecture
    r = client.put("/api/ldc/transcriptions/FDC_ARMAGNAC", headers=jeton("ROLE_ADMIN"),
                   json={"titre": "Armagnac", "statut": "a_verifier", "rubriques": []})
    assert r.status_code == 422
