"""Parseur d'une page `view.php?id_document=N` d'AsCoCid.

Le HTML est déjà sémantiquement balisé par le CMS : le parsing est déterministe,
sans heuristique de mise en page et sans OCR.

Structure observée en Phase 0 :
  #codeDocument     code métier      (« FICHE_… », casse parfois incohérente)
  #titreDocument    titre
  .dateDocument     « Créée le … et modifiée le … »   (classe, pas id)
  #explicationView  corps de l'article : <h2> titres de section, <p>/<ul> texte
  #motscles         .defbox (définition) suivi de [<a>Terme</a>]  → glossaire
  #voiraussi        <a href="view.php?id_document=N">   → arêtes du graphe
  #biblio           références bibliographiques
  #auteurs          .actbox → paires label/valeur
"""

from __future__ import annotations

import base64
import hashlib
import re
from urllib.parse import parse_qs, urlsplit

from lxml import html as lxml_html
from lxml.html import HtmlElement

from ascocid.domain.modeles import (
    Auteur, Bloc, Fiche, OrigineRenvoi, Renvoi, TypeBloc, TypeFiche,
)

_TITRES = {"h1", "h2", "h3", "h4", "h5", "h6"}
_MOIS = "janv|févr|mars|avr|mai|juin|juil|août|sept|oct|nov|déc"
_RE_DATE = re.compile(rf"(\d{{1,2}}\s+(?:{_MOIS})\.?\s+\d{{4}})", re.IGNORECASE)


def _txt(noeud: HtmlElement | None) -> str:
    if noeud is None:
        return ""
    return re.sub(r"\s+", " ", " ".join(noeud.itertext())).strip()


def _par_id(arbre: HtmlElement, ident: str) -> HtmlElement | None:
    trouve = arbre.xpath(
        f"//*[@id='{ident}']"
        f"|//*[contains(concat(' ',normalize-space(@class),' '),' {ident} ')]"
    )
    return trouve[0] if trouve else None


def _idoc_de_href(href: str) -> int | None:
    params = parse_qs(urlsplit(href).query)
    for cle in ("id_document", "idoc"):
        if cle in params and params[cle][0].isdigit():
            return int(params[cle][0])
    return None


def _nom_fichier_telecharge(src: str) -> str:
    """`download.php?mimetype=<b64>&dldfile=<b64>` → nom de fichier en clair."""
    m = re.search(r"dldfile=([A-Za-z0-9+/=]+)", src or "")
    if not m:
        return ""
    try:
        return base64.b64decode(m.group(1)).decode("utf-8", "replace")
    except Exception:
        return ""


def parser_fiche(idoc: int, html_brut: str, source_url: str = "") -> tuple[Fiche, list[Bloc], list[Renvoi]] | None:
    """Retourne (fiche, blocs, renvois), ou None si l'idoc n'existe pas.

    Un idoc inexistant renvoie HTTP 200 avec une coquille sans #titreDocument :
    la détection se fait sur le contenu, jamais sur le statut (Phase 0 §6).
    """
    arbre = lxml_html.fromstring(html_brut)
    titre = _txt(_par_id(arbre, "titreDocument"))
    if not titre:
        return None

    code = re.sub(r"^fiche\s+", "", _txt(_par_id(arbre, "codeDocument")), flags=re.I).strip()
    dates = _RE_DATE.findall(_txt(_par_id(arbre, "dateDocument")))

    illustration = ""
    img = arbre.xpath("//*[@id='documentImage']//img/@src")
    if img:
        illustration = _nom_fichier_telecharge(img[0])

    fiche = Fiche(
        idoc=idoc,
        code=code,
        type=TypeFiche.depuis_code(code),
        titre=titre,
        cree_le=dates[0] if dates else "",
        modifie_le=dates[1] if len(dates) > 1 else "",
        illustration=illustration,
        auteurs=_parser_auteurs(arbre),
        source_url=source_url,
        sha256=hashlib.sha256(html_brut.encode("utf-8", "replace")).hexdigest(),
    )

    blocs = [
        *_parser_corps(idoc, arbre),
        *_parser_glossaire(idoc, arbre),
        *_parser_biblio(idoc, arbre),
    ]
    for i, b in enumerate(blocs):
        b.ordre = i

    # Les liens insérés dans le corps sont aussi nombreux que les « voir aussi »
    # et plus riches de sens : ils sont contextualisés par leur paragraphe.
    renvois: dict[int, Renvoi] = {}
    for chemin, origine in (
        ("//*[@id='explicationView']//a[@href]", OrigineRenvoi.CORPS),
        ("//*[@id='voiraussi']//a[@href]", OrigineRenvoi.VOIRAUSSI),
    ):
        for a in arbre.xpath(chemin):
            cible = _idoc_de_href(a.get("href", ""))
            if cible is None or cible == idoc:
                continue
            # « voir aussi » écrase le lien de corps : c'est le lien déclaré
            renvois[cible] = Renvoi(
                source_idoc=idoc, cible_idoc=cible,
                libelle=_txt(a).strip("«» "), origine=origine,
            )
    return fiche, blocs, list(renvois.values())


def _parser_corps(idoc: int, arbre: HtmlElement) -> list[Bloc]:
    """Découpe `#explicationView` en blocs, une section `<h2>` à la fois.

    Les paragraphes d'une même section sont regroupés : la section est l'unité
    sémantique voulue par les auteurs, et un paragraphe isolé perd son ancrage.
    """
    racine = _par_id(arbre, "explicationView")
    if racine is None:
        return []

    blocs: list[Bloc] = []
    section = ""
    tampon: list[str] = []

    def vider() -> None:
        texte = re.sub(r"\s+", " ", " ".join(tampon)).strip()
        if len(texte) >= 25:
            blocs.append(Bloc(
                fiche_idoc=idoc, ordre=0,
                type=TypeBloc.RESUME if not section else TypeBloc.SECTION,
                texte=texte, titre_section=section,
            ))
        tampon.clear()

    for enfant in racine.iterchildren():
        if not isinstance(enfant.tag, str):
            continue
        # l'illustration et sa légende ne sont pas du contenu rédigé
        if enfant.get("id") == "documentImage" or enfant.tag == "img":
            continue
        if enfant.tag in _TITRES:
            vider()
            section = _txt(enfant)
            continue
        texte = _txt(enfant)
        if not texte:
            continue
        # un paragraphe court entièrement en gras est un titre de section déguisé
        gras = enfant.xpath(".//strong|.//b")
        if len(texte) < 100 and gras and len(_txt(gras[0])) >= len(texte) * 0.8:
            vider()
            section = texte
            continue
        tampon.append(texte)
    vider()
    return blocs


def _parser_glossaire(idoc: int, arbre: HtmlElement) -> list[Bloc]:
    """`#motscles` : chaque `.defbox` est suivi de `[<a>Terme</a>]`.

    Ce sont des définitions de glossaire attachées à la fiche, pas le contenu
    de l'article — le lien défbox ↔ terme se fait par l'id `definition_N`.
    """
    racine = _par_id(arbre, "motscles")
    if racine is None:
        return []
    termes: dict[str, str] = {}
    for a in racine.xpath(".//a[@onclick]"):
        m = re.search(r"['\"](definition_\d+)['\"]", a.get("onclick", ""))
        if m:
            termes[m.group(1)] = _txt(a)

    blocs = []
    for boite in racine.xpath(".//*[contains(concat(' ',normalize-space(@class),' '),' defbox ')]"):
        definition = _txt(boite)
        if not definition:
            continue
        blocs.append(Bloc(
            fiche_idoc=idoc, ordre=0, type=TypeBloc.MOTCLE,
            texte=definition, terme=termes.get(boite.get("id", ""), ""),
        ))
    return blocs


def _parser_biblio(idoc: int, arbre: HtmlElement) -> list[Bloc]:
    racine = _par_id(arbre, "biblio")
    if racine is None:
        return []
    texte = re.sub(r"^Références bibliographiques\s*", "", _txt(racine)).strip()
    if len(texte) < 10:
        return []
    return [Bloc(fiche_idoc=idoc, ordre=0, type=TypeBloc.BIBLIO, texte=texte)]


def _parser_auteurs(arbre: HtmlElement) -> list[Auteur]:
    auteurs = []
    for boite in arbre.xpath("//*[contains(concat(' ',normalize-space(@class),' '),' actbox ')]"):
        champs: dict[str, str] = {}
        for ligne in boite.xpath(".//*[contains(@class,'line-actor-infos')]"):
            lab = ligne.xpath(".//*[contains(@class,'author_label')]")
            val = ligne.xpath(".//*[contains(@class,'author_info')]")
            if lab and val:
                champs[_txt(lab[0]).lower()] = _txt(val[0])
        courriel = champs.get("adresse @", "")
        auteurs.append(Auteur(
            statut=champs.get("statut", ""),
            affiliation=champs.get("affiliation(s)", ""),
            courriel="" if courriel in ("@", "") else courriel,
        ))
    return auteurs
