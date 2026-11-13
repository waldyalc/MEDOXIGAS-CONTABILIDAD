---
name: probar-cambios
description: Qué correr antes de commitear (typecheck, Biome solo en lo que cambiaste, tests relevantes). No dupliques el pre-push. Nunca --no-verify.
---

# Probar cambios

Comandos tomados de `package.json` y de `.husky/`. Corre **una vez** antes del commit, no el suite completo otra vez antes del push.

```powershell
pnpm typecheck
pnpm exec biome check --write <archivos que cambiaste>
pnpm exec vitest run <ruta-del-test>
```

- El `vitest` solo si hay tests que cubran lo que tocaste (por ejemplo `src/lib/facturacion/calculo.test.ts`). Si no hay un test relevante, no corras `pnpm test` entero: el hook de pre-push ya lo hace.
- `pnpm build` **solo** si tocaste config, rutas o código de servidor (`next.config`, `src/proxy.ts`, `src/app/**/route.ts`, layouts de raíz, env). Un cambio de UI o de copy no lo necesita.
- No corras `pnpm check` ni `pnpm check:fix` sobre todo el repo. Si Biome marca archivos que **tú no tocaste** (a menudo finales de línea CRLF en Windows), ignóralos. No conviertas el repo a lo masivo ni pelees con `git status`.
- El **pre-push** (`.husky/pre-push`) ya corre `pnpm typecheck && pnpm test`. No los vuelvas a correr a mano justo antes de empujar.

| Script | Qué hace |
| --- | --- |
| `pnpm typecheck` | `tsc --noEmit` |
| `pnpm check` | `biome check` (formato + lint + imports). No lo uses en todo el repo. |
| `pnpm check:fix` | `biome check --write`. Prefiere `--write` solo en los archivos que cambiaste. |
| `pnpm lint` | `biome lint` (solo lint). |
| `pnpm test` | `vitest run` (todo el suite; lo corre el pre-push). |
| `pnpm exec vitest run <ruta>` | Un archivo o carpeta de tests. |
| `pnpm build` | `next build`. Solo si aplica (ver arriba). |
| `pnpm test:e2e` | Playwright. Se salta si no están `E2E_EMAIL` y `E2E_PASSWORD`. No inventes esas variables. |
| `pnpm db:types` | Regenera `src/lib/supabase/types.ts` tras una migración. No edites ese archivo a mano. |

Biome (ver `biome.json`) no revisa `*.md`, `.husky`, `src/components/ui` ni `src/lib/supabase/types.ts`.

## Hooks (husky)

Se activan con `pnpm install` (`prepare`: `husky`).

- **pre-commit** (`.husky/pre-commit`): `pnpm exec lint-staged`. Solo archivos staged `*.{js,jsx,ts,tsx,mjs,mts,json,css}` con `biome check --write --no-errors-on-unmatched`. Si `gitleaks` está instalado, también corre `gitleaks protect --staged`. Los `.md` no pasan por Biome aquí.
- **pre-push** (`.husky/pre-push`): `pnpm typecheck && pnpm test`. No corre `pnpm check` ni `pnpm build`.

Nunca uses `--no-verify` ni `HUSKY=0`. Si un hook falla, arregla la causa y vuelve a intentar.
