# Motor contable — guía corta

Resumen para trabajar sin leer las ~2.169 líneas de
`supabase/migrations/20261113140000_motor_contable.sql`. El contrato completo de
tablas y RPC está en `docs/contrato-db.md`.

## Idea en una frase

Cada documento de negocio (factura, pago, compra, gasto) crea un asiento de
doble partida en la misma transacción. Las cuentas las decide el motor; el
usuario no escribe débitos ni créditos.

## Documento → asiento

| Documento (RPC) | Débito | Crédito |
| --- | --- | --- |
| Factura de venta (`crear_factura`) | 1103 Cuentas por cobrar clientes — total | 4101 Ventas de productos o 4102 Ventas de servicios — subtotal de cada línea |
| | | 2102 ITBIS por pagar — ITBIS de la factura |
| | 5101 Costo de ventas — cantidad × costo (solo líneas inventariables) | 1104 Inventario de mercancía — cantidad × costo |
| Pago recibido (`registrar_pago_recibido`) | 1101 Caja general o 1102 Banco principal — monto | 1103 Cuentas por cobrar clientes — monto |
| Factura de proveedor (`crear_factura_proveedor`) | 1104 Inventario de mercancía — compra de producto inventariable | 2101 Cuentas por pagar proveedores — total |
| | 6101 Gastos generales, cuenta de costo del producto o cuenta de la línea — compra de gasto | |
| | 1105 ITBIS adelantado en compras — ITBIS | |
| Pago a proveedor (`registrar_pago_proveedor`) | 2101 Cuentas por pagar proveedores — monto | 1101 Caja general o 1102 Banco principal — monto |
| Gasto menor (`crear_gasto_menor`) | 6101 Gastos generales (o la cuenta de gasto indicada) — subtotal | 1106 Caja chica (o la cuenta de caja/banco indicada) — total |
| | 1105 ITBIS adelantado en compras — ITBIS | |
| Anulación (`anular_documento`) | Las líneas de crédito del asiento original | Las líneas de débito del asiento original |

Notas:

- Una factura de venta con `pago` en el mismo JSON llama a
  `registrar_pago_recibido` dentro de la misma transacción.
- La factura de proveedor sube la cantidad del producto y recalcula su costo
  promedio ponderado.
- Los pagos actualizan `pagado` y el estado (`pagada` cuando `pagado = total`).
- El cobro de una nota de débito de venta (`nota_debito_id`) usa el mismo
  asiento (Dr caja/banco / Cr CxC), no toca `facturas.pagado` y su saldo se
  calcula con los pagos activos ligados a la nota; al anular el pago el saldo
  reaparece en `reporte_cxc`.
- La anulación invierte el asiento con fecha de hoy y `origen_tipo =
  'anulacion'`; no borra el original y deja el documento en `anulada`.

## Ejemplo numérico

Factura de venta de 2 unidades a RD$650.00, costo RD$390.00 por unidad, ITBIS
18%, sin descuento:

- Subtotal: 2 × 650.00 = 1.300.00
- ITBIS: 1.300.00 × 18% = 234.00
- Total: 1.534.00
- Costo de venta: 2 × 390.00 = 780.00

| Cuenta | Débito | Crédito |
| --- | ---: | ---: |
| 1103 Cuentas por cobrar clientes | 1.534.00 | |
| 4101 Ventas de productos | | 1.300.00 |
| 2102 ITBIS por pagar | | 234.00 |
| 5101 Costo de ventas | 780.00 | |
| 1104 Inventario de mercancía | | 780.00 |
| **Totales** | **2.314.00** | **2.314.00** |

La existencia del producto baja en 2 y `factura_lineas.costo_unitario` guarda
390.00. Si el cliente paga después: Dr 1101 Caja general 1.534.00 / Cr 1103
Cuentas por cobrar clientes 1.534.00.

## De dónde salen las cuentas

1. **Producto** (`productos.cuenta_ingreso_id`, `cuenta_costo_id`,
   `cuenta_inventario_id`). Si están en null, el motor usa `config_contable`:
   - venta de producto → `ventas` (4101); venta de servicio → `ventas_servicios` (4102)
   - costo de venta → `costo_ventas` (5101)
   - inventario → `inventario` (1104)
   - compra de producto no inventariable → `gastos_generales` (6101)
2. **Contacto**: `cuenta_cxc_id` o `cuenta_cxp_id` reemplazan a `cxc` (1103) y
   `cxp` (2101).
3. **Configuración**: `config_contable` tiene 20 claves (`caja`, `banco`,
   `caja_chica`, `cxc`, `inventario`, `itbis_adelantado`, `cxp`,
   `itbis_por_pagar`, `ventas`, `ventas_servicios`, `costo_ventas`,
   `gastos_generales`, `ajuste_inventario`, las 4 de retenciones,
   `ajustes_iniciales` y las nuevas `ajustes_iniciales_inventario` y
   `devoluciones_ventas`) y viene sembrada.
   Además, la clasificación DGII por cuenta vive en las columnas
   `cuentas.categoria_dgii` / `tipo_compra` / `tipo_ingreso` (606/607).
4. **Caja o banco**: el pago elige una cuenta con `es_caja_banco = true` (1101,
   1102 o 1106 en el catálogo semilla).
5. **Gasto menor**: usa `cuenta_gasto_id` y `cuenta_pago_id` si se indican; si
   no, `gastos_generales` (6101) y `caja_chica` (1106). La cuenta de gasto debe
   ser de detalle (tipo `gasto` o `costo` y `acepta_movimientos = true`) y el
   NCF B13 se asigna solo.

El usuario nunca escoge las cuentas del asiento. A lo sumo elige la cuenta de
caja/banco que paga, o la cuenta de gasto de una línea de compra sin producto. El catálogo y la configuración se ven en
`/dashboard/contabilidad`; se cambian por SQL con OK de Waldy, no desde la app.

## Garantías del motor

- **Asiento cuadrado, diferido**: el constraint trigger
  `asiento_lineas_cuadrado` (`deferrable initially deferred`) exige al menos 2
  líneas y suma de débitos = suma de créditos al cerrar la transacción. Además
  `_crear_asiento` valida antes de insertar.
- **Líneas válidas**: cada línea lleva exactamente débito o crédito (nunca
  ambos), montos no negativos y `numeric(14,2)`.
- **Cuentas de agrupación**: las cuentas con `acepta_movimientos = false`
  (códigos 1, 11, 2, 21, 3, 4, 5, 6) no aceptan líneas; el trigger
  `asiento_lineas_cuenta_movimiento` lanza error.
- **Sin DELETE**: no hay borrado físico de documentos. `anular_documento` crea
  el asiento inverso (con `anula_asiento_id`), marca el documento en `anulada`,
  devuelve o retira inventario y libera `pagado`. Una factura con pagos activos
  no se puede anular: primero se anulan los pagos.
- **Permisos**: RLS activo en todas las tablas; `anon` no ve nada;
  `authenticated` solo lee. Las escrituras van por RPC `security definer` y
  exigen rol `admin` o `contador` (`lector` recibe `42501`).
- **NCF**: se toma de `numeraciones` con `for update`; hoy las numeraciones
  semilla son 01/B01, 02/B02 y 13/B13, todas con `hasta = 100000`. El NCF es
  prefijo + 8 dígitos.

Límites conocidos: la anulación se fecha con `current_date`, no con la fecha
del documento. Anular una compra o un ajuste de **entrada** devuelve la cantidad
y revierte el costo promedio con la fórmula inversa (compras desde
`20261113270000`; ajustes de entrada desde `20261117200000`). Si entre el
movimiento y la anulación hubo ventas u otras compras, la reversión es
aproximada por el redondeo del promedio móvil. Un ajuste de salida no cambia el
costo promedio, pero su asiento usa el costo manual de la línea; si difiere del
promedio, el mayor y `cantidad × costo` se separan.

## Cómo se prueba

```bash
supabase start
supabase test db
```

- CI: job `Supabase` (`.github/workflows/supabase.yml`) corre lo mismo y además
  verifica que `types.ts` esté al día.
- 103 asserts en 7 archivos `supabase/tests/motor_*_test.sql`: esquema/RLS (26),
  factura (20), pagos (11), compras (13), gasto menor (9), anulación (14) y
  reportes (10). `perfiles_test.sql` suma 5.
- Nunca contra el proyecto real: solo Supabase local.
