"""Port de génération de réponse.

Le noyau ne connaît qu'une interface : on lui donne une question, des passages
et un contexte de graphe, il reçoit un flux de texte et des citations. Quel
fournisseur est derrière ne remonte jamais jusqu'ici.
"""

from __future__ import annotations

from collections.abc import Iterator
from typing import Protocol

from pydantic import BaseModel

from ascocid.domain.ports.recherche import Passage


class Citation(BaseModel):
    """Un rattachement entre une affirmation et un passage fourni."""

    source_index: int          # position dans la liste de passages envoyée
    extrait: str = ""          # texte cité, quand le fournisseur le renvoie
    verifiee: bool = False     # l'extrait a été retrouvé dans le passage


class Usage(BaseModel):
    entree: int = 0
    cache_lu: int = 0
    cache_ecrit: int = 0
    sortie: int = 0
    cout_usd: float = 0.0


class Reponse(BaseModel):
    texte: str = ""
    citations: list[Citation] = []
    usage: Usage = Usage()
    modele: str = ""
    # Le fournisseur a interrompu la génération avant la fin. Une réponse
    # coupée au milieu d'une phrase ne doit jamais être présentée comme une
    # réponse complète : sur un référentiel technique, la moitié d'une
    # consigne est plus dangereuse qu'une absence de consigne.
    tronquee: bool = False


class GenerateurReponse(Protocol):
    def repondre(
        self, question: str, passages: list[Passage], contexte: dict, carte: str,
    ) -> Iterator[dict]:
        """Émet {"type":"delta","texte":…} puis {"type":"fin","reponse":Reponse}."""
        ...

    @property
    def identifiant_modele(self) -> str: ...
