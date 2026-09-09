"""Analyse de la demande : ce que veut l'utilisateur, avant toute recherche.

L'étage manquant de la chaîne. Il répond à trois questions d'un coup : de quel
type de demande s'agit-il, quelle requête envoyer à la recherche, et un outil de
la plateforme est-il concerné.
"""

from __future__ import annotations

from enum import StrEnum
from typing import Protocol

from pydantic import BaseModel, Field


class Intention(StrEnum):
    CORPUS = "corpus"              # question de fond → recherche + rédaction
    LOOKUP = "lookup"              # une fiche demandée par son nom
    NAVIGATION = "navigation"      # structure d'un processus, enchaînement d'étapes
    OUTIL = "outil"                # calcul sur les données de l'utilisateur → renvoi
    CONVERSATION = "conversation"  # salutation, « que sais-tu faire ? »
    CLARIFICATION = "clarification"  # demande trop vague pour être traitée


class Analyse(BaseModel):
    intention: Intention = Intention.CORPUS
    requete_recherche: str = ""
    # Toujours renseigné quand un outil est concerné, même si l'intention reste
    # CORPUS : la règle de prudence veut qu'on réponde *et* qu'on renvoie.
    outil_suggere: str | None = None
    entites: dict[str, str] = Field(default_factory=dict)
    confiance: float = 0.0
    origine: str = "defaut"        # 'raccourci' | 'modele' | 'defaut' | 'repli'
    duree_ms: int = 0

    @property
    def passe_par_le_corpus(self) -> bool:
        """Les intentions qui déclenchent une recherche documentaire."""
        return self.intention in (
            Intention.CORPUS, Intention.LOOKUP, Intention.NAVIGATION)


class AnalyseurDemande(Protocol):
    def analyser(self, question: str, historique: list[str] | None = None) -> Analyse: ...
