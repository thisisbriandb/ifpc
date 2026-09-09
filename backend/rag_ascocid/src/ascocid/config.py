"""Configuration d'accès à AscoCID, lue depuis l'environnement.

Aucune valeur secrète n'est écrite en dur ni journalisée : `__repr__` masque
systématiquement les champs sensibles (spec 01 §4.4).
"""

from __future__ import annotations

import json
import os
from dataclasses import dataclass, field
from pathlib import Path
from urllib.parse import urlsplit

from dotenv import load_dotenv

MODES_AUTH = ("none", "basic", "bearer", "header", "cookie", "form", "mtls")

_CHAMPS_SECRETS = frozenset(
    {"password", "token", "cookie", "header_value", "client_key"}
)


def _env(cle: str, defaut: str = "") -> str:
    return os.environ.get(cle, defaut).strip()


def _env_int(cle: str, defaut: int) -> int:
    brut = _env(cle)
    return int(brut) if brut else defaut


@dataclass
class ConfigAcces:
    root_url: str
    scope: tuple[str, ...]
    auth: str

    user: str = ""
    password: str = ""
    token: str = ""
    header_name: str = ""
    header_value: str = ""
    cookie: str = ""
    login_url: str = ""
    form_user_field: str = "username"
    form_password_field: str = "password"
    form_extra: dict[str, str] = field(default_factory=dict)
    client_cert: str = ""
    client_key: str = ""

    ca_bundle: str = ""
    verify_tls: bool = True
    proxy: str = ""
    user_agent: str = "ascocid-probe/0.1"
    timeout: int = 30
    concurrence: int = 4
    delai_ms: int = 200

    @classmethod
    def depuis_env(cls, fichier_env: str | Path = ".env") -> ConfigAcces:
        load_dotenv(fichier_env, override=False)

        root = _env("ASCOCID_ROOT_URL")
        scope_brut = _env("ASCOCID_SCOPE")
        if scope_brut:
            scope = tuple(s.strip() for s in scope_brut.split(",") if s.strip())
        elif root:
            decoupe = urlsplit(root)
            base = f"{decoupe.scheme}://{decoupe.netloc}"
            # Le périmètre par défaut est le RÉPERTOIRE de la page d'entrée : on ne
            # retire le dernier segment que s'il désigne un fichier (il contient un
            # point). « /ldc » donne « /ldc », pas la racine du domaine.
            segments = decoupe.path.rstrip("/").split("/")
            if segments and "." in segments[-1]:
                segments = segments[:-1]
            scope = (base + "/".join(segments),)
        else:
            scope = ()

        extra_brut = _env("ASCOCID_FORM_EXTRA", "{}") or "{}"
        try:
            form_extra = json.loads(extra_brut)
        except json.JSONDecodeError as exc:
            raise ErreurConfig(
                f"ASCOCID_FORM_EXTRA n'est pas du JSON valide : {exc}"
            ) from exc

        return cls(
            root_url=root,
            scope=scope,
            auth=_env("ASCOCID_AUTH", "none").lower() or "none",
            user=_env("ASCOCID_USER"),
            password=_env("ASCOCID_PASSWORD"),
            token=_env("ASCOCID_TOKEN"),
            header_name=_env("ASCOCID_HEADER_NAME"),
            header_value=_env("ASCOCID_HEADER_VALUE"),
            cookie=_env("ASCOCID_COOKIE"),
            login_url=_env("ASCOCID_LOGIN_URL"),
            form_user_field=_env("ASCOCID_FORM_USER_FIELD", "username"),
            form_password_field=_env("ASCOCID_FORM_PASSWORD_FIELD", "password"),
            form_extra=form_extra,
            client_cert=_env("ASCOCID_CLIENT_CERT"),
            client_key=_env("ASCOCID_CLIENT_KEY"),
            ca_bundle=_env("ASCOCID_CA_BUNDLE"),
            verify_tls=_env("ASCOCID_VERIFY_TLS", "1") not in ("0", "false", "no"),
            proxy=_env("ASCOCID_PROXY"),
            user_agent=_env("ASCOCID_USER_AGENT", "ascocid-probe/0.1"),
            timeout=_env_int("ASCOCID_TIMEOUT", 30),
            concurrence=_env_int("ASCOCID_CONCURRENCE", 4),
            delai_ms=_env_int("ASCOCID_DELAI_MS", 200),
        )

    def valider(self) -> list[str]:
        """Retourne la liste des problèmes bloquants (vide = configuration utilisable)."""
        pbs: list[str] = []
        if not self.root_url:
            pbs.append("ASCOCID_ROOT_URL est vide.")
        elif not self.root_url.startswith(("http://", "https://")):
            pbs.append("ASCOCID_ROOT_URL doit commencer par http:// ou https://.")

        if self.auth not in MODES_AUTH:
            pbs.append(
                f"ASCOCID_AUTH={self.auth!r} inconnu. Valeurs : {', '.join(MODES_AUTH)}."
            )

        requis: dict[str, tuple[str, ...]] = {
            "basic": ("user", "password"),
            "bearer": ("token",),
            "header": ("header_name", "header_value"),
            "cookie": ("cookie",),
            "form": ("login_url", "user", "password"),
            "mtls": ("client_cert",),
        }
        for champ in requis.get(self.auth, ()):
            if not getattr(self, champ):
                pbs.append(
                    f"mode {self.auth!r} : ASCOCID_{champ.upper()} est vide."
                )

        for champ in ("client_cert", "client_key", "ca_bundle"):
            chemin = getattr(self, champ)
            if chemin and not Path(chemin).exists():
                pbs.append(f"ASCOCID_{champ.upper()} : fichier introuvable ({chemin}).")

        if not self.verify_tls:
            pbs.append(
                "AVERTISSEMENT : vérification TLS désactivée "
                "(ASCOCID_VERIFY_TLS=0). À n'utiliser qu'en réseau interne de confiance."
            )
        return pbs

    def dans_le_perimetre(self, url: str) -> bool:
        return any(url.startswith(prefixe) for prefixe in self.scope)

    def __repr__(self) -> str:  # ne jamais laisser fuir un secret dans un log
        morceaux = []
        for cle, valeur in self.__dict__.items():
            if cle in _CHAMPS_SECRETS and valeur:
                morceaux.append(f"{cle}=<masqué:{len(str(valeur))}c>")
            else:
                morceaux.append(f"{cle}={valeur!r}")
        return f"ConfigAcces({', '.join(morceaux)})"


class ErreurConfig(RuntimeError):
    pass
