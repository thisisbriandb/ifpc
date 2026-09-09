"""Contrôle programmatique de la réponse avant affichage.

Sans citations natives (mécanisme propre à l'API Anthropic, absent chez Gemini
pour des documents fournis par l'appelant), les marqueurs [Sn] ne sont qu'une
consigne de prompt : le modèle peut les omettre, en inventer, ou citer un
passage qui ne soutient pas son affirmation.

Cette passe est donc la seule garantie qui reste. Elle ne juge pas la qualité
de la réponse — elle vérifie que ce qu'elle affirme est traçable.

Contrôle central : **aucune valeur chiffrée ne doit apparaître si elle ne
figure pas dans les passages**. Un seuil inventé (« récoltez à 14 kg de
fermeté ») a exactement l'apparence d'une bonne réponse et ne se repère à
aucune relecture humaine.
"""

from __future__ import annotations

import re
import unicodedata
from enum import StrEnum

from pydantic import BaseModel

from ascocid.domain.ports.recherche import Passage

# Valeurs numériques suivies d'une unité : le cas dangereux sur un référentiel
# technique. Les nombres nus (« trois observations ») sont ignorés — trop de
# faux positifs pour aucun risque réel.
_UNITES = r"(?:kg|g/L|g|mg|°C|°|%|h|min|jours?|semaines?|mois|ans?|bar|L|hL|mL|mm|cm|µm|UFC)"
_RE_VALEUR = re.compile(rf"(\d+(?:[.,]\d+)?)\s*({_UNITES})\b", re.IGNORECASE)
# Le modèle groupe volontiers ses sources : [S2], [S2, S7], [S2,S7], [S1][S2].
# Ne reconnaître que la première forme faisait passer des réponses correctement
# sourcées pour des réponses sans aucune source.
_RE_BLOC_SOURCE = re.compile(r"\[\s*[Ss][^\]]*\]")


def marqueurs_de(texte: str) -> list[int]:
    return [int(n) for bloc in _RE_BLOC_SOURCE.findall(texte)
            for n in re.findall(r"\d+", bloc)]
# Une phrase « factuelle » porte un verbe et de la substance ; on ignore les
# amorces courtes et les titres de liste.
_RE_PHRASE = re.compile(r"[^.!?\n]+[.!?]")


class Gravite(StrEnum):
    BLOQUANTE = "bloquante"
    AVERTISSEMENT = "avertissement"


class Alerte(BaseModel):
    gravite: Gravite
    code: str
    detail: str


class Rapport(BaseModel):
    alertes: list[Alerte] = []
    marqueurs: list[int] = []

    @property
    def bloquee(self) -> bool:
        return any(a.gravite is Gravite.BLOQUANTE for a in self.alertes)


def _normaliser(texte: str) -> str:
    """Minuscules, sans accents, espaces réduits — pour comparer des valeurs."""
    t = unicodedata.normalize("NFD", texte.lower())
    t = "".join(c for c in t if unicodedata.category(c) != "Mn")
    return re.sub(r"\s+", "", t)


def _mots(texte: str) -> set[str]:
    """Jetons numériques du texte, pour repérer un nombre dont l'unité est élidée."""
    return set(re.findall(r"\d+(?:[.,]\d+)?", texte))


def verifier(reponse: str, passages: list[Passage]) -> Rapport:
    alertes: list[Alerte] = []
    corpus = _normaliser(" ".join(p.texte for p in passages))
    rapport = Rapport()

    # 1. Les marqueurs pointent-ils vers un passage réellement fourni ?
    marqueurs = marqueurs_de(reponse)
    rapport.marqueurs = sorted(set(marqueurs))
    for n in set(marqueurs):
        if not 1 <= n <= len(passages):
            alertes.append(Alerte(
                gravite=Gravite.BLOQUANTE, code="source_inexistante",
                detail=f"[S{n}] ne correspond à aucun des {len(passages)} passages fournis",
            ))

    # 2. Toute valeur chiffrée provient-elle d'un passage ?
    #
    # Attention au piège de la rédaction : les fiches élident l'unité quand elle
    # vient d'être donnée — « en dessous de 6 kg […] et au-dessus de 12 ». Une
    # réponse qui restitue « 12 kg » est alors correcte, et une recherche de la
    # chaîne « 12 kg » ne la trouve pas. Bloquer là-dessus reviendrait à rejeter
    # de bonnes réponses (c'est arrivé), donc on distingue deux cas :
    #   - le nombre est absent du corpus fourni          → bloquant
    #   - le nombre est présent, mais pas accolé à l'unité → à vérifier à l'œil
    corpus_mots = _mots(" ".join(p.texte for p in passages))
    for nombre, unite in _RE_VALEUR.findall(reponse):
        variantes = {
            _normaliser(f"{nombre}{unite}"),
            _normaliser(f"{nombre.replace(',', '.')}{unite}"),
            _normaliser(f"{nombre.replace('.', ',')}{unite}"),
        }
        if any(v in corpus for v in variantes):
            continue
        nus = {nombre, nombre.replace(",", "."), nombre.replace(".", ",")}
        if nus & corpus_mots:
            alertes.append(Alerte(
                gravite=Gravite.AVERTISSEMENT, code="unite_implicite",
                detail=f"« {nombre} » figure bien dans un passage, mais sans "
                       f"l'unité « {unite} » accolée — à vérifier",
            ))
        else:
            alertes.append(Alerte(
                gravite=Gravite.BLOQUANTE, code="valeur_non_sourcee",
                detail=f"« {nombre} {unite} » n'apparaît dans aucun passage fourni",
            ))

    # 3. Une abstention QUI CITE est le comportement voulu, pas un défaut :
    #    la règle 2 demande de s'abstenir *et* de proposer la fiche la plus
    #    proche. Un premier jet signalait ces réponses comme suspectes — il
    #    pénalisait exactement ce qu'on cherche à obtenir.
    abstention = reponse.lstrip().lower().startswith("le livre de connaissances ne traite pas")

    # 4. Les affirmations non étayées.
    if not abstention:
        phrases = [p.strip() for p in _RE_PHRASE.findall(reponse)]
        nues = [p for p in phrases if len(p) > 60 and not marqueurs_de(p)]
        if nues:
            alertes.append(Alerte(
                gravite=Gravite.AVERTISSEMENT, code="affirmation_non_etayee",
                detail=f"{len(nues)} phrase(s) sans marqueur de source : "
                       + " / ".join(p[:70] for p in nues[:2]),
            ))
        if not marqueurs:
            alertes.append(Alerte(
                gravite=Gravite.BLOQUANTE, code="aucune_source",
                detail="réponse affirmative sans aucune citation",
            ))

    rapport.alertes = alertes
    return rapport
