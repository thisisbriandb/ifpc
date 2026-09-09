"""ascocid apercu — page autonome montrant le rendu façon AsCoCid.

    apercu 1019 --etape 1114        une carte, avec l'étape mise en évidence
    apercu 1481 --citation "…"      une fiche, avec le passage cité surlignè
"""

from __future__ import annotations

import base64
import json
import pathlib

import typer
from rich.console import Console

from ascocid.infrastructure.graphe.sqlite import MagasinSqlite
from ascocid.interfaces.web.rendu import carte_html, fiche_html
from ascocid.interfaces.web.styles import STYLES

app = typer.Typer(add_completion=False, help=__doc__)
console = Console()
BLOBS = pathlib.Path("data/blobs")


def _source_image(magasin) -> "callable":  # noqa: ANN001, ANN202
    """Image en URI de données : la page reste autonome, hors ligne comprise."""
    manifeste = json.loads(pathlib.Path("data/manifeste.json").read_text())

    def source(idoc: int) -> str:
        sha = manifeste.get(f"{idoc}:img")
        if not sha:
            return ""
        octets = (BLOBS / sha[:2] / sha).read_bytes()
        nom = magasin.cx.execute(
            "SELECT illustration FROM fiche WHERE idoc=?", (idoc,)).fetchone()
        mime = "image/svg+xml" if (nom and nom[0].lower().endswith(".svg")) else "image/png"
        return f"data:{mime};base64,{base64.b64encode(octets).decode()}"

    return source


@app.command()
def page(
    idocs: list[int] = typer.Argument(..., help="Fiches à rendre."),
    etape: int = typer.Option(0, help="idoc de l'étape à mettre en évidence."),
    citation: str = typer.Option("", help="Passage à surligner dans la fiche."),
    sortie: str = typer.Option("data/apercu.html"),
    base_donnees: str = typer.Option("data/ascocid.sqlite"),
) -> None:
    with MagasinSqlite(base_donnees) as m:
        source = _source_image(m)
        morceaux = []
        for idoc in idocs:
            est_carte = m.cx.execute(
                "SELECT 1 FROM carte WHERE idoc=?", (idoc,)).fetchone()
            if est_carte and etape:
                titre = m.cx.execute(
                    "SELECT titre FROM fiche WHERE idoc=?", (idoc,)).fetchone()["titre"]
                cible = m.cx.execute(
                    "SELECT titre FROM fiche WHERE idoc=?", (etape,)).fetchone()
                morceaux.append(
                    f'<section class="demo"><p class="demo-legende">Schéma « {titre} » — '
                    f'l\'étape <b>{cible["titre"] if cible else etape}</b> est mise en '
                    "évidence, comme le ferait une réponse citant cette étape.</p>"
                    + carte_html(m, idoc, source, etape_cible=etape) + "</section>")
            else:
                morceaux.append(
                    '<section class="demo">'
                    + fiche_html(m, idoc, source, surligner=citation or None)
                    + "</section>")

    page_html = STYLES.replace("@@CORPS@@", "".join(morceaux))
    pathlib.Path(sortie).write_text(page_html, encoding="utf-8")
    console.print(f"écrit : [bold]{sortie}[/bold] "
                  f"({len(page_html) / 1e6:.1f} Mo, images incluses)")


if __name__ == "__main__":
    app()
