"""Parseur d'une page `navig.php?idoc=N` : la carte et ses zones cliquables.

Le graphe de navigation est écrit en clair dans le HTML — aucune interprétation
d'image n'est nécessaire (Phase 0 §3) :

    <object type="image/svg+xml" data="ascocid_data/1_PROCESS_FERMENTATION.svg"
            data-imgwidth="1280" data-imgheight="882">

    <a class="target cmap" data-x="332" data-y="274"
       title="La fermentation primaire"
       href="navig.php?idoc=1114" data-id_document="1114">

`data-imgwidth`/`data-imgheight` donnent le référentiel dans lequel s'expriment
`data-x`/`data-y` : c'est ce qui permettra de surligner une étape sur le schéma
sans recalibrage (spec 07 §3.1).
"""

from __future__ import annotations

import re

from lxml import html as lxml_html

from ascocid.domain.modeles import Carte, Zone


def parser_carte(idoc: int, html_brut: str) -> tuple[Carte | None, list[Zone]]:
    arbre = lxml_html.fromstring(html_brut)

    carte = None
    objets = arbre.xpath("//object[@data]")
    if objets:
        o = objets[0]
        chemin = o.get("data", "")
        carte = Carte(
            idoc=idoc,
            svg=chemin.rsplit("/", 1)[-1],
            largeur=_entier(o.get("data-imgwidth")),
            hauteur=_entier(o.get("data-imgheight")),
        )

    zones: list[Zone] = []
    for i, a in enumerate(arbre.xpath("//a[@data-x and @data-y]")):
        cible = a.get("data-id_document") or ""
        if not cible.isdigit():
            m = re.search(r"idoc=(\d+)", a.get("href", ""))
            if not m:
                continue
            cible = m.group(1)
        zones.append(Zone(
            carte_idoc=idoc,
            ordre=i,
            libelle=(a.get("title") or "").strip(),
            x=_entier(a.get("data-x")),
            y=_entier(a.get("data-y")),
            cible_idoc=int(cible),
        ))
    return carte, zones


def _entier(valeur: str | None) -> int:
    try:
        return int(float(valeur or 0))
    except ValueError:
        return 0
