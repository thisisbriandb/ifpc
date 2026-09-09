"""Modèle canonique d'AsCoCid.

Révision du modèle générique de la spec 02 au vu de la Phase 0 : AsCoCid n'a ni
code documentaire réglementaire, ni indice de révision, ni statut de validité.
L'unité est la **fiche**, identifiée par son `idoc` numérique et porteuse d'un
code métier stable (`FICHE_…`, `CMAP_…`, `FDC_…`).

Deux graphes se rejoignent sur la fiche :
  - graphe de navigation : Carte --Zone--> Fiche   (zones cliquables des schémas)
  - graphe éditorial     : Fiche --Renvoi--> Fiche (« voir aussi »)
"""

from __future__ import annotations

from enum import StrEnum

from pydantic import BaseModel, Field


class TypeFiche(StrEnum):
    ARTICLE = "FICHE"      # article rédigé — 90 % du texte
    CARTE = "CMAP"         # carte conceptuelle
    VARIETE = "FDC"        # fiche de variété — contenu uniquement dans l'image
    PROCESS = "PROCESS"    # diagramme de procédé
    MENU = "MENU"
    GRAPHE = "GRAPHE"
    INCONNU = "INCONNU"

    @classmethod
    def depuis_code(cls, code: str) -> TypeFiche:
        prefixe = code.split("_", 1)[0].upper() if code else ""
        try:
            return cls(prefixe)
        except ValueError:
            return cls.INCONNU


class TypeBloc(StrEnum):
    RESUME = "resume"
    SECTION = "section"          # paragraphe rattaché à un titre de section
    DEFINITION = "definition"    # .defbox
    MOTCLE = "motcle"            # #motscles : « définition [ Terme ] »
    BIBLIO = "biblio"
    LEGENDE = "legende"


class Auteur(BaseModel):
    statut: str = ""
    affiliation: str = ""
    courriel: str = ""


class Fiche(BaseModel):
    idoc: int
    code: str = ""
    type: TypeFiche = TypeFiche.INCONNU
    titre: str
    cree_le: str = ""
    modifie_le: str = ""
    illustration: str = ""       # nom du fichier SVG/PNG servi par download.php
    auteurs: list[Auteur] = Field(default_factory=list)
    source_url: str = ""
    sha256: str = ""

    @property
    def id(self) -> str:
        return f"ascocid://fiche/{self.code or self.idoc}"

    @property
    def porte_du_texte(self) -> bool:
        return self.type in (TypeFiche.ARTICLE,)


class Bloc(BaseModel):
    """Unité sémantique issue du parsing, avant découpage pour l'index.

    Séparer Bloc et Chunk permet de rejouer le découpage sans re-parser
    (spec 02 §2.2) — le parsing est fait une fois, la stratégie de chunking
    évoluera plusieurs fois.
    """

    fiche_idoc: int
    ordre: int
    type: TypeBloc
    texte: str
    titre_section: str = ""
    terme: str = ""              # pour TypeBloc.MOTCLE

    @property
    def nb_car(self) -> int:
        return len(self.texte)


class Carte(BaseModel):
    """Vue `navig.php` d'une fiche : illustration SVG + surcouche de zones."""

    idoc: int
    svg: str
    largeur: int
    hauteur: int


class Zone(BaseModel):
    """Zone cliquable positionnée sur une carte — une « étape » du schéma."""

    carte_idoc: int
    ordre: int
    libelle: str
    x: int
    y: int
    cible_idoc: int


class OrigineRenvoi(StrEnum):
    VOIRAUSSI = "voiraussi"   # bloc « Voir aussi » en pied de fiche
    CORPS = "corps"           # lien inséré dans le texte de l'article


class Renvoi(BaseModel):
    """Arête éditoriale entre deux fiches.

    L'origine est conservée : un renvoi placé dans le corps d'un paragraphe est
    contextuel (il porte un sens local), là où un « voir aussi » est un lien de
    parenté générale. Le retrieval peut les pondérer différemment.
    """

    source_idoc: int
    cible_idoc: int
    libelle: str = ""
    origine: OrigineRenvoi = OrigineRenvoi.VOIRAUSSI


class Corpus(BaseModel):
    fiches: list[Fiche] = Field(default_factory=list)
    blocs: list[Bloc] = Field(default_factory=list)
    cartes: list[Carte] = Field(default_factory=list)
    zones: list[Zone] = Field(default_factory=list)
    renvois: list[Renvoi] = Field(default_factory=list)
