"""Démarrage du service HTTP, avec une socket qui accepte les deux familles.

Pourquoi ce module plutôt qu'un simple `uvicorn --host` : lancé sur « :: »,
uvicorn ouvre une socket IPv6 **exclusive**. Mesuré dans le conteneur, avec
pourtant `net.ipv6.bindv6only = 0` :

    [::1]:8100      → HTTP 200
    127.0.0.1:8100  → connexion refusée

Sur Railway, cela se traduit par un « Application failed to respond » : le
réseau privé est en IPv6, mais le proxy public entre en IPv4. Aucune valeur de
`--host` ne satisfait les deux à la fois — « 0.0.0.0 » perd le réseau privé,
« :: » perd le domaine public.

La socket est donc construite ici, avec `IPV6_V6ONLY` désactivé : une seule
écoute, les deux familles servies, et plus de choix à faire au déploiement.
"""

from __future__ import annotations

import os
import socket

DOUBLE_PILE = ("::", "*", "dual")


def socket_double_pile(port: int, backlog: int = 2048) -> socket.socket:
    s = socket.socket(socket.AF_INET6, socket.SOCK_STREAM)
    s.setsockopt(socket.SOL_SOCKET, socket.SO_REUSEADDR, 1)
    # Le point de tout le module : sans cette ligne, la socket refuse l'IPv4.
    s.setsockopt(socket.IPPROTO_IPV6, socket.IPV6_V6ONLY, 0)
    s.bind(("::", port))
    s.listen(backlog)
    s.set_inheritable(True)
    return s


def main() -> None:
    import uvicorn

    from ascocid.interfaces.web.api import app

    hote = os.environ.get("LDC_HOST", "127.0.0.1").strip()
    port = int(os.environ.get("PORT", "8100"))

    if hote not in DOUBLE_PILE:
        # Une adresse explicite reste respectée : développement local, ou
        # environnement qui impose une interface précise.
        uvicorn.run(app, host=hote, port=port)
        return

    ecoute = socket_double_pile(port)
    serveur = uvicorn.Server(uvicorn.Config(app))
    print(f"[ldc] écoute double pile sur [::]:{port} (IPv4 comprise)", flush=True)
    serveur.run(sockets=[ecoute])


if __name__ == "__main__":
    main()
