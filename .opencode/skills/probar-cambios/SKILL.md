---
name: probar-cambios
description: Correr los comandos de test, lint, typecheck y build de este repo, y respetar los hooks de husky (nunca --no-verify).
---

# Probar cambios

Comandos tomados de `package.json`. Corre estos cuatro en verde antes de decir que terminaste (también lo pide `AGENTS.md`):

```powershell
pnpm typecheck
pnpm check
pnpm test
pnpm build
```

| Script | Qué hace |
| --- | --- |
| `pnpm typecheck` | `tsc --noEmit` |
| `pnpm check` | `biome check` (formato + lint + imports) |
| `pnpm check:fix` | `biome check --write` (arregla lo que pueda) |
| `pnpm lint` | `biome lint` (solo lint; prefiere `pnpm check`) |
| `pnpm test` | `vitest run` |
| `pnpm build` | `next build` |
| `pnpm test:e2e` | Playwright. Se salta si no están `E2E_EMAIL` y `E2E_PASSWORD`. No inventes esas variables. |
| `pnpm db:types` | Regenera `src/lib/supabase/types.ts` tras una migración. No edites ese archivo a mano. |

Biome (ver `biome.json`) no revisa `*.md`, `.husky`, `src/components/ui` ni `src/lib/supabase/types.ts`.

## Hooks (husky)

Se activan con `pnpm install` (`prepare`: `husky`).

- **pre-commit** (`.husky/pre-commit`): `pnpm exec lint-staged`. Solo archivos staged `*.{js,jsx,ts,tsx,mjs,mts,json,css}` con `biome check --write --no-errors-on-unmatched`. Si `gitleaks` está instalado, también corre `gitleaks protect --staged`. Los `.md` no pasan por Biome aquí.
- **pre-push** (`.husky/pre-push`): `pnpm typecheck && pnpm test`. No corre `pnpm check` ni `pnpm build`; correlos tú.

Nunca uses `--no-verify` ni `HUSKY=0`. Si un hook falla, arregla la causa y vuelve a intentar.
