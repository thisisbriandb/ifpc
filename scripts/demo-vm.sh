#!/usr/bin/env bash
#
# Ouvre un accès aux applications de la VM, le temps d'une démonstration.
#
# Pourquoi un tunnel
# ------------------
# La VM n'est pas exposée à Internet : le réseau de l'établissement ne laisse
# entrer que le port 22. Un tunnel SSH emprunte ce seul port autorisé et rend
# les applications visibles dans le navigateur de la machine qui le lance —
# sans rien contourner, sans rien demander à personne.
#
# Il ne remplace pas l'ouverture du 443 : seule la personne qui lance le tunnel
# y a accès. C'est un outil de démonstration et de recette, pas de production.
#
# Usage :
#   ./scripts/demo-vm.sh               puis Ctrl+C pour refermer
#   ./scripts/demo-vm.sh --domaines    affiche en plus la ligne /etc/hosts
#   ./scripts/demo-vm.sh --federation  tout en une commande pour démontrer la
#                                      connexion PADOC (sudo demandé)
#
# Prérequis : la clé SSH autorisée sur la VM (ssh-copy-id vmadmin@…).

set -u

VM="${VM_HOTE:-vmadmin@138.102.157.119}"
P_PADOC="${P_PADOC:-8080}"
P_CIDER="${P_CIDER:-8081}"
P_PROXY="${P_PROXY:-8000}"

# Relevé AVANT toute boucle : la vérification des ports ci-dessous utilise
# « set -- » pour découper ses couples, ce qui écrase les paramètres de
# position. L'option était donc perdue avant d'être lue.
OPTION="${1:-}"

libre() {
  ! (cat < /dev/null > "/dev/tcp/127.0.0.1/$1") 2>/dev/null
}

# ── Démonstration de la fédération, en une commande ──────────────────────────
# OpenID Connect renvoie le navigateur vers les adresses exactes déclarées
# (http://padoc.ifpc.eu, http://ciderscope.ifpc.eu) : il faut donc que ces noms
# pointent vers cette machine et que le port 80 local mène au proxy de la VM.
# La ligne /etc/hosts est retirée à la fermeture, même sur Ctrl+C : oubliée,
# elle détournerait ces noms une fois le site réellement en ligne.
if [ "$OPTION" = "--federation" ]; then
  if ! libre 80; then
    echo "Le port 80 est déjà pris sur cette machine (serveur web local ?)." >&2
    exit 1
  fi
  if ! ssh -o BatchMode=yes -o ConnectTimeout=10 "$VM" true 2>/dev/null; then
    echo "Connexion impossible à $VM. Vérifier le réseau et la clé (ssh-copy-id $VM)." >&2
    exit 1
  fi

  # « -i.bak » plutôt que « -i » seul : c'est la seule forme que comprennent
  # à la fois le sed de Linux et celui de macOS.
  retirer_hosts() {
    sudo sed -i.bak '/padoc\.ifpc\.eu/d' /etc/hosts && sudo rm -f /etc/hosts.bak
  }

  sudo -v || exit 1
  retirer_hosts
  echo "127.0.0.1  padoc.ifpc.eu ciderscope.ifpc.eu" | sudo tee -a /etc/hosts > /dev/null
  trap 'retirer_hosts; echo; echo "Tunnel fermé, /etc/hosts remis en état."' EXIT

  cat <<FIN

  ┌──────────────────────────────────────────────────────────────┐
  │  Démonstration avec connexion PADOC                          │
  ├──────────────────────────────────────────────────────────────┤
  │  CiderScope   http://ciderscope.ifpc.eu
  │  PADOC        http://padoc.ifpc.eu
  └──────────────────────────────────────────────────────────────┘

  Ctrl+C pour refermer (la ligne /etc/hosts est retirée).

FIN
  # Clés et hôtes connus de l'utilisateur : sous sudo, ssh chercherait ceux de
  # root et redemanderait de valider l'empreinte de la VM. Toutes les clés
  # présentes sont proposées, pour marcher d'un poste à l'autre.
  cles=()
  for cle in "$HOME"/.ssh/id_ed25519 "$HOME"/.ssh/id_ecdsa "$HOME"/.ssh/id_rsa; do
    [ -f "$cle" ] && cles+=(-i "$cle")
  done
  sudo ssh -N \
    ${cles[@]+"${cles[@]}"} \
    -o UserKnownHostsFile="$HOME/.ssh/known_hosts" \
    -o ExitOnForwardFailure=yes \
    -o ServerAliveInterval=30 \
    -L 80:localhost:80 \
    "$VM"
  exit
fi

for couple in "$P_PADOC PADOC" "$P_CIDER CiderScope" "$P_PROXY proxy"; do
  set -- $couple
  if ! libre "$1"; then
    echo "Le port $1 ($2) est déjà pris sur cette machine." >&2
    echo "Relancer avec un autre port, par exemple : P_PADOC=9080 $0" >&2
    exit 1
  fi
done

echo "Connexion à $VM…"
if ! ssh -o BatchMode=yes -o ConnectTimeout=10 "$VM" true 2>/dev/null; then
  echo "Connexion impossible." >&2
  echo "Vérifier le réseau, et que la clé est autorisée :" >&2
  echo "    ssh-copy-id $VM" >&2
  exit 1
fi

cat <<FIN

  ┌──────────────────────────────────────────────────────────────┐
  │  Applications de la VM, accessibles dans ce navigateur       │
  ├──────────────────────────────────────────────────────────────┤
  │  PADOC        http://localhost:$P_PADOC
  │  CiderScope   http://localhost:$P_CIDER
  │  Proxy        http://localhost:$P_PROXY
  └──────────────────────────────────────────────────────────────┘

  Ctrl+C pour refermer le tunnel.

FIN

if [ "$OPTION" = "--domaines" ]; then
  cat <<FIN
  Pour montrer les vrais noms de domaine plutôt que « localhost »,
  ajouter cette ligne à /etc/hosts (sudo requis), puis ouvrir
  http://padoc.ifpc.eu:$P_PROXY :

      127.0.0.1  padoc.ifpc.eu ciderscope.ifpc.eu

  À retirer après la démonstration — en une fois, la ligne a tendance
  à se dupliquer :

      sudo sed -i '/padoc\\.ifpc\\.eu/d' /etc/hosts

  Sinon ces noms resteront détournés vers cette machine une fois le
  site réellement en ligne.

  ⚠️  POUR DÉMONTRER LA FÉDÉRATION, ce tunnel ne suffit pas.
  OpenID Connect fait voyager le navigateur : il est renvoyé vers
  l'émetteur, qui doit donc répondre à l'adresse EXACTE annoncée —
  port compris. Avec le proxy sur un port local autre que 80, les
  redirections ne retombent pas sur leurs pieds.

  Il faut alors prendre le port 80 en local : relancer avec

      $0 --federation

  qui s'occupe aussi de /etc/hosts, puis ouvrir http://ciderscope.ifpc.eu.

FIN
fi

# -N : pas de commande distante, seulement les redirections.
# ExitOnForwardFailure : échouer franchement plutôt que d'ouvrir un tunnel
# muet dont on ne comprendrait pas, en réunion, pourquoi il ne sert rien.
exec ssh -N \
  -o ExitOnForwardFailure=yes \
  -o ServerAliveInterval=30 \
  -L "$P_PADOC:localhost:3000" \
  -L "$P_CIDER:localhost:3001" \
  -L "$P_PROXY:localhost:80" \
  "$VM"
