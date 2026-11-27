---
name: motor-contable
description: Cómo funciona el motor de doble partida en este repo (SQL, RPC, cuentas por defecto e invariantes) y la regla de escribir tests antes de cambiar un cálculo.
---

# Motor contable

La partida doble vive en **Postgres**, no en React. Cada documento de negocio (factura, pago, compra, gasto, nota de crédito, asiento manual, transferencia, etc.) crea un asiento en la misma transacción. El usuario no escribe débitos ni créditos: las cuentas las decide el motor.

Guía corta: `docs/motor-contable.md`. Contrato de tablas y RPC: `docs/contrato-db.md`. Resumen para agentes: `supabase/AGENTS.md`. Esas guías cubren sobre todo la migración original; las migraciones posteriores pueden haber añadido tablas o reemplazado funciones. Lee también `supabase/migrations/` en orden.

## Archivos

- Motor original: `supabase/migrations/20261113140000_motor_contable.sql`. Después hay migraciones aditivas (caja chica, NCF B14/B15/B16, notas de crédito, cotizaciones y conduces, catálogo editable, asientos manuales, bancos, anulación de compras, conciliaciones, reportes).
- Funciones internas (no las llama la app): `_crear_asiento`, `_cuenta_config`, `_validar_cuenta_movimiento`, `_validar_asiento_cuadrado`.
- RPC de escritura (`security definer`, rol `admin` o `contador`): `crear_factura`, `registrar_pago_recibido`, `crear_factura_proveedor`, `registrar_pago_proveedor`, `crear_gasto_menor`, `anular_documento`, y otras añadidas en migraciones posteriores. La app las invoca desde `src/lib/<modulo>/acciones.ts` (ejemplo: `crear_factura` en `src/lib/facturacion/acciones.ts`).
- Cálculos de pantalla (centavos, ITBIS, totales), para mostrar el formulario: `src/lib/facturacion/calculo.ts` y `src/lib/compras/calculo.ts`. El asiento real lo hace el SQL.
- Validación de asiento manual en la app: `src/lib/asientos/validacion.ts`.

## Cuentas por defecto

`config_contable` trae 12 claves sembradas: `caja` (1101), `banco` (1102), `caja_chica` (1106), `cxc` (1103), `inventario` (1104), `itbis_adelantado` (1105), `cxp` (2101), `itbis_por_pagar` (2102), `ventas` (4101), `ventas_servicios` (4102), `costo_ventas` (5101), `gastos_generales` (6101). Se leen con `_cuenta_config`.

Si el producto o el contacto traen cuenta propia (`cuenta_ingreso_id`, `cuenta_costo_id`, `cuenta_inventario_id`, `cuenta_cxc_id`, `cuenta_cxp_id`), esa gana. El usuario, como mucho, elige la caja/banco del pago o la cuenta de gasto de una línea sin producto.

## Invariantes (los exige la base)

- Al cerrar la transacción, suma de débitos = suma de créditos, y al menos 2 líneas (`asiento_lineas_cuadrado`, diferido; `_crear_asiento` también valida antes de insertar).
- Cada línea lleva débito o crédito, nunca ambos; montos no negativos en `numeric(14,2)`.
- Las cuentas de agrupación (`acepta_movimientos = false`) no aceptan líneas.
- No hay `DELETE` físico de documentos: se anulan con asiento inverso (`anular_documento`).
- RLS activo; `anon` no ve nada; las escrituras van por RPC.

## Tests primero

Cualquier cambio a un cálculo (SQL del motor o TypeScript de totales/ITBIS/asientos) lleva **tests antes** de tocar la lógica.

- TypeScript: Vitest al lado del archivo (`src/lib/facturacion/calculo.test.ts`, `src/lib/compras/calculo.test.ts`, `src/lib/asientos/validacion.test.ts`, etc.) y `pnpm test`.
- SQL: un archivo nuevo o actualizado en `supabase/tests/`, y en local `supabase start` && `supabase test db`. Nunca contra el proyecto real.
