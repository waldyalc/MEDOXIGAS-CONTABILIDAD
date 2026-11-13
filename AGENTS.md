<!-- BEGIN:nextjs-agent-rules -->

## This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

# AGENTS.md — Medoxigas Contabilidad

Sistema de **contabilidad y facturación** propio de **MEDOXIGAS ALC, SRL** (y Oxymat), República Dominicana. Dueño: Waldy Alcántara. **Inspirado** en Alegra (alegra.com), **no es una copia**: nada de su código, textos, logos ni diseño exacto; no se hace ingeniería inversa (sus términos lo prohíben). El estudio de cómo trabaja Waldy en Alegra va en `docs/alegra/`.

- Producción: rama `main` → https://medoxigas-contabilidad.vercel.app · Prueba: rama `prueba` → https://medoxigas-contabilidad-prueba.vercel.app · Repo: `waldyalc/MEDOXIGAS-CONTABILIDAD`.
- Base de datos: Supabase, proyecto **MEDOXIGAS-CONTABILIDAD** (`ljfdhrnvlsfaweuvnqxz`, ca-central-1, plan gratis). **Única fuente de la verdad.** Roles en `perfiles`: `admin`, `contador`, `lector`.
- Mismo stack que Medoxigas-OPP (`waldyalc/MEDOXIGAS-OPP`): Next.js 16, React 19, Supabase (`@supabase/ssr`), shadcn/ui + Tailwind 4, Biome, Vitest, Playwright, pnpm, Vercel. Diseño: plantilla Studio Admin → `docs/plantilla-diseno.md`.
- Roles: **Coder** (tech lead) diseña y revisa el diff; **OpenCode** (`opencode-go/deepseek-v4.1-flash`, variante `max`) escribe el código. Waldy aprueba lo irreversible: deploy a producción, migraciones que borran o cambian datos, borrar datos, planes pagos.
- Fiscal RD: la facturación debe cumplir con la DGII (e-CF / NCF, reportes 606 y 607). Se diseña con Contable antes de programar.

## Módulos (menú lateral)

Inicio (hecho). Próximos, en este orden: Clientes y Productos → Facturación con comprobantes fiscales → Cuentas por cobrar → Gastos → Bancos → Reportes. Cada módulo: `docs/dominio-<modulo>.md` primero, luego migración + RLS + pgTAP, luego pantalla.

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

- Rutas: `src/app/(main)/dashboard/<modulo>/page.tsx`. `page.tsx` es Server Component chico, sin `"use client"`; lo interactivo va en su propio componente cliente.
- Componentes: `.../<modulo>/_components/`. Datos y consultas: `src/lib/<modulo>/`.
- Menú: `src/navigation/sidebar/sidebar-items.ts` (`roles` por ítem). Auth y sesión: `src/proxy.ts` (middleware Next 16) + `src/lib/supabase/{server,client,proxy}.ts`. Rol: `src/lib/auth/rol.ts`.
- Backend y RLS: ver `supabase/AGENTS.md`.

## Archivos generados (no editar a mano)

- `src/lib/supabase/types.ts` ← `pnpm db:types` (tras cada migración; CI verifica que estén al día).
- `pnpm-lock.yaml` ← `pnpm install`. `.next/`, `next-env.d.ts` ← `next dev`/`build`.

## Calidad de código (la verifica CI; el pre-push también)

- TypeScript estricto extra (`noUncheckedIndexedAccess`, etc.; sin `exactOptionalPropertyTypes`: rompe Base UI). Biome: sin `any` (salvo `src/components/ui`), sin `!`, sin `console` salvo `error`/`warn` (scripts en `src/scripts/` exentos), sin `@ts-ignore`. Toda supresión `biome-ignore` o `@ts-expect-error` lleva el motivo en el mismo comentario.
- Dinero: nunca `number` flotante para montos guardados; en la base `numeric(14,2)`, cálculos de ITBIS y totales en el servidor.
- Código simple, poco, sin relleno. Sin nuevas dependencias sin decirlo en el PR y justificarlo.

## Git y despliegue

- Trabajo en ramas `feat/*` → merge a `prueba` (Waldy revisa) → `main` solo por fast-forward con OK de Waldy. Nunca force-push.
- Las tareas de OpenCode no hacen commit; el coordinador junta y hace un solo commit.

## Antes de decir "listo"

- [ ] `pnpm typecheck`, `pnpm check`, `pnpm test` y `pnpm build` en verde.
- [ ] Un PR = una tarea; diff pequeño (<400 líneas sin contar generados/lockfile).
- [ ] Si tocaste datos: los números coinciden con Supabase (SQL de solo lectura). Si cambió UI: capturas en claro/oscuro y móvil.
- [ ] Actualiza `HANDOFF.md` (qué se hizo y cómo se resolvió).

## Nunca

- `service_role` en el cliente; desactivar RLS; editar migraciones aplicadas.
- Cambiar una política RLS para que un test pase sin el OK de Waldy.
- Probar Supabase contra producción (`--linked`, `--db-url` o el proyecto real): solo `supabase start` local.
- Commitear `.env*` o claves (Alegra, Supabase, DGII); `--no-verify`; copiar código, textos o imágenes de Alegra; escribir en WhatsApp ni contactar a nadie.
