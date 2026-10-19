"""Index vectoriel en mémoire, adossé à un simple tableau numpy.

**Pourquoi pas Qdrant.** La spec 04 §4 prévoyait Qdrant sous l'hypothèse d'un
corpus de plusieurs dizaines de milliers de pages. La Phase 0 a mesuré la
réalité : ~3 500 chunks. À cette taille, les vecteurs pèsent 10 Mo et une
recherche exhaustive par produit scalaire coûte moins d'une milliseconde — soit
*moins* que le seul aller-retour réseau vers un service externe. Ajouter une
base vectorielle ici, c'est un conteneur à exploiter, une dépendance à mettre à
jour et un mode de panne supplémentaire, pour un gain négatif.

L'interface `IndexVectoriel` reste respectée : le jour où le corpus grandit d'un
facteur cent, on écrit un adaptateur Qdrant et rien d'autre ne bouge.

**Ajouts à chaud.** Les documents déposés par les administrateurs entrent dans
l'index sans redémarrer le service (`ajouter`, `retirer`). Les clés et la
matrice forment donc un seul état, remplacé d'un bloc : une recherche en cours
garde l'ancien, la suivante voit le nouveau, et aucune ne voit des clés d'une
version avec la matrice de l'autre.
"""

from __future__ import annotations

import json
import os
from pathlib import Path

import numpy as np


def _normaliser(vecteurs: list[list[float]]) -> np.ndarray:
    m = np.asarray(vecteurs, dtype=np.float32).reshape(len(vecteurs), -1)
    # Normalisation à la construction : la recherche se réduit alors à un
    # produit matriciel, sans division par la norme à chaque requête.
    normes = np.linalg.norm(m, axis=1, keepdims=True)
    return m / np.maximum(normes, 1e-12)


class IndexMemoire:
    def __init__(self, chemin: str | Path = "data/index") -> None:
        self.chemin = Path(chemin)
        self.chemin.mkdir(parents=True, exist_ok=True)
        self._etat: tuple[list[str], np.ndarray] | None = None

    def construire(self, cles: list[str], vecteurs: list[list[float]]) -> None:
        self._remplacer(list(cles), _normaliser(vecteurs))

    def ajouter(self, cles: list[str], vecteurs: list[list[float]]) -> None:
        """Ajoute des vecteurs ; une clé déjà présente est remplacée."""
        if not cles:
            return
        try:
            anciennes, matrice = self._courant()
        except FileNotFoundError:
            self.construire(cles, vecteurs)
            return
        nouvelles = set(cles)
        garder = [i for i, c in enumerate(anciennes) if c not in nouvelles]
        self._remplacer(
            [anciennes[i] for i in garder] + list(cles),
            np.vstack([matrice[garder], _normaliser(vecteurs)]),
        )

    def retirer(self, cles: list[str]) -> None:
        if not cles:
            return
        try:
            anciennes, matrice = self._courant()
        except FileNotFoundError:
            return
        a_retirer = set(cles)
        garder = [i for i, c in enumerate(anciennes) if c not in a_retirer]
        if len(garder) == len(anciennes):
            return
        self._remplacer([anciennes[i] for i in garder], matrice[garder])

    def charger(self) -> None:
        matrice = np.load(self.chemin / "vecteurs.npy")
        cles = json.loads((self.chemin / "cles.json").read_text(encoding="utf-8"))
        self._etat = (cles, matrice)

    def chercher(self, vecteur: list[float], k: int) -> list[tuple[str, float]]:
        cles, matrice = self._courant()
        if not cles:
            return []
        q = np.asarray(vecteur, dtype=np.float32)
        q /= max(float(np.linalg.norm(q)), 1e-12)
        scores = matrice @ q
        k = min(k, len(cles))
        # argpartition : O(n) au lieu d'un tri complet — inutile ici à 3 500
        # vecteurs, mais gratuit et correct si le corpus décuple.
        top = np.argpartition(-scores, k - 1)[:k]
        top = top[np.argsort(-scores[top])]
        return [(cles[i], float(scores[i])) for i in top]

    @property
    def taille(self) -> int:
        return len(self._etat[0]) if self._etat else 0

    def _courant(self) -> tuple[list[str], np.ndarray]:
        if self._etat is None:
            self.charger()
        assert self._etat is not None
        return self._etat

    def _remplacer(self, cles: list[str], matrice: np.ndarray) -> None:
        # Fichiers temporaires puis renommage : un arrêt au milieu de
        # l'écriture laisse l'ancien index intact, jamais un fichier tronqué.
        tmp_vecteurs = self.chemin / "vecteurs.tmp.npy"
        tmp_cles = self.chemin / "cles.tmp.json"
        np.save(tmp_vecteurs, matrice)
        tmp_cles.write_text(json.dumps(cles), encoding="utf-8")
        os.replace(tmp_vecteurs, self.chemin / "vecteurs.npy")
        os.replace(tmp_cles, self.chemin / "cles.json")
        self._etat = (cles, matrice)
