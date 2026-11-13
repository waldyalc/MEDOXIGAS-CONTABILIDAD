# Alegra — reportes de Ventas

**Cuenta activa:** el selector de empresa de la cabecera mostraba `Fiel Fe…` (nombre truncado por la interfaz), consistente con **Fiel Ferreteria**; no mostraba ninguna empresa Medoxigas. No se cambió de empresa. El recorrido fue de solo lectura: no se creó, editó ni eliminó ningún documento; no se pulsaron Descargar, Compartir, Exportar, Enviar al cliente ni controles que envíen mensajes. No se abrieron Más soluciones, POS, Nómina, planes ni facturación, ni configuraciones e-CF/DGII.

Las vistas se revisaron en el orden de la categoría Ventas. Los periodos predeterminados incluyen el 13/11/2026; los dos selectores por cliente/almacén se usaron solo donde se indica. Los enlaces de celdas se leyeron en la interfaz y no se abrieron.

## 1. Ventas generales

- **URL:** https://app.alegra.com/report/sales
- **Filtros predeterminados:** periodo `01/11/2026 - 30/11/2026`; `Almacén` sin selección (la lista ofrecía `Principal`); `Numeración` sin selección (opciones: Comprobante para exportación (16), Consumo (02), Crédito fiscal (01), Gubernamentales (15), Numeración notas crédito (04), Numeración notas débito en ingresos (03), Régimen especial de tributación (14)); `Más filtros` sin condiciones; búsqueda vacía. `Ítems por página`: 10. Gráfico `Diario` seleccionado; alternativa `Mensual`.
- **Columnas, en orden:** Documento, Cliente, Estado, Creación, Subtotal, Descuento, Antes de impuestos, Impuestos, Después de impuestos.
- **Totales:** Ventas brutas **RD$18,500.00**; Notas crédito **RD$0.00**; Antes de impuestos **RD$18,500.00**; Impuestos **RD$3,330.00**; Después de impuestos **RD$21,830.00**. La tabla no muestra una fila total. Filas: B0100000001 — Constructora Prueba SRL, Por cobrar, 13/11/2026, RD$14,100.00, RD$0.00, RD$14,100.00, RD$2,538.00, RD$16,638.00; B0200000001 — [client name redacted], Cobrada, 13/11/2026, RD$4,400.00, RD$0.00, RD$4,400.00, RD$792.00, RD$5,192.00.
- **Celdas/enlaces:** B0100000001 → https://app.alegra.com/invoice/view/id/1; B0200000001 → https://app.alegra.com/invoice/view/id/2. Las otras celdas de datos no se mostraron como enlaces.
- **Controles visibles:** `Actualizar`, `Filtrar`, personalización (icono de ajustes), icono de compartir y `Descargar`; no se vio botón de impresión. Pestañas del gráfico `Diario`/`Mensual`; no se pulsaron los controles de descarga ni compartir.
- **Capturas:** `08-reporte-ventas-generales.png`, `08-reporte-ventas-generales-mensual.png`.

## 2. Ventas por producto/servicio

- **URL:** https://app.alegra.com/report/sales-by-item
- **Filtros predeterminados:** `Periodo*` (obligatorio) `01/11/2026 - 30/11/2026`; búsqueda/filtro de tabla sin condiciones; resultados por página: 20.
- **Columnas, en orden:** Producto/servicio, Referencia, Número de productos/servicios, Antes de impuestos, Después de impuestos.
- **Totales:** Antes de impuestos **RD$18,500**; Después de impuestos **RD$21,830**. No hay fila total en la tabla. Detalle: Varilla 3/8 — 20.00, RD$7,600, RD$8,968; Cemento gris 42.5kg — 10.00, RD$6,500, RD$7,670; Tubo PVC 1/2 — 10.00, RD$1,500, RD$1,770; Pintura galón — 2.00, RD$2,900, RD$3,422. Referencias vacías.
- **Celdas/enlaces:** las celdas de producto y valores no se mostraron como enlaces.
- **Controles visibles:** `Generar Reporte`, `Filtrar`, `Descargar` y dos botones de icono sin texto (personalización y compartir); no se vio botón de impresión. No se pulsó `Descargar` ni compartir.
- **Captura:** `08-reporte-ventas-por-producto-servicio.png`.

## 3. Ventas por cliente

- **URL:** https://app.alegra.com/report/sales-by-client/from/2026-11-01/to/2026-11-30
- **Filtros predeterminados:** periodo `01/11/2026 - 30/11/2026`; `Buscar cliente` vacío; `Ítems por página`: 10.
- **Columnas, en orden:** Cliente, Número de ventas, Subtotal, Descuentos, Devoluciones, Antes de impuestos, Impuestos, Después de impuestos.
- **Totales/detalle:** no se muestra fila total. Suma de las dos filas: Antes de impuestos **RD$18,500.00**, Impuestos **RD$3,330.00**, Después de impuestos **RD$21,830.00**. Constructora Prueba SRL — 1 venta, RD$14,100.00, RD$0.00, RD$0.00, RD$14,100.00, RD$2,538.00, RD$16,638.00; [client name redacted] — 1 venta, RD$4,400.00, RD$0.00, RD$0.00, RD$4,400.00, RD$792.00, RD$5,192.00. Los gráficos muestran mejores clientes por ingresos y por número de ventas.
- **Celdas/enlaces:** Constructora Prueba SRL → https://app.alegra.com/client/view/id/5; [client name redacted] → https://app.alegra.com/client/view/id/6.
- **Controles visibles:** `Actualizar`, `Descargar`, iconos de personalización y compartir; no se vio botón de impresión. También aparece `Ayuda`. No se pulsaron los controles de descarga ni compartir.
- **Captura:** `08-reporte-ventas-por-cliente.png`.

## 4. Rentabilidad por producto/servicio

- **Nombre mostrado:** la categoría lo lista como `Rentabilidad por producto`; el encabezado del reporte dice `Rentabilidad por producto/servicio` (título de pestaña: `Rentabilidad por producto`).
- **URL:** https://app.alegra.com/report/items-profit
- **Filtros predeterminados:** periodo `01/11/2026 - 30/11/2026`; sin otros filtros seleccionados; `Ítems por página`: 10.
- **Columnas, en orden:** Producto/servicio, Referencia, Total vendido, Costo total, Rentabilidad total, Porcentaje.
- **Totales:** Total vendido **RD$18,500.00**; Costo total **RD$11,100.00**; Rentabilidad total **RD$7,400.00**. Filas: Cemento gris 42.5kg — `-`, RD$6,500.00, RD$3,900.00, RD$2,600.00, 40%; Varilla 3/8 — `-`, RD$7,600.00, RD$4,560.00, RD$3,040.00, 40%; Tubo PVC 1/2 — `-`, RD$1,500.00, RD$900.00, RD$600.00, 40%; Pintura galón — `-`, RD$2,900.00, RD$1,740.00, RD$1,160.00, 40%.
- **Celdas/enlaces:** Cemento gris 42.5kg → https://app.alegra.com/item/view/id/2; Varilla 3/8 → https://app.alegra.com/item/view/id/3; Tubo PVC 1/2 → https://app.alegra.com/item/view/id/4; Pintura galón → https://app.alegra.com/item/view/id/5.
- **Controles visibles:** `Actualizar`, `Filtrar`, `Personalizar`, `Descargar`; no se vieron compartir ni imprimir. No se pulsó `Descargar`.
- **Captura:** `08-reporte-rentabilidad-por-producto.png`.

## 5. Ventas por vendedor

- **URL:** https://app.alegra.com/report/sales-by-seller
- **Filtros predeterminados:** periodo `01/11/2026 - 30/11/2026`; `Todos los vendedores`; `Almacén` sin selección. El periodo incluye el 13/11/2026.
- **Columnas y totales:** no hay tabla ni columnas: la vista indica `No encontramos ventas que coincidan con tu búsqueda` y no muestra totales ni filas.
- **Celdas/enlaces:** no había filas de datos enlazables.
- **Controles visibles:** `Actualizar`, personalización (icono de ajustes), icono de compartir y `Descargar`; no se vio impresión. No se pulsaron los controles de descarga ni compartir.
- **Captura:** `08-reporte-ventas-por-vendedor.png`.

## 6. Estado de cuenta por cliente

- **URL:** https://app.alegra.com/report/client-statement?idClient=5
- **Filtros:** se seleccionó `Constructora Prueba SRL` como requiere este reporte; `Corte al 13/11/2026`; `Estado de vencimiento` inicialmente sin selección (opciones: Sin vencer, Vencidas: 1 a 30 días, Vencidas: 31 a 60 días, Vencidas: 61 a 90 días, Vencidas: Más de 91 días). `Buscar documento` vacío; `Ítems por página`: 10. Se guardó además la vista alternativa `Sin vencer`.
- **Columnas, en orden:** Documento, Creación, Vencimiento, Antigüedad, Días vencidos, Estado, Moneda, Total, Retenido, Cobrado, Saldo, columna de acción sin encabezado.
- **Totales:** Total en ventas **RD$16,638.00 DOP**; Retenciones **RD$0.00 DOP**; Total cobrado **RD$8,000.00 DOP**; Saldo por cobrar **RD$8,638.00 DOP**. Una fila: B0100000001 (Factura), creada 13/11/2026, vence 13/12/2026, antigüedad 0, días vencidos 0, Pendiente, DOP, total RD$16,638.00, retenido RD$0.00, cobrado RD$8,000.00, saldo RD$8,638.00. La alternativa `Sin vencer` muestra la misma fila y los mismos totales.
- **Celdas/enlaces:** B0100000001 → https://app.alegra.com/invoice/view/id/1.
- **Controles visibles:** `Actualizar`, `Filtrar`, personalización (icono de ajustes), descarga (icono) y `Enviar al cliente`; no se usó ninguno de los controles de descarga ni el de envío. No se vio impresión ni compartir.
- **Capturas:** `08-reporte-estado-de-cuenta-por-cliente.png`, `08-reporte-estado-de-cuenta-por-cliente-sin-vencer.png`.

## 7. Ventas por almacén

- **URL de la vista documentada:** https://app.alegra.com/report/sales-by-warehouse/from/2026-11-01/to/2026-11-30?idWarehouse=01a1cfac-cfe1-70bf-b863-7d648048edfb
- **Filtros:** periodo `01/11/2026 - 30/11/2026`; el valor predeterminado era `Todos los almacenes`. Se seleccionó `Principal` para detallar el almacén solicitado; búsqueda vacía; `Ítems por página`: 10. Gráfico `Diario` predeterminado y alternativa `Mensual`.
- **Columnas, en orden:** Documento, Cliente, Estado, Creación, Almacén, Centro de costos, Subtotal, Descuento, Antes de impuestos, Impuestos, Después de impuestos.
- **Totales:** Ventas brutas **RD$18,500.00**; Notas crédito **RD$0.00**; Antes de impuestos **RD$18,500.00**; Impuestos **RD$3,330.00**; Después de impuestos **RD$21,830.00**. La tabla no presenta fila total. Filas: B0200000001 — [client name redacted], Cobrada, 13/11/2026, Principal, centro de costos vacío, RD$4,400.00, RD$0.00, RD$4,400.00, RD$792.00, RD$5,192.00; B0100000001 — Constructora Prueba SRL, Por cobrar, 13/11/2026, Principal, centro de costos vacío, RD$14,100.00, RD$0.00, RD$14,100.00, RD$2,538.00, RD$16,638.00. Gráfico de productos por unidades: Varilla 3/8 20; Cemento gris 42.5kg 10; Tubo PVC 1/2 10; Pintura galón 2.
- **Celdas/enlaces:** B0200000001 → https://app.alegra.com/invoice/view/id/2; B0100000001 → https://app.alegra.com/invoice/view/id/1. Las otras celdas de datos no se mostraron como enlaces.
- **Controles visibles:** `Actualizar`, `Filtrar`, personalización (icono de ajustes), `Descargar`; pestañas `Diario`/`Mensual`. No se vieron compartir ni imprimir. No se pulsó `Descargar`.
- **Capturas:** `08-reporte-ventas-por-almacen.png`, `08-reporte-ventas-por-almacen-mensual.png`.

**Acceso por plan:** ninguno de estos siete reportes apareció bloqueado por plan.
