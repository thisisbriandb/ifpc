"""Lecture des cartes conceptuelles d'AsCoCid (CMAP) depuis leur SVG.

Une carte conceptuelle a toujours la même forme : une notion en haut, une
rangée de relations (« est une », « a pour synonymes », « est constituée de »,
« a pour causes d'échec »…), et sous chacune une colonne de cases. Le texte
des pages ne garde que les définitions du glossaire : ces relations, qui sont
le contenu de la carte, n'existaient que dans le dessin.

Contrairement aux fiches de variété, rien n'est à deviner dans le texte : le
SVG le contient tel quel. Seul le **rangement** est calculé, d'après la
géométrie, et il l'est sans heuristique fragile :

* les cases sont les images incrustées de l'export (une par case), et chaque
  ligne de texte va dans la case qui la contient ;
* les colonnes de cases, de gauche à droite, correspondent une à une aux
  relations, de gauche à droite — si les nombres diffèrent, la carte est
  signalée pour relecture plutôt que devinée ;
* une colonne est une **suite ordonnée** quand une flèche pleine relie
  chacune de ses cases à la suivante (« la pomme dans l'arbre → au sol → … »).
"""

from __future__ import annotations

import re

from pydantic import BaseModel, Field

# Une case : image d'au moins cette taille (les petites sont des décorations).
CASE_MIN = (40, 15)
# Tolérance de rattachement d'une ligne à sa case, en points.
MARGE = 3
# Au-delà, une colonne est trop loin du libellé auquel elle est rattachée pour
# que le rattachement soit sûr : la carte est signalée pour relecture.
ECART_MAX = 220


class Element(BaseModel):
    texte: str
    douteux: list[str] = Field(default_factory=list)   # mots dont l'OCR doute
    # Carte à deux niveaux : la case dont celle-ci est le détail, dessinée en
    # retrait sous elle (« La chaîne de pressage » sous « Les procédures de
    # nettoyage & désinfection du matériel »).
    parent: str = ""


class Relation(BaseModel):
    libelle: str
    elements: list[Element] = Field(default_factory=list)
    ordonnee: bool = False


class CarteLue(BaseModel):
    notion: str
    relations: list[Relation]
    anomalies: list[str] = Field(default_factory=list)
    # « svg » : texte exact. « svg+ocr » : le SVG a ses lettres en tracés (57
    # cartes sur 139) ; le texte est lu par OCR sur le rendu de la carte, la
    # géométrie (cases, flèches) reste celle du SVG.
    source: str = "svg"
    qualite: float = 100.0


class _Boite(BaseModel):
    x0: float
    y0: float
    x1: float
    y1: float
    lignes: list[tuple[float, float, str]] = Field(default_factory=list)   # (y, x, texte)
    douteux: list[str] = Field(default_factory=list)

    @property
    def texte(self) -> str:
        texte = " ".join(t for _, _, t in sorted(self.lignes))
        return re.sub(r"\s+", " ", texte).strip()

    @property
    def cx(self) -> float:
        return (self.x0 + self.x1) / 2

    def contient(self, x: float, y: float) -> bool:
        return (self.x0 - MARGE <= x <= self.x1 + MARGE
                and self.y0 - MARGE <= y <= self.y1 + MARGE)


def lire(svg: bytes) -> CarteLue:
    import pymupdf

    page = pymupdf.open(stream=svg, filetype="svg")[0]

    boites = [_Boite(x0=b[0], y0=b[1], x1=b[2], y1=b[3])
              for b in (i["bbox"] for i in page.get_image_info())
              if b[2] - b[0] >= CASE_MIN[0] and b[3] - b[1] >= CASE_MIN[1]]
    # Une même case est parfois exportée en deux images superposées.
    uniques: list[_Boite] = []
    for b in sorted(boites, key=lambda b: (b.y0, b.x0)):
        if not any(abs(b.x0 - u.x0) < 4 and abs(b.y0 - u.y0) < 4 for u in uniques):
            uniques.append(b)
    boites = uniques

    source, qualite, lignes = "svg", 100.0, _lignes_svg(page)
    # Lettres converties en tracés : le SVG n'a de texte dans aucune case.
    if not any(b.contient((l[0] + l[2]) / 2, (l[1] + l[3]) / 2) for l in lignes for b in boites):
        source, qualite, lignes = "svg+ocr", *_lignes_ocr(page, boites)

    libres: list[tuple[float, float, float, float, str]] = []   # lignes hors case
    for x0, y0, x1, y1, texte, douteux in lignes:
        cx, cy = (x0 + x1) / 2, (y0 + y1) / 2
        boite = next((b for b in boites if b.contient(cx, cy)), None)
        if boite is not None:
            boite.lignes.append((y0, x0, texte))
            boite.douteux += douteux
        else:
            libres.append((x0, y0, x1, y1, texte))

    boites = [b for b in boites if b.texte]
    if not boites:
        return CarteLue(notion="", relations=[], anomalies=["aucune case lue"],
                        source=source, qualite=0.0)
    racine = min(boites, key=lambda b: b.y0)
    cases = [b for b in boites if b is not racine]
    anomalies: list[str] = []

    # Relations : les lignes hors case sous la notion, au-dessus des cases.
    haut_cases = min((b.y0 for b in cases), default=page.rect.y1)
    candidates = [l for l in libres if racine.y1 <= l[1] and l[3] <= haut_cases + MARGE]
    relations = _regrouper_relations(candidates)

    # Colonnes : cases dont les étendues horizontales se recouvrent.
    colonnes: list[list[_Boite]] = []
    for b in sorted(cases, key=lambda b: b.x0):
        if colonnes and b.x0 < max(c.x1 for c in colonnes[-1]) - 4:
            colonnes[-1].append(b)
        else:
            colonnes.append([b])
    for c in colonnes:
        c.sort(key=lambda b: b.y0)

    paires, ecart = _apparier(relations, colonnes)
    if len(colonnes) < len(relations):
        anomalies.append(f"{len(relations)} relations pour {len(colonnes)} colonnes de cases : "
                         f"rattachement à vérifier")
    elif ecart > ECART_MAX:
        anomalies.append(f"une colonne est loin de sa relation ({ecart:.0f} points) : "
                         f"rattachement à vérifier")

    fleches = [d["rect"] for d in page.get_drawings()
               if d.get("fill") == (0.0, 0.0, 0.0) and d["rect"].width < 14 and 8 < d["rect"].height < 40]

    resultat: dict[str, Relation] = {}
    for rel, colonne in paires:
        libelle = re.sub(r"\s+", " ", rel[4]).strip() if rel else "(relation non lue)"
        r = resultat.setdefault(libelle, Relation(libelle=libelle))
        r.elements += [Element(texte=b.texte, douteux=b.douteux) for b in colonne]
        if len(colonne) > 1:
            r.ordonnee = all(_relies(a, b, fleches) for a, b in zip(colonne, colonne[1:]))
    for libelle, r in resultat.items():
        boites_rel = [b for rel, colonne in paires for b in colonne
                      if (re.sub(r"\s+", " ", rel[4]).strip() if rel else "(relation non lue)") == libelle]
        _hierarchiser(r, boites_rel)
    return CarteLue(notion=racine.texte, relations=list(resultat.values()), anomalies=anomalies,
                    source=source, qualite=qualite)


def _lignes_svg(page) -> list[tuple[float, float, float, float, str, list[str]]]:  # noqa: ANN001
    sortie = []
    for bloc in page.get_text("dict")["blocks"]:
        for ligne in bloc.get("lines", []):
            texte = "".join(s["text"] for s in ligne["spans"]).strip()
            if texte:
                sortie.append((*ligne["bbox"], texte, []))
    return sortie


def _lignes_ocr(page, boites: list[_Boite]  # noqa: ANN001
                ) -> tuple[float, list[tuple[float, float, float, float, str, list[str]]]]:
    """Texte lu par OCR sur le rendu de la carte, ramené aux coordonnées du SVG.

    Chaque case est rendue et lue isolément (un bloc de texte sur fond uni :
    le cas idéal pour Tesseract) ; lue d'un seul tenant, la carte perdait tout
    le texte posé sur les cases colorées. Les relations, sur fond blanc, sont
    lues sur la page entière, en mode « texte épars ».
    """
    import pymupdf

    from ascocid.infrastructure.parsing import ocr

    sortie: list[tuple[float, float, float, float, str, list[str]]] = []
    confiances: list[tuple[float, int]] = []
    zoom = 4
    for b in boites:
        rect = pymupdf.Rect(b.x0, b.y0, b.x1, b.y1)
        image = page.get_pixmap(matrix=pymupdf.Matrix(zoom, zoom), clip=rect, alpha=False)
        for l in ocr.lire_bloc(image.tobytes("png")):
            # Position dans la case, ramenée à la page : le rangement en
            # case se fait ensuite comme pour le texte du SVG.
            sortie.append((b.x0 + l.gauche / zoom, b.y0 + l.haut / zoom,
                           b.x0 + l.droite / zoom, b.y0 + l.bas / zoom, l.texte, l.douteux))
            confiances.append((l.confiance_moyenne, l.nb_mots))
    zoom = 3
    page_entiere = page.get_pixmap(matrix=pymupdf.Matrix(zoom, zoom), alpha=False).tobytes("png")
    for l in ocr.lire_mise_en_page_libre(page_entiere):
        x0, y0, x1, y1 = l.gauche / zoom, l.haut / zoom, l.droite / zoom, l.bas / zoom
        if any(b.contient((x0 + x1) / 2, (y0 + y1) / 2) for b in boites):
            continue                    # déjà lu, case par case
        sortie.append((x0, y0, x1, y1, l.texte, l.douteux))
        confiances.append((l.confiance_moyenne, l.nb_mots))
    mots = sum(n for _, n in confiances)
    qualite = sum(c * n for c, n in confiances) / mots if mots else 0.0
    return round(qualite, 1), sortie


def _relies(haut: _Boite, bas: _Boite, fleches: list) -> bool:  # noqa: ANN001
    """Une flèche pleine dans l'intervalle entre deux cases, au centre de la colonne."""
    largeur = haut.x1 - haut.x0
    return any(abs((f.x0 + f.x1) / 2 - haut.cx) < largeur * 0.3
               and f.y0 >= haut.y1 - 12 and f.y1 <= bas.y0 + 12 for f in fleches)


def _regrouper_relations(lignes: list[tuple[float, float, float, float, str]]) -> list[list]:
    """Libellés de relation, recollés, de gauche à droite : [x0, y0, x1, y1, texte].

    Deux recollements : les morceaux d'une même ligne séparés par de grands
    espaces (« a pour   fonctions » sort du SVG en deux morceaux), et les
    libellés sur deux lignes (« est constituée » / « de », qui se chevauchent
    de quelques points). Entre deux relations distinctes, l'écart est bien plus
    grand que la taille du texte.
    """
    relations: list[list] = []
    for x0, y0, x1, y1, texte in sorted(lignes, key=lambda l: (round(l[1] / 6), l[0])):
        hauteur = y1 - y0
        meme_ligne = next((r for r in relations
                           if abs(r[1] - y0) < hauteur * 0.6 and 0 <= x0 - r[2] < hauteur * 2.2), None)
        if meme_ligne is not None:
            meme_ligne[4] = f"{meme_ligne[4]} {texte}"
            meme_ligne[2] = x1
            continue
        dessous = next((r for r in relations
                        if -6 <= y0 - r[3] < 8 and min(x1, r[2]) > max(x0, r[0])), None)
        if dessous is not None:
            dessous[4] = f"{dessous[4]} {texte}"
            dessous[0], dessous[2], dessous[3] = min(dessous[0], x0), max(dessous[2], x1), y1
            continue
        relations.append([x0, y0, x1, y1, texte])
    return sorted(relations, key=lambda r: r[0])


def _apparier(relations: list[list], colonnes: list[list[_Boite]]) -> tuple[list, float]:
    """Répartit les colonnes, dans l'ordre, en groupes contigus : un par relation.

    Une relation peut avoir plusieurs colonnes côte à côte (« regroupe » sur
    deux cases voisines). Le découpage retenu minimise la distance entre le
    libellé et le centre de ses colonnes ; renvoie aussi le plus grand écart
    rencontré, pour signaler un rattachement douteux.
    """
    if not relations:
        return [(None, c) for c in colonnes], float("inf") if colonnes else 0.0
    if len(colonnes) < len(relations):
        # Moins de colonnes que de relations : chaque colonne à la plus proche.
        paires = [(min(relations, key=lambda r: abs((r[0] + r[2]) / 2 - _centre(c))), c)
                  for c in colonnes]
        return paires, 0.0
    k, n = len(relations), len(colonnes)
    centre = [(r[0] + r[2]) / 2 for r in relations]

    def cout(i: int, a: int, b: int) -> float:      # colonnes a..b-1 à la relation i
        return max(abs(_centre(c) - centre[i]) for c in colonnes[a:b])

    infini = float("inf")
    meilleur = [[infini] * (n + 1) for _ in range(k + 1)]
    choix = [[0] * (n + 1) for _ in range(k + 1)]
    meilleur[0][0] = 0.0
    for i in range(1, k + 1):
        for b in range(i, n - (k - i) + 1):
            for a in range(i - 1, b):
                valeur = max(meilleur[i - 1][a], cout(i - 1, a, b))
                if valeur < meilleur[i][b]:
                    meilleur[i][b], choix[i][b] = valeur, a
    groupes, b = [], n
    for i in range(k, 0, -1):
        a = choix[i][b]
        groupes.append([(relations[i - 1], c) for c in colonnes[a:b]])
        b = a
    # Les groupes sont retrouvés de droite à gauche ; l'ordre des colonnes
    # dans chaque groupe, lui, est déjà le bon.
    return [p for groupe in reversed(groupes) for p in groupe], meilleur[k][n]


def _centre(colonne: list[_Boite]) -> float:
    return (min(b.x0 for b in colonne) + max(b.x1 for b in colonne)) / 2


RETRAIT_MIN = 15


def _hierarchiser(relation: Relation, boites: list[_Boite]) -> None:
    """Rattache chaque sous-case à sa case parente, et range parents puis détails.

    Une case est le détail d'une autre quand elle est dessinée plus bas, en
    retrait à droite sous elle. Une simple colonne (cases empilées au même
    bord gauche) n'a pas de niveaux : rien n'y change.
    """
    parents: dict[int, _Boite] = {}
    for b in boites:
        candidats = [p for p in boites if p is not b and p.y1 <= b.y0 + MARGE
                     and p.x0 + RETRAIT_MIN < b.x0 < p.x1]
        if candidats:
            parents[id(b)] = max(candidats, key=lambda p: (p.y1, p.x0))
    if not parents:
        return
    # Le parent d'une sous-case est la case racine de sa lignée.
    def racine(b: _Boite) -> _Boite:
        while id(b) in parents:
            b = parents[id(b)]
        return b

    hauts = [b for b in sorted(boites, key=lambda b: (b.x0, b.y0)) if id(b) not in parents]
    elements: list[Element] = []
    anciens = {e.texte: e for e in relation.elements}
    for h in sorted(hauts, key=lambda b: b.x0):
        elements.append(anciens.get(h.texte, Element(texte=h.texte)))
        for b in sorted((b for b in boites if id(b) in parents and racine(b) is h), key=lambda b: b.y0):
            e = anciens.get(b.texte, Element(texte=b.texte)).model_copy(update={"parent": h.texte})
            elements.append(e)
    relation.elements = elements
    relation.ordonnee = False       # l'ordre des flèches ne vaut que pour une colonne simple
