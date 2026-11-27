# Catálogo de candados (tests y reglas)

Regla de oro: cada corrección de Waldy se convierte en un **test** (Vitest, pgTAP o Playwright) o una **regla de Biome** que falle si alguien repite el error, con mensaje claro de cómo arreglarlo de raíz. Ver `.agents/skills/biome/SKILL.md`.

## Candados activos

- `src/lib/selects-nativos.test.ts` — prohíbe `<select>` y `NativeSelect` fuera de `components/ui`.
- `src/lib/rpc-sin-extraer.test.ts` — prohíbe guardar `supabase.rpc` en una variable o convertirlo con `as`; llamar siempre `supabase.rpc("nombre", args)` directo.
- `src/lib/numeraciones/acciones.test.ts` — la server action de numeraciones llama la RPC directa con el payload validado y devuelve errores en español.
- `src/lib/paginacion.test.ts` — reportes, bancos, fichas y selectores críticos leen por lotes (`paginarConsulta`/`consultarEnLotes`), sin topes de 300/500/1,000; ventas/rentabilidad por producto no se corta en 20,000 líneas.
- `src/lib/tablas-listas.test.ts` — las listas migradas usan `TablaLista` (48 px en `<TableHead>`, `EsqueletoTabla` 48/56 px); las listas maestro-detalle del POS usan el kit compartido (`TarjetaLista`/`BarraLista`/`PillEstado`).
- `src/lib/bancos/consultas.test.ts` — `getIngresosGastosMensual` lee `asientos` por índice de fecha y luego líneas con `consultarEnLotes` (evita `statement_timeout`).
- `src/lib/diseno-paginas.test.ts` — pantallas migradas usan `EncabezadoPagina` + migas sin `text-3xl` suelto; POS usa `EncabezadoPagina` sin migas.
- `src/lib/fichas-sin-datos-ejemplo.test.ts` — prohíbe `*_EJEMPLO` y datos ficticios en fichas de contacto y producto.
- `src/lib/fechas-nativas.test.ts` — prohíbe `<input type="date">` fuera de `components/ui`; exige `DatePicker` / `DatePickerCampo`.
- `src/lib/reportes-encabezado.test.ts` — todos los reportes usan `EncabezadoReporte` o `EncabezadoPagina`, sin `<h1>` sueltos.
- `src/lib/supabase/migraciones.test.ts` — exige `YYYYMMDDHHMMSS_nombre.sql`, sin duplicados ni vacíos, y timestamp UTC real posterior a `20261123000000`.
- `src/lib/supabase/reset-virgen.test.ts` — exige todas las tablas `public.*` clasificadas una sola vez en `docs/pruebas/reset-base-virgen.sql`, dentro de `BEGIN…COMMIT`, sin tocar `perfiles` ni `auth.users`.
- `tests/e2e/numeraciones.spec.ts` — guardar B16 sin cambios cierra el diálogo y un nombre en blanco muestra error en español.
- `supabase/tests/anular_ajuste_costo_test.sql` y `anular_compra_costo_test.sql` — anular entrada/compra revierte cantidad y costo promedio.
- `supabase/tests/fix_actualizar_cuenta_invariantes_test.sql`, `fix_actualizar_numeracion_gastos_menores_test.sql` y `fix_saldos_iniciales_lock_test.sql` — invariantes de cuentas, series B13 y lock en saldos iniciales.
- `supabase/tests/fix_nc_residuo_credito_test.sql` — NC parciales cuadran exactas por residuo y NC manual no genera sobrecrédito salvo `permite_saldo_a_favor` del POS.
- `src/lib/pos/ticket-pdf-carril.test.ts` — `ticket-pdf.test.tsx` (Chromium + Poppler) queda excluido de `pnpm test` y corre solo en `pnpm test:pdf` / job `pdf`.
- `src/lib/pos/diseno-pos.test.ts` — POS usa tokens `--pos-*` derivados de `--brand-primary`; prohíbe `--primary` y hexes directos en `src/app/(pos)/pos/`; turno/pestañas en `barra-inferior-pos.tsx`; Sheet móvil deja 44 px abajo.
- `src/lib/marca.test.ts` — fuente única de marca (`src/lib/marca.ts` + `--brand-primary` en `globals.css`) alimenta ERP, POS y PWA; prohíbe el teal de Alegra en `src/`.
- `src/lib/contactos/dialogo-nuevo-contacto.test.ts` + `src/components/contactos/dialogo-nuevo-contacto.test.tsx` — alta rápida unificada con `DialogoNuevoContacto`; en el POS `permitirProveedor={false}`.
- `src/lib/pos/mas-opciones.test.ts` + `tests/e2e/pos-mas-opciones.spec.ts` — el `⋯` del carrito abre el panel «Más opciones» a todo el panel con cierre por X y Esc.
- `src/lib/binarios-grandes.test.ts` (+ `src/lib/binarios-permitidos.txt`) — bloquea binarios nuevos >200 KB e imágenes con «alegra» en el nombre o bajo `docs/diseno/alegra-pos/`.
- `src/lib/facturacion/totales-factura-ui.test.ts` + `totales-nota.test.ts` — Subtotal bruto con Descuento, B03/B04 con otros impuestos y propina, bloqueo de anulación con notas activas, fecha de anulación >= factura, conversión B14/B15/B16 y `hoyRd()`.
- `.github/workflows/supabase.yml` — en PR, toda migración nueva en `supabase/migrations/` exige al menos un archivo tocado en `supabase/tests/`.
