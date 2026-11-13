# Alegra — reportes Administrativos

**Cuenta activa:** el selector de empresa de la cabecera mostraba `Fiel Fe…` (nombre truncado por la interfaz), consistente con **Fiel Ferreteria**; los reportes mostraron los datos de prueba de ferretería. No se cambió de empresa. Se mantuvo el recorrido en modo lectura: no se creó ni editó ningún documento y no se pulsaron los controles de descarga o compartir. No se abrió Más soluciones, POS ni Nómina.

Todas las fechas/valores que siguen corresponden a lo visto en la sesión del 13/11/2026. Se usaron periodos que incluyen el 13/11/2026. Los enlaces indicados son destinos de navegación visibles en la interfaz; no se abrieron los enlaces de filas.

## 1. Cuentas por cobrar

- **URL:** https://app.alegra.com/report/invoices-open
- **Filtros predeterminados:** `Hasta*: 30/11/2026`; incluye el 13/11. Los cinco selectores por antigüedad no estaban seleccionados inicialmente (vista general). Al abrir `Filtrar`, los campos estaban vacíos: `NCF/Número`, `Cliente`, `Creación`, `Vencimiento`.
- **Columnas, en orden:** casilla de selección, NCF/Número, Tipo de documento, Cliente, Creación, Vencimiento, Total, Cobrado, Por cobrar.
- **Totales/detalle:** Total por cobrar **RD$8,638.00**. Una fila: `B0100000001`, Factura, [client name redacted], creada 13/11/2026, vence 13/12/2026, total RD$16,638.00, cobrado RD$8,000.00, por cobrar RD$8,638.00. La vista `No vencidas` muestra RD$8,638.00; cada vista vencida (30 días o menos, 31–60, 61–90, 91+) muestra RD$0.00 y ninguna factura.
- **Celdas/enlaces:** `B0100000001` → https://app.alegra.com/invoice/view/id/1. Las demás celdas de datos no se mostraron como enlaces.
- **Controles:** `Generar Reporte`, `Filtrar`, selector de resultados por página (20), paginación. Iconos de descarga y compartir en la esquina superior; no se pulsaron. No se vio impresión.
- **Capturas:** `08-reporte-cuentas-por-cobrar.png` y `08-reporte-cuentas-por-cobrar-{vencidas-30-dias-o-menos,vencidas-31-a-60-dias,vencidas-61-a-90-dias,vencidas-91-plus,no-vencidas}.png`.

## 2. Cuentas por pagar

- **URL:** https://app.alegra.com/report/bills-open
- **Filtros predeterminados:** `Periodo*: 01/11/2026 - 30/11/2026`; incluye el 13/11. Ninguna de las cinco vistas por antigüedad estaba seleccionada inicialmente. En `Filtrar`, `NCF/Número`, `Cliente`, `Creación` y `Vencimiento` estaban vacíos.
- **Columnas, en orden:** Tipo de documento, NCF/Número, Proveedor, Creación, Vencimiento, Total, Pagado, Por pagar.
- **Totales/detalle:** Total por pagar **RD$0.00**; el reporte indica `¡No tienes facturas pendientes por pagar!`. Cada vista (Vencidas 30 días o menos, 31–60, 61–90, 91+, No vencidas) da RD$0.00 y no contiene filas.
- **Celdas/enlaces:** no había filas de datos enlazables.
- **Controles:** `Generar Reporte`, `Filtrar`, selector de resultados por página (20), paginación. Iconos de descarga y compartir en la esquina superior; no se pulsaron. No se vio impresión.
- **Capturas:** `08-reporte-cuentas-por-pagar.png` y `08-reporte-cuentas-por-pagar-{vencidas-30-dias-o-menos,vencidas-31-a-60-dias,vencidas-61-a-90-dias,vencidas-91-plus,no-vencidas}.png`.

## 3. Ingresos y compras

- **URL:** https://app.alegra.com/report/income-and-expense/ledger/yes
- **Filtros predeterminados:** periodo `01/11/2026 - 30/11/2026`; búsqueda `Buscar cuenta contable` vacía; `Cuentas con saldos en cero` activado. El botón `Actualizar` genera/actualiza la vista.
- **Columnas:** Cuenta contable, Total.
- **Totales y subtotales:** Total de ingresos **RD$18,500.00**; total de egresos **-RD$12,150.00**; saldo **RD$6,350.00**. Subtotales no cero mostrados: Ingresos RD$18,500.00 → Ingresos de actividades ordinarias RD$18,500.00 → Ventas RD$18,500.00; Costos -RD$11,100.00 → Costos de ventas y operación -RD$11,100.00 → Costos de la mercancía vendida -RD$11,100.00 → Costos del inventario -RD$11,100.00; Gastos -RD$1,050.00 → Gastos generales -RD$1,050.00, incluidos Servicios públicos -RD$250.00 (Agua -RD$250.00), Artículos de oficina -RD$300.00 (Papelería -RD$300.00) y Combustibles y lubricantes -RD$500.00. Las demás cuentas/subcuentas visibles muestran RD$0.00.
- **Celdas/enlaces:** los nombres de cuentas enlazan al detalle de asientos de la cuenta, con el rango `/report/ledger-journal-categories/from/2026-11-01/to/2026-11-30?category_id=<id>` (por ejemplo, `Ventas` usa `category_id=5124`; `Costos del inventario`, `category_id=5135`). Los nodos de cuenta con flecha tienen controles para expandir/contraer, sin navegar.
- **Controles:** `Descargar` (no pulsado); no se vio imprimir ni compartir. No hay pestañas de vista.
- **Captura:** `08-reporte-ingresos-y-compras.png`.

## 4. Valor de inventario

- **URL:** https://app.alegra.com/report/inventory
- **Filtros predeterminados:** `Hasta: 13/11/2026`; selector `Almacén` sin almacén seleccionado visible (el menú ofrecía `Principal`); campos `Producto/servicio` y `Referencia` vacíos. `Ítems por página`: 10.
- **Columnas, en orden:** Producto/servicio, Referencia, Descripción, Cantidad, Unidad, Estado, Costo promedio, Total, columna de acción sin encabezado.
- **Total:** **RD$124,800.00**. Ocho productos (todos Activo, unidad Unidad; referencia y descripción vacías): Bombillo LED 9W — 50.00 × RD$72.00 = RD$3,600.00; Cable THHN #12 (metro) — 50.00 × RD$27.00 = RD$1,350.00; Cemento gris 42.5kg — 140.00 × RD$390.00 = RD$54,600.00; Clavos libra — 50.00 × RD$51.00 = RD$2,550.00; Llave de paso 1/2 — 50.00 × RD$210.00 = RD$10,500.00; Pintura galón — 48.00 × RD$870.00 = RD$41,760.00; Tubo PVC 1/2 — 40.00 × RD$90.00 = RD$3,600.00; Varilla 3/8 — 30.00 × RD$228.00 = RD$6,840.00. Paginación: 1–8 de 8.
- **Celdas/enlaces:** nombres de producto enlazan a sus fichas: Bombillo LED 9W → `/item/view/id/9`; Cable THHN #12 (metro) → `/item/view/id/7`; Cemento gris 42.5kg → `/item/view/id/2`; Clavos libra → `/item/view/id/6`; Llave de paso 1/2 → `/item/view/id/8`; Pintura galón → `/item/view/id/5`; Tubo PVC 1/2 → `/item/view/id/4`; Varilla 3/8 → `/item/view/id/3`. Hay un botón de acción por fila, no activado.
- **Controles:** `Actualizar`, `Filtrar`, `Descargar` (no pulsado); no se vio imprimir ni compartir.
- **Captura:** `08-reporte-valor-de-inventario.png`.

## 5. Transacciones

- **URL:** https://app.alegra.com/report/transactions
- **Filtros predeterminados:** periodo `Este mes` (noviembre de 2026, incluye el 13/11). En `Filtrar`, `Comprobante`, `Fecha`, `Estado`, `Tipo` y `Valor` estaban vacíos. `Ítems por página`: 20.
- **Columnas, en orden:** Comprobante, Fecha, Cuenta, Proveedor, Detalle, Entradas, Salidas.
- **Totales:** entradas **RD$13,192**; salidas **RD$47,070**. Seis filas, todas del 13/11/2026: B1300000003 / Caja chica / Papelería / salida RD$300.00; B1300000002 / Caja chica / Agua / salida RD$250.00; B1300000001 / Caja chica / Combustibles y lubricantes / salida RD$500.00; 2 / Caja general / [client name redacted] / `Facturas: B0100000001` / entrada RD$8,000.00; 1 / Tarjeta de crédito empresarial / [client name redacted] / `Facturas: B0200000001` / entrada RD$5,192.00; 1 / Banco 1 / [supplier name redacted] / `Facturas de proveedor: B0100000050` / salida RD$46,020.00. El texto del reporte aclara que excluye transferencias entre bancos.
- **Celdas/enlaces:** comprobantes enlazan respectivamente a `/payment/view/id/6`, `/payment/view/id/5`, `/payment/view/id/4`, `/income-payments/view/id/2`, `/income-payments/view/id/1` y `/payment/view/id/3`. Las demás celdas no se mostraron como enlaces.
- **Controles:** `Actualizar`, `Filtrar`, paginación. Iconos de descarga y compartir visibles; no se pulsaron. No se vio impresión.
- **Captura:** `08-reporte-transacciones.png`.

## 6. Compras

- **URL:** https://app.alegra.com/report/purchases
- **Filtros predeterminados:** `01/11/2026 - 30/11/2026`; `Proveedor` vacío. `Ítems por página`: 10.
- **Columnas, en orden:** Número de factura, Proveedor, Fecha, Antes de impuestos, Después de impuestos (la etiqueta de la interfaz aparece como `Despues de impuestos`).
- **Totales/detalle:** antes de impuestos **RD$39,000.00**; después de impuestos **RD$46,020.00**. Una fila: B0100000050, [supplier name redacted], 13/11/2026, RD$39,000.00 y RD$46,020.00. Paginación 1–1 de 1.
- **Celdas/enlaces:** B0100000050 → https://app.alegra.com/bill/view/id/1. Las demás celdas no se mostraron como enlaces.
- **Controles:** `Actualizar`, `Filtrar`, `Descargar` (no pulsado); no se vio imprimir ni compartir.
- **Captura:** `08-reporte-compras.png`.

## 7. Reporte anual

- **URL:** https://app.alegra.com/report/annual?year=2026
- **Filtros/estado:** el valor inicial era `Año: 2025`; se cambió a **2026** para incluir el 13/11/2026 y se actualizó el reporte. Comparar con año anterior está activado (2025). En el gráfico principal, la periodicidad predeterminada es `Mensual`; el menú ofrece `Mensual` y `Diario`.
- **Totales/resumen 2026:** promedio mensual de ventas **RD$1,541.67**; promedio semanal **RD$355.77**; promedio diario **RD$51.39**; ventas **RD$18,500.00**; costos y gastos **RD$12,150.00**; utilidad neta **RD$6,350.00**; margen neto **34.32%**. El gráfico de ventas dice que las ventas netas (ventas menos devoluciones) fueron RD$18,500.00 y aumentaron 0.00% frente a 2025.
- **Tarjetas y vistas:**
  - `Productos/Servicios más vendidos` — suma RD$18,500.00 (100.00%). Alterna gráfico/tabla. Tabla: Producto/servicio | Valor (2026) | Participación; Varilla 3/8 RD$7,600.00 (41.08%), Cemento gris 42.5kg RD$6,500.00 (35.14%), Pintura galón RD$2,900.00 (15.68%), Tubo PVC 1/2 RD$1,500.00 (8.11%).
  - `Mejores vendedores` — sin vendedores destacados; ofrece `Registrar venta`.
  - `Mejores clientes` — suma RD$18,500.00 (100.00%). Alterna gráfico/tabla. Tabla: Cliente | Valor (2026) | Participación; [client name redacted] RD$14,100.00 (76.22%), [client name redacted] RD$4,400.00 (23.78%).
  - `Principales gastos` — RD$1,050.00, equivalente a 5.68% de las ventas. Alterna gráfico/tabla. Tabla: Concepto | Valor (2026) | Participación; Gastos generales RD$1,050.00 (100.00%).
- **Celdas/enlaces:** los títulos de tarjetas enlazan a rangos del año 2026: Total de ventas → `/report/sales/from/2026-01-01/to/2026-12-31`; Productos/Servicios más vendidos → `/report/sales-by-item/from/2026-01-01/to/2026-12-31`; Mejores vendedores → `/report/sales-by-seller/from/2026-01-01/to/2026-12-31`; Mejores clientes → `/report/sales-by-client/from/2026-01-01/to/2026-12-31`; Principales gastos → `/report/income-and-expense/from/2026-01-01/to/2026-12-31`. `Registrar venta` enlaza a `/invoice/add`. Las celdas de las tablas no se mostraron como enlaces.
- **Controles:** `Actualizar`, selector de año, comparación con año anterior, `Ver más/Ver menos`, periodicidad, pestañas gráfico/tabla. `Compartir` visible pero no pulsado; no se vio descarga ni impresión.
- **Capturas:** `08-reporte-reporte-anual.png`, `08-reporte-reporte-anual-graficas.png`, `08-reporte-reporte-anual-diario.png`, `08-reporte-reporte-anual-resumen-expandido.png`, y las vistas de tabla `08-reporte-reporte-anual-{productos-tabla,clientes-tabla,gastos-tabla}.png`.

**Acceso por plan:** ninguno de los siete reportes apareció bloqueado por plan.
