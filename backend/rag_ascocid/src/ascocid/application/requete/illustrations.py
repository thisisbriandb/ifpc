"""Sélection des illustrations à joindre à une réponse.

La plateforme compose l'affichage ; nous lui fournissons de quoi le faire sans
avoir à ouvrir les fichiers : type, dimensions, orientation, poids, légende, et
— pour une carte conceptuelle — la géométrie de ses zones cliquables avec
l'étape concernée déjà repérée.

Trois natures d'image, qui n'appellent pas le même traitement :

  schema   carte conceptuelle SVG, avec zones cliquables. Vectorielle : elle
           supporte n'importe quelle taille d'affichage.
  planche  fiche de variété — l'image EST le contenu, il n'y a aucun texte
           derrière. À afficher en grand ou pas du tout.
  figure   illustration d'accompagnement d'un article rédigé.
"""

from __future__ import annotations

import json
import os
import pathlib
import re
import struct

from pydantic import BaseModel, Field

from ascocid.domain.ports.recherche import Passage

# Racine des données : le répertoire du projet en local, un volume monté en
# production (ASCOCID_DATA=/data sur Railway).
RACINE = pathlib.Path(os.environ.get("ASCOCID_DATA", "data"))
BLOBS = RACINE / "blobs"
MANIFESTE = RACINE / "manifeste.json"
MAX_PAR_REPONSE = 3


class Zone(BaseModel):
    """Zone cliquable, en pourcentage du cadre — indépendant de l'affichage."""

    libelle: str
    cible_idoc: int
    x_pct: float
    y_pct: float
    taille_pct: float
    active: bool = False


class Illustration(BaseModel):
    fiche_idoc: int
    nature: str                 # schema | planche | figure
    legende: str
    url: str
    format: str                 # svg | png
    largeur: int = 0
    hauteur: int = 0
    orientation: str = ""       # paysage | portrait | carre
    octets: int = 0
    essentielle: bool = False   # l'image porte le contenu, pas une décoration
    zones: list[Zone] = Field(default_factory=list)


def _manifeste() -> dict[str, str]:
    return json.loads(MANIFESTE.read_text()) if MANIFESTE.exists() else {}


def _dimensions(chemin: pathlib.Path, format_: str) -> tuple[int, int]:
    octets = chemin.read_bytes()[:4096]
    if format_ == "png" and octets[:8] == b"\x89PNG\r\n\x1a\n":
        largeur, hauteur = struct.unpack(">II", octets[16:24])
        return int(largeur), int(hauteur)
    if format_ == "svg":
        # viewBox d'abord : width/height peuvent être en unités relatives
        tete = octets.decode("utf-8", "replace")
        if (m := re.search(r'viewBox\s*=\s*"[\d.\-]+\s+[\d.\-]+\s+([\d.]+)\s+([\d.]+)"', tete)):
            return int(float(m.group(1))), int(float(m.group(2)))
        if (m := re.search(r'width\s*=\s*"([\d.]+)[^"]*"\s+height\s*=\s*"([\d.]+)', tete)):
            return int(float(m.group(1))), int(float(m.group(2)))
    return 0, 0


def _orientation(largeur: int, hauteur: int) -> str:
    if not largeur or not hauteur:
        return ""
    rapport = largeur / hauteur
    return "paysage" if rapport > 1.15 else "portrait" if rapport < 0.87 else "carre"


def illustrations_pour(
    magasin, passages: list[Passage], base_url: str = "/api/illustration",  # noqa: ANN001
    etapes_citees: set[int] | None = None, maximum: int = MAX_PAR_REPONSE,
) -> list[Illustration]:
    """Illustrations des fiches citées, dans l'ordre de pertinence des passages.

    On suit le classement de la recherche plutôt que d'inventer un critère :
    la fiche la mieux placée est celle dont l'image éclaire le plus la réponse.
    """
    # Une carte peut mener vers plusieurs fiches citées : on les marque toutes,
    # la plateforme décide ensuite lesquelles mettre en avant.
    etapes = etapes_citees or {p.fiche_idoc for p in passages}
    manifeste = _manifeste()
    vues: set[int] = set()
    resultat: list[Illustration] = []

    for p in passages:
        if p.fiche_idoc in vues or len(resultat) >= maximum:
            continue
        vues.add(p.fiche_idoc)
        sha = manifeste.get(f"{p.fiche_idoc}:img")
        if not sha:
            continue
        f = magasin.cx.execute(
            "SELECT titre, type, illustration FROM fiche WHERE idoc=?", (p.fiche_idoc,)
        ).fetchone()
        if not f or not f["illustration"]:
            continue

        chemin = BLOBS / sha[:2] / sha
        format_ = "svg" if f["illustration"].lower().endswith(".svg") else "png"
        carte = magasin.cx.execute(
            "SELECT * FROM carte WHERE idoc=?", (p.fiche_idoc,)).fetchone()

        if carte:
            nature, largeur, hauteur = "schema", carte["largeur"], carte["hauteur"]
        else:
            nature = "planche" if f["type"] == "FDC" else "figure"
            largeur, hauteur = _dimensions(chemin, format_)

        illu = Illustration(
            fiche_idoc=p.fiche_idoc, nature=nature, legende=f["titre"],
            url=f"{base_url}/{p.fiche_idoc}", format=format_,
            largeur=largeur, hauteur=hauteur,
            orientation=_orientation(largeur, hauteur),
            octets=chemin.stat().st_size,
            # Sur une fiche de variété, aucun texte n'existe derrière l'image :
            # ne pas l'afficher, c'est ne rien montrer.
            essentielle=(nature == "planche"),
        )

        if carte:
            for z in magasin.cx.execute(
                "SELECT * FROM zone WHERE carte_idoc=? ORDER BY ordre", (p.fiche_idoc,)
            ):
                illu.zones.append(Zone(
                    libelle=z["libelle"], cible_idoc=z["cible_idoc"],
                    x_pct=round(z["x"] / max(largeur, 1) * 100, 3),
                    y_pct=round(z["y"] / max(hauteur, 1) * 100, 3),
                    taille_pct=round(24 / max(largeur, 1) * 100, 3),
                    active=(z["cible_idoc"] in etapes),
                ))
        resultat.append(illu)
    return resultat
