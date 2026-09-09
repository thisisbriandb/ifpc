"""Orchestration de l'analyse : raccourcis déterministes, puis modèle.

Ordre volontaire — le moins cher d'abord. Une salutation ou une demande de fiche
par son titre exact n'a aucune raison de coûter un appel réseau.
"""

from __future__ import annotations

import json
import pathlib
import re
import time
import unicodedata

from ascocid.domain.ports.analyse import Analyse, AnalyseurDemande, Intention

CHEMIN_OUTILS = pathlib.Path("config/outils.json")

_SALUTATIONS = re.compile(
    r"^\s*(bonjour|salut|bonsoir|hello|coucou|merci|au revoir|ok|d'accord)\b[\s!.?]*$",
    re.IGNORECASE)
_META = re.compile(
    r"\b(que sais-tu|qui es-tu|comment (ça|tu) march|à quoi sers-tu|tu peux faire quoi"
    r"|aide[- ]moi à|comment t'utiliser)\b", re.IGNORECASE)


def _sans_accents(t: str) -> str:
    d = unicodedata.normalize("NFD", t.lower())
    return "".join(c for c in d if unicodedata.category(c) != "Mn")


class RegistreOutils:
    """Outils d'aide à la décision de la plateforme (config/outils.json)."""

    def __init__(self, chemin: pathlib.Path = CHEMIN_OUTILS) -> None:
        self.outils: list[dict] = []
        if chemin.exists():
            self.outils = json.loads(chemin.read_text(encoding="utf-8")).get("outils", [])

    def correspondance(self, question: str) -> tuple[str | None, bool]:
        """(id de l'outil, la demande a-t-elle une tournure d'action).

        Le sujet seul ne suffit pas : « pourquoi pasteuriser ? » relève du Livre,
        « quel barème pour mon lot ? » relève de l'outil. C'est la tournure qui
        tranche (spec 04 §6.0).
        """
        q = _sans_accents(question)
        for outil in self.outils:
            if not any(_sans_accents(s) in q for s in outil.get("sujets", [])):
                continue
            action = any(_sans_accents(d) in q for d in outil.get("declencheurs_action", []))
            return outil["id"], action
        return None, False

    def par_id(self, ident: str | None) -> dict | None:
        return next((o for o in self.outils if o["id"] == ident), None)

    def resume_pour_prompt(self) -> str:
        if not self.outils:
            return "Aucun outil déclaré."
        return "\n".join(
            f"- {o['id']} : {o['nom']} — {o['objet']}" for o in self.outils)


class Analyseur:
    """Raccourcis déterministes, puis délégation au modèle."""

    def __init__(self, magasin, modele: AnalyseurDemande | None = None,  # noqa: ANN001
                 registre: RegistreOutils | None = None) -> None:
        self.magasin = magasin
        self.modele = modele
        self.registre = registre or RegistreOutils()

    def analyser(self, question: str, historique: list[str] | None = None) -> Analyse:
        t0 = time.perf_counter()
        raccourci = self._raccourci(question)
        if raccourci is not None:
            raccourci.duree_ms = round((time.perf_counter() - t0) * 1000)
            return raccourci

        if self.modele is None:
            return self._repli(question, t0, "defaut")
        try:
            a = self.modele.analyser(question, historique)
        except Exception:  # noqa: BLE001 — l'analyse ne doit jamais bloquer la réponse
            return self._repli(question, t0, "repli")

        if not a.requete_recherche.strip():
            a.requete_recherche = question
        # Le sujet d'outil détecté par le registre complète le modèle : on cumule
        # plutôt que d'arbitrer, conformément à la règle de prudence.
        if a.outil_suggere is None:
            ident, action = self.registre.correspondance(question)
            if ident:
                a.outil_suggere = ident
                if action and a.intention is Intention.CORPUS and a.confiance < 0.5:
                    a.intention = Intention.OUTIL
        a.origine = "modele"
        a.duree_ms = round((time.perf_counter() - t0) * 1000)
        return a

    # ── raccourcis ──────────────────────────────────────────────────────────

    def _raccourci(self, question: str) -> Analyse | None:
        q = question.strip()
        if not q or len(q) < 3:
            return Analyse(intention=Intention.CLARIFICATION, requete_recherche=q,
                           confiance=1.0, origine="raccourci")
        if _SALUTATIONS.match(q) or _META.search(q):
            return Analyse(intention=Intention.CONVERSATION, requete_recherche=q,
                           confiance=1.0, origine="raccourci")
        if (idoc := self._titre_exact(q)) is not None:
            return Analyse(intention=Intention.LOOKUP, requete_recherche=q,
                           entites={"fiche_idoc": str(idoc)}, confiance=1.0,
                           origine="raccourci")
        return None

    # Un titre cité au passage n'est pas une demande de fiche : « quelles étapes
    # viennent après la clarification des moûts ? » contient le titre d'une fiche
    # sans être un lookup. Le raccourci exige donc que la question SOIT le titre,
    # à quelques mots de politesse près — pas qu'elle le contienne.
    _PREFIXES = re.compile(
        r"^\s*(ou (est|se trouve)|je cherche|montre[- ]moi|la fiche( sur)?|"
        r"fiche|qu'est[- ]ce que|c'est quoi)\s+(la |le |les |l')?", re.IGNORECASE)
    RATIO_TITRE_MIN = 0.75

    def _titre_exact(self, question: str) -> int | None:
        """La question est-elle, en substance, le titre d'une fiche ?"""
        q = self._PREFIXES.sub("", re.sub(r"[?!.]+$", "", question).strip())
        q = _sans_accents(q.strip())
        if len(q) < 8:
            return None
        for r in self.magasin.cx.execute("SELECT idoc, titre FROM fiche"):
            t = _sans_accents(r["titre"])
            noyau = self._PREFIXES.sub("", t)
            if q in (t, noyau):
                return int(r["idoc"])
            # inclusion tolérée seulement si les longueurs sont comparables :
            # le titre doit représenter l'essentiel de la question
            if (q in t or t in q) and min(len(q), len(t)) / max(len(q), len(t)) >= self.RATIO_TITRE_MIN:
                return int(r["idoc"])
        return None

    def _repli(self, question: str, t0: float, origine: str) -> Analyse:
        """Sans modèle ou en cas d'échec : le chemin sûr, c'est le corpus."""
        ident, action = self.registre.correspondance(question)
        return Analyse(
            intention=Intention.OUTIL if (ident and action) else Intention.CORPUS,
            requete_recherche=question, outil_suggere=ident, confiance=0.3,
            origine=origine, duree_ms=round((time.perf_counter() - t0) * 1000),
        )
