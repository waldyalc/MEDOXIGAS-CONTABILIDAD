<!-- BEGIN:nextjs-agent-rules -->

## This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

# AGENTS.md — Medoxigas Contabilidad

Sistema de **contabilidad y facturación** propio de **MEDOXIGAS ALC, SRL** (y Oxymat), República Dominicana. Dueño: Waldy Alcántara. **Inspirado** en Alegra (alegra.com): **el punto de venta copia su diseño exactamente** (decisión de Waldy, 22-11-2026 — teal `#00b19d` vía tokens `--pos-*` de `src/app/globals.css`), el resto del sistema solo se inspira. Sigue prohibido copiar código fuente de Alegra: nada de su código, HTML, CSS, selectores, textos largos ni logos, y no se hace ingeniería inversa (sus términos lo prohíben). El estudio de cómo trabaja Waldy en Alegra vive en `docs/alegra/`.

- **Exports crudos de Alegra (HTML/CSS capturados de la cuenta de Waldy):** sirven como regla de medición **local** del Orquestador — verificar px, colores y espaciados al revisar un diff — pero **nunca se commitean al repo** (es público), no se copian de ellos selectores, clases ni textos, y los subagentes solo trabajan con las guías destiladas y capturas de `docs/alegra/`.

- **Fuente de la verdad funcional:** `docs/alegra/ALEGRA.md` (con sus capturas y las guías `css-*`). Todo se construye copiando el comportamiento y el orden de Alegra Contabilidad documentados ahí; si hay dudas, manda ese archivo.
- **Repositorio:** `waldyalc/MEDOXIGAS-CONTABILIDAD`. **Solo existe `main`** → https://medoxigas-contabilidad.vercel.app (producción). Cada push a `main` despliega.
- **Base de datos:** Supabase, proyecto **MEDOXIGAS-CONTABILIDAD** (`ljfdhrnvlsfaweuvnqxz`, ca-central-1, plan gratis). **Única fuente de la verdad.** Roles en `perfiles`: `admin`, `contador`, `lector`.
- **Stack:** Next.js 16, React 19, Supabase (`@supabase/ssr`), shadcn/ui + Base UI + Tailwind 4, Biome, Vitest, Playwright, pnpm, Vercel. Diseño: plantilla Studio Admin → `docs/plantilla-diseno.md`.
- **Fiscal RD:** la facturación debe cumplir con la DGII (e-CF / NCF, reportes 606 y 607). Se diseña con Contable antes de programar.

## Rol según cómo fuiste invocado

**Lee esto primero. Orquestador y subagente nunca se confunden.**

### Sesión principal (Orquestador / Tech Lead)

Si estás hablando **directamente con Waldy en el hilo principal de T3 Code**, eres el **Orquestador**:

- Analizas el pedido, diseñas el plan y lo divides en tareas con **archivos disjuntos** (dos subagentes nunca escriben el mismo archivo).
- Delegas con `delegate_task` e `isolation: "worktree"`. Modelo por defecto: **DeepSeek V4.1 Flash 1017** → `providerInstanceId: "opencode_2"`, `model: "opencode-go/deepseek-v4.1-flash"`, `options: { variant: "max" }`; usa otro solo si Waldy lo pide.
- Revisas el diff real, verificas los checks de CI y luego integras a `main`.
- **Solo tú lees `docs/ORQUESTADOR.md`**: es tu playbook obligatorio.
- Waldy aprueba lo irreversible: deploy a producción, migraciones que borran o cambian datos, borrar datos y planes pagos.

### Subagente / tarea delegada (Ejecutor o Revisor)

Si llegaste por un brief de `delegate_task`, eres **Ejecutor** (o Revisor), no el orquestador:

- **Prueba visual SIEMPRE (regla de Waldy, 20-11-2026):** tu reporte entrega evidencia de lo que hiciste. Si tocaste UI o diseño: **capturas de pantalla del resultado funcionando** (dev server de tu worktree con Playwright, claro y oscuro; móvil si aplica). El Orquestador te pasa las credenciales por archivo temporal fuera del repo — nunca las imprimas ni las commitees. Las capturas se le muestran a **Waldy para que las verifique con sus ojos**; sin captura, tu trabajo no está terminado. Si tu tarea es backend/motor, la evidencia es la verificación (tests, pgTAP en CI, logs).

- **No leas `docs/ORQUESTADOR.md`** ni asumas el rol de orquestador.
- Ejecuta el brief **tú mismo** en tu worktree: código, tests y docs de tu tarea.
- Verifica en local con `pnpm typecheck`, `pnpm check` y `pnpm test`.
- Haz commits chicos en tu rama y **no hagas push ni merge a `main`** salvo que el brief lo pida explícitamente.
- **Nunca lances subagentes.**
- Reporta al Orquestador: archivos cambiados, verificación y cualquier bloqueo.

## Ir rápido

- Lee solo lo que pide el brief (y la skill que aplique). No explores el repo ni `node_modules` por curiosidad.
- No leas tipos en `node_modules` para copiar una API: copia un uso real del repo (ver skill `diseno-ui`).
- No hagas verificación visual, no levantes el dev server ni abras el preview, salvo que el brief lo pida (lo hace el Orquestador).
- ¿Atascado? Usa la skill `pedir-ayuda`: pregunta, no des vueltas.

## Antes de empezar

- [ ] Lee este `AGENTS.md` y el `HANDOFF.md`.
- [ ] Carga la skill de `.opencode/skills/` que aplique (ver abajo).
- [ ] Si el cambio es de UI, lee también `docs/plantilla-diseno.md` y, si toca factura o fechas, `docs/alegra/css-factura/`.

## Skills

Viven en `.opencode/skills/<nombre>/SKILL.md`. Cárgalas con la herramienta `skill` de OpenCode (el id es el nombre de la carpeta):

- `localhost` — levantar el dev server en un worktree de T3 (puerto 3001, `.env.local`, login y la misma base de producción).
- `probar-cambios` — comandos de test, lint, typecheck y build, y los hooks de husky (nunca `--no-verify`).
- `flujo-git` — rama `feat/*` o `fix/*` desde `origin/main`, commits chicos y reporte al Orquestador; sin merge a `main` ni force-push.
- `diseno-ui` — shadcn tal cual (`InputGroup`, `Select`, calendario), colores Medoxigas e inspiración de `docs/alegra/`, sin copiar código de Alegra.
- `motor-contable` — motor de doble partida (archivos, cuentas por defecto, invariantes) y tests antes de cambiar un cálculo.
- `supabase-migraciones` — cómo escribir una migración; no aplicarla en el remoto ni usar `service_role`; RLS en tablas nuevas.
- `pedir-ayuda` — si te atascas, pregunta al Orquestador con la herramienta `question`; no des vueltas ni inventes atajos.
- `biome` — cómo convertir cada corrección de Waldy en un candado (test o regla de Biome) y resumen de la charla de Lauren Tan.

## Módulos (menú lateral)

Hechos: Inicio, Ingresos (facturas de venta y recurrentes, pagos recibidos, notas de crédito y débito, cotizaciones, conduces), Compras (facturas de proveedor, pagos, gastos menores, notas de crédito, órdenes de compra, pagos recurrentes), Contactos, Inventario (productos, ajustes, transferencias, listas de precios, almacenes, categorías), Bancos (cuentas y conciliaciones), Contabilidad (catálogo de cuentas, asientos, numeraciones, activos fijos, periodos), Reportes y Configuración.

Punto de venta (`src/app/(pos)/pos/`, shell propio con riel lateral `menu-pos.tsx` de 56 px → 271 px, sin el sidebar de Contabilidad): `/pos` (vender), `/pos/pagos` (registro de pagos), `/pos/turnos`, `/pos/historial` (ventas) y `/pos/devoluciones`. La configuración de terminales vive en `/dashboard/configuracion/pos`.

Transversales: adjuntos por documento/ficha, auditoría de quién creó/modificó/anuló, búsqueda global, saldos iniciales, tipos de entrada de diario, límite de crédito por contacto y control de `vende_negativo` por producto. El motor contable se resume en `docs/motor-contable.md`; tablas y RPC en `supabase/AGENTS.md`.

Próximos: e-CF/DGII (606/607) y lo que marque `HANDOFF.md`. Cada módulo nuevo: `docs/dominio-<modulo>.md` primero, luego migración + RLS + pgTAP, luego pantalla.

## Comandos (verificados, copy-paste)

| Para…                    | Comando                                                        |
| ------------------------ | -------------------------------------------------------------- |
| Instalar (activa hooks)  | `pnpm install`                                                 |
| Desarrollo               | `pnpm dev` → http://localhost:3000 (`/login`, sin sesión)      |
| Tipos                    | `pnpm typecheck`                                               |
| Formato + lint + imports | `pnpm check` (`pnpm check:fix` para arreglar)                  |
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

- `src/lib/supabase/types.ts` ← `pnpm db:types` (tras cada migración; el job `db` de CI verifica que esté al día).
- `pnpm-lock.yaml` ← `pnpm install`. `.next/`, `next-env.d.ts` ← `next dev`/`build`.

## Calidad de código (la verifica CI; el pre-push también)

- TypeScript estricto extra (`noUncheckedIndexedAccess`, etc.; sin `exactOptionalPropertyTypes`: rompe Base UI). Biome: sin `any` (salvo `src/components/ui`), sin `!`, sin `console` salvo `error`/`warn` (scripts en `src/scripts/` exentos), sin `@ts-ignore`. Toda supresión `biome-ignore` o `@ts-expect-error` lleva el motivo en el mismo comentario.
- Dinero: nunca `number` flotante para montos guardados; en la base `numeric(14,2)`, cálculos de ITBIS y totales en el servidor.
- Listas desplegables: siempre `Select`/`SelectCampo` o el `Combobox` de `components/ui`; nunca `<select>` ni `NativeSelect` fuera de `components/ui`.
- `supabase.rpc("nombre", args)` siempre directo: nunca guardarlo en una variable ni convertirlo con `as` (desvincula `this` y crashea la pantalla).
- Código simple, poco, sin relleno. Sin nuevas dependencias sin decirlo en el PR y justificarlo.

## Git y despliegue

- **`main` es la única rama de larga vida**; cada push a `main` despliega a producción en Vercel.
- Toda tarea nace en `feat/*` o `fix/*` **desde `origin/main`**, en su propio worktree de T3.
- El subagente hace commits chicos en su rama y **reporta al Orquestador**; no empuja ni fusiona a `main` salvo que el brief lo pida.
- El Orquestador revisa el diff, verifica los checks reales de CI y luego integra a `main`.
- Nunca force-push, nunca `--no-verify`, nunca reescribir historia publicada. Ver skill `flujo-git`.

## Preview oficial en el VPS

- **Enlace oficial:** https://medoxigas-agentes.tail25e53a.ts.net (solo abre desde equipos con Tailscale). Es donde **Waldy revisa los cambios** en vivo.
- Por dentro es el servicio systemd `medoxigas-preview.service`: corre `pnpm dev` en el puerto **3010** desde `/root/MEDOXIGAS-CONTABILIDAD`, contra la **base de PRUEBA** con datos falsos (no producción).
- **Nunca** levantes otro dev server en el puerto 3010 ni mates ese servicio. Si hay que reiniciarlo: `systemctl restart medoxigas-preview`.
- Un worktree que quiera su propio preview usa otro puerto (**3011 en adelante**).
- El login es con los usuarios **ZZTEST** de `.env.pruebas` (las claves nunca van en el repo ni en prompts).

## Candados: cada corrección se vuelve un test o una regla

- **Regla de Waldy (20-11-2026) — capturas siempre:** todo cambio de UI (diseño nuevo o ajuste) llega con **capturas de pantalla del resultado terminado**: las toma el propio subagente que implementó (dev server de su worktree, Playwright; el brief las exige como criterio de terminado), el Orquestador revisa el diff y los checks estructurales, y **le muestra las capturas a Waldy, que es quien verifica visualmente y decide**. "Listo" sin captura no está listo.

- **Regla de oro:** cada vez que Waldy te corrija algo, no lo apuntes solo aquí. Crea un **test** (Vitest, pgTAP o Playwright) o una **regla de Biome** que falle si alguien lo vuelve a hacer, con un mensaje que diga cómo arreglarlo de raíz. Después agrega una línea abajo. Cómo hacerlo: skill `biome`.
- **Por qué:** este archivo es un consejo y la IA a veces no lo lee, se le olvida o busca una excusa. Un test o una regla es un candado: si se rompe, el commit no entra.
- **Test** = un programa pequeño que revisa que el sistema funcione (ej.: una factura de 1,000 genera un asiento que cuadra). **Regla de Biome** = revisa cómo está escrito el código (ej.: prohibido `<select>` nativo).
- La IA copia lo que ve en el repo: no dejes parches ni comentarios que justifiquen atajos; limpia los casos viejos cuando crees una regla.

Candados que ya existen:

- `src/lib/selects-nativos.test.ts` — prohíbe `<select>` y `NativeSelect` fuera de `components/ui`.
- `src/lib/rpc-sin-extraer.test.ts` — prohíbe guardar `supabase.rpc` en una variable o convertirlo con `as`; llamar siempre `supabase.rpc("nombre", args)` directo.
- `src/lib/numeraciones/acciones.test.ts` — la server action de numeraciones llama la RPC directa con el payload validado y devuelve los errores en español.
- `src/lib/paginacion.test.ts` — los reportes, bancos, fichas y selectores críticos leen por lotes (`paginarConsulta`/`consultarEnLotes`), sin topes de 300/500/1,000; ventas/rentabilidad por producto no se corta en 20,000 líneas.
- `src/lib/tablas-listas.test.ts` — las listas migradas usan `TablaLista` (una sola implementación de tabla/paginación), cada `<TableHead>` mide 48 px (`h-12`) y `EsqueletoTabla` conserva 48/56 px sin salto de layout; las listas maestro-detalle del POS (`/pos/pagos`, `/pos/turnos`, `/pos/historial`, `/pos/devoluciones`) usan el kit compartido (`TarjetaLista`/`BarraLista`/`PillEstado`) sin pills locales.
- `src/lib/bancos/consultas.test.ts` — la gráfica de `/dashboard/bancos` (`getIngresosGastosMensual`) lee `asientos` por índice de fecha y luego sus líneas con `consultarEnLotes`, prohibiendo volver al join `asientos!inner` que agotaba `statement_timeout`.
- `src/lib/diseno-paginas.test.ts` — las pantallas migradas usan el marco `EncabezadoPagina` + migas, sin `text-3xl` suelto; las pantallas del POS usan `EncabezadoPagina` en su `*-pos.tsx` (sin migas: la navegación es el riel lateral).
- `src/lib/fichas-sin-datos-ejemplo.test.ts` — prohíbe `*_EJEMPLO` y datos ficticios en las fichas de contacto y producto.
- `src/lib/fechas-nativas.test.ts` — prohíbe `<input type="date">` fuera de `components/ui`; obliga a usar `DatePicker` / `DatePickerCampo`.
- `src/lib/reportes-encabezado.test.ts` — todos los reportes usan `EncabezadoReporte` (con migas por defecto) o `EncabezadoPagina`, sin `<h1>` sueltos.
- `src/lib/supabase/migraciones.test.ts` — exige formato `YYYYMMDDHHMMSS_nombre.sql`, sin duplicados ni archivos vacíos/sueltos, y timestamp UTC real para toda migración nueva posterior a `20261123000000`.
- `src/lib/supabase/reset-virgen.test.ts` — exige que las 64 tablas `public.*` de las migraciones estén clasificadas una sola vez en `docs/pruebas/reset-base-virgen.sql`, dentro de `BEGIN…COMMIT`, sin tocar `perfiles` ni `auth.users`.
- `tests/e2e/numeraciones.spec.ts` — guardar B16 sin cambios cierra el diálogo y un nombre en blanco muestra el error en español (requiere `E2E_EMAIL`/`E2E_PASSWORD`, como el humo).
- `supabase/tests/anular_ajuste_costo_test.sql` — anular un ajuste de inventario de entrada devuelve la cantidad y revierte el costo promedio; anular una compra ya lo hacía (`anular_compra_costo_test.sql`).
- `src/lib/pos/diseno-pos.test.ts` — el POS usa los tokens `--pos-*` (teal `#00b19d`, copia exacta de Alegra); prohíbe `--primary` y `#1e56c7` en `src/app/(pos)/pos/` con una lista de pendientes que solo puede encoger, y exige la paleta en `globals.css`.

## Antes de decir "listo"

- [ ] `pnpm typecheck`, `pnpm check`, `pnpm test` y `pnpm build` en verde.
- [ ] Un PR = una tarea; diff pequeño (<400 líneas sin contar generados/lockfile).
- [ ] Si tocaste datos: los números coinciden con Supabase (SQL de solo lectura). Si cambió UI: capturas en claro/oscuro y móvil.
- [ ] Actualiza `HANDOFF.md` (qué se hizo y cómo se resolvió).
- [ ] Si eres subagente: reporta al Orquestador rama, SHA, archivos y verificación. No empujes ni fusiones a `main`.

## Nunca

- `service_role` en el cliente, en un script o en un prompt; desactivar RLS; editar migraciones aplicadas.
- Cambiar una política RLS para que un test pase sin el OK de Waldy.
- Probar Supabase contra producción (`--linked`, `--db-url` o el proyecto real): solo `supabase start` local.
- Commitear `.env*` o claves (Alegra, Supabase, DGII); `--no-verify`; copiar código, textos o imágenes de Alegra; escribir en WhatsApp ni contactar a nadie.
