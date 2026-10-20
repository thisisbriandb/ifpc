"""ascocid transcrire — les illustrations en image deviennent des TOML relisibles.

    transcrire images                   OCR de toutes les illustrations PNG/JPEG
    transcrire images --types FDC       seulement les fiches de variété
    transcrire etat                     où en est la relecture

À lancer sur un poste où Tesseract est installé (paquet tesseract-ocr-fra) :
l'OCR est fait une fois, pas par le service. Les transcriptions sont écrites
avec les données (`<données>/transcriptions/images/`), parce qu'elles en
dérivent et qu'elles sont corrigées sur place par la relecture.

Une transcription déjà corrigée ou validée n'est **jamais** réécrite : si son
image a changé dans AsCoCid, la commande le signale et s'arrête là.
"""

from __future__ import annotations

import json
import os
import pathlib
import subprocess
from collections import Counter

import typer
from rich.console import Console
from rich.table import Table

from ascocid.application.ingestion import transcriptions_images as ti
from ascocid.infrastructure.graphe.sqlite import MagasinSqlite
from ascocid.infrastructure.parsing import ocr

app = typer.Typer(add_completion=False, help=__doc__)
console = Console()

DONNEES = pathlib.Path(os.environ.get("ASCOCID_DATA", "data"))
BASE = DONNEES / "ascocid.sqlite"
MANIFESTE = DONNEES / "manifeste.json"
SORTIE = DONNEES / "transcriptions" / "images"


def _version_tesseract() -> str:
    try:
        return subprocess.run(["tesseract", "--version"], capture_output=True,
                              text=True).stdout.split()[1]
    except (OSError, IndexError):
        return ""


@app.command()
def images(
    types: list[str] = typer.Option(["FDC", "FICHE"], help="Types de fiche à traiter."),
    sortie: str = typer.Option(str(SORTIE)),
    forcer: bool = typer.Option(False, help="Refaire l'OCR des transcriptions encore « à vérifier »."),
) -> None:
    """OCR des illustrations PNG/JPEG des fiches, vers un TOML par illustration."""
    if not ocr.disponible():
        console.print("[red]Tesseract absent : installer tesseract-ocr et tesseract-ocr-fra.[/red]")
        raise typer.Exit(code=2)
    dossier = pathlib.Path(sortie)
    dossier.mkdir(parents=True, exist_ok=True)
    manifeste = json.loads(MANIFESTE.read_text())
    version = _version_tesseract()

    with MagasinSqlite(BASE) as m:
        marques = ",".join("?" * len(types))
        fiches = m.cx.execute(
            f"SELECT idoc, code, type, titre, illustration FROM fiche"
            f" WHERE type IN ({marques}) AND illustration<>'' ORDER BY idoc", types).fetchall()

    compte: Counter[str] = Counter()
    for f in fiches:
        if f["illustration"].lower().endswith(".svg"):
            compte["svg (texte lu ailleurs, sans OCR)"] += 1
            continue
        sha = manifeste.get(f"{f['idoc']}:img")
        if not sha:
            compte["image non collectée"] += 1
            continue
        chemin = dossier / f"{f['code']}.toml"
        if chemin.exists():
            try:
                existante = ti.charger(chemin)
            except Exception as exc:  # noqa: BLE001
                # Illisible : on ne sait pas s'il porte une relecture, donc on n'y touche pas.
                console.print(f"[red]{f['code']} : fichier existant illisible ({exc}) — "
                              f"non réécrit, à réparer ou supprimer.[/red]")
                compte["existant illisible, conservé"] += 1
                continue
            if existante.statut != "a_verifier":
                if existante.image_sha256 != sha:
                    console.print(f"[yellow]{f['code']} : image modifiée dans AsCoCid depuis sa "
                                  f"relecture — à revoir, non réécrite.[/yellow]")
                compte["déjà relue, conservée"] += 1
                continue
            if not forcer and existante.image_sha256 == sha:
                compte["déjà transcrite"] += 1
                continue
        image = (DONNEES / "blobs" / sha[:2] / sha).read_bytes()
        try:
            # Seules les fiches de variété sont des doubles pages texte | photo.
            lignes = ocr.lire(image, double_page=f["type"] == "FDC")
            t = ti.depuis_ocr(f["idoc"], f["code"], f["titre"], sha, lignes, version)
        except Exception as exc:  # noqa: BLE001 — une image illisible n'arrête pas le lot
            console.print(f"[red]{f['code']} : {type(exc).__name__}: {exc}[/red]")
            compte["échec"] += 1
            continue
        chemin.write_text(ti.en_toml(t), encoding="utf-8")
        if ti.charger(chemin) != t:              # relu tout de suite : un TOML faux se voit ici
            console.print(f"[red]{f['code']} : le TOML écrit ne se relit pas à l'identique.[/red]")
            compte["échec"] += 1
            continue
        compte["transcrite"] += 1
        console.print(f"  {f['code']:55} {len(t.rubriques):>2} rubriques, "
                      f"{t.nb_douteux:>3} mots douteux")

    tableau = Table(title=f"Transcriptions — {dossier}")
    tableau.add_column("résultat"); tableau.add_column("n", justify="right")
    for k, v in compte.most_common():
        tableau.add_row(k, str(v))
    console.print(tableau)


@app.command()
def etat(sortie: str = typer.Option(str(SORTIE))) -> None:
    """Avancement de la relecture."""
    transcriptions = ti.charger_dossier(sortie)
    statuts = Counter(t.statut for t in transcriptions)
    tableau = Table(title="Relecture des transcriptions")
    tableau.add_column("statut"); tableau.add_column("n", justify="right")
    for s in ti.STATUTS:
        tableau.add_row(s, str(statuts.get(s, 0)))
    console.print(tableau)
    console.print(f"mots douteux restant à vérifier : "
                  f"{sum(t.nb_douteux for t in transcriptions if t.statut == 'a_verifier')}")


if __name__ == "__main__":
    app()
