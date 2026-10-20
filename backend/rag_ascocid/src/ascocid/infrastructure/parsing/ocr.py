"""OCR des illustrations en image (PNG, JPEG) : Tesseract, ligne par ligne.

Tesseract plutôt qu'un modèle de vision : sur les fiches de variété, il rend
les chiffres tels qu'imprimés (17 valeurs justes sur 17 à l'essai), là où un
petit modèle de vision local en inventait (« 66 » lu « 68 », « érigé » lu
« dirigé ») sans le signaler. Ses erreurs à lui sont repérables : il donne une
confiance par mot, que la page de relecture surligne.

Tesseract est un outil du poste qui produit les transcriptions, une fois : il
n'entre pas dans l'image du service.
"""

from __future__ import annotations

import csv
import io
import re
import shutil
import subprocess
import tempfile
from pathlib import Path

from pydantic import BaseModel, Field

# En dessous, le mot est signalé à la relecture : réglé sur l'essai des fiches
# de variété, où les seules erreurs (exposants, formules chimiques) tombaient
# sous ce seuil.
CONFIANCE_MIN = 80


class LigneOcr(BaseModel):
    texte: str
    confiance: float                    # du mot le moins sûr de la ligne
    confiance_moyenne: float = 100.0
    nb_mots: int = 0
    douteux: list[str] = Field(default_factory=list)
    paragraphe: int = 0                 # paragraphe détecté par Tesseract : une ligne
                                        # qui en continue une autre y appartient
    gauche: int = 0                     # position, pour retrouver la ligne sur l'image
    haut: int = 0
    droite: int = 0
    bas: int = 0


class TesseractAbsent(RuntimeError):
    pass


def disponible() -> bool:
    return shutil.which("tesseract") is not None


def preparer(image: bytes, moitie: str = "") -> bytes:
    """Image prête pour Tesseract : fond blanc, page de texte seule, agrandie.

    * Fond blanc : plusieurs fiches sont des PNG avec transparence ; posé tel
      quel, le fond transparent devient noir et le texte noir disparaît
      (9 fiches de variété rendaient un texte vide).
    * `moitie` (« gauche » ou « droite ») : les fiches de variété sont des
      doubles pages, texte d'un côté, photo des fruits de l'autre. Lue entière,
      la photo ajoute du bruit. Le côté du texte varie (9 fiches l'ont à
      droite) : `lire` essaie les deux.
    * Agrandie ×2 : Tesseract lit mieux vers 300 dpi.
    """
    import pymupdf

    pix = pymupdf.Pixmap(image)
    if pix.alpha:
        doc = pymupdf.open()
        page = doc.new_page(width=pix.width, height=pix.height)
        page.draw_rect(page.rect, color=None, fill=(1, 1, 1))
        page.insert_image(page.rect, pixmap=pix)
        pix = page.get_pixmap(alpha=False)
    elif pix.n not in (1, 3):
        pix = pymupdf.Pixmap(pymupdf.csRGB, pix)
    largeur = pix.width * (0.5 if moitie else 1.0)
    decalage = -largeur if moitie == "droite" else 0
    doc = pymupdf.open()
    page = doc.new_page(width=largeur, height=pix.height)
    page.draw_rect(page.rect, color=None, fill=(1, 1, 1))
    page.insert_image(pymupdf.Rect(decalage, 0, decalage + pix.width, pix.height), pixmap=pix)
    facteur = 2 if pix.width < 2000 else 1
    sortie = page.get_pixmap(matrix=pymupdf.Matrix(facteur, facteur), clip=page.rect, alpha=False)
    return sortie.tobytes("png")


def lire(image: bytes, langue: str = "fra", double_page: bool = False) -> list[LigneOcr]:
    """Lignes de texte, dans l'ordre de lecture, avec leur confiance.

    `double_page` : l'image est une double page texte | photo (fiches de
    variété). Les deux moitiés sont lues, et la plus riche en mots est gardée.
    """
    if not disponible():
        raise TesseractAbsent("Tesseract n'est pas installé (paquet tesseract-ocr-fra).")
    import pymupdf

    pix = pymupdf.Pixmap(image)
    if not (double_page and pix.width / pix.height > 1.2):
        return _ocr(preparer(image), langue)
    lectures = [_ocr(preparer(image, cote), langue) for cote in ("gauche", "droite")]
    return max(lectures, key=lambda lignes: sum(
        len(re.findall(r"[^\W\d_]{3,}", l.texte)) for l in lignes))


def lire_mise_en_page_libre(image_png: bytes, langue: str = "fra") -> list[LigneOcr]:
    """OCR d'une image dont le texte est éparpillé (carte conceptuelle rendue).

    Mode « texte épars » : chaque case est lue pour elle-même, sans chercher de
    colonnes ; les positions des lignes, en pixels de l'image donnée,
    permettent de les ranger ensuite dans leurs cases.
    """
    if not disponible():
        raise TesseractAbsent("Tesseract n'est pas installé (paquet tesseract-ocr-fra).")
    return _ocr(image_png, langue, psm="11")


def lire_bloc(image_png: bytes, langue: str = "fra") -> list[LigneOcr]:
    """OCR d'un petit bloc de texte isolé (une case de carte conceptuelle)."""
    if not disponible():
        raise TesseractAbsent("Tesseract n'est pas installé (paquet tesseract-ocr-fra).")
    return _ocr(image_png, langue, psm="6")


def _ocr(image_preparee: bytes, langue: str, psm: str = "4") -> list[LigneOcr]:
    with tempfile.TemporaryDirectory() as dossier:
        entree = Path(dossier) / "page.png"
        entree.write_bytes(image_preparee)
        # psm 4 : une colonne de texte de tailles variables — la mise en page
        # des fiches. Les autres modes mélangeaient les colonnes de la photo.
        tsv = subprocess.run(
            ["tesseract", str(entree), "stdout", "-l", langue, "--psm", psm, "tsv"],
            capture_output=True, text=True, check=True).stdout
    return lignes_depuis_tsv(tsv)


def lignes_depuis_tsv(tsv: str) -> list[LigneOcr]:
    """Regroupe la sortie TSV de Tesseract (un mot par ligne) en lignes de texte."""
    lignes: dict[tuple[int, int, int], list[dict]] = {}
    for mot in csv.DictReader(io.StringIO(tsv), delimiter="\t", quoting=csv.QUOTE_NONE):
        if mot.get("level") != "5" or not (mot.get("text") or "").strip():
            continue
        cle = (int(mot["block_num"]), int(mot["par_num"]), int(mot["line_num"]))
        lignes.setdefault(cle, []).append(mot)
    sortie = []
    paragraphes = {p: i for i, p in enumerate(sorted({c[:2] for c in lignes}))}
    for cle in sorted(lignes):
        mots = lignes[cle]
        if _bruit([m["text"] for m in mots]):
            continue
        confiances = [float(m["conf"]) for m in mots]
        sortie.append(LigneOcr(
            texte=" ".join(m["text"] for m in mots),
            confiance=min(confiances),
            # Une ponctuation isolée n'est pas un mot à vérifier : le relecteur
            # ne saurait qu'en faire.
            douteux=[m["text"] for m in mots if float(m["conf"]) < CONFIANCE_MIN
                     and re.search(r"\w", m["text"])],
            confiance_moyenne=sum(confiances) / len(confiances), nb_mots=len(mots),
            paragraphe=paragraphes[cle[:2]],
            gauche=min(int(m["left"]) for m in mots), haut=min(int(m["top"]) for m in mots),
            droite=max(int(m["left"]) + int(m["width"]) for m in mots),
            bas=max(int(m["top"]) + int(m["height"]) for m in mots),
        ))
    return sortie


def _bruit(mots: list[str]) -> bool:
    """Une ligne de traits de tableau ou de taches de photo (« | D EE = »).

    Ni mot d'au moins trois lettres, ni chiffre : rien qu'un relecteur puisse
    corriger, et rien qui aide la recherche. Une valeur courte reste gardée
    (« 3e. », « 66 ») : elle contient un chiffre.
    """
    return not any(re.search(r"[^\W\d_]{3}", m) or re.search(r"\d", m) for m in mots)
