# Alegra — Reportes Contables (08)

**Empresa activa:** Fiel Ferreteria (confirmada; el encabezado de la app muestra “Fiel Fe…” y el nombre completo figura en el archivo local descargado por la acción Descargar). No se abrió Más soluciones, POS ni Nómina.  
**Contexto de fechas:** viernes 13/11/2026. Las vistas consultadas usan noviembre de 2026 o el corte al 13/11/2026, de modo que incluyen la fecha solicitada.  
**Capturas:** capturas de pantalla del área visible, guardadas en esta carpeta. No se enviaron correos ni se compartió nada.

## Página de inicio de Reportes

Captura: `08-reportes-inicio.png`  
URL: https://app.alegra.com/report

Categorías y reportes, en el orden mostrado:

- **Ventas (7):** Ventas generales; Ventas por producto/servicio; Ventas por cliente; Rentabilidad por producto; Ventas por vendedor; Estado de cuenta por cliente; Ventas por almacén.
- **Administrativos (7):** Cuentas por cobrar; Cuentas por pagar; Ingresos y compras; Valor de inventario; Transacciones; Compras; Reporte anual.
- **Financieros (1):** Flujo de caja.
- **Contables (9):** Estado de resultados; Estado de situación financiera; Estado de flujo de efectivo; Libro diario; Auxiliar por tercero; Balanza de comprobación; Movimientos por cuenta contable; Movimientos por cuenta contable agrupado; Balanza de comprobación por tercero.
- **Fiscales (8):** Reporte 606; Reporte 607; Reporte 608; Reporte IT1; Reporte detallado de impuestos; Impuestos y retenciones; Reporte IR-17; Cartas de retención.
- **Para trabajar (2):** Exportar facturas; Informe contador.

## Contables — detalle (en el orden de la página)

### 1. Estado de resultados

Captura: `08-reporte-estado-de-resultados.png`  
URL: https://app.alegra.com/report/profit-and-loss

**Filtros / valores:** Fecha = Este mes, 01/11/2026–30/11/2026; Centro de costos = ninguno (el selector no muestra resultados); Vista = Reporte detallado; Buscar cuenta contable = vacío. La fecha incluye 13/11/2026.

**Columnas (orden):** Cuenta contable; Nov, 2026; % de Ingresos; Nov, 2025; % de Ingresos; Var. Absoluta; Var. Relativa (%).

**Totales/subtotales principales:** Ingresos de actividades ordinarias RD$18,500.00 (Ventas RD$18,500.00; Devoluciones RD$0.00); Costos de ventas y operación -RD$11,100.00 (mercancía vendida -RD$11,100.00; servicios RD$0.00); **Utilidad bruta RD$7,400.00**. Gastos generales -RD$1,050.00, desglosados en Servicios públicos -RD$250.00, Artículos de oficina -RD$300.00 y Combustibles y lubricantes -RD$500.00. **Utilidad operativa RD$6,350.00; utilidad antes de impuestos RD$6,350.00; impuestos RD$0.00; utilidad/pérdida neta RD$6,350.00.** Periodo comparativo 2025 = RD$0.00; la variación relativa aparece como 0% cuando la base es cero.

**Exportar/imprimir:** control de personalización con icono; `Descargar` abrió las opciones `Descargar Excel` y `Descargar PDF` (no se eligió ninguno). No se observó botón de impresión con etiqueta.

### 2. Estado de situación financiera

Captura: `08-reporte-estado-de-situacion-financiera.png`  
URL: https://app.alegra.com/report/general-balance

**Filtros / valores:** Hasta = 13/11/2026; Vista = Reporte detallado; Buscar cuenta contable = vacío. El corte corresponde al día solicitado.

**Columnas (orden):** Cuenta contable; 13 Nov, 2026; Análisis vertical; 13 Nov, 2025; Análisis vertical; Var. Absoluta; Var. Relativa (%).

**Totales/subtotales:** Total activos RD$101,388.00 (activos corrientes RD$101,388.00; activos no corrientes RD$0.00). Entre los saldos no nulos: efectivo y equivalentes -RD$39,070.00; deudores comerciales RD$8,638.00; activos por impuestos corrientes RD$7,020.00; inventarios RD$124,800.00. Total pasivos -RD$1,862.00 (obligaciones financieras corrientes -RD$5,192.00; pasivos por impuestos corrientes RD$3,330.00). Total patrimonio RD$103,250.00, incluido resultado del ejercicio RD$6,350.00 y ajustes iniciales en inventario RD$96,900.00. **Total pasivos + patrimonio RD$101,388.00.** Comparativo 2025 = RD$0.00.

**Exportar/imprimir:** botón `Descargar`; no se activó.

### 3. Estado de flujo de efectivo

Captura: `08-reporte-estado-de-flujo-de-efectivo.png`  
URL: https://app.alegra.com/report/statement-of-cash-flows?from=2026-11-01&to=2026-11-30

**Filtros / valores:** Fecha = Este mes, 01/11/2026–30/11/2026; Buscar cuenta contable = vacío. Método indirecto. El reporte indicó que hay 2 conceptos sin cuentas contables asociadas: Depreciaciones, amortizaciones y desvalorizaciones e Inversiones financieras.

**Columnas (orden):** Concepto; Nov, 2026; Análisis vertical; Oct, 2026; Análisis vertical; Var. Absoluta; Var. Relativa (%).

**Totales/subtotales:** Utilidad neta RD$6,350.00; total efectivo generado en actividades de operación -RD$130,778.00 (incluye deudores -RD$8,638.00, inventarios -RD$124,800.00, otros activos corrientes -RD$7,020.00 y otros pasivos corrientes RD$3,330.00); total actividades de inversión RD$0.00; total actividades de financiación RD$91,708.00 (obligaciones financieras -RD$5,192.00 y capital RD$96,900.00). **Aumento/disminución de efectivo -RD$39,070.00; efectivo inicial RD$0.00; efectivo final -RD$39,070.00; saldo del Estado de Situación Financiera -RD$39,070.00; diferencia RD$0.00.**

**Exportar/imprimir:** botones `Personalizar` y `Descargar`; no se eligieron.

### 4. Libro diario

Captura: `08-reporte-libro-diario.png`  
URL: https://app.alegra.com/report/ledger-journals/from/2026-11-01/to/2026-11-30

**Filtros / valores:** Fecha = 01/11/2026–30/11/2026; Tipo de registro = sin tipos seleccionados (por defecto se incluyen todos). Opciones del selector: Ajustes de inventario; Bancos; Comprobantes contables; Comprobantes de egreso; Facturas de proveedor; Facturas de venta; Items; Notas crédito; Notas débito; Recibos de caja. Ítems por página = 10.

**Columnas (orden):** selección; Asiento; Estado; Fecha; Tercero; Código; Cuenta contable; Centro de costo; Débito; Crédito.

**Totales/subtotales:** no aparece una fila agregada de total/subtotal; el paginador indica 1–10 de 21. En la primera página, los movimientos visibles son del 13/11/2026.

**Exportar/imprimir:** botón `Descargar`; el encabezado descriptivo menciona consulta/descarga/impresión, pero no se vio un botón de impresión separado.

### 5. Auxiliar por tercero

Captura: `08-reporte-auxiliar-por-tercero.png`  
URL: https://app.alegra.com/report/subsidiary-ledger-by-client

**Filtros / valores:** Tercero = vacío por defecto (obligatorio para generar la vista); Fecha = Este mes, 01/11/2026–30/11/2026; Cuenta contable = sin selección/todas. Para mostrar datos del test se seleccionó **Juan Pérez**; el valor predeterminado del tercero seguía siendo ninguno.

**Columnas (orden):** Cuenta contable; Tercero; Saldo anterior; Débito; Crédito; Neto; Saldo final.

**Totales/subtotales:** no se muestra total general; 1–4 de 4 cuentas para Juan Pérez. Cuentas por cobrar clientes: saldo anterior RD$0.00, débito RD$5,192.00, crédito RD$5,192.00, neto/saldo final RD$0.00. Tarjeta de crédito empresarial: débito RD$5,192.00, crédito RD$0.00, neto/saldo final -RD$5,192.00. ITBIS por pagar: débito RD$0.00, crédito RD$792.00, neto/saldo final RD$792.00. Ventas: débito RD$0.00, crédito RD$4,400.00, neto/saldo final RD$4,400.00.

**Exportar/imprimir:** botón `Descargar` (inactivo hasta seleccionar tercero; habilitado al seleccionar Juan Pérez). No se activó.

### 6. Balanza de comprobación

Captura: `08-reporte-balanza-de-comprobacion.png`  
URL: https://app.alegra.com/report/general-ledger

**Filtros / valores:** Fecha = 01/11/2026–30/11/2026; Buscar cuenta contable = vacío; Cierre anual = desactivado; Cuentas con saldos en cero = desactivado.

**Columnas (orden):** Cuenta contable; Saldo inicial (Débito, Crédito); Movimientos (Débito, Crédito); Saldo final (Débito, Crédito).

**Totales/subtotales:** fila Total: saldo inicial RD$0.00/RD$0.00; movimientos RD$236,112.00/RD$236,112.00; saldo final RD$115,400.00/RD$115,400.00. Subtotales relevantes: Activos RD$172,750.00 débito/RD$71,362.00 crédito en movimientos, saldo final RD$101,388.00 débito; Pasivos RD$51,212.00/RD$49,350.00, saldo final RD$1,862.00 débito; Patrimonio RD$96,900.00 crédito. Ingresos RD$18,500.00 crédito; Costos RD$11,100.00 débito; Gastos RD$1,050.00 débito.

**Exportar/imprimir:** botón `Descargar`; no se activó.

### 7. Movimientos por cuenta contable

Captura: `08-reporte-movimientos-por-cuenta-contable.png`  
URL de vista con datos: https://app.alegra.com/report/ledger-journal-categories/from/2026-11-01/to/2026-11-30?category_id=5124

**Filtros / valores:** Fecha = Este mes, 01/11/2026–30/11/2026; Cuenta contable = ninguna por defecto (se eligió Ventas para consultar datos); campo Asiento = vacío. El filtro adicional ofrece Tipo de documento, Fecha, Tercero y Cuenta contable, sin valores aplicados.

**Columnas (orden):** Tipo de documento; Fecha; Asiento; Estado; Tercero; Código contable; Cuenta contable; Saldo inicial; Débito; Crédito; Movimiento neto; Saldo final.

**Totales/subtotales:** tarjetas de resumen: saldo inicial RD$0.00; débito RD$0.00; crédito RD$18,500.00; movimiento neto RD$18,500.00; saldo final RD$18,500.00. Dos facturas: RD$4,400.00 (Juan Pérez) y RD$14,100.00 (Constructora Prueba SRL); total de la tabla: crédito RD$18,500.00 y movimiento neto RD$18,500.00.

**Exportar/imprimir/compartir:** botones visibles `Personalizar`, `Compartir`, `Descargar`. No se usó Compartir ni se envió correo. Al abrir `Descargar` se produjo una descarga local Excel (no por correo): `/home/box/Downloads/Alegra - Movimientos por cuenta contable - Fiel Ferreteria - 13_11_2026.xlsx`.

### 8. Movimientos por cuenta contable agrupado

Captura: `08-reporte-movimientos-por-cuenta-contable-agrupado.png`  
URL de vista con datos: https://app.alegra.com/report/ledger-journal-categories-grouped/from/2026-11-01/to/2026-11-30?category_id=5122&groupBy=category-only

**Filtros / valores:** Fecha = Este mes, 01/11/2026–30/11/2026; Cuenta contable = ninguna por defecto (se eligió el grupo Ingresos, mostrado como “Ingresos, +9”, para consultar datos); Agrupar por = Cuenta contable (predeterminado); Tercero = ninguno/todos por defecto.

**Columnas (orden):** resumen agrupado: Cuenta contable; Saldo inicial; Débito; Crédito; Movimiento neto; Saldo final. Detalle: Asiento; Fecha; Estado; Tercero; Código contable; Cuenta contable; Tipo de documento; Débito; Crédito; Movimiento neto.

**Totales/subtotales:** cuenta Ventas: saldo inicial RD$0.00; débito RD$0.00; crédito RD$18,500.00; movimiento neto RD$18,500.00; saldo final RD$18,500.00. Dos facturas: Juan Pérez RD$4,400.00 y Constructora Prueba SRL RD$14,100.00; total RD$18,500.00.

**Exportar/imprimir/compartir:** botones visibles `Personalizar`, `Compartir`, `Descargar`; no se compartió ni se envió nada.

### 9. Balanza de comprobación por tercero

Captura: `08-reporte-balanza-de-comprobacion-por-tercero.png`  
URL: https://app.alegra.com/report/category/accounting (formulario Excel abierto desde la tarjeta)

La tarjeta muestra etiqueta **Excel**. Al abrirla aparece un formulario de exportación, no una tabla de vista previa; no se encontró bloqueo de plan ni requisito de pago. No se pulsó `Exportar`.

**Filtros / valores:** Periodo (obligatorio) = 01/11/2026–30/11/2026; Cuenta = vacío; Tercero = vacío; Incluir cuentas con saldos en cero = desactivado.

**Columnas/totales:** no hay tabla de resultados en el formulario; por tanto, no hay columnas ni totales/subtotales visibles.

**Exportar/imprimir:** botones `Cerrar` y `Exportar` (Excel).

## Observaciones de acciones

- No se crearon ni editaron documentos contables, no se envió correo, y no se compartió información.
- El único archivo exportado fue el XLSX local descrito en el reporte 7; no se envió por correo.
- Ninguno de los nueve reportes requirió un plan pagado o mostró bloqueo. El noveno es una exportación Excel-only con filtros, sin vista previa.
