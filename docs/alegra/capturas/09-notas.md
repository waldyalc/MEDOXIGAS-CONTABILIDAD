# Alegra links — read-only review (09)

## Scope and company check

- The active company is **Fiel Ferreteria**. The app's top selector is visually truncated to `Fiel Fe...`; the full company name is shown on the invoice and payment document headers.
- I only viewed records and reports. I did not create, edit, delete, send, share, or submit anything. I did not open Más soluciones, POS, or Nómina. A sharing/upgrade dialog was dismissed without sending anything.
- The examples are dated 13/11/2026; amounts are in DOP/RD$.

## Client: Constructora Prueba SRL

Main profile: customer, RNC 132456789; payment term De contado; accounting defaults shown as `Cuentas por cobrar clientes` and `Cuentas por pagar a proveedores nacionales`. Summary: Cuentas por cobrar **RD$8.638,0**; anticipos recibidos/entregados, por pagar, and unapplied credit/debit notes all **RD$0,0**.

The profile has these sections/tabs. The list screens show a Filtrar control; when present, the visible text box is noted. Lists have no grand-total footer; totals/balance below refer to document amounts and the profile summary. Empty tabs report zero records.

| Tab | Columns, in order | Visible filter | Result / totals and balance |
|---|---|---|---|
| Transacciones | Fecha, Detalle, Estado, Gastos, Ingresos | Filtrar | 1 row: 13/11/2026, `2, Facturas: B0100000001`, RD$8,000.00 income. No grand total; profile balance RD$8.638,0. The date link opens `/income-payments/view/id/2`. |
| Facturas | Número, Creación, Vencimiento, Total, Cobrado, Por cobrar, Estado de emisión, Estado, Acciones | Número text box + Filtrar | B0100000001, 13/11/2026, due 13/12/2026; total RD$16,638.00, collected RD$8,000.00, receivable RD$8,638.00; `No electrónico`, `Por cobrar`. |
| Facturas de proveedor | Número, Creación, Vencimiento, Total, Pagado, Por pagar, Acciones | Número text box + Filtrar | No rows (1-0 de 0). |
| Devoluciones en ventas | Número, Fecha, Total, Por aplicar, Acciones | Número text box + Filtrar | No rows. |
| Notas débito | Número, Fecha, Total, Por aplicar, Acciones | Número text box + Filtrar | No rows. |
| Cotizaciones | Número, Creación, Estado, Total, Acciones | Número text box + Filtrar | One quote, number 1, 13/11/2026, `Sin facturar`, RD$16,638.00. |
| Remisiones | Número, Creación, Vencimiento, Estado, Total, Acciones | Número text box + Filtrar | No rows. |
| Órdenes de compra | Código, Fecha, Plazo de pago, Estado, Total, Acciones | Código text box + Filtrar | No rows. |
| Comprobantes contables | Número, Fecha, Referencia, Observaciones, Débito, Crédito, Acciones | Número text box + Filtrar | No rows. |

### Client statement of account

`Más acciones` → `Ver estado de cuenta` opens `https://app.alegra.com/report/client-statement?idClient=5`. The report filters are client, cutoff date (13/11/2026), and aging status; there is also `Buscar documento` + `Filtrar`. Columns: Documento, Creación, Vencimiento, Antigüedad, Días vencidos, Estado, Moneda, Total, Retenido, Cobrado, Saldo, actions. For B0100000001: total RD$16,638.00; retained RD$0.00; collected RD$8,000.00; balance RD$8,638.00; pending; 0 days overdue at the cutoff. Statement totals: sales RD$16,638.00; retentions RD$0.00; collected RD$8,000.00; receivable RD$8,638.00. The download menu offers **Descargar Excel** and **Descargar PDF**. No separate statement-print button was identified; the PDF is printable. Nothing was sent to the client.

## Supplier: Cementos Prueba SA

The contact is marked as both client and supplier. Profile summary cards show RD$0,0 for receivable, advances, payable, and unapplied notes. Accounting defaults shown: `Cuentas por cobrar clientes` and `Cuentas por pagar a proveedores nacionales`.

| Section | Columns, in order | Visible filter | Result / totals and balance |
|---|---|---|---|
| Facturas de proveedor (purchases) | Número, Creación, Vencimiento, Total, Pagado, Por pagar, Acciones | Número text box + Filtrar | B0100000050, 13/11/2026, due 13/12/2026; total RD$46,020.00, paid RD$46,020.00, payable RD$0.00. |
| Transacciones | Fecha, Detalle, Estado, Gastos, Ingresos | Filtrar | One row, 13/11/2026, `1, Facturas de proveedor: B0100000050`, RD$46,020.00 expense and RD$0.00 income. No separate payment row appears in this contact transaction list. |

There is no separate Pagos tab on this contact profile. The paid amount and linked CE-1 are visible on the supplier bill's `Pagos` section and on the payment record described below.

## Product: Cemento gris 42.5kg

- Code 2; product / inventory item active; unit `Unidad`; warehouse `Principal`.
- Stock: total 140; warehouse table shows initial 50, current 140, blank minimum/maximum, 0 in conduces.
- Selling price: RD$650 before tax; ITBIS 18%; total price RD$767.00. Price list `General` is RD$650.
- Unit cost RD$390. Accounting accounts are clickable on the product record: Sales → `/category/view/id/5124`; Inventory → `/category/view/id/5037`; Cost of inventory → `/category/view/id/5135`.
- Related-document tabs have a `Filtrar` control and result pagination. **Facturas de venta** columns: Número, Cliente, Creación, Vencimiento, Total, Pagado, Por cobrar, Estado, Acciones. It lists B0100000001, Constructora Prueba SRL, 2026-11-13, total RD$16,638, paid RD$8,000, receivable RD$8,638, Por cobrar.
- **Facturas de compras** columns: Número, Proveedor, Creación, Vencimiento, Total, Pagado, Por pagar, Acciones. It lists B0100000050, Cementos Prueba SA, 2026-11-13, total RD$46,020, paid RD$46,020, payable RD$0.
- Notas de crédito, Notas débito, Cotizaciones, Remisiones, Órdenes de compra, and Transferencias de bodegas were empty (`No hay contenido disponible`). No other invoices/purchases were listed.
- `Historial de operaciones` downloads an Excel history. It shows initial 50 units at RD$390 (RD$19,500); supplier bill B0100000050 on 13/11/2026 adds 100 at RD$390 (RD$39,000), bringing stock to 150; sale invoice B0100000001 on 13/11/2026 removes 10 at average cost RD$390 (RD$3,900), leaving 140 at RD$390 (RD$54,600). Thus the history gives document, date, and quantity; the sales/purchase rows separately identify customer/supplier.

## Invoice and payment links

### Sale invoice B0100000001

- Client name **Constructora Prueba SRL** is a link to `/client/view/id/5`.
- **Cemento gris 42.5kg** is a link to `/item/view/id/2` (10 units at RD$650); Varilla 3/8 also links to `/item/view/id/3`.
- `Pagos asociados` shows 13/11/2026, RD$8,000.00, receipt number `2`, Transferencia, status Abierto. The receipt-number cell is plain text, not a link; clicking it did not change the URL. On the client Transacciones tab, the date link does open `/income-payments/view/id/2`.
- I opened the invoice's dots menu: it has edit, PDF/print, credit/debit note, advance, recurring, clone, versions, close without payment, retentions, and void actions; there is no `Ver asiento`. The `Contabilidad` tab was empty in this invoice view.

### Supplier invoice B0100000050 (internal entry FP-1)

- **Cementos Prueba SA** links to `/client/view/id/8`; **Cemento gris 42.5kg** links to `/item/view/id/2`.
- Bill date 13/11/2026; 100 units × RD$390 = RD$39,000, ITBIS RD$7,020, total RD$46,020. Paid RD$46,020; payable RD$0.
- Its `Pagos` section lists a 13/11/2026 payment by Transferencia for RD$46,020. The date link opens `/payment/view/id/3`; the comprobante number `1` is plain text.
- `Contabilidad` shows **Asiento contable FP-1** and an `Imprimir` link to `/ledger/print/id/1/document/bill`; the account names/codes in this bill accounting table are links to category records.

### Supplier payment CE-1

- Payment page is `/payment/view/id/3` (page title `Pago a factura`, document No. 1); the report identifies it as CE-1.
- Supplier Cementos Prueba SA links to `/client/view/id/8`. The associated invoice B0100000050 links to `/bill/view/id/1`.
- Date 13/11/2026; transfer from Banco 1; total and amount applied RD$46,020.00. The page has an `Imprimir` link to `/transaction/print/id/3`. The account name `Banco 1` is text, not a link.

## Report-row navigation

I checked Libro diario (`/report/ledger-journals`) for November 2026. Filters shown: date range and `Tipo de registro`; table columns in order are Asiento, Estado, Fecha, Tercero, Código, Cuenta contable, Centro de costo, Débito, Crédito. The **CE-1 document cell is clickable**, with href `https://reports-api-v3.alegra.com/api/v2/reports/redirect-resource?idJournal=1283095071`; clicking it kept the app on Libro diario and did not open an Alegra record page. In this report, third-party/client names and account names are plain text, not links. The report has a Descargar control.

## Captures and saved export

All files below are in `/workspace/contab-repo/docs/alegra/capturas/`:

- Client: `09-ficha-cliente.png`, `09-ficha-cliente-transacciones.png`, `09-ficha-cliente-facturas.png`, `09-ficha-cliente-facturas-de-proveedor.png`, `09-ficha-cliente-devoluciones-en-ventas.png`, `09-ficha-cliente-notas-debito.png`, `09-ficha-cliente-cotizaciones.png`, `09-ficha-cliente-remisiones.png`, `09-ficha-cliente-ordenes-de-compra.png`, `09-ficha-cliente-comprobantes-contables.png`, `09-ficha-cliente-estado-de-cuenta.png`.
- Supplier: `09-ficha-proveedor.png`, `09-ficha-proveedor-compras.png`, `09-ficha-proveedor-transacciones.png`.
- Product: `09-ficha-producto.png`, `09-ficha-producto-facturas-de-venta.png`, `09-ficha-producto-facturas-de-compras.png`, `09-ficha-producto-notas-de-credito.png`, `09-ficha-producto-notas-debito.png`, `09-ficha-producto-cotizaciones.png`, `09-ficha-producto-remisiones.png`, `09-ficha-producto-ordenes-de-compra.png`, `09-ficha-producto-transferencias-bodegas.png`, plus `09-historial-producto.xlsx`.
- Documents and report: `09-factura-enlaces.png`, `09-factura-pagos-asociados.png`, `09-factura-proveedor-enlaces.png`, `09-factura-proveedor-pagos.png`, `09-pago-proveedor-enlaces.png`, `09-reporte-libro-diario-enlaces.png`.
