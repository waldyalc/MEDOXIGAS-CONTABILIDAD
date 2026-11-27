---
name: probar-cambios
description: Qué correr antes de commitear y antes de reportar al Orquestador (typecheck, Biome y tests). Nunca --no-verify.
---

# Probar cambios

Comandos tomados de `package.json` y de `.husky/`. La verificación que el Orquestador espera en cada tarea delegada es la terna completa:

```powershell
pnpm typecheck
pnpm check
pnpm test
```

Corre eso **antes de reportar**. Si algo falla, arregla la causa; no lo reportes como verde ni lo des por «preexistente» sin comprobarlo.

Mientras iteras, para no esperar el suite completo en cada vuelta:

```powershell
pnpm exec biome check --write <archivos que cambiaste>
pnpm exec vitest run <ruta-del-test>
```

- `pnpm build` **solo** si tocaste config, rutas o código de servidor (`next.config`, `src/proxy.ts`, `src/app/**/route.ts`, layouts de raíz, env). Un cambio de UI, de copy o de documentación no lo necesita.
- No conviertas el repo a lo masivo ni pelees con `git status`: si Biome marca archivos que **tú no tocaste** (a menudo finales de línea CRLF en Windows), ignóralos.
- El **pre-push** (`.husky/pre-push`) ya corre `pnpm typecheck && pnpm test`; es una red de seguridad, no un reemplazo de la terna de arriba.

| Script | Qué hace |
| --- | --- |
| `pnpm typecheck` | `tsc --noEmit` |
| `pnpm check` | `biome check` (formato + lint + imports). |
| `pnpm check:fix` | `biome check --write`. Prefiere `--write` solo en los archivos que cambiaste. |
| `pnpm lint` | `biome lint` (solo lint). |
| `pnpm test` | `vitest run` (todo el suite). |
| `pnpm exec vitest run <ruta>` | Un archivo o carpeta de tests. |
| `pnpm build` | `next build`. Solo si aplica (ver arriba). |
| `pnpm test:e2e` | Playwright. Se salta si no están `E2E_EMAIL` y `E2E_PASSWORD`. No inventes esas variables. |
| `pnpm db:types` | Regenera `src/lib/supabase/types.ts` tras una migración. No edites ese archivo a mano. |

Biome (ver `biome.json`) no revisa `*.md`, `.husky`, `src/components/ui` ni `src/lib/supabase/types.ts`. Un cambio solo de documentación igual pasa por `pnpm typecheck` y `pnpm test` (son rápidos y confirman que no rompiste nada).

## Hooks (husky)

Se activan con `pnpm install` (`prepare`: `husky`).

- **pre-commit** (`.husky/pre-commit`): `pnpm exec lint-staged`. Solo archivos staged `*.{js,jsx,ts,tsx,mjs,mts,json,css}` con `biome check --write --no-errors-on-unmatched`. Si `gitleaks` está instalado, también corre `gitleaks protect --staged`. Los `.md` no pasan por Biome aquí.
- **pre-push** (`.husky/pre-push`): `pnpm typecheck && pnpm test`. No corre `pnpm check` ni `pnpm build`.

Nunca uses `--no-verify` ni `HUSKY=0`. Si un hook falla, arregla la causa y vuelve a intentar.

## Antes de reportar

- [ ] `pnpm typecheck`, `pnpm check` y `pnpm test` en verde.
- [ ] `git status` sin archivos inesperados (ni `.env*`, ni `node_modules`, ni generados tocados a mano).
- [ ] Commits chicos en tu rama; sin push ni merge a `main` salvo que el brief lo pida.
