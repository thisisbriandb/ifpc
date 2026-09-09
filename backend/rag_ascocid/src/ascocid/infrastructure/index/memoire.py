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
"""

from __future__ import annotations

import json
from pathlib import Path

import numpy as np


class IndexMemoire:
    def __init__(self, chemin: str | Path = "data/index") -> None:
        self.chemin = Path(chemin)
        self.chemin.mkdir(parents=True, exist_ok=True)
        self._cles: list[str] = []
        self._matrice: np.ndarray | None = None

    def construire(self, cles: list[str], vecteurs: list[list[float]]) -> None:
        m = np.asarray(vecteurs, dtype=np.float32)
        # Normalisation à la construction : la recherche se réduit alors à un
        # produit matriciel, sans division par la norme à chaque requête.
        normes = np.linalg.norm(m, axis=1, keepdims=True)
        m = m / np.maximum(normes, 1e-12)
        self._cles, self._matrice = list(cles), m
        np.save(self.chemin / "vecteurs.npy", m)
        (self.chemin / "cles.json").write_text(json.dumps(cles), encoding="utf-8")

    def charger(self) -> None:
        self._matrice = np.load(self.chemin / "vecteurs.npy")
        self._cles = json.loads((self.chemin / "cles.json").read_text(encoding="utf-8"))

    def chercher(self, vecteur: list[float], k: int) -> list[tuple[str, float]]:
        if self._matrice is None:
            self.charger()
        assert self._matrice is not None
        q = np.asarray(vecteur, dtype=np.float32)
        q /= max(float(np.linalg.norm(q)), 1e-12)
        scores = self._matrice @ q
        k = min(k, len(self._cles))
        # argpartition : O(n) au lieu d'un tri complet — inutile ici à 3 500
        # vecteurs, mais gratuit et correct si le corpus décuple.
        top = np.argpartition(-scores, k - 1)[:k]
        top = top[np.argsort(-scores[top])]
        return [(self._cles[i], float(scores[i])) for i in top]

    @property
    def taille(self) -> int:
        return len(self._cles)
