<!-- BEGIN:nextjs-agent-rules -->

## This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

# AGENTS.md — Medoxigas Contabilidad

Sistema de **contabilidad y facturación** propio de **MEDOXIGAS ALC, SRL** (y Oxymat), República Dominicana. Dueño: Waldy Alcántara. **Inspirado** en Alegra (alegra.com), **no es una copia**: nada de su código, textos, logos ni diseño exacto; no se hace ingeniería inversa (sus términos lo prohíben). El estudio de cómo trabaja Waldy en Alegra va en `docs/alegra/`. El contexto completo para seguir el sistema en local, sin Coder, está en `docs/CONTEXTO-CODER.md`.

- **Fuente de la verdad:** `docs/alegra/ALEGRA.md` (con sus capturas y las guías `css-*`). Todo se construye copiando el comportamiento y el orden de Alegra Contabilidad documentados ahí; si hay dudas, manda ese archivo.
- Producción: rama `main` → https://medoxigas-contabilidad.vercel.app · Prueba: rama `prueba` → https://medoxigas-contabilidad-prueba.vercel.app · Repo: `waldyalc/MEDOXIGAS-CONTABILIDAD`.
- Base de datos: Supabase, proyecto **MEDOXIGAS-CONTABILIDAD** (`ljfdhrnvlsfaweuvnqxz`, ca-central-1, plan gratis). **Única fuente de la verdad.** Roles en `perfiles`: `admin`, `contador`, `lector`.
- Mismo stack que Medoxigas-OPP (`waldyalc/MEDOXIGAS-OPP`): Next.js 16, React 19, Supabase (`@supabase/ssr`), shadcn/ui + Tailwind 4, Biome, Vitest, Playwright, pnpm, Vercel. Diseño: plantilla Studio Admin → `docs/plantilla-diseno.md`.
- Roles: **Coder** (tech lead) diseña y revisa el diff; **OpenCode** (`opencode-go/deepseek-v4.1-flash`, variante `max`) escribe el código. Waldy aprueba lo irreversible: deploy a producción, migraciones que borran o cambian datos, borrar datos, planes pagos.
- Fiscal RD: la facturación debe cumplir con la DGII (e-CF / NCF, reportes 606 y 607). Se diseña con Contable antes de programar.

## Ir rápido

- Lee solo lo que pide el brief (y la skill que aplique). No explores el repo ni `node_modules` por curiosidad.
- No leas tipos en `node_modules` para copiar una API: copia un uso real del repo (ver skill `diseno-ui`).
- No hagas verificación visual, no levantes el dev server ni abras el preview, salvo que el brief lo pida (lo hace Coder).
- ¿Atascado? Usa la skill pedir-ayuda: pregunta, no des vueltas.

## Antes de empezar

- [ ] Lee este `AGENTS.md` y el `HANDOFF.md`.
- [ ] Carga la skill de `.opencode/skills/` que aplique (ver abajo).
- [ ] Si el cambio es de UI, lee también `docs/plantilla-diseno.md` y, si toca factura o fechas, `docs/alegra/css-factura/`.

## Skills

Viven en `.opencode/skills/<nombre>/SKILL.md`. Cárgalas con la herramienta `skill` de OpenCode (el id es el nombre de la carpeta):

- `localhost` — levantar el dev server en un worktree de T3 (puerto 3001, `.env.local`, login y la misma base de producción).
- `probar-cambios` — comandos de test, lint, typecheck y build, y los hooks de husky (nunca `--no-verify`).
- `flujo-git` — rama `feat/*` desde `origin/prueba`, commits chicos, empujar la rama; no fusionar ni hacer force-push.
- `diseno-ui` — shadcn tal cual (`InputGroup`, `Select`, calendario), colores Medoxigas e inspiración de `docs/alegra/`, sin copiar código de Alegra.
- `motor-contable` — motor de doble partida (archivos, cuentas por defecto, invariantes) y tests antes de cambiar un cálculo.
- `supabase-migraciones` — cómo escribir una migración; no aplicarla en el remoto ni usar `service_role`; RLS en tablas nuevas.
- `pedir-ayuda` — si te atascas, pregunta a Coder con la herramienta `question`; no des vueltas ni inventes atajos.
- `biome` — cómo convertir cada corrección de Waldy en un candado (test o regla de Biome) y resumen de la charla de Lauren Tan.

## Módulos (menú lateral)

Hechos en la beta 1: Inicio, Contactos, Productos, Facturación, Pagos recibidos, Compras (facturas y pagos a proveedores), Gastos menores, Contabilidad y Reportes. El motor contable se resume en `docs/motor-contable.md`; tablas y RPC en `supabase/AGENTS.md`.

Próximos: datos de la empresa (RNC, dirección, logo), numeraciones B14/B15/B16, e-CF/DGII (606/607), Bancos y notas de crédito. Cada módulo nuevo: `docs/dominio-<modulo>.md` primero, luego migración + RLS + pgTAP, luego pantalla.

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
- Listas desplegables: siempre `Select`/`SelectCampo` o el `Combobox` de `components/ui`; nunca `<select>` ni `NativeSelect` fuera de `components/ui`. `src/lib/selects-nativos.test.ts` falla si reaparecen.
- Código simple, poco, sin relleno. Sin nuevas dependencias sin decirlo en el PR y justificarlo.

## Git y despliegue

- Trabajo en ramas `feat/*` desde `origin/prueba`. El agente hace commits chicos y empuja **su rama**. Coder revisa y fusiona a `prueba` (Waldy prueba). `main` solo por fast-forward con OK de Waldy. Nunca force-push ni fusionar a `prueba`/`main` desde una tarea. Ver skill `flujo-git`.

## Candados: cada corrección se vuelve un test o una regla

- **Regla de oro:** cada vez que Waldy te corrija algo, no lo apuntes solo aquí. Crea un **test** (Vitest, pgTAP o Playwright) o una **regla de Biome** que falle si alguien lo vuelve a hacer, con un mensaje que diga cómo arreglarlo de raíz. Después agrega una línea abajo. Cómo hacerlo: skill `biome`.
- **Por qué:** este archivo es un consejo y la IA a veces no lo lee, se le olvida o busca una excusa. Un test o una regla es un candado: si se rompe, el commit no entra.
- **Test** = un programa pequeño que revisa que el sistema funcione (ej.: una factura de 1,000 genera un asiento que cuadra). **Regla de Biome** = revisa cómo está escrito el código (ej.: prohibido `<select>` nativo).
- La IA copia lo que ve en el repo: no dejes parches ni comentarios que justifiquen atajos; limpia los casos viejos cuando crees una regla.

Candados que ya existen:

- `src/lib/selects-nativos.test.ts` — prohíbe `<select>` y `NativeSelect` fuera de `components/ui`.
- `src/lib/rpc-sin-extraer.test.ts` — prohíbe guardar `supabase.rpc` en una variable o convertirlo con `as` (desvincula `this` y crashea la pantalla); llamar siempre `supabase.rpc("nombre", args)` directo.
- `src/lib/numeraciones/acciones.test.ts` — la server action de numeraciones llama la RPC directa con el payload validado y devuelve los errores en español.
- `src/lib/paginacion.test.ts` — los reportes, bancos, fichas y selectores críticos leen por lotes (`paginarConsulta`/`consultarEnLotes`), sin topes de 300/500/1,000; ventas/rentabilidad por producto no se corta en 20,000 líneas.
- `tests/e2e/numeraciones.spec.ts` — guardar B16 sin cambios cierra el diálogo y un nombre en blanco muestra el error en español (requiere `E2E_EMAIL`/`E2E_PASSWORD`, como el humo).

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
