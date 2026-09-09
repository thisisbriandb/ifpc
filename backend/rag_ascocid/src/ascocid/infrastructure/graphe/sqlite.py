"""Magasin SQLite : graphe métier + métadonnées + index lexical FTS5.

À cette volumétrie (415 fiches), SQLite traverse le graphe en millisecondes
avec un `WITH RECURSIVE` ; une base graphe dédiée n'apporterait rien et
ajouterait un service à exploiter (spec 02 §4).
"""

from __future__ import annotations

import json
import sqlite3
from collections.abc import Iterable
from pathlib import Path

from ascocid.domain.modeles import Bloc, Carte, Corpus, Fiche, Renvoi, Zone

SCHEMA = """
PRAGMA journal_mode = WAL;
PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS fiche (
    idoc         INTEGER PRIMARY KEY,
    code         TEXT NOT NULL,
    type         TEXT NOT NULL,
    titre        TEXT NOT NULL,
    cree_le      TEXT,
    modifie_le   TEXT,
    illustration TEXT,
    auteurs      TEXT,           -- JSON
    source_url   TEXT NOT NULL,
    sha256       TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS ix_fiche_type ON fiche(type);
CREATE INDEX IF NOT EXISTS ix_fiche_code ON fiche(code);

CREATE TABLE IF NOT EXISTS bloc (
    id            INTEGER PRIMARY KEY,
    fiche_idoc    INTEGER NOT NULL REFERENCES fiche(idoc) ON DELETE CASCADE,
    ordre         INTEGER NOT NULL,
    type          TEXT NOT NULL,
    titre_section TEXT,
    terme         TEXT,
    texte         TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS ix_bloc_fiche ON bloc(fiche_idoc);
CREATE INDEX IF NOT EXISTS ix_bloc_type ON bloc(type);

CREATE TABLE IF NOT EXISTS carte (
    idoc     INTEGER PRIMARY KEY REFERENCES fiche(idoc) ON DELETE CASCADE,
    svg      TEXT NOT NULL,
    largeur  INTEGER NOT NULL,
    hauteur  INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS zone (
    id         INTEGER PRIMARY KEY,
    carte_idoc INTEGER NOT NULL REFERENCES carte(idoc) ON DELETE CASCADE,
    ordre      INTEGER NOT NULL,
    libelle    TEXT NOT NULL,
    x          INTEGER NOT NULL,
    y          INTEGER NOT NULL,
    cible_idoc INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS ix_zone_cible ON zone(cible_idoc);

CREATE TABLE IF NOT EXISTS renvoi (
    source_idoc INTEGER NOT NULL,
    cible_idoc  INTEGER NOT NULL,
    libelle     TEXT,
    origine     TEXT NOT NULL DEFAULT 'voiraussi',
    PRIMARY KEY (source_idoc, cible_idoc)
);
CREATE INDEX IF NOT EXISTS ix_renvoi_cible ON renvoi(cible_idoc);

CREATE TABLE IF NOT EXISTS chunk (
    cle           TEXT PRIMARY KEY,
    fiche_idoc    INTEGER NOT NULL REFERENCES fiche(idoc) ON DELETE CASCADE,
    ordre         INTEGER NOT NULL,
    type          TEXT NOT NULL,
    titre_section TEXT,
    terme         TEXT,
    texte         TEXT NOT NULL,
    contexte      TEXT
);
CREATE INDEX IF NOT EXISTS ix_chunk_fiche ON chunk(fiche_idoc);

-- Index lexical au niveau du chunk : c'est lui qui répond aux requêtes
-- contenant un terme exact du glossaire, que le vectoriel confond.
CREATE VIRTUAL TABLE IF NOT EXISTS chunk_fts USING fts5(
    cle UNINDEXED, texte,
    tokenize = "unicode61 remove_diacritics 2"
);

-- Recherche lexicale exacte : indispensable pour les termes du glossaire et
-- les titres, que le vectoriel rate (spec 04 §6.1).
CREATE VIRTUAL TABLE IF NOT EXISTS recherche USING fts5(
    cible, kind UNINDEXED, texte,
    tokenize = "unicode61 remove_diacritics 2"
);
"""


class MagasinSqlite:
    def __init__(self, chemin: str | Path = "data/ascocid.sqlite",
                 *, multi_threads: bool = False) -> None:
        self.chemin = Path(chemin)
        self.chemin.parent.mkdir(parents=True, exist_ok=True)
        # `multi_threads` sert au service HTTP : Starlette fait avancer un
        # générateur synchrone sur un pool, et deux pas consécutifs peuvent
        # tomber sur deux threads différents. Le garde-fou de sqlite3 refuse
        # alors la connexion — alors qu'un seul thread à la fois y touche, la
        # progression du générateur étant sérialisée.
        self.cx = sqlite3.connect(self.chemin, check_same_thread=not multi_threads)
        self.cx.row_factory = sqlite3.Row
        self.cx.executescript(SCHEMA)

    def __enter__(self) -> MagasinSqlite:
        return self

    def __exit__(self, *_: object) -> None:
        self.cx.commit()
        self.cx.close()

    def vider_index(self) -> None:
        for t in ("chunk_fts", "chunk"):
            self.cx.execute(f"DELETE FROM {t}")
        self.cx.commit()

    def vider(self) -> None:
        for t in ("chunk_fts", "chunk", "recherche", "renvoi", "zone", "carte", "bloc", "fiche"):
            self.cx.execute(f"DELETE FROM {t}")
        self.cx.commit()

    def ecrire(self, corpus: Corpus) -> None:
        cx = self.cx
        cx.executemany(
            "INSERT OR REPLACE INTO fiche VALUES (?,?,?,?,?,?,?,?,?,?)",
            [(f.idoc, f.code, f.type.value, f.titre, f.cree_le, f.modifie_le,
              f.illustration, json.dumps([a.model_dump() for a in f.auteurs],
                                         ensure_ascii=False),
              f.source_url, f.sha256) for f in corpus.fiches],
        )
        cx.executemany(
            "INSERT INTO bloc (fiche_idoc,ordre,type,titre_section,terme,texte)"
            " VALUES (?,?,?,?,?,?)",
            [(b.fiche_idoc, b.ordre, b.type.value, b.titre_section, b.terme, b.texte)
             for b in corpus.blocs],
        )
        cx.executemany(
            "INSERT OR REPLACE INTO carte VALUES (?,?,?,?)",
            [(c.idoc, c.svg, c.largeur, c.hauteur) for c in corpus.cartes],
        )
        cx.executemany(
            "INSERT INTO zone (carte_idoc,ordre,libelle,x,y,cible_idoc) VALUES (?,?,?,?,?,?)",
            [(z.carte_idoc, z.ordre, z.libelle, z.x, z.y, z.cible_idoc) for z in corpus.zones],
        )
        cx.executemany(
            "INSERT OR REPLACE INTO renvoi VALUES (?,?,?,?)",
            [(r.source_idoc, r.cible_idoc, r.libelle, r.origine.value)
             for r in corpus.renvois],
        )
        cx.executemany(
            "INSERT INTO recherche (cible,kind,texte) VALUES (?,?,?)",
            [(str(f.idoc), "fiche", f"{f.titre} {f.code}") for f in corpus.fiches]
            + [(str(b.fiche_idoc), "bloc", f"{b.terme} {b.titre_section} {b.texte}")
               for b in corpus.blocs],
        )
        cx.commit()

    def ecrire_chunks(self, chunks: list) -> None:
        self.cx.executemany(
            "INSERT OR REPLACE INTO chunk VALUES (?,?,?,?,?,?,?,?)",
            [(c.cle, c.fiche_idoc, c.ordre, c.type, c.titre_section, c.terme,
              c.texte, c.contexte) for c in chunks],
        )
        # L'index lexical porte sur le texte *indexé* (ancrage + contexte inclus),
        # pas sur le seul texte affiché : le titre de fiche et de section sont
        # souvent les mots que l'utilisateur emploie.
        self.cx.executemany(
            "INSERT INTO chunk_fts (cle, texte) VALUES (?,?)",
            [(c.cle, c.texte_indexe) for c in chunks],
        )
        self.cx.commit()

    def chunks(self) -> list[sqlite3.Row]:
        return self.cx.execute(
            "SELECT c.*, f.titre AS titre_fiche FROM chunk c"
            " JOIN fiche f ON f.idoc=c.fiche_idoc ORDER BY c.fiche_idoc, c.ordre"
        ).fetchall()

    def chunks_par_cles(self, cles: list[str]) -> dict[str, sqlite3.Row]:
        if not cles:
            return {}
        marques = ",".join("?" * len(cles))
        lignes = self.cx.execute(
            f"SELECT c.*, f.titre AS titre_fiche FROM chunk c"
            f" JOIN fiche f ON f.idoc=c.fiche_idoc WHERE c.cle IN ({marques})", cles
        ).fetchall()
        return {l["cle"]: l for l in lignes}

    def recherche_lexicale(self, requete_fts: str, k: int) -> list[tuple[str, float]]:
        if not requete_fts.strip():
            return []
        try:
            lignes = self.cx.execute(
                "SELECT cle, bm25(chunk_fts) s FROM chunk_fts"
                " WHERE chunk_fts MATCH ? ORDER BY s LIMIT ?", (requete_fts, k)
            ).fetchall()
        except sqlite3.OperationalError:
            return []           # requête FTS mal formée : la voie dense prend le relais
        return [(l["cle"], -float(l["s"])) for l in lignes]

    # ── lectures ────────────────────────────────────────────────────────────

    def compter(self) -> dict[str, int]:
        return {
            t: self.cx.execute(f"SELECT count(*) FROM {t}").fetchone()[0]
            for t in ("fiche", "bloc", "carte", "zone", "renvoi")
        }

    def invariants(self) -> list[tuple[str, int, str]]:
        """(nom, nombre d'infractions, description). 0 partout = base saine."""
        q = self.cx.execute
        controles = [
            ("I1 bloc → fiche existante",
             "SELECT count(*) FROM bloc b LEFT JOIN fiche f ON f.idoc=b.fiche_idoc"
             " WHERE f.idoc IS NULL", "un bloc référence une fiche absente"),
            ("I2 zone → fiche cible existante",
             "SELECT count(*) FROM zone z LEFT JOIN fiche f ON f.idoc=z.cible_idoc"
             " WHERE f.idoc IS NULL", "une zone pointe vers une fiche absente"),
            ("I3 renvoi → fiche cible existante",
             "SELECT count(*) FROM renvoi r LEFT JOIN fiche f ON f.idoc=r.cible_idoc"
             " WHERE f.idoc IS NULL", "un renvoi pointe vers une fiche absente"),
            ("I4 carte non vide",
             "SELECT count(*) FROM carte c WHERE NOT EXISTS"
             " (SELECT 1 FROM zone z WHERE z.carte_idoc=c.idoc)",
             "une carte n'a aucune zone cliquable"),
            ("I5 article avec du texte",
             "SELECT count(*) FROM fiche f WHERE f.type='FICHE' AND NOT EXISTS"
             " (SELECT 1 FROM bloc b WHERE b.fiche_idoc=f.idoc"
             "  AND b.type IN ('resume','section'))",
             "un article FICHE ne produit aucun bloc de texte"),
            ("I6 code de fiche présent",
             "SELECT count(*) FROM fiche WHERE code=''", "fiche sans code métier"),
            ("I7 type reconnu",
             "SELECT count(*) FROM fiche WHERE type='INCONNU'", "type de fiche non reconnu"),
        ]
        return [(nom, q(sql).fetchone()[0], desc) for nom, sql, desc in controles]

    def orphelines(self) -> list[sqlite3.Row]:
        """Fiches qu'aucune zone ni aucun renvoi n'atteint."""
        return self.cx.execute(
            "SELECT idoc, code, type, titre FROM fiche f"
            " WHERE NOT EXISTS (SELECT 1 FROM zone z WHERE z.cible_idoc=f.idoc)"
            "   AND NOT EXISTS (SELECT 1 FROM renvoi r WHERE r.cible_idoc=f.idoc)"
            " ORDER BY f.idoc"
        ).fetchall()

    def voisinage(self, idoc: int) -> dict[str, list[sqlite3.Row]]:
        """Contexte de graphe d'une fiche — alimente l'expansion (spec 04 §8)."""
        q = self.cx.execute
        return {
            "cartes_parentes": q(
                "SELECT f.idoc, f.titre, z.libelle, z.x, z.y FROM zone z"
                " JOIN fiche f ON f.idoc=z.carte_idoc WHERE z.cible_idoc=?", (idoc,)
            ).fetchall(),
            "zones_filles": q(
                "SELECT z.cible_idoc, z.libelle FROM zone z WHERE z.carte_idoc=?"
                " ORDER BY z.ordre", (idoc,)
            ).fetchall(),
            "renvois_sortants": q(
                "SELECT cible_idoc, libelle, origine FROM renvoi WHERE source_idoc=?", (idoc,)
            ).fetchall(),
            "renvois_entrants": q(
                "SELECT r.source_idoc, f.titre FROM renvoi r"
                " JOIN fiche f ON f.idoc=r.source_idoc WHERE r.cible_idoc=?", (idoc,)
            ).fetchall(),
        }
