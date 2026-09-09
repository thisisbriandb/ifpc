"""Embeddings multilingues locaux (spec 04 §4).

`intfloat/multilingual-e5-base` : 768 dimensions, bon niveau sur le français
technique, ~1,1 Go en mémoire. Retenu plutôt que BGE-M3 parce que l'argument
principal de BGE-M3 — produire dense *et* sparse en une passe — ne vaut pas ici :
la voie lexicale est déjà couverte par FTS5, qui traite mieux les termes exacts
du glossaire.

Local dans tous les cas : c'est le composant qui voit 100 % du corpus, et cela
retire une dépendance réseau du chemin de requête.

⚠️ Les modèles E5 exigent un préfixe : « query: » pour une requête,
« passage: » pour un document. L'oublier dégrade silencieusement le rappel —
aucune erreur, juste de moins bons résultats.
"""

from __future__ import annotations

from functools import cached_property

MODELE = "intfloat/multilingual-e5-base"


class EmbedderE5:
    def __init__(self, modele: str = MODELE) -> None:
        self._nom = modele

    @cached_property
    def _modele(self):  # noqa: ANN202 - type fourni par sentence_transformers
        from sentence_transformers import SentenceTransformer

        return SentenceTransformer(self._nom)

    def encoder(self, textes: list[str], *, requete: bool = False) -> list[list[float]]:
        prefixe = "query: " if requete else "passage: "
        vecteurs = self._modele.encode(
            [prefixe + t for t in textes],
            batch_size=16,
            normalize_embeddings=True,
            show_progress_bar=len(textes) > 200,
        )
        return [v.tolist() for v in vecteurs]

    @property
    def dimension(self) -> int:
        return int(self._modele.get_embedding_dimension())

    @property
    def identifiant_modele(self) -> str:
        return self._nom
