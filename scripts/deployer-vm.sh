#!/usr/bin/env bash
#
# Déploie une version de PADOC sur la VM — l'environnement de test de l'équipe.
#
#   ./scripts/deployer-vm.sh v1.4.0     une version publiée (tag)
#   ./scripts/deployer-vm.sh main       l'état courant de main, pour le tester
#
# La production (Vercel, Railway) ne passe pas par ici : elle suit la branche
# « production », avancée par la publication d'une version (docs/versions.md).
#
# Prérequis : la clé SSH autorisée sur la VM, et le dépôt cloné dans
# $DEPOT_VM avec son .env (jamais versionné).

set -euo pipefail

VM="${VM_HOTE:-vmadmin@138.102.157.119}"
DEPOT_VM="${DEPOT_VM:-/opt/padoc/ifpc}"
REF="${1:-}"

if [ -z "$REF" ]; then
  echo "Usage : $0 <version ou branche>   (ex. v1.4.0, ou main)" >&2
  exit 2
fi
# Une référence de branche ou de tag, rien d'autre : elle part dans une
# commande distante.
if [[ ! "$REF" =~ ^[A-Za-z0-9._/-]+$ ]]; then
  echo "Référence invalide : $REF" >&2
  exit 2
fi

echo "Déploiement de « $REF » sur $VM ($DEPOT_VM)…"
ssh -o ConnectTimeout=10 "$VM" bash -s -- "$DEPOT_VM" "$REF" <<'DISTANT'
set -euo pipefail
DEPOT="$1"; REF="$2"
cd "$DEPOT"

# Une copie modifiée à la main sur la VM serait écrasée sans prévenir.
if [ -n "$(git status --porcelain --untracked-files=no)" ]; then
  echo "La copie de $DEPOT a des modifications locales : déploiement refusé." >&2
  git status --short --untracked-files=no >&2
  exit 1
fi

git fetch --tags --prune origin
if git rev-parse -q --verify "refs/tags/$REF" >/dev/null; then
  CIBLE="refs/tags/$REF"
elif git rev-parse -q --verify "refs/remotes/origin/$REF" >/dev/null; then
  CIBLE="origin/$REF"
else
  echo "« $REF » n'est ni une version publiée ni une branche." >&2
  echo "Versions récentes : $(git tag -l 'v*' --sort=-v:refname | head -5 | tr '\n' ' ')" >&2
  exit 1
fi
AVANT=$(git rev-parse --short HEAD)
git checkout --quiet --detach "$CIBLE"
echo "Code : $AVANT → $(git rev-parse --short HEAD) ($REF, version $(cat version.txt 2>/dev/null || echo ?))"

docker compose up -d --build
echo
docker compose ps --format "table {{.Name}}\t{{.Status}}"
DISTANT

echo
echo "Retour à la version précédente : $0 <version précédente>"
