"""ascocid-probe — sonde de reconnaissance d'AscoCID (spec 01, passes 1 et 2).

Lecture seule. Aucune écriture sur AscoCID, aucun POST hors connexion,
aucun suivi de lien hors du périmètre configuré.
"""

from __future__ import annotations

import collections
import os
import pathlib
import re
from urllib.parse import urljoin, urlsplit

import httpx
import typer
from lxml import html as lxml_html
from rich.console import Console
from rich.panel import Panel
from rich.table import Table

from ascocid.config import ConfigAcces, ErreurConfig
from ascocid.infrastructure.collecte.auth import (
    Diagnostic,
    construire_client,
    diagnostiquer,
)

app = typer.Typer(add_completion=False, help=__doc__)
console = Console()

SORTIE = pathlib.Path(os.environ.get("ASCOCID_DATA", "data")) / "probe"

EXT_DOCUMENT = {
    ".pdf": "PDF",
    ".doc": "Word", ".docx": "Word",
    ".xls": "Excel", ".xlsx": "Excel", ".xlsm": "Excel",
    ".ppt": "PowerPoint", ".pptx": "PowerPoint",
    ".vsd": "Visio ★", ".vsdx": "Visio ★", ".vsdm": "Visio ★",
    ".drawio": "draw.io ★", ".bpmn": "BPMN ★", ".graphml": "GraphML ★",
    ".odt": "OpenDocument", ".ods": "OpenDocument", ".odp": "OpenDocument",
    ".png": "image", ".jpg": "image", ".jpeg": "image", ".gif": "image",
    ".svg": "SVG ★", ".webp": "image",
}


# ── affichage ────────────────────────────────────────────────────────────────


def _afficher_diagnostic(diag: Diagnostic) -> None:
    style = "green" if diag.ok else "red"
    lignes = [
        f"[bold]{diag.verdict}[/bold]",
        "",
        f"statut       : {diag.statut}",
        f"URL finale   : {diag.url_finale}",
        f"content-type : {diag.content_type or '—'}",
        f"taille       : {diag.taille:,} octets".replace(",", " "),
    ]
    if diag.titre:
        lignes.append(f"titre        : {diag.titre}")
    if diag.redirections:
        lignes.append(f"redirections : {len(diag.redirections)}")
        for url in diag.redirections[:5]:
            lignes.append(f"               → {url}")
    if diag.raisons:
        lignes += ["", "[bold]Indices relevés :[/bold]"]
        lignes += [f"  • {r}" for r in diag.raisons]
    console.print(Panel("\n".join(lignes), border_style=style, title="Diagnostic"))


def _aide_par_mode(mode: str) -> str:
    aides = {
        "none": "Le site exige une authentification : renseigner ASCOCID_AUTH dans .env.",
        "basic": "Vérifier ASCOCID_USER / ASCOCID_PASSWORD. Si le site utilise en réalité "
                 "un SSO, Basic ne fonctionnera jamais : passer en mode `cookie`.",
        "bearer": "Jeton invalide ou expiré. Vérifier qu'il s'agit bien d'un jeton porteur "
                  "et non d'une clé d'API à passer dans un en-tête maison (mode `header`).",
        "header": "Vérifier ASCOCID_HEADER_NAME / ASCOCID_HEADER_VALUE.",
        "cookie": "La session a expiré ou le cookie est incomplet.\n"
                  "  Recopier la valeur COMPLÈTE de l'en-tête « Cookie » depuis\n"
                  "  F12 → Réseau → 1re requête → En-têtes de requête.\n"
                  "  (Copier le cookie d'un seul domaine ne suffit pas si le SSO en pose "
                  "plusieurs.)",
        "form": "Les noms de champs sont probablement faux. Ouvrir le HTML de la page de "
                "connexion et relever les attributs `name` des champs identifiant et mot "
                "de passe → ASCOCID_FORM_USER_FIELD / ASCOCID_FORM_PASSWORD_FIELD.",
        "mtls": "Vérifier le certificat client et sa clé, et que l'autorité interne est "
                "bien dans ASCOCID_CA_BUNDLE.",
    }
    return aides.get(mode, "")


def _charger(fichier_env: str) -> ConfigAcces:
    cfg = ConfigAcces.depuis_env(fichier_env)
    pbs = cfg.valider()
    bloquants = [p for p in pbs if not p.startswith("AVERTISSEMENT")]
    for p in pbs:
        couleur = "yellow" if p.startswith("AVERTISSEMENT") else "red"
        console.print(f"[{couleur}]• {p}[/{couleur}]")
    if bloquants:
        console.print(
            f"\n[red]Configuration incomplète.[/red] "
            f"Compléter [bold]{fichier_env}[/bold] (modèle : .env.example)."
        )
        raise typer.Exit(code=2)
    return cfg


# ── commandes ────────────────────────────────────────────────────────────────


@app.command("auth-test")
def auth_test(
    env: str = typer.Option(".env", help="Fichier de configuration."),
    url: str = typer.Option("", help="URL à tester (défaut : ASCOCID_ROOT_URL)."),
) -> None:
    """Vérifie que l'authentification donne bien accès au CONTENU d'AscoCID.

    À lancer avant toute autre chose : derrière un SSO, un accès refusé se
    présente comme un succès HTTP 200.
    """
    cfg = _charger(env)
    cible = url or cfg.root_url

    tableau = Table(show_header=False, box=None, padding=(0, 2))
    tableau.add_row("mode d'authentification", f"[bold]{cfg.auth}[/bold]")
    tableau.add_row("URL testée", cible)
    tableau.add_row("périmètre", "\n".join(cfg.scope) or "—")
    tableau.add_row("vérification TLS", "oui" if cfg.verify_tls else "[yellow]NON[/yellow]")
    secrets_fournis = [
        n for n, v in (
            ("user/password", cfg.user and cfg.password),
            ("token", cfg.token), ("cookie", cfg.cookie),
            ("header", cfg.header_value), ("cert client", cfg.client_cert),
        ) if v
    ]
    tableau.add_row("secrets chargés", ", ".join(secrets_fournis) or "aucun")
    console.print(Panel(tableau, title="Configuration", border_style="blue"))

    try:
        client = construire_client(cfg)
    except ErreurConfig as exc:
        console.print(f"[red]{exc}[/red]")
        raise typer.Exit(code=2) from exc

    with client:
        try:
            rep = client.get(cible)
        except httpx.HTTPError as exc:
            console.print(Panel(
                f"[red]Connexion impossible : {type(exc).__name__}: {exc}[/red]\n\n"
                "Pistes : VPN non monté, proxy d'entreprise (ASCOCID_PROXY), "
                "autorité de certification interne absente (ASCOCID_CA_BUNDLE), "
                "nom d'hôte non résolu.",
                title="Échec réseau", border_style="red",
            ))
            raise typer.Exit(code=1) from exc

        diag = diagnostiquer(rep)
        _afficher_diagnostic(diag)

        SORTIE.mkdir(parents=True, exist_ok=True)
        brut = SORTIE / "auth-test.html"
        brut.write_bytes(rep.content)
        console.print(f"réponse brute enregistrée : [bold]{brut}[/bold]")

        if not diag.ok:
            aide = _aide_par_mode(cfg.auth)
            if aide:
                console.print(Panel(aide, title="Que faire", border_style="yellow"))
            raise typer.Exit(code=1)

        console.print(
            "\n[green]✓ Accès au contenu confirmé.[/green] "
            "Étape suivante : [bold]probe peek <url>[/bold] sur la page d'entrée "
            "et sur un logigramme."
        )


@app.command("peek")
def peek(
    url: str = typer.Argument(..., help="URL à inspecter."),
    env: str = typer.Option(".env"),
    sortie: bool = typer.Option(True, help="Enregistrer le HTML brut."),
) -> None:
    """Décrit la structure d'une page : liens, images, imagemaps, SVG, documents.

    Sert à classer chaque schéma dans la typologie de la spec 01 §3, qui décide
    de la stratégie d'extraction.
    """
    cfg = _charger(env)
    with construire_client(cfg) as client:
        rep = client.get(url)
    diag = diagnostiquer(rep)
    _afficher_diagnostic(diag)
    if not diag.ok:
        raise typer.Exit(code=1)
    if "html" not in diag.content_type:
        console.print("[yellow]Ce n'est pas une page HTML — rien à analyser ici.[/yellow]")
        raise typer.Exit(code=0)

    arbre = lxml_html.fromstring(rep.text)
    base = str(rep.url)

    compte = {
        "liens <a>": len(arbre.xpath("//a[@href]")),
        "images <img>": len(arbre.xpath("//img")),
        "imagemaps <map>": len(arbre.xpath("//map")),
        "zones <area>": len(arbre.xpath("//area")),
        "<svg> inline": len(arbre.xpath("//*[local-name()='svg']")),
        "liens dans SVG": len(arbre.xpath("//*[local-name()='svg']//*[local-name()='a']")),
        "tableaux <table>": len(arbre.xpath("//table")),
        "<iframe>": len(arbre.xpath("//iframe")),
        "<object>/<embed>": len(arbre.xpath("//object")) + len(arbre.xpath("//embed")),
        "SVG externe": len([u for u in (arbre.xpath("//object/@data")
            + arbre.xpath("//embed/@src") + arbre.xpath("//img/@src"))
            if ".svg" in u.lower()]),
        "zones data-x/y": len(arbre.xpath("//a[@data-x and @data-y]")),
    }
    t = Table(title="Structure de la page")
    t.add_column("élément"); t.add_column("n", justify="right")
    for cle, val in compte.items():
        t.add_row(cle, f"[bold]{val}[/bold]" if val else "0")
    console.print(t)

    # Répartition des cibles de liens
    par_type: collections.Counter[str] = collections.Counter()
    hors_perimetre = 0
    for href in arbre.xpath("//a/@href") + arbre.xpath("//area/@href"):
        absolu = urljoin(base, href)
        if not absolu.startswith(("http://", "https://")):
            continue
        if not cfg.dans_le_perimetre(absolu):
            hors_perimetre += 1
        ext = pathlib.PurePosixPath(urlsplit(absolu).path).suffix.lower()
        par_type[EXT_DOCUMENT.get(ext, "page / autre")] += 1
    if par_type:
        t2 = Table(title="Cibles des liens")
        t2.add_column("type"); t2.add_column("n", justify="right")
        for cle, val in par_type.most_common():
            t2.add_row(cle, str(val))
        console.print(t2)
        if hors_perimetre:
            console.print(f"[dim]{hors_perimetre} lien(s) hors du périmètre configuré "
                          f"(ignorés au crawl).[/dim]")

    # Classement dans la typologie spec 01 §3
    cas: list[str] = []
    # SVG externe : <object data="x.svg">, <embed>, <img src="x.svg">
    svg_externe = [
        u for u in (
            arbre.xpath("//object/@data") + arbre.xpath("//embed/@src")
            + arbre.xpath("//img/@src")
        )
        if ".svg" in u.lower()
    ]
    # Surcouche de zones cliquables positionnées (data-x/data-y), motif AsCoCid
    zones_data = arbre.xpath("//a[@data-x and @data-y]")
    if svg_externe:
        cas.append(f"C — SVG externe → parsing exact du SVG : {svg_externe[0][:60]}")
    if zones_data:
        cas.append(
            f"B/C — surcouche HTML de {len(zones_data)} zones positionnées "
            "(data-x/data-y + href) → graphe extractible tel quel"
        )
    if arbre.xpath("//*[local-name()='svg']//*[local-name()='a']"):
        cas.append("C — SVG inline cliquable → parsing exact, gratuit")
    if compte["zones <area>"]:
        cas.append("B — image + imagemap → parsing exact des <area> (coords + href)")
    if any(e in par_type for e in ("Visio ★", "draw.io ★", "BPMN ★", "GraphML ★")):
        cas.append("F — FICHIERS SOURCES accessibles → le meilleur cas possible")
    if compte["tableaux <table>"] and compte["liens <a>"] > 5:
        cas.append("A — table/liste HTML de liens → parsing DOM")
    if compte["images <img>"] and not compte["zones <area>"] and not cas:
        cas.append("E — image plate probable → extraction par vision (coûteux)")

    console.print(Panel(
        "\n".join(f"  • {c}" for c in cas) or "  aucun motif reconnu — inspecter le HTML",
        title="Typologie d'encodage (spec 01 §3)",
        border_style="green" if cas and not cas[0].startswith("E") else "yellow",
    ))

    if compte["zones <area>"]:
        exemple = lxml_html.tostring(
            arbre.xpath("//map")[0], pretty_print=True, encoding="unicode"
        )[:1200]
        console.print(Panel(exemple, title="Premier <map> (extrait)", border_style="blue"))

    if sortie:
        SORTIE.mkdir(parents=True, exist_ok=True)
        brut_nom = urlsplit(base).path.strip("/") or "index"
        brut_nom = re.sub(r"\.(x?html?|aspx?|php|jsp)$", "", brut_nom, flags=re.I)
        nom = re.sub(r"[^a-zA-Z0-9._-]", "_", brut_nom)
        chemin = SORTIE / f"peek-{nom[:80]}.html"
        chemin.write_bytes(rep.content)
        console.print(f"HTML enregistré : [bold]{chemin}[/bold]")



# ── inventaire (spec 01 §4.2) ────────────────────────────────────────────────


def _extraire_fiche(idoc: int, h: str) -> dict[str, object] | None:
    """Extrait les champs d'une fiche `view.php`. None si l'idoc n'existe pas.

    Un idoc inexistant renvoie HTTP 200 avec une coquille vide : la détection
    se fait sur le contenu, jamais sur le statut.
    """
    arbre = lxml_html.fromstring(h)

    def bloc(ident: str) -> str:
        # AsCoCid porte certains conteneurs par id, d'autres par class
        # (.dateDocument notamment) : chercher les deux.
        n = arbre.xpath(
            f"//*[@id='{ident}']"
            f"|//*[contains(concat(' ',normalize-space(@class),' '),' {ident} ')]"
        )
        return re.sub(r"\s+", " ", " ".join(n[0].itertext())).strip() if n else ""

    titre = bloc("titreDocument")
    if not titre:
        return None

    # Le préfixe de code est saisi à la main dans le CMS : casse incohérente
    # observée (« Fiche_LE_SULFITAGE » vs « FICHE_… »). Normaliser.
    code = re.sub(r"^Fiche\s+", "", bloc("codeDocument")).strip()
    corps = bloc("explicationView") or bloc("document")
    dates = bloc("dateDocument")
    m_dates = re.findall(r"(\d{1,2} \w+\.? \d{4})", dates)

    return {
        "idoc": idoc,
        "code": code,
        "type": code.split("_")[0].upper() if code else "",
        "titre": titre,
        "car_corps": len(corps),
        "nb_defbox": len(arbre.xpath("//*[contains(@class,'defbox')]")),
        "nb_auteurs": len(arbre.xpath("//*[contains(@class,'actbox')]")),
        "nb_voiraussi": len(arbre.xpath("//*[@id='voiraussi']//a")),
        "a_biblio": bool(bloc("biblio").replace("Références bibliographiques", "").strip()),
        "a_illustration": bool(arbre.xpath("//*[@id='documentImage']//img")),
        "cree_le": m_dates[0] if m_dates else "",
        "modifie_le": m_dates[1] if len(m_dates) > 1 else "",
        "octets": len(h),
    }


@app.command("inventaire")
def inventaire(
    debut: int = typer.Option(1000, help="Premier idoc à sonder."),
    fin: int = typer.Option(1700, help="Dernier idoc à sonder."),
    env: str = typer.Option(".env"),
    ouvriers: int = typer.Option(2, help="Requêtes simultanées (rester poli)."),
    delai_ms: int = typer.Option(300, help="Délai entre requêtes, par ouvrier."),
) -> None:
    """Parcourt la plage d'idoc via `view.php` et produit l'inventaire des fiches."""
    import concurrent.futures as cf
    import csv
    import json
    import time

    cfg = _charger(env)
    fiches: list[dict[str, object]] = []
    absents = 0

    def sonder(idoc: int, client: httpx.Client) -> dict[str, object] | None:
        time.sleep(delai_ms / 1000)
        try:
            r = client.get(f"{cfg.scope[0]}/view.php?id_document={idoc}")
        except httpx.HTTPError:
            return None
        if r.status_code != 200:
            return None
        if not diagnostiquer(r).ok:
            raise typer.Exit(code=1)   # session perdue en cours de crawl
        return _extraire_fiche(idoc, r.text)

    total = fin - debut + 1
    with construire_client(cfg) as client, cf.ThreadPoolExecutor(ouvriers) as pool:
        futurs = {pool.submit(sonder, i, client): i for i in range(debut, fin + 1)}
        for n, fut in enumerate(cf.as_completed(futurs), 1):
            res = fut.result()
            if res:
                fiches.append(res)
            else:
                absents += 1
            if n % 50 == 0:
                console.print(f"  … {n}/{total} sondés, {len(fiches)} fiches trouvées")

    fiches.sort(key=lambda f: f["idoc"])
    SORTIE.mkdir(parents=True, exist_ok=True)
    (SORTIE / "inventaire.json").write_text(
        json.dumps(fiches, ensure_ascii=False, indent=1), encoding="utf-8"
    )
    if fiches:
        with (SORTIE / "inventaire.csv").open("w", newline="", encoding="utf-8") as fh:
            w = csv.DictWriter(fh, fieldnames=list(fiches[0].keys()))
            w.writeheader()
            w.writerows(fiches)  # type: ignore[arg-type]

    console.print(f"\n[green]{len(fiches)} fiches[/green] sur {total} idoc sondés "
                  f"({absents} vides).")
    par_type = collections.Counter(str(f["type"]) for f in fiches)
    t = Table(title="Répartition par type de fiche")
    t.add_column("préfixe de code"); t.add_column("n", justify="right")
    t.add_column("car. de corps (médiane)", justify="right")
    for typ, n in par_type.most_common():
        cars = sorted(int(f["car_corps"]) for f in fiches if f["type"] == typ)
        t.add_row(typ or "—", str(n), str(cars[len(cars) // 2]))
    console.print(t)
    tot_car = sum(int(f["car_corps"]) for f in fiches)
    console.print(
        f"\nvolume textuel total : [bold]{tot_car:,}[/bold] caractères "
        f"≈ [bold]{tot_car // 3:,}[/bold] tokens".replace(",", " ")
    )
    console.print(f"définitions (.defbox) : {sum(int(f['nb_defbox']) for f in fiches)}")
    console.print(f"renvois « voir aussi » : {sum(int(f['nb_voiraussi']) for f in fiches)}")
    console.print(f"\nécrit : {SORTIE/'inventaire.csv'} et {SORTIE/'inventaire.json'}")

if __name__ == "__main__":
    app()
