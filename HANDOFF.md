# Handoff — Producción v1

## POS — editar movimientos de efectivo (12 nov 2026, rama `feat/pos-editar-movimientos` → `prueba`)
- Migración aditiva `supabase/migrations/20261112190000_pos_editar_movimiento.sql`: RPC `pos_editar_movimiento` (solo admin, security definer) cambia tipo/monto/motivo con las validaciones de `pos_registrar_movimiento`; bloquea movimiento y turno con `for update`; si nada cambió devuelve la fila sin UPDATE. En turno cerrado recalcula `entradas`, `salidas`, `esperado` y `diferencia` sin tocar `contado` ni `ventas_*`; en abierto no escribe `pos_turnos`. Audita el trigger existente. Grants: sin `public`/`anon`, execute para `authenticated`.
- UI: lápiz por movimiento en "Movimientos del turno" solo si `esAdmin`, con `DialogoEditarMovimiento` (Entrada/Salida, monto, motivo, error visible). El store `useTurno.editarMovimiento` reemplaza el movimiento y el cierre recalcula al instante. `normalizarEdicionMovimiento` en `src/lib/pos/editar.ts`; llamada a la RPC con cast acotado porque `types.ts` no se tocó.
- Tests: Vitest nuevos para normalización y actualización del store (148/148 + 1 skip); `pos_editar_movimiento_test.sql` (26 asserts) queda listo pero **no se ejecutó**: este box no tiene Docker/Supabase local ni servidor Postgres. `pnpm typecheck`, `pnpm check` (solo avisos preexistentes) y `pnpm build` con env dummy en verde.
- Migración probada en BEGIN/ROLLBACK contra la base real (sin cambiar datos) y aplicada el 12 nov 2026 ~3:05 p. m. AST. `types.ts` actualizado con `pos_editar_movimiento` (coincide exacto con el esquema que genera CI); pgTAP verde en CI.
- Mismo día: el movimiento id 15 (turno 11, 'DADO A JARDI ALCANTARA', 70,000) se pasó de entrada a salida por SQL; respaldo en /workspace/pos-plan/backup-mov-jardi-20261112.json.

## Rol cobros — solo Estado de cuenta (12 nov 2026, rama `feat/estado-cuenta`, sin commit)
- Nuevo rol `cobros` (Natividad): `Rol` y `normalizarRol` lo aceptan; `/dashboard` redirige cobros → `/dashboard/estado-cuenta`. Estado de cuenta (pantalla y ambas acciones) permite admin y cobros; Caja Chica y POS quedan solo admin/caja (cobros → `/unauthorized`); Producción sigue solo admin.
- Menú: `sidebar-items.ts` reemplaza `soloAdmin` por `roles` por ítem y expone `filtrarItemsPorRol` (admin ve 4, caja 2, cobros 1). Tests Vitest nuevos cubren `normalizarRol` y el filtro.
- Migración nueva `supabase/migrations/20261112150000_rol_cobros.sql` (aditiva): amplía el CHECK de `perfiles` a admin/caja/cobros y crea el perfil de `natividadgiraldo@gmail.com` solo si la cuenta existe (`on conflict (user_id) do nothing`). Sin cambios en funciones, RLS ni `types.ts`; no aplicada a Supabase (la aplica el líder).
- Verificado: `pnpm typecheck`, `pnpm check`, `pnpm test` y `pnpm build` con env dummy.

## Estado de cuenta (12 nov 2026, rama `feat/estado-cuenta`, sin commit)
- Nueva pantalla `/dashboard/estado-cuenta` (solo admin, `getRol` + redirect a `/unauthorized`): empresa (Oxymat/Medoxigas), búsqueda de cliente de Alegra con debounce (mín. 2 letras, muestra nombre y RNC), fecha de corte (hoy RD por defecto) y "Descargar PDF". El menú suma "Estado de cuenta" con `FileText` y `soloAdmin`.
- `actions.ts` revalida admin en cada llamada, valida empresa/cliente/corte y devuelve errores en español sin exponer claves. Importa `src/lib/estado-cuenta/alegra.ts` solo en el servidor; el cliente nunca ve credenciales.
- Descarga: acción → `Datos`; HEAD a `empresa.logo` (404/error → `null`, el PDF usa el nombre); import dinámico de `@react-pdf/renderer` y `EstadoCuentaPdf`; archivo `estado-cuenta-<empresa>-<rnc>-<corte>.pdf`. Debajo, resumen con Total, Vencido/Pago mínimo, No vencido y nº de facturas. `loading.tsx` y `error.tsx` como Producción.
- Verificado: `pnpm typecheck`, `pnpm check` (10 avisos de complejidad preexistentes), `pnpm test` 126/126 (+1 skip) y `pnpm build` con env dummy. Como no hay credenciales de Alegra en local, el flujo se probó con Playwright en una copia temporal con stubs del contrato: búsqueda, selección, descarga `estado-cuenta-oxymat-130122522-2026-11-12.pdf`, resumen RD$115,970.40 / 80,287.20 / 35,683.20, 3 facturas, y capturas en 1440×900 y 390×844, claro y oscuro.

## POS — cierre sin ventas anuladas (2 nov 2026, sin commit)
- `calcularCierre` ignora las ventas con `estado === "anulada"` (undefined = vigente): ya no inflan ventas efectivo/transferencia ni el esperado. Helper `esVentaVigente` en `src/lib/pos/calculos.ts`.
- El ticket de cierre PDF y el conteo de ventas de Ajustes → Turnos también excluyen anuladas; la lista de órdenes de la app las sigue mostrando.
- Tests: `turno.test.ts` (efectivo y transferencia anuladas no cuentan) y `pdf/datos.test.ts` (conteos y formas de pago).
- Verificado: `pnpm typecheck`, `pnpm check` (8 avisos + 1 info preexistentes), `pnpm test` 117/117.

## Beneficiario en gastos (2 nov 2026, sin commit)
- Caja Chica: Beneficiario siempre visible en registrar/editar como combobox Command/Popover con los 6 `cc_empleados` y texto libre "Usar «…»"; obligatorio solo donde el concepto lo exige; tabla y PDF siguen mostrándolo.
- Migración `20261102140000_cc_beneficiario.sql`: tabla `cc_empleados` (RLS admin/caja, seed, auditoría) y `cc_registrar_gasto`/`cc_editar_gasto` aceptan beneficiario en cualquier concepto; pgTAP 71 asserts y `types.ts` actualizado.
- Verificado: `pnpm lint` (8 avisos preexistentes), `pnpm typecheck`, `pnpm test` 114/114, `pnpm build` con env dummy y `scripts/pgtap-local.sh` en verde. Migración pendiente de aplicar a Supabase.

- Caja Chica: el PDF de la sesión cabe en una sola hoja A4 vertical (40 gastos verificados), con filas de una línea, Nota/Concepto truncados y tipografía que se reduce sola hasta 5.5 pt si hay muchas filas.
- Caja Chica: el PDF deja un gutter derecho en Concepto, Nota, Camión y Beneficiario para que el "…" del texto truncado no toque ni invada la columna siguiente.
- Caja Chica: con 25 % o menos del fondo, la KPI "Disponible" muestra "Hay que reponer la caja chica" (alerta y barra rojas) y un toast al cargar; por encima sigue "Nivel saludable" y no bloquea registrar gastos.
- Caja Chica: la tabla y el PDF de la sesión muestran los gastos más recientes arriba (fecha desc, id desc), con el saldo por fila y el "En caja" actual intactos.

## Cerrar y abrir nueva sesión (2 nov 2026, sin commit)

- Caja Chica suma "Cerrar y abrir nueva" (admin y caja): confirma con resumen (gastado/en caja), nombre editable con el sugerido y, al terminar, descarga el PDF de la sesión cerrada reutilizando el flujo de "Imprimir".
- Migración nueva `supabase/migrations/20261102120000_cc_cerrar_y_abrir.sql` (RPC atómica `cc_cerrar_y_abrir_sesion`; `cc_abrir_sesion`/`cc_cerrar_sesion` siguen solo admin) y `supabase/tests/cc_cerrar_y_abrir_test.sql` (20 asserts, incluye atomicidad). `src/lib/supabase/types.ts` actualizado a mano.
- Verificado: `pnpm check`, `pnpm typecheck`, `pnpm test` 108/108, `pnpm build` y `scripts/pgtap-local.sh` (todos los tests) en verde.

## Historial fuera de la app + editar venta POS (1 nov 2026, sin commit)

- Se quitó la UI de Historial de auditoría: pantalla `/dashboard/historial`, `src/components/historial`, ítem del menú y paneles en Caja Chica y POS. La auditoría sigue intacta en Supabase (tabla `auditoria`), con su trigger y `historial_registro`. Los turnos cerrados del POS siguen visibles en Ajustes → Turnos.
- Migración nueva `supabase/migrations/20261101140000_pos_editar_venta.sql`: RPC `pos_editar_venta` (solo admin, security definer) actualiza cliente, precio y cantidad de líneas existentes de una venta vigente, sin insertar ni borrar líneas, y recalcula subtotal y total en el servidor. Bloquea ventas anuladas y ventas de un turno cerrado: al cerrar el turno se congelan `ventas_efectivo`, `ventas_transferencia`, `esperado` y `diferencia`, así que editar después descuadraría el cierre. Grants: sin `public`/`anon`, execute para `authenticated`. El trigger de auditoría registra los UPDATE.
- POS: botón "Editar venta" en el detalle (solo admin, venta vigente del turno abierto) con diálogo de cliente, precio y cantidad por línea; no permite quitar líneas. Al guardar refresca la orden y el ticket reimpreso usa los datos actuales. Validación cliente y `puedeEditarVenta` en `src/lib/pos/editar.ts` con test Vitest.
- Pruebas: `scripts/pgtap-local.sh` en verde (incluye `pos_editar_venta_test.sql`, 23 asserts; se actualizó `pos.sql` a los 7 productos reales), `pnpm lint` (8 avisos preexistentes), `pnpm typecheck`, `pnpm test` 106/106 y `pnpm build` en copia temporal (el `node_modules` de este worktree es un symlink).
- Pendiente: aplicar la migración y regenerar `src/lib/supabase/types.ts`; la app llama la RPC con cast acotado mientras tanto.

## Roles, historial de auditoría y anulación POS (1 nov 2026, sin commit)

- `src/lib/auth/rol.ts` (`getRol`, `normalizarRol`) lee `perfiles` en servidor; sin perfil no hay módulos. Menú: Producción e Historial solo admin; Caja Chica y Punto de Venta para admin y caja. `/dashboard`, login, callback y raíz redirigen por rol (se quitó el redirect fijo de `next.config.mjs` a Producción).
- Rutas: Producción e Historial redirigen a `/unauthorized` si no es admin; Caja Chica y POS también sin perfil. La marca del menú apunta a `/dashboard`.
- Historial: `src/components/historial` (Sheet con líneas tipo "waldyalcantara818 editó el 01/11 10:30: precio 1,300 → 1,200", fecha `America/Santo_Domingo` y números es-DO) montado en el detalle del gasto (`cc_gastos`) y de la venta (`pos_ventas`), solo admin. Pantalla `/dashboard/historial` con tabla shadcn, filtros por tabla/usuario y páginas de 50 sobre `auditoria`.
- POS: botón "Anular venta" (solo admin) en el detalle, con motivo obligatorio; llama `pos_anular_venta`, recarga el POS y avisa con toast. `Venta` ahora lleva `id` para la RPC. La caja no ve Editar/Cancelar gasto (ya estaba protegido con `esAdmin`).
- Contrato Supabase: `historial_registro`, `auditoria` y `pos_anular_venta` se llaman con un cast acotado y comentado porque `types.ts` aún no los tiene; la migración la hace la tarea paralela. No se tocó `supabase/**`.
- Verificado: `pnpm lint`/`pnpm check` (solo 8 avisos de complejidad preexistentes), `pnpm exec tsc --noEmit`, `pnpm test` 94/94 y `pnpm build` (en copia temporal con `node_modules` local y env dummy: el symlink de `node_modules` rompe Turbopack).
- Pendiente: aplicar la migración y regenerar `types.ts`; pgTAP local (`supabase start && supabase test db`).

## POS — editar precio por línea (31 oct 2026, rama `feat/pos-precio`, sin commit)

- El carrito (`hoja-carrito.tsx`) muestra "Precio unitario (RD$)" editable por línea. Al cambiarlo se actualizan el subtotal de la línea, el total del carrito y, al confirmar, el PDF, el detalle de la orden y la venta en Supabase (`pos_venta_lineas.precio`/`subtotal`). Precio vacío o igual al del catálogo quita el cambio; se acepta 0 (cortesía); negativos/NaN se ignoran. El precio se guarda solo en la línea del carrito (no persiste al vaciarlo).
- Migración NUEVA pendiente de aplicar: `supabase/migrations/20261031200000_pos_precio_linea.sql` (reemplaza `pos_registrar_venta` con `precio` opcional por línea y relaja los CHECK de precio/subtotal a `>= 0`; no se aplicó). `supabase/tests/pos.sql` actualizado con los casos de precio editado/cero/negativo.
- Verificado: `pnpm lint` y `pnpm check` en verde (8 avisos de complejidad preexistentes), `pnpm exec tsc --noEmit`, `pnpm test` 94/94 y `pnpm build` (en copia temporal porque aquí `node_modules` es un symlink fuera del root de Turbopack).
- Probar a mano: `supabase start && supabase db reset` (aplica la migración), `pnpm dev`, entrar al POS y abrir turno; agregar un producto, abrir el carrito y editar el precio (p. ej. 850.50): aparece "Precio editado" y cambian subtotal/total; dejar el campo vacío vuelve al precio del catálogo; probar 0 y un negativo. Pagar y revisar el ticket PDF y la orden en Ajustes → Órdenes; en Supabase, `pos_venta_lineas` y `pos_ventas.total` deben coincidir.

## Login rediseñado con la plantilla `login-04` (31 oct 2026)

- `pnpm dlx shadcn@latest add login-04` creó `src/components/login-form.tsx`; se adaptó a español y a las server actions existentes (`entrar` y `entrarConGoogle`, sin tocar `actions.ts`). Tarjeta centrada `max-w-sm md:max-w-3xl` sobre `bg-muted`, logo arriba, título "Bienvenido", botón Entrar y un solo botón outline "Entrar con Google" con su propio `<form>`.
- Se conservan los mensajes de `error=1`, `error=google` y `aviso=config`. Imagen derecha: `public/pos/productos/oxigeno-medico-6m3.webp` con `object-cover` y, en oscuro, `brightness-[0.2] grayscale`; se oculta en móvil. `src/app/login/layout.tsx` quedó mínimo (ya no parte la pantalla en dos paneles).
- e2e `smoke.spec.ts` actualizado de "Iniciar sesión" a "Bienvenido". Verificado: `pnpm typecheck`, `pnpm check` (solo los 8 avisos preexistentes), `pnpm test` 89/89 y `pnpm build` (en la copia limpia `prueba-wt` por el symlink de `node_modules`). Capturas claro/oscuro y móvil revisadas en 1440×900 y 390×844.

## Login con Google (31 oct 2026, rama `feat/login-google`)

- Nuevo botón "Entrar con Google" debajo del formulario de correo/contraseña, con separador "o" y logo G inline. La server action `entrarConGoogle()` (`src/app/login/actions.ts`) arma `<origen>/auth/callback` desde `x-forwarded-host`/`host` y `x-forwarded-proto` (`src/lib/auth/origen.ts`, con test) y redirige a la URL de Supabase OAuth.
- `src/app/auth/callback/route.ts`: canjea el `code` con `exchangeCodeForSession`; sin code, con `error`/`error_description` (registro público apagado) o fallo del canje → `/login?error=google`, que muestra "No se pudo entrar con Google. Tu correo debe estar registrado en el sistema."
- `src/lib/supabase/proxy.ts` deja `/auth/callback` pasar sin sesión, igual que `/login`. El login por correo/contraseña sigue igual.
- Verificado: `pnpm lint`/`pnpm check` (solo los 8 avisos de complejidad preexistentes), `pnpm typecheck`, `pnpm test` 89/89 y `pnpm build` (corrido en la copia limpia `prueba-wt` porque aquí `node_modules` es un symlink fuera del root de Turbopack).

## POS — entrar sin turno / modo consulta (31 oct 2026, rama `feat/pos-sin-turno`)

- "Abrir turno" suma "Entrar sin abrir turno" (outline, tamaño grande): entra al POS en modo consulta con aviso "Modo consulta — sin turno abierto" y botón Abrir turno.
- En consulta se ven productos, precios, ventas de turnos cerrados y turnos con sus tickets/cierres PDF. Vender (producto, carrito o pagar) o mover efectivo/cerrar abre un Dialog con el mismo formulario de apertura (saldo sugerido); al abrir el turno sigue normal y agrega al carrito el producto que se intentó vender.
- El formulario quedó compartido (`abrir-turno-form.tsx`) entre pantalla y diálogo. Se agregó guard `puedeVender` + test unitario y e2e de solo lectura (`pos-consulta.spec.ts`).
- Verificado: `pnpm typecheck`, `pnpm check` (solo avisos preexistentes), `pnpm test` 84/84 y `pnpm build`.

## Caja Chica PDF con tabla (31 oct 2026, rama `feat/caja-chica-ux`, sin commit)

- El PDF de Caja Chica ahora copia la tabla del proyecto viejo: MEDOXIGAS, "Reporte Caja Chica - <sesión>", meta (abierta/cerrada, fondo y responsable en mayúsculas) y tabla NCF | # | Fecha | Concepto | Nota | Camión | Beneficiario | Monto, con totales al final (FONDO DE SESIÓN, TOTAL GASTADO, SALDO RESTANTE).
- Carta horizontal: las 8 columnas a 12 pt no caben legibles en vertical. Tamaños algo mayores que la referencia (30/20/13/12; monto 15 y totales 18, negrita). Encabezado de tabla fijo que se repite en cada página; filas enteras y sin guiones automáticos en las notas.
- Muestra actualizada `/workspace/caja-plan/pdf-muestra/caja-chica.pdf` (4 gastos de ejemplo, 1 página); se probó además un PDF multipágina y la repetición del encabezado.
- Verificado: `pnpm typecheck`, `pnpm check` (solo avisos de complejidad preexistentes), `pnpm test` y `pnpm build`.

## Caja Chica UX ronda 2 (31 oct 2026, rama `feat/caja-chica-ux`, sin commit)

- Header del panel: sin botón "Buscar ⌘K" ni `search-dialog.tsx`; sin engranaje "Preferencias" ni `layout-controls.tsx` (quedan fijos Medoxigas, Geist, centrado, barra fija y menú lateral). Sigue el cambio claro/oscuro.
- Perfil arriba a la derecha: `ProfileMenu` con `AvatarInicial` (inicial del nombre o del correo, color estable) y DropdownMenu con nombre/correo + "Cerrar sesión" en rojo. Se quitó `NavUser` del pie del menú lateral. Componente reusable `src/components/avatar-inicial.tsx`.
- Caja Chica sin buscador ni Ctrl+K (`buscar.tsx` y `cc_buscar_gastos` en la UI eliminados). "Imprimir" (sesión abierta y sesiones viejas) genera y descarga el PDF al toque con `@react-pdf/renderer@4.9.0` (import dinámico); la ruta `imprimir/[sesionId]` quedó borrada. PDF con el diseño de tabla del proyecto viejo (ver sección de arriba); nombre `CAJA-CHICA-Octubre-2026-1.pdf`.
- Muestra del PDF con datos de ejemplo: `/workspace/caja-plan/pdf-muestra/caja-chica.pdf` (1 página, texto verificado con `pdftotext`).
- Verificado: `pnpm typecheck`, `pnpm check` (8 avisos de complejidad preexistentes), `pnpm test` 55/55 y `pnpm build` en verde. e2e actualizado (logout por el menú de perfil y descarga del PDF).

## Caja Chica UX (31 oct 2026, rama `feat/caja-chica-ux`, sin commit)

- Pantalla Gastos: sin fila "Rápidos" ni selector de sesión; muestra la sesión abierta. Desde Sesiones, "Ver" abre esa sesión (también las viejas) en Gastos.
- Header: Imprimir secundario y "Registrar gasto" grande (size lg, Plus) arriba a la derecha (el Buscar se quitó en la ronda 2). La tabla ya no tiene columna "Ver": toda la fila es clicable y accesible por teclado (tabIndex 0 + Enter/Espacio).
- `gasto-detalle.tsx` eliminado: el detalle reusa el diálogo de `gasto-form` lleno y en solo lectura (foto, saldo y motivo si cancelado); "Editar" habilita campos y "Guardar"; "Cancelar gasto" conserva la confirmación con motivo.
- Selects de Concepto y Camión muestran el nombre (prop `items` de Base UI). Errores de validación en Alert destructive dentro del formulario y debajo del campo, además del servidor.
- Migración nueva `supabase/migrations/20261031010000_conceptos_nombres_completos.sql`: UPDATE idempotente a "Reparación de gomas" y "Reparación eléctrica" (no aplicada a Supabase remoto; la vieja no se tocó). Docs, pgTAP y e2e actualizados.
- Verificado: `pnpm typecheck`, `pnpm check` (8 avisos de complejidad preexistentes/nuevos), `pnpm test` 55/55 y `pnpm build` en verde.
## Punto de Venta — backend Supabase (31 oct 2026, rama `feat/pos-diseno`, sin commit)

- Datos: migración aditiva `supabase/migrations/20261031020000_pos.sql` con `pos_productos` (17 semillas del diseño anterior, mismo nombre/precio/imagen), `pos_turnos` (un solo abierto), `pos_ventas`, `pos_venta_lineas` y `pos_movimientos`. RLS de solo lectura para `authenticated`, `anon` nada, trigger anti-DELETE y revoke de INSERT/UPDATE/DELETE/TRUNCATE y secuencias. RPC `pos_*` security definer con `set search_path = ''` y rol vía `cc_rol()`; el precio/total de la venta SIEMPRE sale de `pos_productos` y los `numeric` rechazan `NaN`. Diseño en `docs/dominio-pos.md`.
- App: `src/lib/pos/datos.ts` lee todo desde Supabase con paginación de 1000 filas (productos activos, turno abierto, ventas, movimientos e historial). `src/lib/pos/turno.ts` escribe SOLO por RPC y actualiza el estado con la fila devuelta, sin depender de una recarga completa; el carrito ya no se persiste entre recargas. Se borraron `ejemplo.ts` y su test; `calculos.ts` concentra formatos `M000001`/`TUR-0001` y la fórmula de cierre. Abrir turno, venta, movimientos, cierre y reimpresiones usan datos reales; Confirmar se deshabilita mientras guarda, no abre PDF si falla y valida saldo/contado/montos.
- Verificado aquí: `pnpm typecheck`, `pnpm check` (solo los 9 avisos preexistentes de caja chica/producción), `pnpm test` 83/83 y `pnpm build` en verde. En este box pnpm necesitó `COREPACK_HOME=/tmp/corepack`.
- Pendiente: no hay Docker aquí, así que `supabase/tests/pos.sql` (43 asserts pgTAP) no se ejecutó; correr `supabase start && supabase test db`. `src/lib/supabase/types.ts` se agregó A MANO (solo tablas/funciones pos_*), sin Docker: regenerar con `pnpm db:types` y verificar el diff del job Supabase. El e2e `tests/e2e/pos-venta.spec.ts` queda listo pero no se corrió (requiere `E2E_POS=1`, `POS_SUPABASE_URL` local, `POS_EMAIL`/`POS_PASSWORD`; sin URL local se salta para no escribir en producción). No se aplicó nada al Supabase remoto: lo hace el líder con OK del dueño.

## Punto de Venta — solo diseño (31 oct 2026)

Diseño frontend con datos de ejemplo; sin backend ni Supabase. Ruta `/pos` fuera del dashboard (pantalla completa, sin sidebar), login por `src/proxy.ts`. Tokens azul Medoxigas en `.pos` (`src/app/(main)/pos/pos.css`), sin tocar `globals.css`.

- `src/lib/pos/`: `tipos.ts` (contrato previo), `ejemplo.ts` (17 productos, 5 categorías, 6 clientes), `carrito.ts` + `turno.ts` (Zustand persist `sessionStorage`, `skipHydration` y rehidratación al montar), `cambio.ts` (formato RD$, cambio, totales, fecha RD) y tests (`carrito`, `ejemplo`, `cambio`, `turno`).
- `src/app/(main)/pos/`: `page.tsx` + `layout.tsx` (server), `error.tsx`, `loading.tsx`, `pos.css`, y `_components/` (`pos-app` coordinador, `venta/**`, `pago/**`, `turno/**`).
- Flujo: abrir turno (TUR-0001) → vender efectivo con teclado, rápidos y cambio → ticket POS/00001 → transferencia con referencia → entradas/salidas → cierre con esperado/diferencia → ticket de cierre → vuelve a abrir turno. Ticket 58 mm único para venta y cierre, `window.print`.
- Menú del ERP: "Punto de Venta" (`ShoppingCart`, `newTab: true`) en `src/navigation/sidebar/sidebar-items.ts`.
- Verificado: `typecheck`, `check` (solo avisos preexistentes de caja chica/producción), `test` 82/82 y `build`. Flujo completo probado con Playwright en una copia temporal del repo con proxy desactivado (390×844 y 1440×900, claro/oscuro, ticket en `@media print`); persistencia al recargar y Combobox de clientes OK. El repo no se modificó para esa prueba.
- Ajustes de diseño (31 oct, revisión): artículos de borde a borde con celdas planas separadas por líneas finas y 5 columnas a 1440 px; carrito con nombre completo, precio unitario, controles y subtotal abajo; un solo "Exacto" (chip); ticket con datos reales (RNC 130893489, Cabral, Barahona), letra mayor, fondo sólido y cierre con Escape; movimientos habilita con monto > 0 y motivo (test); fondo inicial vacío con placeholder `0.00`. Verificado con `typecheck`, `check`, `test` 83/83 y `build`, y capturas temporales 390×844 / 1440×900 (proxy desactivado solo durante la prueba y restaurado).
- Segunda ronda de diseño (31 oct, 10:51 a. m.): abrir turno ya no pide fondo (`Turno.saldoAnterior`, `saldoEnCaja` persistido inicia en RD$10,000.00); el contado del cierre pasa al siguiente turno. Cierre y ticket muestran Saldo anterior. Movimientos Entrada verde/Salida roja (selector, botón y lista). Sin categorías: barra delgada fija con TUR-0001 + Caja RD$X y botón Ajustes (engranaje) con Drawer de opciones grandes (movimientos, cierre, tema). Tarjetas con imagen cuadrada `object-contain` (fallback Package) en `public/pos/productos/<id>.png` (carpeta + README, aún sin imágenes). Ticket con Tel.: 829-520-4627.
- Verificado: `typecheck`, `check` (solo 9 avisos preexistentes de caja chica/producción), `test` 84/84 y `build`. Capturas temporales 390×844 y 1440×900 en claro/oscuro con proxy bypass temporal (restaurado): abrir turno con RD$10,000.00, venta, Ajustes, movimientos y cierre. Sin commit.
- Tercera ronda de diseño (31 oct, 11:17 a. m.): la barra de venta ya solo muestra el turno (sin "Caja RD$X"). Ajustes suma arriba "Órdenes" (`Receipt`) y "Turnos" (`History`); orden final: Órdenes, Turnos, Entradas y salidas de efectivo, Cerrar turno, Tema. Órdenes lista las ventas del turno actual (más reciente arriba) con número, hora, cliente, ícono del método y total, y abre el ticket para reimprimir. Turnos lista el turno actual y los cerrados (número, fecha, Abierto/Cerrado, ventas); un turno cerrado abre sus órdenes y permite reimprimir tickets y su cierre. El store guarda `historial: TurnoCerrado[]` con cierre y ventas; `ejemplo.ts` trae `TURNO_CERRADO_EJEMPLO` (TUR-0001, 3 ventas marcadas `ejemplo`), por eso el turno nuevo abre como TUR-0002 y la numeración POS continúa en POS/00004. Pago queda en total + cliente de texto libre ("Nombre (opcional)", vacío = "Consumidor final" solo en el ticket) + Efectivo/Transferencia con íconos + Confirmar (siempre activo con artículos); se quitó teclado numérico (`teclado-numerico.tsx` borrado), monto recibido, montos rápidos, cambio y referencia. `Venta` ya no tiene `recibido` ni `cambio`; `cambio.ts` conserva `formatearRD`, `formatearHoraRD`, totales y `parsearMonto`. El ticket ya no imprime Recibido ni Cambio.
- Verificado tercera ronda: `typecheck`, `check` (solo 9 avisos preexistentes de caja chica/producción), `test` 82/82 y `build`. Flujo probado con Playwright en dev local con bypass temporal de `proxy.ts` (restaurado): abrir turno, venta con cliente escrito y transferencia, ticket reimpreso desde Órdenes, turno cerrado de ejemplo (ticket + cierre) y capturas 390×844 / 1440×900 en claro/oscuro. Sin commit.
- Cuarta ronda (31 oct, 11:44 a. m.): tickets PDF reales de 58 mm con `@react-pdf/renderer` (carga dinámica solo en el POS), alto automático y logo `public/pos/logo-medoxigas.png`; `src/lib/pos/pdf/` separa datos puros (`datos.ts`), componentes (venta, cierre, movimiento), `abrirPdf` (ventana abierta en el mismo click + respaldo `<a download>`) e `imprimir*`. Al confirmar la venta se abre el PDF y la app queda en "Venta completada" (Imprimir ticket/Nueva venta); se borró el ticket HTML. Cerrar turno y registrar movimientos abren su PDF; Turnos/Órdenes reimprimen PDF. Órdenes muestra resumen de artículos y abre `detalle-orden.tsx` estilo RestroPOS (tarjetas, total, método, Imprimir ticket). Muestras en `/workspace/pos-plan/pdf-muestra/` con `POS_PDF_MUESTRA_DIR=... pnpm test src/lib/pos/pdf/muestra.test.tsx`.
- Verificado cuarta ronda: `typecheck`, `check` (solo 9 avisos preexistentes), `test` 90/90 y `build`. Flujo Playwright 390×844 y 1440×900 (claro/oscuro) con bypass temporal de `proxy.ts` (restaurado): venta abre PDF, reimpresión, detalle, movimiento y cierre. Sin commit.
- Pendiente: backend en Supabase (productos/clientes/turnos/ventas/movimientos), roles cajero/admin, pruebas e2e reales con login y capturas para Waldy. En este box `pnpm` necesitó `COREPACK_HOME=/tmp/corepack`.

## Caja Chica UI (31 oct 2026, rama `feat/caja-chica`, sin commit)

Otra sesión escribe la migración `supabase/migrations/20261031000000_caja_chica.sql` + pgTAP + `types.ts` (ya regenerados con `cc_*`); esta parte es solo UI + lib + e2e.

- `src/lib/caja-chica.ts`: tipos y helpers puros (NCF `^[BEF]\d{10,12}$`, reglas por concepto, fecha futura RD, pct/alerta ≤25 %, saldo corrido, `formatoMoneda` RD$, `puedeEscribir`). Sin imports de servidor (lo usan clientes).
- `src/lib/caja-chica-datos.ts`: `cargarCajaChica` (rol vía `cc_rol`, sesiones de `v_cc_sesion`, libro de `v_cc_libro`, conceptos/camiones/rápidos, sugerencia `cc_sugerir_nombre_sesion`, signed URLs 1 h para fotos).
- `src/lib/caja-chica.test.ts`: 13 tests Vitest (total 55/55 en `pnpm test`).
- `src/app/(main)/dashboard/caja-chica/`: `page.tsx` (server chico, `?sesion`/`?tab`), `_components/` (`pantalla` header+pastilla+tabs+KPIs+toolbar+tabla+pie, `gasto-form` (alta, detalle y edición), `sesiones`, `buscar` Ctrl+K con `cc_buscar_gastos`), `actions.ts` (registrar/editar/cancelar/abrir/cerrar vía `supabase.rpc` con sesión del usuario + subida de foto ≤5 MB a `caja-recibos/<sesion>/<uuid>.<ext>`, `revalidatePath`, errores en español con toast), `loading.tsx`, `error.tsx`.
- Impresión: reemplazada en la ronda 2 por PDF descargable (la ruta `imprimir/[sesionId]` ya no existe).
- Menú: "Caja Chica" bajo Producción, icono Wallet. e2e: lector ve título y "Registrar gasto" deshabilitado (skip sin creds).
- Verificado: `typecheck`, `check` (exit 0; 11 avisos: complejidad en funciones nuevas + `noImgElement` en foto), `test` 55/55, `build` ok, `test:e2e` 2 pass + 2 skip (sin `E2E_*`).
- Pendiente: probar con sesión real (abrir sesión, registrar/editar/cancelar, foto, Ctrl+K, imprimir) cuando la migración esté aplicada en local (`supabase start` + `supabase db reset`); capturas claro/oscuro/móvil.

Trabajo a medias en `cursor/produccion-v1-8684`. No hay PR.

## Etapa 2 — Calidad para agentes (issues #2–#11, rama `feat/plantilla-studio`, 30 oct 2026)

Un commit por issue. Completos (`Closes`): #2, #3, #7 (humo parcial), #8, #9, #10, #11. Parciales (`Refs`, falta su parte de CI o ejecución local): #4 (falta drift de tipos, lo pone el job Supabase de #6), #5 (falta `pnpm test` en CI, lo pone #2), #6 (archivo pgTAP + job listos pero `supabase test db` no se ejecutó aquí: sin Docker/CLI), #7 (login bueno se salta sin `E2E_EMAIL`/`E2E_PASSWORD`; su job e2e lo pone #2). #12 no se hizo (instrucción expresa).

- Verificado en local: `pnpm install`, `typecheck`, `lint` (1 aviso permitido: complejidad de `cargarProduccion`), `test` (42/42), `build` (también con placeholders como en CI), humo Playwright (redirección + clave mala pasan contra dev y Supabase real), hooks (lint-staged arregla, error de lint y secreto falso bloquean), gitleaks limpio (16 commits).
- Detalles por issue en cada mensaje de commit. Pendiente manual de Waldy en GitHub: protección de `main` con checks verdes, Dependabot alerts, secret scanning y push protection; secrets `E2E_*` para el humo en CI; correr `supabase start && supabase test db` (con mutación) en una máquina con Docker.

## Caja Chica (31 oct 2026 ~00:30 hora RD) — issue #13
- Diseño: `docs/dominio-caja-chica.md`. Sin contabilidad. Escrituras solo por RPC `cc_*` (security definer, rol en `perfiles`), nunca DELETE (revoke + trigger), sesión cerrada = solo lectura.
- Migración `20261031000000_caja_chica.sql` aplicada a producción (aditiva): 8 conceptos, 3 camiones, 7 rápidos, perfil admin de Waldy, bucket privado `caja-recibos` (5 MB, imágenes). 0 sesiones y 0 gastos (no se crean datos de prueba en prod).
- Pruebas: pgTAP del flujo completo en CI (local), Vitest, e2e del lector (Registrar deshabilitado). Código escrito por OpenCode; `types.ts` igualado al generador del CLI (sin la función trigger).
- Pendiente: cuenta de Héctor (rol `caja`) cuando Waldy dé su correo: crear usuario + `insert into perfiles (user_id, rol, nombre) values (..., 'caja', 'Héctor Alcántara')`. Importar datos viejos: issue #14. Flujo de escritura en la UI no probado contra prod (solo SQL vía pgTAP): primera sesión real la abre Waldy.

## Estado 30 oct 2026 ~22:30 (hora RD)
- #7 cerrado: usuario Auth `e2e-lectura@medoxigas.invalid` (confirmado, solo lectura: RLS rechaza INSERT con 42501). Secrets `E2E_EMAIL`, `E2E_PASSWORD`, `E2E_SUPABASE_URL`, `E2E_SUPABASE_ANON_KEY` en GitHub. Job e2e corre y pasa (3 passed): run 41149168070. Ojo: apunta al proyecto Supabase de producción (solo lectura), no a staging.
- Vercel Production Branch = `feat/plantilla-studio` (cambiado por API 30 oct ~22:45 RD); cada push a esa rama despliega a producción. `main` sin tocar.
- Pendiente manual de Waldy: Supabase Auth: desactivar "Allow new users to sign up" (Authentication > Sign In / Providers); el MCP no tiene config de Auth y no hay token de Management API en el box. Hoy `disable_signup=false`.

## Estado 30 oct 2026 ~20:20 (hora RD)

- CI, Gitleaks y Supabase en verde en `4d5d571`.
- Producción https://medoxigas-opp.vercel.app = deploy `dpl_BJPQjjt2P8xrc6YYkqki3jpXmENK` (commit `4d5d571`) con pruebas en vivo OK.
- Deploys preview automáticos ya funcionan (autor Waldy); producción se promueve por API porque la Production Branch de Vercel sigue siendo otra.
- Issues cerrados #2–#6, #8–#11; #7 abierto (faltan secrets `E2E_*` en GitHub, idealmente usuario de prueba de solo lectura).
- Protección de `main` y secret scanning no disponibles sin GitHub Pro.
- Tarea Notion: ERP OPP: plantilla Studio Admin + calidad.

## Hecho

- Cascarón: sidebar shadcn, marca MEDOXIGAS ALC, SRL, un módulo (Producción).
- Login con Supabase (email y contraseña). Sin registro público. Rutas de la app exigen sesión (`src/proxy.ts`; en Next.js 16 el middleware se llama proxy).
- Página única de Producción: filtro por ISO y fechas, tarjetas KPI, tabla de llenados (orden y paginación).
- Migración `supabase/migrations/20261030140000_produccion.sql`: tablas `tanques`, `isos`, `llenados`, `lecturas_reloj`, `alertas`; vistas `v_produccion_diaria`, `v_merma_iso`, `v_merma_iso_pct`, `v_llenados`. RLS de solo lectura para `authenticated`. Escritura solo con `service_role`. Semilla del tanque `TM-22820`.
- `README.md` y `.env.example` (`NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`).

## Pendiente (2026-10-30, verificado)

- [x] Gráficos vacíos — causa: la animación de entrada de Recharts (`react-smooth`,
  `stroke-dasharray` en líneas y rects en 0) no completaba y las barras/líneas
  quedaban invisibles (ejes y puntos sí se pintaban). Arreglo en
  `src/components/graficos-produccion.tsx`: `isAnimationActive={false}` en los
  5 `Bar`/`Line`. Componentes shadcn (`ChartContainer`, `ChartTooltip`,
  `ChartLegend`) sin cambios. Verificado en Chrome headless con datos de
  prueba: los 4 gráficos pintan barras, líneas, referencias y leyenda.
- [x] Migración en Postgres nuevo — probada con PGlite (no había servidor
  Postgres instalable en esta máquina): falla con mensaje claro si faltan los
  roles; con `anon`, `authenticated`, `service_role` creados aplica limpia.
  Estado vacío: solo el tanque semilla `TM-22820`, vistas con 0 filas (la
  página muestra el aviso "Aún no hay producción cargada" y cada gráfico su
  mensaje `Vacio`). Con datos de prueba: `base 20000 − vendido 1216 − reloj
  cierre 18000 = merma 784 kg (3.92 %, en rango)`; merma 25 % marca
  `fuera_de_rango`. RLS: 5 políticas `SELECT` para `authenticated`, ninguna
  de escritura; verificado que `authenticated` lee y que un `insert` da
  `permission denied`. El bloque de `storage` se omite sin error si no existe
  el esquema.
- [x] `pnpm install`, `pnpm build` y `pnpm lint` sin errores (se limpió
  `.next` de tipos viejos de una ruta temporal de prueba, ya eliminada).
- Página con datos vacíos: ramas `datos.vacio` y `Vacio` por gráfico +
  mensaje de tabla vacía. Con datos: KPIs, tabla y los 4 gráficos.
- Abrir el PR contra `main`.

## ETAPA 1 — Base en la plantilla Studio Admin (terminada 2026-10-30)

Rama `feat/plantilla-studio`, commit `2e04620`. Verificado en local y en producción
https://medoxigas-opp.vercel.app (deploy `dpl_3jzAAq5ZDvgn8hZqVpC5LCNekCyv` creado por API desde la rama, 30 oct 2026):
redirección sin sesión a `/login`, error en español con clave mala, login ok, KPIs del ISO 28 octubre =
152 cilindros, 13 termos, 3,920 kg, merma −2.81 % (−380 kg) iguales a `v_merma_iso_pct`, gráficos dibujan,
logout ok, sin errores de consola.

Nota: los deploys automáticos por push quedan BLOCKED en Vercel (autor del commit
"Muse Spark <muse-spark@local>" no es miembro del equipo Hobby): configurar `git user.email` de Waldy
o deployar por API. Pendiente etapa 2: Google + allowlist. Pendiente: `main` sigue sin fusionar;
Production Branch de Vercel no cambiada.

Se trajo el código de Studio Admin (`arhamkhnz/next-shadcn-admin-dashboard-baseui`, MIT) como base del repo
y se le pasó lo nuestro encima.

- Plantilla: `src/` completo, `biome.json` (linter; `pnpm lint`), `postcss.config.mjs`, `tsconfig.json`,
  `next.config.mjs` (redirige `/dashboard` a `/dashboard/produccion`). `package.json` fusionado con
  `@supabase/ssr` + `@supabase/supabase-js`; sin eslint. `src/proxy.ts` exige sesión en todo salvo `/login`.
- Borradas todas las pantallas demo (CRM, Finance, Academy, Analytics, Productivity, E-commerce, Logistics,
  Infrastructure, File Manager, Patient Monitoring, chat, mail, kanban, invoice, users, roles, auth v1, register)
  y sus datos (`src/data/users.ts`). Sidebar con un solo módulo: Producción → `/dashboard/produccion`.
  Fuera: Quick Create, botón de mail, botón de GitHub, tarjeta "Have something in mind", "Studio Admin", "Arham".
- Marca "MEDOXIGAS ALC, SRL" con `public/marca/logo-medoxigas-cuadrado.png` en el sidebar; abajo el email real
  de Supabase y "Cerrar sesión" funcional. Header con búsqueda (solo Producción), Preferencias en español
  y cambio de tema claro/oscuro/sistema.
- Login en `/login` (diseño v2 de la plantilla, español): formulario blanco a la izquierda con logo,
  "Iniciar sesión", email + contraseña, "Entrar"; panel de marca a la derecha en `bg-brand-dark` con logo y
  textos de Medoxigas. Solo email+contraseña contra Supabase Auth; error: "Correo o contraseña incorrectos".
  Tras login → `/dashboard/produccion`. `/` y `/dashboard` redirigen ahí.
- Preset "Medoxigas" (`src/styles/presets/medoxigas.css`, default): fondo blanco, `--primary #1e56c7`,
  hover `#123c8c`, suave `#eaf0fc`, oscuro `--brand-dark #0a2352` (usable como `bg-brand-dark`), `--ring`,
  `--chart-1` primario, `--sidebar-*`; variante oscura incluida. Sin hex sueltos en componentes.
- Producción en `src/app/(main)/dashboard/produccion/` con ritmo Academy: encabezado (ISO activo + hora de
  última lectura; filtro de ISO por searchParams, rango de fechas, "Ver alertas"), 4 KPIs con ícono
  (Cilindros, Termos, LOX usado, Merma real con insignia verde −3 %..20 % / roja), lista de ISOs con estado
  (5 col) + barras por día cilindros vs termos (7 col), nivel+presión en el tiempo y merma por ISO (8 col) +
  alertas recientes por severidad (4 col, `id="alertas"`), tabla de llenados con TanStack Table de la plantilla
  (orden, paginación, búsqueda en español). Todo en español, números `es-DO`, horas `America/Santo_Domingo`,
  Recharts con `isAnimationActive={false}`, `loading.tsx` con skeletons, estado vacío
  "Aún no hay producción cargada", `error.tsx` con reintento. Datos reales por RLS (solo lectura);
  columnas verificadas contra `supabase/migrations/*.sql`. `page.tsx` es Server Component chico.
- Verificado: `pnpm install`, `pnpm lint` (1 aviso preexistente de la plantilla), `pnpm build` pasan.
  Servidor prod: `/login` 200 en español, `/` → `/dashboard/produccion`, sin sesión → `/login`,
  `?error=1` muestra "Correo o contraseña incorrectos", preset `medoxigas` por defecto. Con clave anon
  sin sesión Supabase da `permission denied` (RLS solo `authenticated` lee: correcto).
- Rondas de corrección aplicadas (select de ISO muestra el nombre vía `items` de Base UI; números de la lista
  de ISOs con formato `es-DO` y filas reorganizadas; barras de merma coloreadas por rango con etiqueta de %;
  strings visibles/aria restantes traducidos; subtítulo del login sin mencionar Supabase).

## Correr en local

```bash
pnpm install
cp .env.example .env.local
pnpm dev
```

Abre http://localhost:3000. Sin sesión redirige a `/login`. El usuario se crea a mano en Supabase; esta app no registra cuentas.

## Migraciones

```bash
supabase db push
```

O aplica `supabase/migrations/20261030140000_produccion.sql` en el editor SQL. En Postgres pelado, crea antes los roles:

```sql
create role anon nologin;
create role authenticated nologin;
create role service_role nologin bypassrls;
```
