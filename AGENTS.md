<!-- BEGIN:nextjs-agent-rules -->

## This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

# AGENTS.md — Medoxigas Contabilidad

Sistema de **contabilidad y facturación** propio de **MEDOXIGAS ALC, SRL** (y Oxymat), República Dominicana. Dueño: Waldy Alcántara. **Copia exacta de Alegra** (alegra.com) en diseño y comportamiento, en **todo** el sistema (decisión de Waldy, 23-11-2026 — amplía la del 22-11, que solo cubría el POS con teal `#00b19d` vía tokens `--pos-*` de `src/app/globals.css`): vale copiar su HTML, CSS, estructura y selectores de las capturas y adaptarlos a nuestro código (Next.js + Tailwind + shadcn). Lo que siempre es nuestro: el **logo Medoxigas**, la marca y los datos. El estudio de cómo trabaja Waldy en Alegra vive en `docs/alegra/`.

- **Exports crudos de Alegra (HTML/CSS SingleFile capturados de la cuenta de Waldy):** son la **plantilla y regla de medición** — se les copia estructura, clases, medidas, colores y comportamiento adaptándolos al código propio — pero **nunca se commitean al repo** (es público y llevan datos de la cuenta): viven fuera del repo (hoy `/root/alegra-refs/`).

- **Fuente de la verdad funcional:** `docs/alegra/ALEGRA.md` (con sus capturas y las guías `css-*`). Todo se construye copiando el comportamiento y el orden de Alegra Contabilidad documentados ahí; si hay dudas, manda ese archivo.
- **Repositorio:** `waldyalc/MEDOXIGAS-CONTABILIDAD`. **Solo existe `main`** → https://medoxigas-contabilidad.vercel.app (producción). Cada push a `main` despliega.
- **Base de datos:** Supabase, proyecto **MEDOXIGAS-CONTABILIDAD** (`ljfdhrnvlsfaweuvnqxz`, ca-central-1, plan gratis). **Única fuente de la verdad.** Roles en `perfiles`: `admin`, `contador`, `lector`.
- **Stack:** Next.js 16, React 19, Supabase (`@supabase/ssr`), shadcn/ui + Base UI + Tailwind 4, Biome, Vitest, Playwright, pnpm, Vercel. Diseño: **`docs/DESIGN.md` es la ley** (estructura de Alegra + azul Medoxigas `#1e56c7`, nunca su teal fuera del POS; iconos Tabler); plantilla base → `docs/plantilla-diseno.md`.
- **Fiscal RD:** la facturación debe cumplir con la DGII (e-CF / NCF, reportes 606 y 607). Se diseña con Contable antes de programar.

## Rol según cómo fuiste invocado

**Lee esto primero. Orquestador y subagente nunca se confunden.**

### Sesión principal (Orquestador / Tech Lead)

Si estás hablando **directamente con Waldy en el hilo principal de T3 Code**, eres el **Orquestador**:

- Analizas el pedido, diseñas el plan y lo divides en tareas con **archivos disjuntos** (dos subagentes nunca escriben el mismo archivo).
- Delegas con `delegate_task` e `isolation: "worktree"`. Modelo por defecto: **DeepSeek V4.1 Flash 1017** → `providerInstanceId: "opencode"`, `model: "opencode-go/deepseek-v4.1-flash"`, `options: { variant: "max" }`; usa otro solo si Waldy lo pide.
- **Modelo único (Waldy, 23-11-2026 8:59 PM):** todos los hijos usan **DeepSeek V4.1 Flash 1017** (`providerInstanceId: "opencode"`, `model: "opencode-go/deepseek-v4.1-flash"`, `options: { variant: "max" }`). Devin, SWE-2 Max y Adaptive quedan cancelados (MSG-26 y MSG-27); no se usan salvo que Waldy lo pida explícitamente.
- **Cuota agotada:** si un hijo devuelve «Your daily usage quota has been exhausted», avisa a Waldy en el hilo de inmediato y espera su decisión; no lo relances en otro modelo sin preguntar.
- Revisas el diff real, verificas los checks de CI y luego integras a `main`.
- **Solo tú lees `docs/ORQUESTADOR.md`**: es tu playbook obligatorio.
- Waldy aprueba lo irreversible: deploy a producción, migraciones que borran o cambian datos, borrar datos y planes pagos.

### Subagente / tarea delegada (Ejecutor o Revisor)

Si llegaste por un brief de `delegate_task`, eres **Ejecutor** (o Revisor), no el orquestador:

- **Prueba visual SIEMPRE (regla de Waldy, 20-11-2026):** tu reporte entrega evidencia de lo que hiciste. Si tocaste UI o diseño: **capturas de pantalla del resultado funcionando** desde el preview oficial con Playwright (ver «Preview y capturas al terminar»; para UI, además claro/oscuro y móvil si aplica). El Orquestador te pasa las credenciales por archivo temporal fuera del repo — nunca las imprimas ni las commitees. Las capturas se le muestran a **Waldy para que las verifique con sus ojos**; sin captura, tu trabajo no está terminado. Si tu tarea es backend/motor, la evidencia es la verificación (tests, pgTAP en CI, logs).

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
- `diseno-ui` — shadcn tal cual (`InputGroup`, `Select`, calendario), colores Medoxigas y **copia exacta del diseño de Alegra** (`docs/alegra/` + exports crudos en `/root/alegra-refs/`), adaptada a nuestro código.
- `motor-contable` — motor de doble partida (archivos, cuentas por defecto, invariantes) y tests antes de cambiar un cálculo.
- `supabase-migraciones` — cómo escribir una migración; no aplicarla en el remoto ni usar `service_role`; RLS en tablas nuevas.
- `pedir-ayuda` — si te atascas, pregunta al Orquestador con la herramienta `question`; no des vueltas ni inventes atajos.
- `biome` — cómo convertir cada corrección de Waldy en un candado (test o regla de Biome) y resumen de la charla de Lauren Tan.

- `ticket-80mm` — `.opencode/skills/ticket-80mm/SKILL.md`: contrato MSG-22 de medidas exactas en pt/mm y prueba de cuatro PDFs (`src/lib/pos/ticket-pdf.test.tsx`, carril `pnpm test:pdf`). Obligatoria al tocar factura/prefactura/cotización/cierre: no adivinar tamaños en em ni comparar capturas con dpi distintos.

## Módulos (menú lateral)

Hechos: Inicio, Ingresos (facturas de venta y recurrentes, pagos recibidos, notas de crédito y débito, cotizaciones, conduces), Compras (facturas de proveedor, pagos, gastos menores, notas de crédito, órdenes de compra, pagos recurrentes), Contactos, Inventario (productos, ajustes, transferencias, listas de precios, almacenes, categorías), Bancos (cuentas y conciliaciones), Contabilidad (catálogo de cuentas, asientos, numeraciones, activos fijos, periodos), Reportes y Configuración.

Punto de venta (`src/app/(pos)/pos/`, shell propio con riel lateral `menu-pos.tsx` de 52 px → 271 px, sin el sidebar de Contabilidad): `/pos` (vender), `/pos/pagos` (registro de pagos), `/pos/turnos`, `/pos/historial` (ventas) y `/pos/devoluciones`. La configuración de terminales vive en `/dashboard/configuracion/pos`.

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
| Ticket 80 mm (PDF real)  | `pnpm test:pdf` (Chromium + Poppler; NO entra en `pnpm test`)  |
| Humo navegador           | `pnpm test:e2e` (sin `E2E_EMAIL`/`E2E_PASSWORD` se salta)      |
| Build prod               | `pnpm build`                                                   |
| Regenerar tipos Supabase | `pnpm db:types` (tras cada migración; ver `supabase/AGENTS.md`) |
| Probar RLS en local      | `supabase start` + `supabase test db` (NUNCA contra producción) |
| pgTAP sin Docker         | `scripts/pgtap-local.sh` (Postgres 18 + pgtap del VPS; corre como `postgres`) |
| Capturas claro/oscuro/móvil | `pnpm captura --ruta /pos --salida <carpeta>` (ZZTEST, storageState fuera del repo) |

## Estructura (convención de la plantilla)

- Rutas: `src/app/(main)/dashboard/<modulo>/page.tsx`. `page.tsx` es Server Component chico, sin `"use client"`; lo interactivo va en su propio componente cliente.
- Componentes: `.../<modulo>/_components/`. Datos y consultas: `src/lib/<modulo>/`.
- Menú: `src/navigation/sidebar/sidebar-items.ts` (`roles` por ítem). Auth y sesión: `src/proxy.ts` (middleware Next 16) + `src/lib/supabase/{server,client,proxy}.ts`. Rol: `src/lib/auth/rol.ts`.
- Backend y RLS: ver `supabase/AGENTS.md`.

## Archivos generados (no editar a mano)

- `src/lib/supabase/types.ts` ← `pnpm db:types` (tras cada migración; el job `db` de CI verifica que esté al día).
- `pnpm-lock.yaml` ← `pnpm install`. `.next/`, `next-env.d.ts` ← `next dev`/`build`.

## Base de datos (regla del VPS)

- Toda operación de base de datos (migraciones, consultas, tipos) se hace con **Supabase CLI desde este VPS**; no se usan claves en scripts ni `service_role` en el cliente.
- El token de acceso vive en `/root/.supabase.env` (chmod 600, cargado por el shell). **Nunca** se imprime, se pega en el chat o en logs, ni se commitea.
- Proyecto `ljfdhrnvlsfaweuvnqxz` = **producción**: es la base que usa https://medoxigas-contabilidad.vercel.app, donde Waldy hace su prueba real del mes. Los agentes solo la **leen** con usuarios ZZTEST; **nunca** escriben datos ni aplican migraciones sin el OK de Waldy en el chat. La base de OPP tampoco se toca sin su OK.
- Para pruebas con escritura los agentes usan Postgres local (`scripts/pgtap-local.sh`), **nunca producción**. Propuesta de staging aparte: `docs/infra/base-staging.md`.

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
- Por dentro es el servicio systemd `medoxigas-preview.service`: corre `pnpm start` en el puerto **3010** desde `/root/MEDOXIGAS-CONTABILIDAD` (sirve el último `pnpm build`; hay que rebuild tras mergear), contra la base de **producción** (solo lectura con usuarios ZZTEST).
- **Nunca** levantes otro dev server en el puerto 3010 ni mates ese servicio. Si hay que reiniciarlo: `systemctl restart medoxigas-preview`.
- Un worktree que quiera su propio preview usa otro puerto (**3011 en adelante**).
- El login es con los usuarios **ZZTEST** de `.env.pruebas` (las claves nunca van en el repo ni en prompts).

## Vercel y producción

- Vercel construye SOLO los cambios en `main`. Las ramas y los PR NO generan preview en Vercel; para revisar se usa el preview del VPS (puerto 3010).
- Vercel tiene un límite de builds seguidos (build-rate-limit). No se unen muchas ramas a `main` de golpe; si un build se rechaza, Vercel no lo reintenta solo y hay que disparar otro.
- Nada se une a `main`, se publica, se promueve en Vercel ni cambia variables de entorno sin el OK de Waldy en el chat.
- El trabajo se consolida en la rama del POS (`feat/pos-alegra-exacto`) y se publica de una sola vez cuando Waldy lo apruebe.

## Candados: cada corrección se vuelve un test o una regla

- **Regla de Waldy (20-11-2026) — capturas siempre:** todo cambio de UI (diseño nuevo o ajuste) llega con **capturas de pantalla del resultado terminado**: las toma el propio subagente que implementó (Playwright; el brief las exige como criterio de terminado), el Orquestador revisa el diff y los checks estructurales, y **le muestra las capturas a Waldy, que es quien verifica visualmente y decide**. "Listo" sin captura no está listo. Dónde y cómo se toman: «Preview y capturas al terminar».

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
- `src/lib/pos/ticket-pdf-carril.test.ts` — el test del ticket 80 mm (Chromium + Poppler) queda fuera de `pnpm test`: exige que `vitest.config.mts` lo excluya, que `pnpm test:pdf` use `vitest.pdf.config.mts` y que el job `ci` de CI no instale navegador ni Poppler (solo el job `pdf`).
- `src/lib/pos/diseno-pos.test.ts` — el POS usa los tokens `--pos-*` (teal `#00b19d`, copia exacta de Alegra); prohíbe `--primary` y `#1e56c7` en `src/app/(pos)/pos/` con una lista de pendientes que solo puede encoger, y exige la paleta en `globals.css`. Además fija el Punto 1: el turno y las pestañas de ventas van en la barra inferior (`barra-inferior-pos.tsx`), no en una línea sobre el buscador ni dentro del panel, y el Sheet móvil termina 44 px antes para no tapar la barra. El cuerpo del panel usa `--pos-panel` (#f8fafc) con encabezado, bloque superior, renglones y pie blancos, y el shell fija `--ring: var(--pos-primario)` para que el foco sea teal.
- `src/lib/pos/mas-opciones.test.ts` + `tests/e2e/pos-mas-opciones.spec.ts` — el ⋯ del carrito abre el panel «Más opciones» a todo el panel (no un dropdown) con los cuadros «Guardar cotización», «Cargar cotización» e «Historial de ventas» desde un arreglo; X y Esc cierran sin tocar la venta.
- `src/lib/binarios-grandes.test.ts` (+ `src/lib/binarios-permitidos.txt`) — bloquea binarios nuevos >200 KB e imágenes con «alegra» en el nombre o bajo `docs/diseno/alegra-pos/`; lo ya commiteado quedó abuelado en la lista permitida, que solo encoge.
- `.github/workflows/supabase.yml` — en PR, toda migración nueva en `supabase/migrations/` exige al menos un archivo tocado en `supabase/tests/`.

## Preview y capturas al terminar (regla de Waldy, 22-11-2026)

«Al terminar una tarea, todo agente debe tomar capturas de pantalla de lo que hizo (en el preview) y entregarlas con su informe; el orquestador, al juntar, actualiza el preview y reporta las capturas».

- **Preview oficial:** http://127.0.0.1:3010 (puerto 3010). Al juntar, el Orquestador hace `git pull` de `feat/pos-alegra-exacto`, `pnpm build` y `systemctl restart medoxigas-preview`, y comprueba que responde 200.
- **Cómo se toman:** con el script único **`pnpm captura --ruta /pos --salida <carpeta> [--base http://localhost:3010]`** (`src/scripts/captura.ts`): entra como **ZZTEST** (credenciales de `.env.pruebas`, storageState en `/root/.medoxigas/` fuera del repo, se renueva solo), toma claro 1440 px, oscuro 1440 px y móvil 390 px, y **falla ante errores de consola o HTTP 5xx**. Todos los agentes usan este script; nada de scripts de captura improvisados.
- **Dónde se guardan:** `/root/referencias/capturas-terminadas/<fecha>-<punto>.png`, fuera del repo (defecto del script: `/root/referencias/capturas-terminadas/<fecha>`). El informe del Orquestador lista la ruta y una línea de qué muestra cada una.
- **Seguridad:** no se commitean claves ni datos sensibles; las capturas sí pueden incluir datos de prueba de ZZTEST.

## Antes de decir "listo"

- [ ] `pnpm typecheck`, `pnpm check`, `pnpm test` y `pnpm build` en verde.
- [ ] Un PR = una tarea; diff pequeño (<400 líneas sin contar generados/lockfile).
- [ ] Si tocaste datos: los números coinciden con Supabase (SQL de solo lectura). Si cambió UI: además de las capturas del preview, en claro/oscuro y móvil.
- [ ] Capturas de lo que quedó hecho, una por punto, desde el preview oficial (ZZTEST, 1440 px), guardadas en `/root/referencias/capturas-terminadas/` y entregadas con el informe.
- [ ] Actualiza `HANDOFF.md` (qué se hizo y cómo se resolvió).
- [ ] Si eres subagente: reporta al Orquestador rama, SHA, archivos y verificación. No empujes ni fusiones a `main`.

## Nunca

- `service_role` en el cliente, en un script o en un prompt; desactivar RLS; editar migraciones aplicadas.
- Cambiar una política RLS para que un test pase sin el OK de Waldy.
- Probar Supabase contra producción (`--linked`, `--db-url` o el proyecto real): solo `supabase start` local.
- Commitear `.env*` o claves (Alegra, Supabase, DGII); `--no-verify`; usar el logo, la marca ni imágenes de Alegra (el logo siempre es Medoxigas); commitear exports crudos de Alegra al repo; escribir en WhatsApp ni contactar a nadie.
