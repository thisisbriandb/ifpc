"""Chaîne complète : analyse → aiguillage → réponse.

Un seul point d'entrée pour la plateforme. L'aiguillage décidé par l'analyse
détermine ce qui se passe ensuite — et trois intentions sur six ne déclenchent
aucune recherche documentaire.
"""

from __future__ import annotations

import time
from collections.abc import Iterator

from ascocid.application.requete.illustrations import illustrations_pour
from ascocid.domain.ports.analyse import Analyse, Intention
from ascocid.domain.ports.recherche import Passage

REPONSE_CONVERSATION = (
    "Je réponds aux questions sur le cidre à partir du Livre de Connaissances "
    "AsCoCid : récolte, extraction, clarification, fermentation, conditionnement, "
    "hygiène, réglementation. Posez votre question en langage courant — et pour "
    "les calculs sur vos propres lots, je vous oriente vers les outils de la "
    "plateforme."
)
REPONSE_CLARIFICATION = (
    "Je n'ai pas assez d'éléments pour chercher. Pouvez-vous préciser sur quelle "
    "étape ou quel produit porte votre question ?"
)


class Pipeline:
    def __init__(self, analyseur, recherche, generateur, verificateur,  # noqa: ANN001
                 magasin, k: int = 8,
                 base_illustrations: str = "/api/illustration") -> None:
        self.analyseur = analyseur
        self.recherche = recherche
        self.generateur = generateur
        self.verificateur = verificateur
        self.magasin = magasin
        self.k = k
        # L'URL des images dépend de l'endroit où le service est monté ; le
        # noyau n'a pas à la connaître, l'appelant la donne.
        self.base_illustrations = base_illustrations

    def repondre(
        self, question: str, historique: list[str] | None = None,
    ) -> Iterator[dict]:
        t0 = time.perf_counter()
        analyse = self.analyseur.analyser(question, historique)
        yield {"type": "analyse", "analyse": analyse.model_dump()}

        outil = self.analyseur.registre.par_id(analyse.outil_suggere)
        if outil:
            yield {"type": "outil", "outil": {
                "id": outil["id"], "nom": outil["nom"],
                "url": outil["url"], "objet": outil["objet"]}}

        # Trois chemins ne consultent pas le corpus.
        if analyse.intention is Intention.CONVERSATION:
            yield from self._direct(REPONSE_CONVERSATION, analyse, t0)
            return
        if analyse.intention is Intention.CLARIFICATION:
            yield from self._direct(REPONSE_CLARIFICATION, analyse, t0)
            return
        if analyse.intention is Intention.OUTIL and outil:
            yield from self._direct(
                f"Cette question porte sur vos propres données : l'outil "
                f"« {outil['nom']} » de la plateforme la traite directement. "
                f"{outil['objet']}", analyse, t0)
            return

        passages = self.recherche.chercher(analyse.requete_recherche, k=self.k)
        yield {"type": "sources", "passages": [
            {"index": i, "fiche_idoc": p.fiche_idoc, "titre_fiche": p.titre_fiche,
             "titre_section": p.titre_section, "terme": p.terme, "origine": p.origine,
             "url": f"https://ascocid.fr/ldc/view.php?id_document={p.fiche_idoc}"}
            for i, p in enumerate(passages, 1)]}
        # Les illustrations partent avec les sources, avant le premier mot de la
        # réponse : la plateforme peut composer sa mise en page pendant que le
        # texte arrive encore.
        illus = illustrations_pour(self.magasin, passages,
                                   base_url=self.base_illustrations)
        if illus:
            yield {"type": "illustrations",
                   "illustrations": [i.model_dump() for i in illus]}

        if not passages:
            yield from self._direct(
                "Je ne trouve rien sur ce sujet dans le Livre de Connaissances.",
                analyse, t0)
            return

        contexte = self.recherche.contexte_graphe([p.fiche_idoc for p in passages])
        carte = self.generateur.carte if hasattr(self.generateur, "carte") else ""
        texte, ttft, reponse = "", None, None
        for ev in self.generateur.repondre(
                analyse.requete_recherche, passages, contexte, carte):
            if ev["type"] == "delta":
                if ttft is None:
                    ttft = (time.perf_counter() - t0) * 1000
                texte += ev["texte"]
                yield ev
            elif ev["type"] == "fin":
                reponse = ev["reponse"]

        rapport = self.verificateur(texte, passages)
        yield {
            "type": "fin",
            "verification": {
                "bloquee": rapport.bloquee,
                "tronquee": bool(reponse and reponse.tronquee),
                "alertes": [{"gravite": a.gravite.value, "code": a.code,
                             "detail": a.detail} for a in rapport.alertes]},
            "latence": {"analyse_ms": analyse.duree_ms, "ttft_ms": round(ttft or 0),
                        "total_ms": round((time.perf_counter() - t0) * 1000)},
            "usage": reponse.usage.model_dump() if reponse else None,
        }

    def _direct(self, texte: str, analyse: Analyse, t0: float) -> Iterator[dict]:
        """Réponse sans recherche ni modèle : ni source à citer, ni rien à vérifier."""
        yield {"type": "delta", "texte": texte}
        yield {"type": "fin",
               "verification": {"bloquee": False, "tronquee": False, "alertes": []},
               "latence": {"analyse_ms": analyse.duree_ms, "ttft_ms": analyse.duree_ms,
                           "total_ms": round((time.perf_counter() - t0) * 1000)},
               "usage": None}
