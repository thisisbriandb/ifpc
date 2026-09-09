"""ascocid ingest — collecte et extraction du corpus AsCoCid (specs 02 et 03).

Deux étapes séparées et rejouables :

    ingest collecte   AsCoCid → data/blobs/  (HTML brut, adressé par contenu)
    ingest extraire   data/blobs/ → data/ascocid.sqlite

La séparation n'est pas cosmétique : la stratégie de parsing évoluera plusieurs
fois, et re-parser 830 pages depuis le disque prend deux secondes là où les
re-télécharger prend trois minutes et sollicite le serveur pour rien.
"""

from __future__ import annotations

import concurrent.futures as cf
import hashlib
import json
import pathlib
import time

import httpx
import typer
from rich.console import Console
from rich.table import Table

from ascocid.config import ConfigAcces
from ascocid.application.ingestion.chunking import decouper, dedupliquer_definitions
from ascocid.domain.modeles import Bloc, Corpus, Fiche, TypeBloc, TypeFiche
from ascocid.infrastructure.collecte.auth import construire_client, diagnostiquer
from ascocid.infrastructure.graphe.sqlite import MagasinSqlite
from ascocid.infrastructure.parsing.carte import parser_carte
from ascocid.infrastructure.parsing.fiche import parser_fiche

app = typer.Typer(add_completion=False, help=__doc__)
console = Console()

DONNEES = pathlib.Path("data")
BLOBS = DONNEES / "blobs"
MANIFESTE = DONNEES / "manifeste.json"
BASE = DONNEES / "ascocid.sqlite"


def _ranger(contenu: bytes) -> str:
    """Écrit le contenu dans le magasin adressé par contenu, retourne son sha256."""
    h = hashlib.sha256(contenu).hexdigest()
    dest = BLOBS / h[:2] / h
    if not dest.exists():
        dest.parent.mkdir(parents=True, exist_ok=True)
        dest.write_bytes(contenu)
    return h


def _lire(sha: str) -> str:
    return (BLOBS / sha[:2] / sha).read_text("utf-8", errors="replace")


@app.command()
def collecte(
    env: str = typer.Option(".env"),
    inventaire: str = typer.Option("data/probe/inventaire.json",
                                   help="Liste d'idoc à collecter (sortie de `probe inventaire`)."),
    ouvriers: int = typer.Option(3, help="Requêtes simultanées."),
    delai_ms: int = typer.Option(200),
    forcer: bool = typer.Option(False, help="Re-télécharger même si déjà en cache."),
) -> None:
    """Télécharge `view.php` et `navig.php` pour chaque fiche connue."""
    cfg = ConfigAcces.depuis_env(env)
    pbs = [p for p in cfg.valider() if not p.startswith("AVERTISSEMENT")]
    if pbs:
        console.print(f"[red]{pbs[0]}[/red]")
        raise typer.Exit(code=2)

    inv = pathlib.Path(inventaire)
    if not inv.exists():
        console.print(f"[red]{inv} absent — lancer d'abord `./probe inventaire`.[/red]")
        raise typer.Exit(code=2)
    idocs = [f["idoc"] for f in json.loads(inv.read_text())]
    console.print(f"{len(idocs)} fiches à collecter ({len(idocs) * 2} requêtes).")

    ancien: dict[str, str] = (
        json.loads(MANIFESTE.read_text()) if MANIFESTE.exists() and not forcer else {}
    )
    manifeste: dict[str, str] = dict(ancien)
    base = cfg.scope[0]
    taches = [(i, "vue", f"{base}/view.php?id_document={i}") for i in idocs]
    taches += [(i, "nav", f"{base}/navig.php?idoc={i}") for i in idocs]
    a_faire = [t for t in taches if forcer or f"{t[0]}:{t[1]}" not in ancien]
    console.print(f"{len(taches) - len(a_faire)} déjà en cache, {len(a_faire)} à télécharger.")

    echecs = 0

    def chercher(tache: tuple[int, str, str], client: httpx.Client) -> tuple[str, str] | None:
        idoc, genre, url = tache
        time.sleep(delai_ms / 1000)
        try:
            r = client.get(url)
        except httpx.HTTPError:
            return None
        if r.status_code != 200:
            return None
        if not diagnostiquer(r).ok:
            console.print("[red]Session perdue en cours de collecte — arrêt.[/red]")
            raise typer.Exit(code=1)
        return f"{idoc}:{genre}", _ranger(r.content)

    with construire_client(cfg) as client, cf.ThreadPoolExecutor(ouvriers) as pool:
        futurs = [pool.submit(chercher, t, client) for t in a_faire]
        for n, fut in enumerate(cf.as_completed(futurs), 1):
            res = fut.result()
            if res:
                manifeste[res[0]] = res[1]
            else:
                echecs += 1
            if n % 100 == 0:
                console.print(f"  … {n}/{len(a_faire)}")

    MANIFESTE.write_text(json.dumps(manifeste, indent=1, sort_keys=True))
    octets = sum((BLOBS / s[:2] / s).stat().st_size for s in set(manifeste.values()))
    console.print(
        f"\n[green]{len(manifeste)} documents[/green] en cache "
        f"({len(set(manifeste.values()))} blobs distincts, {octets / 1e6:.1f} Mo), "
        f"{echecs} échec(s)."
    )


@app.command()
def extraire(base_donnees: str = typer.Option(str(BASE))) -> None:
    """Parse le HTML en cache et (re)construit la base."""
    if not MANIFESTE.exists():
        console.print("[red]Aucun manifeste — lancer `ingest collecte` d'abord.[/red]")
        raise typer.Exit(code=2)
    manifeste = json.loads(MANIFESTE.read_text())

    corpus = Corpus()
    anomalies: list[str] = []
    for cle, sha in sorted(manifeste.items(), key=lambda kv: int(kv[0].split(":")[0])):
        idoc_s, genre = cle.split(":")
        idoc = int(idoc_s)
        html = _lire(sha)
        if genre == "vue":
            res = parser_fiche(idoc, html, f"https://ascocid.fr/ldc/view.php?id_document={idoc}")
            if res is None:
                anomalies.append(f"idoc {idoc} : fiche vide")
                continue
            fiche, blocs, renvois = res
            corpus.fiches.append(fiche)
            corpus.blocs.extend(blocs)
            corpus.renvois.extend(renvois)
        else:
            carte, zones = parser_carte(idoc, html)
            if carte and zones:
                corpus.cartes.append(carte)
                corpus.zones.extend(zones)

    connus = {f.idoc for f in corpus.fiches}
    corpus.cartes = [c for c in corpus.cartes if c.idoc in connus]
    corpus.zones = [z for z in corpus.zones if z.carte_idoc in connus]

    with MagasinSqlite(base_donnees) as m:
        m.vider()
        m.ecrire(corpus)
        compte = m.compter()

    t = Table(title="Corpus extrait")
    t.add_column("table"); t.add_column("n", justify="right")
    for k, v in compte.items():
        t.add_row(k, f"{v:,}".replace(",", " "))
    console.print(t)
    for a in anomalies[:10]:
        console.print(f"[yellow]  {a}[/yellow]")
    console.print(f"\nbase écrite : [bold]{base_donnees}[/bold]")


@app.command()
def indexer(
    base_donnees: str = typer.Option(str(BASE)),
    sans_vecteurs: bool = typer.Option(False, help="Index lexical seul (ligne de base)."),
) -> None:
    """Découpe le corpus en chunks, construit l'index lexical et vectoriel."""
    from ascocid.domain.modeles import TypeBloc as TB

    with MagasinSqlite(base_donnees) as m:
        m.vider_index()
        fiches = {r["idoc"]: r for r in m.cx.execute("SELECT * FROM fiche")}
        blocs_par_fiche: dict[int, list[Bloc]] = {}
        for r in m.cx.execute("SELECT * FROM bloc ORDER BY fiche_idoc, ordre"):
            blocs_par_fiche.setdefault(r["fiche_idoc"], []).append(Bloc(
                fiche_idoc=r["fiche_idoc"], ordre=r["ordre"], type=TB(r["type"]),
                texte=r["texte"], titre_section=r["titre_section"] or "",
                terme=r["terme"] or "",
            ))
        parents: dict[int, list[int]] = {}
        for r in m.cx.execute("SELECT cible_idoc, carte_idoc FROM zone"):
            parents.setdefault(r["cible_idoc"], []).append(r["carte_idoc"])

        chunks = []
        for idoc, r in fiches.items():
            f = Fiche(idoc=idoc, code=r["code"], type=TypeFiche(r["type"]),
                      titre=r["titre"])
            chunks.extend(decouper(f, blocs_par_fiche.get(idoc, []),
                                   parents.get(idoc, [])))
        avant = len(chunks)
        chunks = dedupliquer_definitions(chunks)
        chunks.sort(key=lambda c: (c.fiche_idoc, c.ordre))
        m.ecrire_chunks(chunks)

        t = Table(title="Index")
        t.add_column("mesure"); t.add_column("valeur", justify="right")
        t.add_row("chunks", str(len(chunks)))
        t.add_row("  définitions dédupliquées", f"-{avant - len(chunks)}")
        par_type: dict[str, int] = {}
        for c in chunks:
            par_type[c.type] = par_type.get(c.type, 0) + 1
        for k, v in sorted(par_type.items(), key=lambda kv: -kv[1]):
            t.add_row(f"  dont {k}", str(v))
        car = sum(len(c.texte) for c in chunks)
        t.add_row("caractères indexés", f"{car:,}".replace(",", " "))
        t.add_row("longueur médiane", str(sorted(len(c.texte) for c in chunks)[len(chunks) // 2]))
        console.print(t)

    if sans_vecteurs:
        console.print("[yellow]Index lexical seul (FTS5). C'est la ligne de base "
                      "à battre (spec 08 §1.2).[/yellow]")
        return

    from ascocid.infrastructure.embeddings.e5 import EmbedderE5
    from ascocid.infrastructure.index.memoire import IndexMemoire

    console.print("chargement du modèle d'embedding…")
    emb = EmbedderE5()
    console.print(f"encodage de {len(chunks)} chunks ({emb.identifiant_modele})…")
    vecteurs = emb.encoder([c.texte_indexe for c in chunks])
    idx = IndexMemoire()
    idx.construire([c.cle for c in chunks], vecteurs)
    console.print(f"[green]index vectoriel construit[/green] : {idx.taille} vecteurs "
                  f"× {emb.dimension} dimensions")


@app.command()
def verifier(base_donnees: str = typer.Option(str(BASE))) -> None:
    """Contrôle les invariants du corpus (spec 02 §6)."""
    with MagasinSqlite(base_donnees) as m:
        t = Table(title="Invariants")
        t.add_column("contrôle"); t.add_column("infractions", justify="right")
        t.add_column("signification")
        rouge = 0
        for nom, n, desc in m.invariants():
            rouge += 1 if n else 0
            t.add_row(nom, f"[red]{n}[/red]" if n else "[green]0[/green]", desc if n else "")
        console.print(t)
        orph = m.orphelines()
        console.print(f"\nfiches orphelines (aucune zone ni renvoi entrant) : "
                      f"{'[yellow]' if orph else '[green]'}{len(orph)}[/]")
        for o in orph[:8]:
            console.print(f"    {o['idoc']}  {o['type']:8} {o['titre'][:60]}")
    raise typer.Exit(code=1 if rouge else 0)


@app.command()
def voisinage(idoc: int, base_donnees: str = typer.Option(str(BASE))) -> None:
    """Affiche le contexte de graphe d'une fiche (spec 04 §8)."""
    with MagasinSqlite(base_donnees) as m:
        f = m.cx.execute("SELECT * FROM fiche WHERE idoc=?", (idoc,)).fetchone()
        if not f:
            console.print(f"[red]idoc {idoc} inconnu[/red]")
            raise typer.Exit(code=1)
        console.print(f"[bold]{f['titre']}[/bold]  ({f['code']}, {f['type']})")
        v = m.voisinage(idoc)
        for titre, lignes in (
            ("Atteinte depuis (carte → zone)", v["cartes_parentes"]),
            ("Mène vers (zones de sa carte)", v["zones_filles"]),
            ("Voir aussi (sortants)", v["renvois_sortants"]),
            ("Citée par (entrants)", v["renvois_entrants"]),
        ):
            console.print(f"\n  [bold]{titre}[/bold] : {len(lignes)}")
            for l in lignes[:6]:
                console.print("     " + "  ".join(str(x) for x in tuple(l))[:100])



@app.command()
def illustrations(
    env: str = typer.Option(".env"),
    base_donnees: str = typer.Option(str(BASE)),
    ouvriers: int = typer.Option(3),
    delai_ms: int = typer.Option(200),
) -> None:
    """Télécharge les SVG et PNG des fiches (servis par `download.php`).

    Nécessaires pour reproduire l'affichage d'AsCoCid : la carte conceptuelle
    d'une fiche et l'illustration d'une fiche de variété sont son contenu, pas
    une décoration.
    """
    import base64 as b64

    cfg = ConfigAcces.depuis_env(env)
    with MagasinSqlite(base_donnees) as m:
        fiches = m.cx.execute(
            "SELECT idoc, illustration FROM fiche WHERE illustration<>''"
        ).fetchall()

    manifeste: dict[str, str] = (
        json.loads(MANIFESTE.read_text()) if MANIFESTE.exists() else {}
    )
    a_faire = [f for f in fiches if f"{f['idoc']}:img" not in manifeste]
    console.print(f"{len(fiches)} illustrations, {len(a_faire)} à télécharger.")

    def chercher(f, client: httpx.Client) -> tuple[str, str] | None:  # noqa: ANN001
        time.sleep(delai_ms / 1000)
        mime = "image/svg+xml" if f["illustration"].lower().endswith(".svg") else "image/png"
        url = (f"{cfg.scope[0]}/download.php"
               f"?mimetype={b64.b64encode(mime.encode()).decode()}"
               f"&dldfile={b64.b64encode(f['illustration'].encode()).decode()}")
        try:
            r = client.get(url)
        except httpx.HTTPError:
            return None
        if r.status_code != 200 or not r.content:
            return None
        return f"{f['idoc']}:img", _ranger(r.content)

    echecs = 0
    with construire_client(cfg) as client, cf.ThreadPoolExecutor(ouvriers) as pool:
        futurs = [pool.submit(chercher, f, client) for f in a_faire]
        for n, fut in enumerate(cf.as_completed(futurs), 1):
            res = fut.result()
            if res:
                manifeste[res[0]] = res[1]
            else:
                echecs += 1
            if n % 50 == 0:
                console.print(f"  … {n}/{len(a_faire)}")

    MANIFESTE.write_text(json.dumps(manifeste, indent=1, sort_keys=True))
    images = {k: v for k, v in manifeste.items() if k.endswith(":img")}
    octets = sum((BLOBS / s[:2] / s).stat().st_size for s in set(images.values()))
    console.print(f"\n[green]{len(images)} illustrations[/green] "
                  f"({octets / 1e6:.0f} Mo), {echecs} échec(s).")

if __name__ == "__main__":
    app()
