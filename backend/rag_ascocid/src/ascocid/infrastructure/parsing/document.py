"""Lecture des documents ajoutés par les administrateurs : PDF et Word.

Le corpus AsCoCid arrive déjà découpé par ses auteurs (sections `<h2>`,
définitions). Un PDF ou un .docx n'offre pas cette structure toute faite : on
la reconstitue — titres de section, paragraphes — pour que le découpage en
passages (`application/ingestion/chunking`) retrouve des frontières qui ont un
sens, plutôt que de couper au kilo.

Deux limites assumées :

* **Pas d'OCR.** Un PDF scanné ne porte pas de texte : il est refusé avec un
  message qui le dit, plutôt qu'indexé vide — un document présent dans la
  liste mais introuvable par l'assistant serait pire qu'un refus.
* **Le titre de section est deviné.** Dans un PDF, un titre n'est qu'une ligne
  en plus gros caractères ; la règle ci-dessous suffit aux documents
  techniques courants, et une erreur ne coûte qu'un intitulé moins précis.
"""

from __future__ import annotations

import io
import re
from collections import Counter

from pydantic import BaseModel

# En dessous, le PDF est très probablement une image : rien à indexer.
MIN_CAR_DOCUMENT = 200
# Un titre de section est court et ne finit pas comme une phrase.
MAX_CAR_TITRE = 150
# Taille relative à partir de laquelle une ligne est tenue pour un titre.
RATIO_TITRE = 1.15


class DocumentIllisible(ValueError):
    """Le fichier ne peut pas alimenter l'assistant. Le message est pour l'admin."""


class Section(BaseModel):
    titre: str = ""
    paragraphes: list[str]
    page: int = 0               # première page de la section (PDF), 0 sinon


class DocumentLu(BaseModel):
    titre: str                  # titre détecté ; l'admin peut le remplacer
    sections: list[Section]

    @property
    def nb_car(self) -> int:
        return sum(len(p) for s in self.sections for p in s.paragraphes)


FORMATS = {".pdf": "pdf", ".docx": "docx"}


def format_de(nom_fichier: str) -> str:
    """Format reconnu d'après l'extension, ou DocumentIllisible."""
    extension = "." + nom_fichier.rsplit(".", 1)[-1].lower() if "." in nom_fichier else ""
    if extension == ".doc":
        raise DocumentIllisible(
            "L'ancien format Word (.doc) n'est pas lu : l'enregistrer en .docx "
            "ou en PDF depuis Word, puis l'envoyer à nouveau.")
    try:
        return FORMATS[extension]
    except KeyError:
        raise DocumentIllisible("Seuls les fichiers PDF et Word (.docx) sont acceptés.") from None


def lire(octets: bytes, nom_fichier: str) -> DocumentLu:
    """Point d'entrée unique : le format est déduit du nom du fichier."""
    fmt = format_de(nom_fichier)
    doc = lire_pdf(octets) if fmt == "pdf" else lire_docx(octets)
    if not doc.titre:
        doc.titre = _titre_depuis_nom(nom_fichier)
    if doc.nb_car < MIN_CAR_DOCUMENT:
        if fmt == "pdf":
            raise DocumentIllisible(
                "Ce PDF ne contient pas de texte sélectionnable : c'est probablement "
                "un document scanné. L'assistant ne lit que le texte ; en exporter "
                "une version texte (ou passer le scan dans un logiciel de "
                "reconnaissance de caractères) avant de l'envoyer.")
        raise DocumentIllisible("Ce document ne contient presque pas de texte.")
    return doc


def _titre_depuis_nom(nom_fichier: str) -> str:
    base = nom_fichier.rsplit("/", 1)[-1].rsplit("\\", 1)[-1]
    base = base.rsplit(".", 1)[0]
    return re.sub(r"[_\-]+", " ", base).strip() or "Document sans titre"


def _propre(texte: str) -> str:
    # Les césures de fin de ligne des PDF (« fermen-\ntation ») et les espaces
    # multiples gênent autant la recherche lexicale que la lecture.
    texte = re.sub(r"(\w)-\n(\w)", r"\1\2", texte)
    return re.sub(r"\s+", " ", texte).strip()


# ── PDF ──────────────────────────────────────────────────────────────────────


def lire_pdf(octets: bytes) -> DocumentLu:
    import pymupdf

    try:
        pdf = pymupdf.open(stream=octets, filetype="pdf")
    except Exception as exc:  # noqa: BLE001 — tout échec d'ouverture vaut refus
        raise DocumentIllisible("Ce fichier n'est pas un PDF lisible.") from exc
    if pdf.needs_pass:
        raise DocumentIllisible("Ce PDF est protégé par un mot de passe.")

    # 1. Lignes de chaque page, avec la taille de leur plus grand caractère.
    pages: list[list[tuple[str, float]]] = []
    tailles: Counter[float] = Counter()
    for page in pdf:
        lignes: list[tuple[str, float]] = []
        for bloc in page.get_text("dict")["blocks"]:
            for ligne in bloc.get("lines", []):
                spans = [s for s in ligne["spans"] if s["text"].strip()]
                if not spans:
                    continue
                texte = "".join(s["text"] for s in spans).strip()
                taille = round(max(s["size"] for s in spans), 1)
                lignes.append((texte, taille))
                tailles[taille] += len(texte)
            # Fin de bloc = fin de paragraphe dans la mise en page du PDF.
            lignes.append(("", 0.0))
        pages.append(lignes)

    titre_meta = (pdf.metadata or {}).get("title", "").strip()
    pdf.close()
    if not tailles:
        return DocumentLu(titre=titre_meta, sections=[])

    # 2. En-têtes et pieds de page : les lignes de bord de page (deux premières,
    #    deux dernières) qui reviennent sur plus de la moitié des pages.
    #    Indexées, elles feraient remonter chaque page sur le nom du document ou
    #    de l'organisme. Seuls les bords sont examinés : une phrase répétée dans
    #    le corps du texte (un avertissement, une consigne) reste du contenu.
    def gabarit(t: str) -> str:
        return re.sub(r"\d+", "#", t.lower())

    def bords(lignes: list[tuple[str, float]]) -> set[str]:
        textes = [t for t, _ in lignes if t]
        return {gabarit(t) for t in textes[:2] + textes[-2:]}

    repetees: set[str] = set()
    if len(pages) >= 3:
        par_ligne: Counter[str] = Counter()
        for lignes in pages:
            par_ligne.update(bords(lignes))
        repetees = {g for g, n in par_ligne.items() if n > len(pages) / 2}

    # 3. La taille du corps de texte est celle qui porte le plus de caractères.
    corps = tailles.most_common(1)[0][0]

    sections: list[Section] = []
    courante = Section(titre="", paragraphes=[], page=1)
    paragraphe: list[str] = []

    def fermer_paragraphe() -> None:
        if paragraphe:
            courante.paragraphes.append(_propre("\n".join(paragraphe)))
            paragraphe.clear()

    for numero, lignes in enumerate(pages, 1):
        a_ignorer = bords(lignes) & repetees
        for texte, taille in lignes:
            if not texte:
                fermer_paragraphe()
                continue
            if gabarit(texte) in a_ignorer or re.fullmatch(r"[\d\s/.\-–]+", texte):
                continue                     # en-tête, pied ou numéro de page
            est_titre = (taille >= corps * RATIO_TITRE and len(texte) <= MAX_CAR_TITRE
                         and not texte.rstrip().endswith((".", ",", ";")))
            if est_titre:
                fermer_paragraphe()
                if courante.paragraphes:
                    sections.append(courante)
                    courante = Section(titre=_propre(texte), paragraphes=[], page=numero)
                else:
                    # Titre sur plusieurs lignes, ou titre suivi d'un sous-titre
                    # sans texte entre les deux : on les réunit.
                    if not courante.titre:
                        courante.page = numero
                    courante.titre = _propre(f"{courante.titre} {texte}")
            else:
                paragraphe.append(texte)
        fermer_paragraphe()
    if courante.paragraphes:
        sections.append(courante)

    # Une page de garde sans titre détectable précède souvent le premier :
    # on prend le premier intitulé trouvé, pas celui de la première section.
    titre = titre_meta or next((s.titre for s in sections if s.titre), "")
    return DocumentLu(titre=titre, sections=sections)


# ── Word (.docx) ─────────────────────────────────────────────────────────────


def lire_docx(octets: bytes) -> DocumentLu:
    import docx
    from docx.table import Table
    from docx.text.paragraph import Paragraph

    try:
        document = docx.Document(io.BytesIO(octets))
    except Exception as exc:  # noqa: BLE001
        raise DocumentIllisible("Ce fichier n'est pas un document Word (.docx) lisible.") from exc

    sections: list[Section] = []
    courante = Section(titre="", paragraphes=[])
    premier_titre = ""

    # Parcours du corps dans l'ordre : `document.paragraphs` omet les tableaux,
    # qui portent souvent les valeurs chiffrées qu'on vient chercher.
    for element in document.element.body.iterchildren():
        balise = element.tag.rsplit("}", 1)[-1]
        if balise == "p":
            p = Paragraph(element, document)
            texte = _propre(p.text)
            if not texte:
                continue
            style = (p.style.name if p.style is not None else "").lower()
            if style.startswith(("heading", "titre", "title")):
                premier_titre = premier_titre or texte
                if courante.paragraphes:
                    sections.append(courante)
                    courante = Section(titre=texte, paragraphes=[])
                else:
                    courante.titre = _propre(f"{courante.titre} {texte}")
            else:
                courante.paragraphes.append(texte)
        elif balise == "tbl":
            for rangee in Table(element, document).rows:
                cellules = list(dict.fromkeys(_propre(c.text) for c in rangee.cells))
                ligne = " | ".join(c for c in cellules if c)
                if ligne:
                    courante.paragraphes.append(ligne)
    if courante.paragraphes:
        sections.append(courante)

    titre = (document.core_properties.title or "").strip() or premier_titre
    return DocumentLu(titre=titre, sections=sections)
