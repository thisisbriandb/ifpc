"""Ports de la chaîne de recherche (spec 06 §3)."""

from __future__ import annotations

from typing import Protocol, runtime_checkable

from pydantic import BaseModel


class Passage(BaseModel):
    """Un chunk retrouvé, avec sa provenance et son score."""

    cle: str
    fiche_idoc: int
    titre_fiche: str
    titre_section: str = ""
    terme: str = ""
    type: str
    texte: str
    score: float = 0.0
    origine: str = ""          # 'lexical' | 'dense' | 'fusion' | 'graphe'


@runtime_checkable
class Embedder(Protocol):
    def encoder(self, textes: list[str], *, requete: bool = False) -> list[list[float]]: ...
    @property
    def dimension(self) -> int: ...
    @property
    def identifiant_modele(self) -> str: ...


@runtime_checkable
class IndexVectoriel(Protocol):
    def construire(self, cles: list[str], vecteurs: list[list[float]]) -> None: ...
    def chercher(self, vecteur: list[float], k: int) -> list[tuple[str, float]]: ...
    def charger(self) -> None: ...
    @property
    def taille(self) -> int: ...
