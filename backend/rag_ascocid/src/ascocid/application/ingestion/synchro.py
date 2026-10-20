"""Remplacer à chaud une famille de passages dans la base et l'index.

Les passages qui ne viennent pas du texte des pages AsCoCid — schémas
transcrits, illustrations transcrites — sont régénérés quand leur source
change, sans reconstruire tout l'index : on retire les passages de ce type, on
écrit les nouveaux, on ne vectorise qu'eux. Une empreinte, gardée en base, dit
s'il y a du travail.
"""

from __future__ import annotations

from collections.abc import Callable

from ascocid.application.ingestion.chunking import Chunk


def synchroniser(magasin, type_chunk: str, cle_meta: str, empreinte: str,  # noqa: ANN001
                 construire: Callable[[], tuple[list[Chunk], list[str]]],
                 embedder=None, index=None, *, vide: bool = False,  # noqa: ANN001
                 ) -> tuple[int | None, list[str]]:
    """Remplace les passages `type_chunk` si `empreinte` a changé.

    `vide` : la source ne produit aucun passage. Zéro passage en base est alors
    l'état attendu, pas le signe d'une base reconstruite à reremplir.

    Renvoie (nombre de passages écrits, ou None si rien n'avait changé ; anomalies).
    Sans index vectoriel, l'empreinte est notée « lexicale » : le jour où
    l'index revient, les passages sont régénérés avec leurs vecteurs.
    """
    avec_vecteurs = embedder is not None and index is not None
    attendue = empreinte + ("" if avec_vecteurs else ":lexical")
    deja = magasin.cx.execute(
        "SELECT count(*) FROM chunk WHERE type=?", (type_chunk,)).fetchone()[0]
    if magasin.lire_meta(cle_meta) == attendue and (deja or vide):
        return None, []

    anciennes = magasin.retirer_chunks_de_type(type_chunk)
    if index is not None:
        index.retirer(anciennes)
    nouveaux, anomalies = construire()
    magasin.ecrire_chunks(nouveaux)
    if avec_vecteurs and nouveaux:
        index.ajouter([c.cle for c in nouveaux],
                      embedder.encoder([c.texte_indexe for c in nouveaux]))
    magasin.ecrire_meta(cle_meta, attendue)
    return len(nouveaux), anomalies
