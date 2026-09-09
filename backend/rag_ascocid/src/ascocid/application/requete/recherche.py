"""Recherche hybride : lexical + dense, fusionnés, puis étendus par le graphe.

Ordre imposé par la spec 04 §1. Les deux voies ne se remplacent pas :

  - **lexicale (FTS5)** : imbattable sur les termes exacts du glossaire et les
    titres. « Brettanomyces », « pectinestérase », « code de régression de
    l'amidon » sont des jetons rares que l'embedding dilue.
  - **dense** : rattrape l'écart de vocabulaire entre la question du producteur
    et la langue des fiches — « mon cidre est trouble » vs « clarification ».

Aucune des deux ne suffit seule sur ce corpus : la première rate les
reformulations, la seconde confond les termes techniques voisins.
"""

from __future__ import annotations

import re

from ascocid.domain.ports.recherche import Embedder, IndexVectoriel, Passage
from ascocid.infrastructure.graphe.sqlite import MagasinSqlite

# Mots vides français : ils polluent la requête FTS sans rien discriminer.
VIDES = frozenset("""
au aux avec ce ces dans de des du elle en et eux il je la le les leur lui ma mais me
mes moi mon ne nos notre nous on ou par pas pour qu que qui sa se ses son sur ta te
tes toi ton tu un une vos votre vous c d j l m n s t y été être avoir fait faire
comment quand quel quelle quels quelles quoi est sont a ai as ont plus moins très
il-y-a combien pourquoi où dois doit peut peuvent faut
""".split())

K_LEXICAL = 50
K_DENSE = 50
K_FUSION = 25
MAX_PAR_FICHE = 2
PART_MAX_DEFINITIONS = 0.34


def requete_fts(question: str) -> str:
    """Question en langue naturelle → requête FTS5.

    Les termes sont joints par OR : on veut du rappel à ce stade, la précision
    est l'affaire de la fusion et du reclassement.
    """
    mots = [m for m in re.findall(r"\w{3,}", question.lower()) if m not in VIDES]
    return " OR ".join(f'"{m}"' for m in dict.fromkeys(mots))


def fusion_rrf(
    classements: list[list[tuple[str, float]]], k: int = 60
) -> list[tuple[str, float]]:
    """Reciprocal Rank Fusion.

    Choisie plutôt qu'une somme pondérée de scores parce que BM25 et la
    similarité cosinus ne vivent pas sur la même échelle : les normaliser
    demanderait une calibration par corpus, que RRF évite entièrement — elle ne
    regarde que les rangs.
    """
    scores: dict[str, float] = {}
    for classement in classements:
        for rang, (cle, _) in enumerate(classement, start=1):
            scores[cle] = scores.get(cle, 0.0) + 1.0 / (k + rang)
    return sorted(scores.items(), key=lambda kv: -kv[1])


class RechercheHybride:
    def __init__(
        self,
        magasin: MagasinSqlite,
        embedder: Embedder | None = None,
        index: IndexVectoriel | None = None,
    ) -> None:
        self.magasin = magasin
        self.embedder = embedder
        self.index = index

    def chercher(self, question: str, k: int = K_FUSION) -> list[Passage]:
        lexical = self.magasin.recherche_lexicale(requete_fts(question), K_LEXICAL)

        dense: list[tuple[str, float]] = []
        if self.embedder and self.index:
            vecteur = self.embedder.encoder([question], requete=True)[0]
            dense = self.index.chercher(vecteur, K_DENSE)

        classements = [c for c in (lexical, dense) if c]
        if not classements:
            return []
        fusionnes = self._diversifier(fusion_rrf(classements), k)

        lignes = self.magasin.chunks_par_cles([c for c, _ in fusionnes])
        rangs_lex = {c: i for i, (c, _) in enumerate(lexical)}
        rangs_den = {c: i for i, (c, _) in enumerate(dense)}

        passages: list[Passage] = []
        for cle, score in fusionnes:
            l = lignes.get(cle)
            if l is None:
                continue
            if cle in rangs_lex and cle in rangs_den:
                origine = "fusion"
            elif cle in rangs_lex:
                origine = "lexical"
            else:
                origine = "dense"
            passages.append(Passage(
                cle=cle, fiche_idoc=l["fiche_idoc"], titre_fiche=l["titre_fiche"],
                titre_section=l["titre_section"] or "", terme=l["terme"] or "",
                type=l["type"], texte=l["texte"], score=score, origine=origine,
            ))
        return passages

    def _diversifier(self, classement: list[tuple[str, float]], k: int) -> list[tuple[str, float]]:
        """Plafonne la redondance avant de couper au top-k.

        Deux garde-fous, pour deux échecs observés : plusieurs extraits de la
        même fiche évincent les points de vue complémentaires, et les
        définitions de glossaire — courtes et lexicalement denses — évincent
        les sections rédigées qui portent réellement la réponse.
        """
        lignes = self.magasin.chunks_par_cles([c for c, _ in classement])
        max_def = max(1, int(k * PART_MAX_DEFINITIONS))
        par_fiche: dict[int, int] = {}
        n_def = 0
        retenus: list[tuple[str, float]] = []
        reserve: list[tuple[str, float]] = []
        for cle, score in classement:
            l = lignes.get(cle)
            if l is None:
                continue
            if l["type"] == "definition" and n_def >= max_def:
                reserve.append((cle, score))
                continue
            if par_fiche.get(l["fiche_idoc"], 0) >= MAX_PAR_FICHE:
                reserve.append((cle, score))
                continue
            par_fiche[l["fiche_idoc"]] = par_fiche.get(l["fiche_idoc"], 0) + 1
            n_def += 1 if l["type"] == "definition" else 0
            retenus.append((cle, score))
            if len(retenus) >= k:
                return retenus
        # Si la diversité n'a pas suffi à remplir k, on complète par les écartés
        # plutôt que de renvoyer moins de passages que demandé.
        return (retenus + reserve)[:k]

    def contexte_graphe(self, idocs: list[int]) -> dict[int, dict]:
        """Voisinage des fiches retenues (spec 04 §8).

        C'est l'apport propre à AsCoCid : le modèle peut situer sa réponse dans
        le processus — « cette étape suit la clarification » — alors qu'aucune
        fiche ne contient cette phrase.
        """
        contexte: dict[int, dict] = {}
        for idoc in dict.fromkeys(idocs):
            v = self.magasin.voisinage(idoc)
            contexte[idoc] = {
                "cartes_parentes": [(r["titre"], r["libelle"]) for r in v["cartes_parentes"]][:4],
                "mene_vers": [r["libelle"] for r in v["zones_filles"]][:8],
                "voir_aussi": [r["libelle"] for r in v["renvois_sortants"]][:6],
            }
        return contexte
