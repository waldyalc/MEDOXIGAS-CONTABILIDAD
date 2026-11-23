#!/usr/bin/env bash
# Preparación de un worktree nuevo. Lo lanza T3 Code al crear un hilo con
# worktree (ver t3.json → scripts[runOnWorktreeCreate]); también se puede
# correr a mano dentro de cualquier worktree.
#
# 1) Enlaza .env.local y .env.pruebas desde el checkout principal del repo
#    (los .env* no se commitean: sin este paso el worktree no levanta la app
#    ni el login ZZTEST). Los archivos reales jamás se pisan.
# 2) `pnpm install --prefer-offline` contra el store compartido del VPS.
#
# Idempotente. No imprime secretos.

set -euo pipefail

WT="$(git rev-parse --show-toplevel 2>/dev/null || pwd)"
COMMON="$(git rev-parse --git-common-dir 2>/dev/null || echo .git)"
# En worktrees enlazados devuelve <repo>/.git; en el checkout principal, ".git".
MAIN="$(cd "$(dirname "$COMMON")" 2>/dev/null && pwd || echo "$WT")"

enlaza_env() {
  local nombre="$1"
  local origen="$MAIN/$nombre"
  local destino="$WT/$nombre"

  [ "$MAIN" = "$WT" ] && return 0
  [ -f "$origen" ] || return 0
  if [ -e "$destino" ] && [ ! -L "$destino" ]; then
    echo "t3-setup: $nombre ya existe como archivo real; no se toca."
    return 0
  fi
  ln -sfn "$origen" "$destino"
  echo "t3-setup: $nombre enlazado desde $MAIN (symlink)."
}

enlaza_env .env.local
enlaza_env .env.pruebas

cd "$WT"
pnpm install --prefer-offline
