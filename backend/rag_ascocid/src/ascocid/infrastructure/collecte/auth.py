"""Authentification auprès d'AscoCID.

Un seul point d'entrée : `construire_client(config)` retourne un `httpx.Client`
prêt à l'emploi, quel que soit le mode d'authentification.

Le piège central de cette couche : derrière un SSO, une session invalide ne
produit PAS d'erreur HTTP. Le serveur répond 200 avec la page de connexion.
Un crawler naïf indexe alors 4 000 copies du formulaire de login sans qu'aucune
alarme ne se déclenche. `diagnostiquer()` existe pour ça, et doit être appelé
sur chaque réponse.
"""

from __future__ import annotations

import re
from dataclasses import dataclass, field

import httpx

from ascocid.config import ConfigAcces, ErreurConfig

# ── détection de page de connexion ───────────────────────────────────────────

_MOTIFS_URL_CONNEXION = re.compile(
    r"(?:^|[/.?&=])(?:login|signin|sign-in|logon|sso|saml|adfs|oauth2?|openid"
    r"|connexion|authentif\w*|authenticate|auth/realms|_layouts/\d+/authenticate)",
    re.IGNORECASE,
)
_MOTIFS_TITRE_CONNEXION = re.compile(
    r"\b(connexion|s'identifier|identification|authentification|log ?in"
    r"|sign ?in|welcome to .{0,30}sso)\b",
    re.IGNORECASE,
)
_MOTIFS_CORPS_CONNEXION = re.compile(
    r"(<input[^>]+type=[\"']?password)|(name=[\"']?SAMLRequest)"
    r"|(wa=wsignin)|(__RequestVerificationToken)",
    re.IGNORECASE,
)


@dataclass
class Diagnostic:
    """Verdict sur une réponse : a-t-on vu le contenu, ou la page de connexion ?"""

    ok: bool
    verdict: str
    raisons: list[str] = field(default_factory=list)
    url_finale: str = ""
    redirections: list[str] = field(default_factory=list)
    statut: int = 0
    content_type: str = ""
    taille: int = 0
    titre: str = ""


def _titre(html: str) -> str:
    m = re.search(r"<title[^>]*>(.*?)</title>", html, re.IGNORECASE | re.DOTALL)
    return re.sub(r"\s+", " ", m.group(1)).strip()[:200] if m else ""


def diagnostiquer(rep: httpx.Response) -> Diagnostic:
    """Décide si la réponse est du contenu AscoCID ou un mur d'authentification."""
    ct = rep.headers.get("content-type", "").split(";")[0].strip()
    url_finale = str(rep.url)
    redirections = [str(r.url) for r in rep.history]
    est_html = "html" in ct
    corps = rep.text[:200_000] if est_html else ""
    titre = _titre(corps) if est_html else ""

    raisons: list[str] = []

    if rep.status_code in (401, 403):
        raisons.append(f"statut HTTP {rep.status_code}")
    if _MOTIFS_URL_CONNEXION.search(url_finale):
        raisons.append(f"l'URL finale ressemble à une page de connexion : {url_finale}")
    for url in redirections:
        if _MOTIFS_URL_CONNEXION.search(url):
            raisons.append(f"redirection via un service d'authentification : {url}")
            break
    if titre and _MOTIFS_TITRE_CONNEXION.search(titre):
        raisons.append(f"titre de page : « {titre} »")
    if corps and _MOTIFS_CORPS_CONNEXION.search(corps):
        raisons.append("la page contient un champ mot de passe ou un jeton SAML/ADFS")

    if raisons:
        verdict = "authentification requise — le contenu n'a PAS été atteint"
        ok = False
    elif rep.status_code >= 400:
        verdict = f"erreur HTTP {rep.status_code}"
        ok = False
    else:
        verdict = "accès au contenu confirmé"
        ok = True

    return Diagnostic(
        ok=ok,
        verdict=verdict,
        raisons=raisons,
        url_finale=url_finale,
        redirections=redirections,
        statut=rep.status_code,
        content_type=ct,
        taille=len(rep.content),
        titre=titre,
    )


# ── construction du client ───────────────────────────────────────────────────


def construire_client(cfg: ConfigAcces) -> httpx.Client:
    """Client HTTP configuré et authentifié. Lève ErreurConfig si le mode est
    mal renseigné, httpx.HTTPError si la connexion par formulaire échoue."""
    entetes: dict[str, str] = {
        "User-Agent": cfg.user_agent,
        "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
        "Accept-Language": "fr-FR,fr;q=0.9",
    }
    auth: httpx.Auth | tuple[str, str] | None = None
    cert: str | tuple[str, str] | None = None
    verify: str | bool = cfg.ca_bundle or cfg.verify_tls

    match cfg.auth:
        case "none":
            pass
        case "basic":
            auth = (cfg.user, cfg.password)
        case "bearer":
            entetes["Authorization"] = f"Bearer {cfg.token}"
        case "header":
            entetes[cfg.header_name] = cfg.header_value
        case "cookie":
            entetes["Cookie"] = cfg.cookie
        case "form":
            pass  # traité après construction
        case "mtls":
            cert = (cfg.client_cert, cfg.client_key) if cfg.client_key else cfg.client_cert
        case autre:
            raise ErreurConfig(f"mode d'authentification inconnu : {autre!r}")

    client = httpx.Client(
        headers=entetes,
        auth=auth,
        cert=cert,
        verify=verify,
        proxy=cfg.proxy or None,
        timeout=httpx.Timeout(cfg.timeout),
        follow_redirects=True,
        limits=httpx.Limits(max_connections=cfg.concurrence),
    )

    if cfg.auth == "form":
        _connexion_par_formulaire(client, cfg)
    return client


def _connexion_par_formulaire(client: httpx.Client, cfg: ConfigAcces) -> None:
    """POST du formulaire de connexion ; les cookies de session restent dans le client.

    Récupère au préalable la page de connexion pour capter les jetons anti-CSRF
    cachés, que la plupart des applications exigent.
    """
    champs: dict[str, str] = {}
    try:
        page = client.get(cfg.login_url)
        for nom, valeur in _champs_caches(page.text):
            champs[nom] = valeur
    except httpx.HTTPError:
        pass  # certaines applications acceptent le POST sans GET préalable

    champs[cfg.form_user_field] = cfg.user
    champs[cfg.form_password_field] = cfg.password
    champs.update(cfg.form_extra)

    rep = client.post(cfg.login_url, data=champs)
    diag = diagnostiquer(rep)
    if not diag.ok:
        raise ErreurConfig(
            "connexion par formulaire refusée : "
            + diag.verdict
            + ("\n  - " + "\n  - ".join(diag.raisons) if diag.raisons else "")
            + "\n  Vérifier ASCOCID_FORM_USER_FIELD / ASCOCID_FORM_PASSWORD_FIELD "
            "en lisant le HTML de la page de connexion."
        )


def _champs_caches(html: str) -> list[tuple[str, str]]:
    champs: list[tuple[str, str]] = []
    for balise in re.findall(r"<input[^>]*>", html, re.IGNORECASE):
        if not re.search(r"type=[\"']?hidden", balise, re.IGNORECASE):
            continue
        nom = re.search(r"name=[\"']([^\"']+)", balise, re.IGNORECASE)
        val = re.search(r"value=[\"']([^\"']*)", balise, re.IGNORECASE)
        if nom:
            champs.append((nom.group(1), val.group(1) if val else ""))
    return champs
