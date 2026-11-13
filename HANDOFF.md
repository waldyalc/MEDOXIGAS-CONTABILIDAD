# Handoff — Medoxigas Contabilidad

## CxP con créditos y NCF del proveedor en notas de crédito (14 nov 2026)

- El saldo por pagar ahora es `total - pagado - credito` en el reporte Cuentas
  por pagar, la ficha de contacto y la ficha de producto (`facturas_proveedor.credito`).
- La nota de crédito de compra pide el NCF del proveedor (opcional, B04 + 8
  dígitos o E34 + 10 dígitos) y ya no consume la numeración 03/B03. Migración
  aditiva `20261114700000_notas_credito_compra_ncf_proveedor.sql` (NO aplicada;
  la revisa Coder). `types.ts` actualizado a mano solo en la nulabilidad de
  `notas_credito_compra.ncf`.
- pgTAP aislados de los datos reales: órdenes de compra cuenta asientos
  antes/después, pagos recurrentes usa la RPC, periodos compara contra los
  saldos previos al cierre y configuración valida solo los datos del test.
- `typecheck`, Vitest, Biome y `build` en verde. pgTAP no se pudo correr aquí
  (sin Docker/Supabase CLI).

## Inventario: ajustes, almacenes y categorías (14 nov 2026)

- Nuevo módulo `/dashboard/inventario`: Ajustes de inventario (lista, nuevo y
  detalle), Almacenes (con «Principal» sembrado) y Categorías de productos.
- Ajustes: entrada o salida por producto con su costo. La entrada recalcula el
  costo promedio ponderado y la salida usa el costo indicado. Asiento automático
  `ajuste_inventario`: entrada Dr 1104 Inventario / Cr 5102 Ajustes de
  inventario; salida al revés. Cuenta 5102 y `config_contable.ajuste_inventario`
  se siembran con `ON CONFLICT DO NOTHING`.
- Producto: campo opcional «Categoría» en «Más opciones». `crear_producto` y
  `actualizar_producto` aceptan `categoria_id`.
- Migración `20261114500000_inventario.sql` (NO aplicada al remoto; la revisa
  Coder). pgTAP `supabase/tests/inventario_test.sql` (26 asserts). Tipos de las
  tablas nuevas a mano en `types.ts`. No se pudieron correr los pgTAP en local
  (no hay Supabase CLI ni Docker en este equipo).
- Pendiente: transferencias entre almacenes, anulación de ajustes y stock por
  almacén (hoy la existencia sigue global en `productos`).
- Limpieza: se borró `cotizaciones/_components/documento-form.tsx` (sin uso).
## Configuración (13 nov 2026)

- Nuevo módulo `/dashboard/configuracion` con portada por grupos (Empresa, Facturación, Impuestos, Contabilidad) y menú lateral propio: Empresa (nombre, RNC, dirección, teléfono, correo y logo), Términos de pago (lista y crear), Impuestos (ITBIS 18/16/0/exento, solo lectura), Usuarios (solo admin, solo lectura) y enlaces a Numeraciones y Configuraciones contables.
- Migraciones `20261114600000_configuracion.sql` (empresa nullable, `terminos_pago` con semilla Contado/8/15/30/60, RPC `actualizar_empresa`, `crear_termino_pago`, consulta `listar_terminos_pago` y `listar_perfiles`) y `20261114600100_configuracion_logos_storage.sql` (bucket público `logos`, solo admin sube/actualiza/borra). No aplicadas al proyecto remoto.
- El logo se sube desde el navegador a Storage y el PDF/encabezado ya usan `empresa.logo_url`, RNC, dirección, teléfono y correo con campos vacíos ocultos.
- pgTAP en `supabase/tests/configuracion_test.sql`; tipos añadidos a mano en `src/lib/supabase/types.ts`. `typecheck`, Biome y Vitest en verde.
## Plantilla única de documento de venta (13 nov 2026)

- Nuevo `src/components/documento-venta/` (`documento-venta-form.tsx` + `calculo.ts`): la tarjeta del formulario de factura (logo, empresa, ajustes, cliente/fechas, líneas, totales y «Más opciones») ahora es compartida. Por props define título, comprobante/NCF o numeración simple, vencimiento, pago recibido, notas/términos/pie, textos de botones, rutas y la server action.
- Factura, cotización y conduce nuevas usan la misma plantilla; se conservaron cálculos, validaciones y acciones. La factura mantiene Ajustes con pago; cotización y conduce muestran solo información, líneas, totales y notas.
- Tests del cálculo/armado compartido en `src/components/documento-venta/calculo.test.ts` (11). `typecheck`, Biome y Vitest en verde. `cotizaciones/_components/documento-form.tsx` quedó sin uso (no se borró por ser archivo de otra sesión).

## Ingresos: notas de débito y facturas recurrentes (13 nov 2026)

- Notas de débito de venta (B03): lista, nueva y detalle en `/dashboard/notas-debito`, enlazadas a la factura y al cliente. RPC `crear_nota_debito_venta` con el asiento de una factura (Dr 1103 CxC / Cr ventas / Cr 2102 ITBIS); no mueve inventario ni cambia el saldo de la factura, suma al saldo del cliente. Numeración 03/B03 y tablas `notas_debito_venta` + `nota_debito_venta_lineas` con RLS (`20261114100000_notas_debito_venta.sql`).
- Facturas recurrentes: lista, nueva y detalle en `/dashboard/facturas-recurrentes`; plantilla con cliente, comprobante, inicio, vigencia, frecuencia en meses, plazo y líneas. `generar_factura_recurrente` es idempotente por periodo (bloquea la plantilla y registra el periodo en `factura_recurrente_generaciones`) y genera con el motor (`crear_factura`); botón «Generar ahora», sin cron (`20261114101000_facturas_recurrentes.sql`).
- pgTAP nuevos: `notas_debito_venta_test.sql` (18 asserts) y `facturas_recurrentes_test.sql` (22). No se pudieron correr en esta máquina (sin Docker/Supabase CLI). `typecheck`, Biome de los archivos tocados y los Vitest de validación en verde.
- Nota al aplicar: `asientos.origen_tipo` ya admite `nota_debito`; la migración vuelve a declarar el CHECK completo. Aplicada al proyecto remoto el 13 nov 2026 tras dry run (pgTAP 40/40 en verde dentro de BEGIN/ROLLBACK).

## Reportes fiscales y «Para trabajar» (14 nov 2026)

- Nuevas pantallas de solo lectura: 606, 607 y 608 (`/dashboard/reportes/606|607|608`) con período mensual, Excel/PDF compartido y TXT separado por pipes con encabezado DGII; el 606 incluye los gastos menores B13. Las columnas oficiales viven en `src/lib/reportes/fiscales/formatos/` con su fuente y las marcas `// VERIFICAR con instructivo DGII`.
- Reporte detallado de impuestos (4 tablas por tasa y detalle con NCF enlazado al documento), Impuestos y retenciones (pestañas Ventas/Compras con «Ver detalles») e IT-1 de solo lectura (Anexo A y casillas principales; no crea borradores ni envía nada).
- «Exportar para el contador» con rango de fechas (mes por defecto): facturas de venta, compras y libro diario en Excel/PDF.
- Cálculos y consultas en `src/lib/reportes/fiscales/`, con 23 tests Vitest. Sin migración. En la portada de Reportes solo se agregaron los enlaces de las tarjetas Fiscales y Para trabajar.
- `typecheck`, Biome, `test` (410) y `build` en verde.

## Compras completas: notas, órdenes y recurrentes (13 nov 2026)

- Notas de crédito en compras (`/dashboard/compras/notas-credito`): NCF B03 ligado a la factura de proveedor; asiento Dr CxP / Cr inventario o cuenta de gasto / Cr ITBIS adelantado; devuelve inventario, recalcula el costo promedio y baja el saldo por pagar con `facturas_proveedor.credito`. La anulación revierte asiento, inventario y crédito.
- Órdenes de compra (`/dashboard/ordenes-compra`): documento de control sin asiento ni movimiento de inventario. «Convertir en factura de proveedor» abre `compras/nueva?orden=<id>` y la orden queda enlazada a la factura creada.
- Pagos recurrentes (`/dashboard/pagos-recurrentes`): plantilla + `generar_pago_recurrente` idempotente por periodo; el botón «Generar ahora» crea el gasto menor B13 del último periodo vencido, sin cron.
- Migraciones aditivas `20261114200000_notas_credito_compra.sql`, `20261114201000_ordenes_compra.sql` y `20261114202000_pagos_recurrentes.sql`. pgTAP nuevos: 24 + 11 + 21 asserts. Tipos de las tablas nuevas a mano en `types.ts` y `facturas_proveedor.credito` agregado.
- Pendiente: aplicar la migración y regenerar `types.ts`; el reporte Cuentas por pagar debe restar `facturas_proveedor.credito` (no se tocó por ser de otra sesión). pgTAP no se pudo correr localmente (sin Docker/Supabase CLI en esta máquina).
## Ajustes de diseño del formulario de factura (13 nov 2026)

- Logo a 96 px en escritorio y 72 px en móvil; RD$ y % van dentro del campo con `InputGroup`; los `NativeSelect` (NCF, cuenta, método e ITBIS) pasan al `Select` de shadcn.
- Nuevo `src/components/date-picker.tsx` con las medidas de la guía (un mes de 306 px, celda 40×40 radio 10, paso 40×45, semana LU…DO, elegido en primario, hover slate-100 y botón Hoy) para las dos fechas; cabecera de una línea «Nov 2026» con flechas, sin selects nativos. Las listas `Select` del formulario abren debajo del campo.
- Sin cambios de cálculo. `typecheck`, `check`, `test` (387) y `build` en verde. Vista previa local bloqueada por el login; capturas pendientes de Waldy.

## Skills para agentes y motor de código (13 nov 2026)

- Skills de OpenCode en `.opencode/skills/`: `localhost`, `probar-cambios`, `flujo-git`, `diseno-ui`, `motor-contable` y `supabase-migraciones`. `AGENTS.md` tiene la lista y un checklist de arranque.
- El motor de código pasó a **T3 Code en la PC de Waldy** (Windows, MSI), modelo `opencode-go/deepseek-v4.1-flash` variante `max`. Ya no se programa con OpenCode en el box. Waldy habla solo con Coder; Coder lanza y revisa las sesiones.
- Hecho: rama `feat/fac-ajustes` (logo más grande, `RD$`/`%` dentro del input, `Select` en vez de lista nativa, calendario al estilo de las medidas de `docs/alegra/css-factura/GUIA-CALENDARIO.md`). Ya está en `prueba`.
- Se agregó a `docs/alegra/` la guía de calendario y las capturas `calendario-*.png` (sin el HTML/CSS original de Alegra).


## Diseño del formulario de factura (13 nov 2026)

- `factura-form.tsx` ahora es una sola tarjeta (máx. 1040 px) con el logo de
  Medoxigas, encabezado en 3 tercios, Ajustes en 5 columnas, Información en 3
  columnas (gap 32), tabla de productos en un solo grid con scroll horizontal,
  totales en texto plano y botones fuera de la tarjeta.
- Notas, Términos y Pie siguen ocultos en «Más opciones». La lógica de cálculo,
  validación, NCF, server actions y tipos no cambió.

## Beta 1 (13 nov 2026)

**Hecho**

- Motor contable de doble partida: migración `20261113140000_motor_contable.sql`
  aplicada en el proyecto de prueba. Incluye catálogo de 24 cuentas,
  `config_contable`, contactos, productos, numeraciones NCF, facturas, compras,
  pagos, gastos menores, anulación y reportes. Resumen para no leer todo el SQL:
  `docs/motor-contable.md`; contrato: `docs/contrato-db.md`.
- Pantallas: Inicio con KPIs, Contactos, Productos, Facturación (lista, nueva y
  detalle imprimible con asiento), Pagos recibidos, Compras (facturas de
  proveedor, pagos a proveedores y detalle), Gastos menores, Contabilidad
  (catálogo y configuración) y Reportes (libro diario, balance de comprobación,
  estado de resultados, CxC).
- Reportes de Ventas: `ventas-producto` (período + búsqueda, paginado 20) y
  `rentabilidad-producto` (período, paginado 10), con producto enlazado a su
  ficha, totales en tarjetas y exportación Excel/PDF compartida. Cálculos puros
  en `src/lib/reportes/ventas/v2/` con Vitest (cifras de la ferretería).
- pgTAP: 103 asserts en 7 archivos `motor_*` (+5 de perfiles); corre en CI, job
  `Supabase`. `types.ts` regenerado.

**Pendiente**

- Datos de la empresa editables: RNC, dirección, teléfono, correo y logo. Hoy
  `empresa` solo tiene el nombre semilla.
- Numeraciones B14, B15 y B16 además de B01/B02, con pantalla de administración.
- e-CF / DGII y reportes 606/607.
- Bancos (cuentas, movimientos y conciliación).
- Notas de crédito.
- Google login: activar proveedor en Supabase Auth y redirects de producción y
  prueba.
- e2e de los flujos de la beta (hoy se salta sin `E2E_EMAIL`/`E2E_PASSWORD`).
- Anulación de compras: devuelve cantidad pero no recalcula costo promedio.

## Reportes administrativos (13 nov 2026)

- Cuentas por cobrar ampliado con filtro Hasta, filtros NCF/Número, Cliente,
  Creación y Vencimiento, 5 vistas por antigüedad y paginado de 20.
- Nuevos reportes: Cuentas por pagar (`/reportes/cxp`), Compras
  (`/reportes/compras`) y Valor de inventario (`/reportes/valor-inventario`),
  con columnas, totales y filtros de Alegra. Exportan Excel/PDF con el
  componente compartido.
- Cálculos puros y URL de fichas en `src/lib/reportes/administrativos/d/`;
  pruebas Vitest. Sin migración: todo son consultas de solo lectura. El valor
  de inventario histórico reconstruye la existencia con movimientos posteriores
  de ventas y compras no anuladas.
- Pendiente: la otra sesión agrega los enlaces de cxp, compras y valor de
  inventario al índice de reportes.

## Arranque del proyecto (13 nov 2026)
- Repo `waldyalc/MEDOXIGAS-CONTABILIDAD` (privado), ramas `main` (producción) y `prueba`.
- Base tomada de Medoxigas-OPP (misma configuración: Next 16, pnpm, Biome, Vitest, Playwright, husky, CI, gitleaks, flujo Supabase local) **sin** sus módulos de negocio.
- Supabase `MEDOXIGAS-CONTABILIDAD` (`ljfdhrnvlsfaweuvnqxz`, ca-central-1, gratis). Migración `20261113132637_perfiles.sql` aplicada; `types.ts` generado desde el proyecto.
- Vercel `medoxigas-contabilidad` (mismo equipo que OPP): producción desde `main`, alias fijo de `prueba` en medoxigas-contabilidad-prueba.vercel.app. Variables `NEXT_PUBLIC_SUPABASE_URL` y `NEXT_PUBLIC_SUPABASE_ANON_KEY` (clave publicable).
- App: login (correo + contraseña y botón Google) y dashboard vacío con menú; módulos futuros como "Próximamente".

## Pendiente de infraestructura
- Crear el usuario de Waldy en Supabase Auth y su fila en `perfiles` con rol `admin` (SQL con OK de Waldy).
- Google: activar el proveedor Google en Supabase Auth (Client ID/secret de Google Cloud) y agregar las URL de redirección de producción y prueba. Hasta entonces el botón Google da error y se entra con correo y contraseña.
- Supabase Auth → URL Configuration: Site URL = producción y Redirect URLs de prueba.
- Estudio de Alegra con la cuenta de prueba que da Waldy → `docs/alegra/`.
- Secrets de GitHub para el humo e2e (opcional): `E2E_EMAIL`, `E2E_PASSWORD`, `E2E_SUPABASE_URL`, `E2E_SUPABASE_ANON_KEY`.

## Activos fijos, depreciación y periodos (13 nov 2026)

- Activos fijos en `/dashboard/contabilidad/activos` (lista, nuevo y detalle). Depreciación en línea recta mensual con cálculo puro en `src/lib/activos-fijos/calculo.ts` y Vitest. El botón «Depreciar periodo» crea Dr 6109 / Cr 1211 al cierre del mes y no duplica el mismo mes. La creación del activo puede generar su asiento Dr 1210 / Cr 2101.
- Periodos en `/dashboard/contabilidad/periodos`: cerrar y reabrir meses; el trigger `asientos_periodo_abierto` bloquea crear o anular asientos con fecha en un mes cerrado. El cierre de resultados del año lleva ingresos, costos y gastos a 3202 Utilidad del ejercicio y es idempotente por año.
- Migraciones aditivas `20261114300000_activos_fijos.sql` y `20261114300100_periodos_cierre.sql` (pendientes de aplicar por Coder). Cuentas nuevas: 12, 1210, 1211, 6109 y 3202. pgTAP: `activos_fijos_test.sql` y `periodos_cierre_test.sql`.
- Verificado: `pnpm typecheck`, Biome de los archivos nuevos, `pnpm test` (400) y `pnpm build`. pgTAP no se pudo correr aquí (sin Docker/Supabase local).