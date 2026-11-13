# Handoff — Medoxigas Contabilidad

## Ingresos: notas de débito y facturas recurrentes (13 nov 2026)

- Notas de débito de venta (B03): lista, nueva y detalle en `/dashboard/notas-debito`, enlazadas a la factura y al cliente. RPC `crear_nota_debito_venta` con el asiento de una factura (Dr 1103 CxC / Cr ventas / Cr 2102 ITBIS); no mueve inventario ni cambia el saldo de la factura, suma al saldo del cliente. Numeración 03/B03 y tablas `notas_debito_venta` + `nota_debito_venta_lineas` con RLS (`20261114100000_notas_debito_venta.sql`).
- Facturas recurrentes: lista, nueva y detalle en `/dashboard/facturas-recurrentes`; plantilla con cliente, comprobante, inicio, vigencia, frecuencia en meses, plazo y líneas. `generar_factura_recurrente` es idempotente por periodo (bloquea la plantilla y registra el periodo en `factura_recurrente_generaciones`) y genera con el motor (`crear_factura`); botón «Generar ahora», sin cron (`20261114101000_facturas_recurrentes.sql`).
- pgTAP nuevos: `notas_debito_venta_test.sql` (18 asserts) y `facturas_recurrentes_test.sql` (22). No se pudieron correr en esta máquina (sin Docker/Supabase CLI). `typecheck`, Biome de los archivos tocados y los Vitest de validación en verde.
- Nota al aplicar: `asientos.origen_tipo` ya admite `nota_debito`; la migración vuelve a declarar el CHECK completo. No aplicada al proyecto remoto.

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
