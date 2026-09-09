"""Rendu d'une fiche et d'une carte, dans les conventions d'AsCoCid.

Choix de conception : on reproduit **l'architecture de l'information** d'AsCoCid
— l'ordre des blocs, le comportement des mots-clés, les zones cliquables du
schéma — sans en copier les pixels. Les producteurs retrouvent leurs repères
sans réapprentissage, et on évite la vallée dérangeante d'une imitation
approximative.

Ce qu'on ajoute et qu'AsCoCid n'a pas : le passage cité est surligné à sa place
dans la fiche, et l'étape concernée est mise en évidence sur le schéma.

Géométrie des zones (relevée dans le CSS d'AsCoCid) :
`a.target` est un carré de 24×24 px positionné en absolu, `opacity: 0`, révélé
à 0.5 au survol. AsCoCid le repositionne en JavaScript quand l'image est
redimensionnée ; en exprimant tout en pourcentages du référentiel
`data-imgwidth`/`data-imgheight`, la mise à l'échelle devient l'affaire du
navigateur et le script disparaît.
"""

from __future__ import annotations

import html as H
import json
from collections.abc import Callable

TAILLE_ZONE_PX = 24  # valeur d'AsCoCid, exprimée ensuite en % du référentiel


def _echap(t: str) -> str:
    return H.escape(t or "")


def carte_html(
    magasin, idoc: int, source_image: Callable[[int], str],  # noqa: ANN001
    etape_cible: int | None = None, lien: Callable[[int], str] = lambda i: f"#{i}",
) -> str:
    """Schéma + surcouche de zones cliquables, à l'identique d'AsCoCid."""
    carte = magasin.cx.execute("SELECT * FROM carte WHERE idoc=?", (idoc,)).fetchone()
    if not carte:
        return ""
    zones = magasin.cx.execute(
        "SELECT * FROM zone WHERE carte_idoc=? ORDER BY ordre", (idoc,)
    ).fetchall()
    largeur, hauteur = carte["largeur"] or 1, carte["hauteur"] or 1

    points = []
    for z in zones:
        actif = " active" if etape_cible == z["cible_idoc"] else ""
        points.append(
            f'<a class="zone{actif}" href="{lien(z["cible_idoc"])}"'
            f' title="{_echap(z["libelle"])}"'
            f' style="left:{z["x"] / largeur * 100:.3f}%;'
            f'top:{z["y"] / hauteur * 100:.3f}%;'
            f'width:{TAILLE_ZONE_PX / largeur * 100:.3f}%;'
            f'height:{TAILLE_ZONE_PX / hauteur * 100:.3f}%"></a>'
        )
    return (
        f'<figure class="cmap" style="aspect-ratio:{largeur}/{hauteur}">'
        f'<img src="{source_image(idoc)}" alt="{_echap(carte["svg"])}">'
        + "".join(points)
        + f'<figcaption>{len(zones)} étapes cliquables — survolez le schéma</figcaption>'
        "</figure>"
    )


def fiche_html(
    magasin, idoc: int, source_image: Callable[[int], str],  # noqa: ANN001
    surligner: str | None = None, lien: Callable[[int], str] = lambda i: f"#{i}",
) -> str:
    """Une fiche dans l'ordre des blocs d'AsCoCid, passage cité surligné."""
    f = magasin.cx.execute("SELECT * FROM fiche WHERE idoc=?", (idoc,)).fetchone()
    if not f:
        return f'<p class="vide">fiche {idoc} inconnue</p>'
    blocs = magasin.cx.execute(
        "SELECT * FROM bloc WHERE fiche_idoc=? ORDER BY ordre", (idoc,)
    ).fetchall()

    def texte(bloc) -> str:  # noqa: ANN001
        t = _echap(bloc["texte"])
        if surligner and surligner.strip() and surligner[:120] in bloc["texte"]:
            cible = _echap(surligner.strip())
            t = t.replace(cible, f"<mark>{cible}</mark>", 1)
        return t

    parties: list[str] = [
        f'<p class="code-fiche">Fiche {_echap(f["code"])}</p>',
        f'<h1 class="titre-fiche">{_echap(f["titre"])}</h1>',
    ]

    # 1. L'illustration : sur une carte, c'est le contenu même de la fiche.
    if magasin.cx.execute("SELECT 1 FROM carte WHERE idoc=?", (idoc,)).fetchone():
        parties.append(carte_html(magasin, idoc, source_image, lien=lien))
    elif f["illustration"]:
        parties.append(
            f'<figure class="illustration"><img src="{source_image(idoc)}"'
            f' alt="{_echap(f["titre"])}"><figcaption>{_echap(f["titre"])}'
            "</figcaption></figure>")

    # 2. Le corps rédigé, section par section.
    corps = [b for b in blocs if b["type"] in ("resume", "section")]
    if corps:
        morceaux = []
        section = None
        for b in corps:
            if b["titre_section"] and b["titre_section"] != section:
                section = b["titre_section"]
                morceaux.append(f"<h2>{_echap(section)}</h2>")
            morceaux.append(f"<p>{texte(b)}</p>")
        parties.append(f'<div class="corps">{"".join(morceaux)}</div>')

    # 3. Les mots-clés : terme visible, définition révélée au clic — AsCoCid
    #    fait exactement cela via displayDef(). Ici, <details> suffit.
    motcles = [b for b in blocs if b["type"] == "motcle" and b["terme"]]
    if motcles:
        items = "".join(
            f"<details><summary>{_echap(b['terme'])}</summary>"
            f"<p>{texte(b)}</p></details>" for b in motcles)
        parties.append(f'<section class="motscles"><h3>Mots clés</h3>'
                       f'<div class="grille-termes">{items}</div></section>')

    # 4. « Voir aussi », en distinguant les renvois déclarés des liens de corps.
    renvois = magasin.cx.execute(
        "SELECT r.cible_idoc, r.libelle, r.origine FROM renvoi r"
        " WHERE r.source_idoc=? ORDER BY r.origine, r.libelle", (idoc,)
    ).fetchall()
    if renvois:
        liens = "".join(
            f'<li><a href="{lien(r["cible_idoc"])}">{_echap(r["libelle"])}</a>'
            + ('<span class="corps-lien">cité dans le texte</span>'
               if r["origine"] == "corps" else "")
            + "</li>" for r in renvois)
        parties.append(f'<section class="voiraussi"><h3>Voir aussi</h3>'
                       f"<ul>{liens}</ul></section>")

    # 5. Bibliographie, puis auteurs et dates — comme en pied de fiche AsCoCid.
    for b in blocs:
        if b["type"] == "biblio":
            parties.append('<section class="biblio"><h3>Références bibliographiques'
                           f"</h3><p>{texte(b)}</p></section>")

    auteurs = json.loads(f["auteurs"] or "[]")
    pied = []
    if auteurs:
        pied.append("Auteur(s) : " + ", ".join(
            a.get("affiliation") or a.get("statut", "") for a in auteurs if a))
    if f["cree_le"]:
        pied.append(f"Créée le {f['cree_le']}"
                    + (f", modifiée le {f['modifie_le']}" if f["modifie_le"] else ""))
    if pied:
        parties.append(f'<footer class="pied-fiche">{" · ".join(_echap(p) for p in pied)}'
                       f'<a class="origine" target="_blank" rel="noopener"'
                       f' href="https://ascocid.fr/ldc/view.php?id_document={idoc}">'
                       "Ouvrir dans AsCoCid</a></footer>")

    return f'<article class="fiche-ascocid">{"".join(parties)}</article>'
