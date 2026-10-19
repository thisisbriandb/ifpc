"""Documents ajoutés par les administrateurs de la plateforme.

Le corpus AsCoCid est reconstruit de zéro à chaque ingestion (`ingest
extraire` vide la base). Les documents ajoutés à la main ne peuvent donc pas
vivre seulement dans la base : ils seraient effacés à la prochaine mise à jour
d'AsCoCid. La **bibliothèque** est leur source de vérité — les fichiers
d'origine et un registre, sous `<données>/documents/` — et la base n'en est
qu'une projection, refaite à la demande :

* à l'ajout, le document est lu, découpé, vectorisé et intégré à chaud ;
* à chaque `ingest extraire`, les documents du registre sont relus et
  réinjectés, puis `ingest indexer` les vectorise avec le reste.

Les identifiants commencent à 1 000 000 : AsCoCid numérote ses fiches autour
de 1 000 à 2 000, une collision demanderait un corpus mille fois plus grand.
"""

from __future__ import annotations

import hashlib
import json
import os
import threading
import time
from pathlib import Path

from pydantic import BaseModel

from ascocid.application.ingestion.chunking import CIBLE_CAR, decouper
from ascocid.domain.modeles import Auteur, Bloc, Corpus, Fiche, TypeBloc, TypeFiche
from ascocid.infrastructure.parsing.document import (
    DocumentIllisible,
    DocumentLu,
    format_de,
    lire,
)

PREMIER_IDOC = 1_000_000
TAILLE_MAX = 25 * 1024 * 1024
MAX_CAR_TITRE = 200

# Toutes les écritures (registre, base, index) passent par ce verrou : une
# intégration dure plusieurs secondes, et une suppression lancée pendant ce
# temps ne doit pas voir un document à moitié écrit.
VERROU = threading.Lock()


class DocumentRefuse(ValueError):
    """Refus motivé, destiné à l'administrateur."""


class DocumentAjoute(BaseModel):
    idoc: int
    titre: str
    nom_fichier: str
    format: str                  # "pdf" | "docx"
    octets: int
    sha256: str
    ajoute_le: str
    ajoute_par: str = ""
    etat: str = "en_cours"       # "en_cours" | "pret" | "erreur"
    message: str = ""
    passages: int = 0

    @property
    def fichier(self) -> str:
        return f"{self.idoc}.{self.format}"


def url_fichier(idoc: int, prefixe: str = "/api/ldc") -> str:
    return f"{prefixe}/document/{idoc}/fichier"


class Bibliotheque:
    def __init__(self, racine: str | Path) -> None:
        self.racine = Path(racine)
        self.fichiers = self.racine / "fichiers"
        self.registre = self.racine / "registre.json"

    # ── registre ─────────────────────────────────────────────────────────────

    def _lire(self) -> dict:
        if not self.registre.exists():
            return {"prochain": PREMIER_IDOC, "documents": []}
        return json.loads(self.registre.read_text(encoding="utf-8"))

    def _ecrire(self, contenu: dict) -> None:
        self.racine.mkdir(parents=True, exist_ok=True)
        tmp = self.registre.with_suffix(".tmp")
        tmp.write_text(json.dumps(contenu, ensure_ascii=False, indent=1), encoding="utf-8")
        os.replace(tmp, self.registre)

    def lister(self) -> list[DocumentAjoute]:
        return [DocumentAjoute(**d) for d in self._lire()["documents"]]

    def trouver(self, idoc: int) -> DocumentAjoute | None:
        return next((d for d in self.lister() if d.idoc == idoc), None)

    def chemin(self, doc: DocumentAjoute) -> Path:
        return self.fichiers / doc.fichier

    # ── ajout, mise à jour, retrait ──────────────────────────────────────────

    def enregistrer(self, nom_fichier: str, octets: bytes, *, titre: str = "",
                    auteur: str = "") -> tuple[DocumentAjoute, DocumentLu]:
        """Vérifie, lit et range un document. Il reste à l'intégrer (`integrer`).

        La lecture a lieu ici, avant toute écriture : un fichier refusé (scan,
        format inconnu, doublon) ne laisse aucune trace.
        """
        if not octets:
            raise DocumentRefuse("Le fichier est vide.")
        if len(octets) > TAILLE_MAX:
            raise DocumentRefuse(
                f"Le fichier dépasse {TAILLE_MAX // (1024 * 1024)} Mo.")
        try:
            fmt = format_de(nom_fichier)
            lu = lire(octets, nom_fichier)
        except DocumentIllisible as exc:
            raise DocumentRefuse(str(exc)) from exc

        sha = hashlib.sha256(octets).hexdigest()
        with VERROU:
            contenu = self._lire()
            double = next((d for d in contenu["documents"] if d["sha256"] == sha), None)
            if double:
                raise DocumentRefuse(
                    f"Ce fichier a déjà été ajouté, sous le titre « {double['titre']} ».")
            doc = DocumentAjoute(
                idoc=contenu["prochain"],
                titre=(titre.strip() or lu.titre)[:MAX_CAR_TITRE],
                nom_fichier=Path(nom_fichier).name[:MAX_CAR_TITRE],
                format=fmt, octets=len(octets), sha256=sha,
                ajoute_le=time.strftime("%Y-%m-%dT%H:%M:%S"), ajoute_par=auteur,
            )
            self.fichiers.mkdir(parents=True, exist_ok=True)
            self.chemin(doc).write_bytes(octets)
            contenu["prochain"] += 1
            contenu["documents"].append(doc.model_dump())
            self._ecrire(contenu)
        return doc, lu

    def mettre_a_jour(self, idoc: int, **champs: object) -> DocumentAjoute | None:
        with VERROU:
            return self._mettre_a_jour(idoc, **champs)

    def _mettre_a_jour(self, idoc: int, **champs: object) -> DocumentAjoute | None:
        contenu = self._lire()
        for d in contenu["documents"]:
            if d["idoc"] == idoc:
                d.update(champs)
                self._ecrire(contenu)
                return DocumentAjoute(**d)
        return None

    def _oublier(self, idoc: int) -> DocumentAjoute | None:
        contenu = self._lire()
        trouve = next((d for d in contenu["documents"] if d["idoc"] == idoc), None)
        if trouve is None:
            return None
        contenu["documents"] = [d for d in contenu["documents"] if d["idoc"] != idoc]
        self._ecrire(contenu)
        doc = DocumentAjoute(**trouve)
        self.chemin(doc).unlink(missing_ok=True)
        return doc

    def lire(self, doc: DocumentAjoute) -> DocumentLu:
        """Relit un document du registre depuis son fichier d'origine."""
        return lire(self.chemin(doc).read_bytes(), doc.nom_fichier)

    def relire(self, doc: DocumentAjoute) -> tuple[Fiche, list[Bloc]]:
        """Fiche et blocs d'un document du registre, relus depuis son fichier."""
        return en_fiche(doc, self.lire(doc))

    # ── projection dans le corpus ────────────────────────────────────────────

    def integrer(self, doc: DocumentAjoute, lu: DocumentLu, magasin,  # noqa: ANN001
                 embedder=None, index=None) -> DocumentAjoute | None:  # noqa: ANN001
        """Écrit le document dans la base et l'index ; marque son état.

        Renvoie None si le document a été retiré entre-temps : un retrait
        demandé pendant la lecture ne doit pas être annulé par l'intégration.
        """
        with VERROU:
            if self._lire_un(doc.idoc) is None:
                return None
            try:
                fiche, blocs = en_fiche(doc, lu)
                magasin.retirer_fiche(doc.idoc)      # rejouable sans doublon
                magasin.ecrire(Corpus(fiches=[fiche], blocs=blocs))
                chunks = decouper(fiche, blocs, [])
                magasin.ecrire_chunks(chunks)
                if embedder is not None and index is not None and chunks:
                    vecteurs = embedder.encoder([c.texte_indexe for c in chunks])
                    index.ajouter([c.cle for c in chunks], vecteurs)
            except Exception as exc:  # noqa: BLE001 — l'état doit refléter tout échec
                magasin.retirer_fiche(doc.idoc)
                return self._mettre_a_jour(
                    doc.idoc, etat="erreur",
                    message=f"Intégration impossible ({type(exc).__name__}).")
            return self._mettre_a_jour(doc.idoc, etat="pret", message="",
                                       passages=len(chunks))

    def retirer(self, idoc: int, magasin, index=None) -> DocumentAjoute | None:  # noqa: ANN001
        with VERROU:
            doc = self._oublier(idoc)
            if doc is None:
                return None
            cles = magasin.retirer_fiche(idoc)
            if index is not None:
                index.retirer(cles)
            return doc

    def _lire_un(self, idoc: int) -> dict | None:
        return next((d for d in self._lire()["documents"] if d["idoc"] == idoc), None)


def en_fiche(doc: DocumentAjoute, lu: DocumentLu) -> tuple[Fiche, list[Bloc]]:
    """Un document lu → une fiche et ses blocs, dans le modèle d'AsCoCid.

    Les paragraphes d'une section sont regroupés en blocs d'environ un passage :
    le découpage (`decouper`) accumule les blocs courts et coupe les longs, mais
    ne regroupe pas d'une section à l'autre — on lui donne donc des blocs déjà
    à la bonne taille, sans franchir les frontières de section.
    """
    fiche = Fiche(
        idoc=doc.idoc, code=f"DOC_{doc.idoc}", type=TypeFiche.DOCUMENT,
        titre=doc.titre, cree_le=doc.ajoute_le[:10], modifie_le=doc.ajoute_le[:10],
        auteurs=[Auteur(statut="Document ajouté par l'IFPC")],
        source_url=url_fichier(doc.idoc), sha256=doc.sha256,
    )
    blocs: list[Bloc] = []
    for section in lu.sections:
        titre = section.titre or (f"Page {section.page}" if section.page else "")
        courant: list[str] = []

        def vider() -> None:
            if courant:
                blocs.append(Bloc(fiche_idoc=doc.idoc, ordre=len(blocs),
                                  type=TypeBloc.SECTION, titre_section=titre,
                                  texte="\n\n".join(courant)))
                courant.clear()

        for p in section.paragraphes:
            if courant and sum(len(x) for x in courant) + len(p) > CIBLE_CAR:
                vider()
            courant.append(p)
        vider()
    return fiche, blocs


def reinjecter(bibliotheque: Bibliotheque, magasin) -> list[str]:  # noqa: ANN001
    """Réécrit dans une base fraîchement reconstruite les documents du registre.

    Appelé par `ingest extraire` : sans lui, une mise à jour d'AsCoCid effacerait
    les documents ajoutés. Renvoie les anomalies (fichier manquant, illisible).
    """
    anomalies: list[str] = []
    for doc in bibliotheque.lister():
        if doc.etat == "erreur":
            continue
        try:
            fiche, blocs = bibliotheque.relire(doc)
        except (OSError, DocumentIllisible) as exc:
            anomalies.append(f"document {doc.idoc} « {doc.titre} » : {exc}")
            continue
        magasin.ecrire(Corpus(fiches=[fiche], blocs=blocs))
    return anomalies
