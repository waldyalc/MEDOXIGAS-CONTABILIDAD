<!-- BEGIN:nextjs-agent-rules -->

## This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

# AGENTS.md — Medoxigas-OPP

ERP interno de **MEDOXIGAS ALC, SRL** (oxígeno medicinal e industrial, Cabral, Barahona, RD). Dueño: Waldy Alcántara. Módulos: **Producción** y **Caja Chica** (diseño en `docs/dominio-caja-chica.md`) ("módulo" = entrada del menú lateral).

- App: https://medoxigas-opp.vercel.app · Repo: `waldyalc/MEDOXIGAS-OPP`.
- Base de datos: Supabase, proyecto **MEDOXIGAS-OPP** (`roykriwnmzzcyztxlycg`). **Única fuente de la verdad.** Usuarios: Waldy (admin), Héctor (caja, pendiente), lector e2e; roles en `perfiles`.
- Diseño: plantilla Studio Admin → `docs/plantilla-diseno.md`. Dominio LOX y pantalla Producción → `docs/dominio-produccion.md`.
- Roles: **Coder** (tech lead) diseña y revisa el diff; **OpenCode** (`opencode-go/muse-spark-1.3-contributor`) escribe el código. Waldy aprueba lo irreversible: deploy a producción, migraciones que borran o cambian datos, borrar datos, planes pagos.

## Caja Chica (resumen)

- Sin contabilidad: registro de gastos con fórmulas calculadas. Escrituras SOLO por RPC `cc_*` (security definer, rol vía `perfiles`); tablas solo lectura para `authenticated`; nunca DELETE. Detalle en `docs/dominio-caja-chica.md`.
- En producción no se crean sesiones ni gastos de prueba (no hay borrado): todo flujo se prueba con pgTAP local.

## Comandos (verificados, copy-paste)

| Para…                    | Comando                                                        |
| ------------------------ | -------------------------------------------------------------- |
| Instalar (activa hooks)  | `pnpm install`                                                 |
| Desarrollo               | `pnpm dev` → http://localhost:3000 (`/login`, sin sesión)      |
| Tipos                    | `pnpm typecheck`                                               |
| Formato + lint + imports | `pnpm check` (`pnpm check:fix` para arreglar)                   |
| Tests unitarios          | `pnpm test`                                                    |
| Humo navegador           | `pnpm test:e2e` (sin `E2E_EMAIL`/`E2E_PASSWORD` se salta)      |
| Build prod               | `pnpm build`                                                   |
| Regenerar tipos Supabase | `pnpm db:types` (tras cada migración; ver `supabase/AGENTS.md`) |
| Probar RLS en local      | `supabase start` + `supabase test db` (NUNCA contra producción) |

## Estructura (convención de la plantilla)

- Rutas: `src/app/(main)/dashboard/<modulo>/page.tsx` (p. ej. `produccion`). `page.tsx` es Server Component chico, sin `"use client"`; lo interactivo va en su propio componente cliente.
- Componentes: `.../<modulo>/_components/`. Datos y consultas: `src/lib/`.
- Menú: `src/navigation/sidebar/sidebar-items.ts`. Auth y sesión: `src/proxy.ts` (middleware Next 16) + `src/lib/supabase/{server,client,proxy}.ts`.
- Backend y RLS: ver `supabase/AGENTS.md`.

## Archivos generados (no editar a mano)

- `src/lib/supabase/types.ts` ← `pnpm db:types` (tras cada migración; CI verifica que estén al día).
- `pnpm-lock.yaml` ← `pnpm install`. `.next/`, `next-env.d.ts` ← `next dev`/`build`.

## Calidad de código (la verifica CI; el pre-push también)

- TypeScript estricto extra (`noUncheckedIndexedAccess`, etc.; sin `exactOptionalPropertyTypes`: rompe Base UI). Biome: sin `any` (salvo `src/components/ui`), sin `!`, sin `console` salvo `error`/`warn` (scripts en `src/scripts/` exentos), sin `@ts-ignore`. Toda supresión `biome-ignore` o `@ts-expect-error` lleva el motivo en el mismo comentario.
- Código simple, poco, sin relleno. Sin nuevas dependencias sin decirlo en el PR y justificarlo.

## Antes de decir "listo"

- [ ] `pnpm typecheck`, `pnpm check`, `pnpm test` y `pnpm build` en verde.
- [ ] Un PR = una tarea; diff pequeño (<400 líneas sin contar generados/lockfile); PR en borrador mientras trabajas.
- [ ] Si tocaste datos: los números coinciden con Supabase (SQL de solo lectura). Si cambió UI: capturas en claro/oscuro y móvil.
- [ ] Actualiza `HANDOFF.md` (qué se hizo y cómo se resolvió).

## Nunca

- `service_role` en el cliente (solo el pipeline la usa); desactivar RLS; editar migraciones aplicadas.
- Cambiar una política RLS para que un test pase sin el OK de Waldy.
- Probar Supabase contra producción (`--linked`, `--db-url` o el proyecto real): solo `supabase start` local.
- Commitear `.env*`; `--no-verify`; escribir en WhatsApp ni contactar a nadie.
