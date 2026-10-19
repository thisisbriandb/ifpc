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
