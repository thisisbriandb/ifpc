"""Découpage des blocs en chunks indexables (spec 04 §2).

AsCoCid rend cette étape presque triviale : les auteurs ont déjà découpé le
corpus en sections `<h2>` et en définitions de glossaire. On ne fabrique donc
pas de frontières — on respecte celles qui existent, et on n'intervient que
pour les deux cas dégénérés : la section trop longue et le bloc trop court.
"""

from __future__ import annotations

import re

from pydantic import BaseModel, Field

from ascocid.domain.modeles import Bloc, Fiche, TypeBloc

# Un token français ≈ 3 caractères. Bornes exprimées en caractères pour éviter
# de dépendre d'un tokenizer à l'ingestion.
CIBLE_CAR = 1800        # ≈ 600 tokens
MAX_CAR = 3000          # ≈ 1000 tokens, borne dure
MIN_CAR = 240           # ≈ 80 tokens : en dessous, on fusionne


class Chunk(BaseModel):
    cle: str                       # identifiant reproductible
    fiche_idoc: int
    ordre: int
    type: str
    titre_fiche: str
    titre_section: str = ""
    terme: str = ""
    texte: str                     # ce qui est affiché
    contexte: str = ""             # préfixe généré, indexé mais non affiché
    processus: list[int] = Field(default_factory=list)   # cartes parentes
    fiches_liees: list[int] = Field(default_factory=list)  # définitions : où le terme est employé

    @property
    def texte_indexe(self) -> str:
        """Ce qui part à l'embedding : contexte + ancrage + texte.

        L'ancrage (titre de fiche + section) n'est pas décoratif : sans lui,
        « Elle doit être visée sous 48 h » est irrécupérable, quel que soit le
        modèle d'embedding.
        """
        entete = self.titre_fiche
        if self.titre_section:
            entete += f" — {self.titre_section}"
        if self.terme:
            entete += f" — définition de « {self.terme} »"
        return "\n".join(x for x in (self.contexte, entete, self.texte) if x)


def _cle(fiche_idoc: int, ordre: int, texte: str) -> str:
    import hashlib
    h = hashlib.sha256(f"{fiche_idoc}:{ordre}:{texte}".encode()).hexdigest()[:16]
    return f"ascocid://chunk/{h}"


def _decouper_long(texte: str) -> list[str]:
    """Coupe une section trop longue sur des frontières de phrase."""
    if len(texte) <= MAX_CAR:
        return [texte]
    phrases = re.split(r"(?<=[.!?])\s+", texte)
    morceaux: list[str] = []
    courant = ""
    for p in phrases:
        if courant and len(courant) + len(p) + 1 > CIBLE_CAR:
            morceaux.append(courant.strip())
            courant = p
        else:
            courant = f"{courant} {p}".strip()
    if courant:
        morceaux.append(courant.strip())
    return morceaux or [texte[:MAX_CAR]]


def dedupliquer_definitions(chunks: list[Chunk]) -> list[Chunk]:
    """Une définition n'est indexée qu'une fois pour tout le corpus.

    AsCoCid rattache la même définition à chaque fiche qui emploie le terme :
    311 termes distincts produisent 1 407 blocs identiques. Indexés tels quels,
    ils saturent les résultats — une question sur un procédé remontait huit
    copies de la même entrée de glossaire, poussant hors du top-k les sections
    d'article qui portaient la réponse.

    On conserve la liste des fiches où le terme est employé : c'est une
    information de rattachement, pas une raison de dupliquer le texte.
    """
    gardes: dict[str, Chunk] = {}
    autres: list[Chunk] = []
    for c in chunks:
        if c.type != "definition":
            autres.append(c)
            continue
        cle = f"{c.terme.strip().lower()}|{c.texte.strip()[:200].lower()}"
        if cle in gardes:
            gardes[cle].fiches_liees.append(c.fiche_idoc)
        else:
            c.fiches_liees = [c.fiche_idoc]
            gardes[cle] = c
    return autres + list(gardes.values())


def decouper(fiche: Fiche, blocs: list[Bloc], cartes_parentes: list[int]) -> list[Chunk]:
    """Blocs d'une fiche → chunks. Les définitions restent entières."""
    chunks: list[Chunk] = []

    def ajouter(type_: str, texte: str, section: str = "", terme: str = "") -> None:
        texte = texte.strip()
        if len(texte) < 40:
            return
        ordre = len(chunks)
        chunks.append(Chunk(
            cle=_cle(fiche.idoc, ordre, texte),
            fiche_idoc=fiche.idoc, ordre=ordre, type=type_,
            titre_fiche=fiche.titre, titre_section=section, terme=terme,
            texte=texte, processus=cartes_parentes,
        ))

    # 1. Les définitions de glossaire sont des unités closes : jamais découpées,
    #    jamais fusionnées — chacune répond à « que veut dire X ? ».
    for b in blocs:
        if b.type is TypeBloc.MOTCLE:
            ajouter("definition", b.texte, terme=b.terme)

    # 2. Le corps rédigé : résumé puis sections, dans l'ordre de lecture.
    corps = [b for b in blocs if b.type in (TypeBloc.RESUME, TypeBloc.SECTION)]
    tampon: list[Bloc] = []

    def vider_tampon() -> None:
        if not tampon:
            return
        texte = " ".join(b.texte for b in tampon)
        ajouter("section", texte, section=tampon[0].titre_section)
        tampon.clear()

    for b in corps:
        # une section courte est accumulée avec la suivante plutôt qu'indexée seule
        if len(b.texte) < MIN_CAR:
            tampon.append(b)
            if sum(len(x.texte) for x in tampon) >= MIN_CAR:
                vider_tampon()
            continue
        vider_tampon()
        for morceau in _decouper_long(b.texte):
            ajouter("section", morceau, section=b.titre_section)
    vider_tampon()

    # 3. La bibliographie n'est pas de la connaissance : indexée à part, elle
    #    sert aux questions « d'où vient cette information ? » sans polluer le
    #    reste du rappel.
    for b in blocs:
        if b.type is TypeBloc.BIBLIO:
            ajouter("biblio", b.texte, section="Références bibliographiques")

    return chunks
