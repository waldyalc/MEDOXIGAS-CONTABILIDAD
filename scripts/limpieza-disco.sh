#!/usr/bin/env bash
# limpieza-disco.sh — SOLO LISTA candidatos a borrar en el VPS. No borra nada.
#
# Reporta:
#   1) worktrees de git cuya rama ya está mergeada en la rama base
#   2) carpetas .next viejas (checkout principal y worktrees)
#   3) capturas y reportes de Playwright viejos (fuera y dentro del repo)
#   4) extras: /tmp/opencode, worktrees sin rama (detached), store de pnpm
#
# El borrado automático por cron queda APAGADO hasta el OK de Waldy.
# Uso: scripts/limpieza-disco.sh [rama-base]   (defecto: feat/pos-alegra-exacto)

set -uo pipefail

REPO="${REPO:-/root/MEDOXIGAS-CONTABILIDAD}"
BASE="${1:-feat/pos-alegra-exacto}"
DIAS_NEXT="${DIAS_NEXT:-3}"
DIAS_CAPTURAS="${DIAS_CAPTURAS:-7}"

kb() { du -sk "$1" 2>/dev/null | cut -f1; }
humano() {
  local k="${1:-0}"
  if [ "$k" -ge 1048576 ]; then echo "$((k / 1048576)) GB"
  elif [ "$k" -ge 1024 ]; then echo "$((k / 1024)) MB"
  else echo "${k} KB"; fi
}

echo "== Limpieza de disco — solo listar (repo: $REPO, base: $BASE)"
echo

echo "== 1) Worktrees cuya rama ya está mergeada en $BASE"
git -C "$REPO" worktree list --porcelain | awk '/^worktree /{w=$2} /^branch /{print w" "substr($2,12)}' | while read -r wt rama; do
  [ "$wt" = "$REPO" ] && continue
  [ -z "$rama" ] && continue
  propios=$(git -C "$REPO" rev-list --count "$BASE..$rama" 2>/dev/null || echo "?")
  sucio=""; [ -n "$(git -C "$wt" status --porcelain 2>/dev/null | head -3)" ] && sucio=" SUCIO"
  if [ "$propios" = "0" ]; then
    # Punta == base → nunca commiteó (posible hijo vivo); punta detrás → mergeada.
    if [ "$(git -C "$REPO" rev-parse "$rama" 2>/dev/null)" = "$(git -C "$REPO" rev-parse "$BASE" 2>/dev/null)" ]; then
      printf "   sin commits propios (¿hijo vivo?) %-46s (%s)%s\n" "$wt" "$rama" "$sucio"
    else
      k=$(kb "$wt")
      printf "   MERGEADO  %-70s %8s  (%s)%s\n" "$wt" "$(humano "$k")" "$rama" "$sucio"
    fi
  else
    printf "   pendiente %-70s          (%s, +%s commits)%s\n" "$wt" "$rama" "$propios" "$sucio"
  fi
done
echo "   (worktrees sin rama/detached se listan en 4)"
echo

echo "== 2) Carpetas .next de más de $DIAS_NEXT días sin tocar"
find "$REPO" /root/.t3/worktrees /root/worktrees /tmp/opencode -maxdepth 3 -name .next -type d -mtime "+$DIAS_NEXT" 2>/dev/null | while read -r d; do
  k=$(kb "$d")
  printf "   %-80s %8s  (%s)\n" "$d" "$(humano "$k")" "$(date -d "@$(stat -c %Y "$d")" +%Y-%m-%d)"
done
echo

echo "== 3) Capturas y reportes viejos (>$DIAS_CAPTURAS días)"
{
  find /root/referencias -type f -mtime "+$DIAS_CAPTURAS" 2>/dev/null
  find /root/.t3/worktrees /root/worktrees "$REPO" /tmp/opencode -maxdepth 4 \
    \( -name 'test-results' -o -name 'playwright-report' -o -iname '*captura*' \) \
    -mtime "+$DIAS_CAPTURAS" 2>/dev/null
} | sort -u | while read -r d; do
  k=$(kb "$d")
  printf "   %-80s %8s\n" "$d" "$(humano "$k")"
done
echo

echo "== 4) Extras (revisar a ojo)"
for d in /tmp/opencode /root/preview-antes-carrito /root/.local/share/pnpm/store; do
  [ -e "$d" ] || continue
  k=$(kb "$d")
  printf "   %-80s %8s\n" "$d" "$(humano "$k")"
done
git -C "$REPO" worktree list --porcelain | awk '/^worktree /{w=$2} /detached/{print w}' | while read -r wt; do
  k=$(kb "$wt")
  printf "   DETACHED  %-70s %8s\n" "$wt" "$(humano "$k")"
done
echo

echo "== Nada se borró. El borrado queda manual hasta el OK de Waldy (cron apagado)."
