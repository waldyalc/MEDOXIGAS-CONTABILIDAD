# 06 — Alegra: compras, pago a proveedor y gasto menor

Empresa confirmada en el formulario: **Fiel Ferreteria**. Fecha usada: **13/11/2026**. Solo se guardaron comprobantes contables internos; no se emitió/activó e-CF, no se envió correo ni se ejecutó transferencia bancaria real.

## 1. Factura de proveedor
- Proveedor existente: Cementos Prueba SA (RNC/teléfono vacíos en el formulario).
- No.: **B0100000050**; fecha 13/11/2026; vencimiento 13/12/2026; estado al guardarse: por pagar.
- Almacén: Principal. Línea: Cemento gris 42.5kg, cantidad 100, costo RD$390, descuento 0%, ITBIS 18%. Subtotal RD$39,000; ITBIS RD$7,020; total RD$46,020.
- Obligatorios marcados (*): Proveedor, Creación, Vencimiento. Predeterminados: almacén Principal; fechas de creación y vencimiento = 13/11/2026; línea inicial cantidad 1, precio 0, descuento 0, impuesto Ninguno. Al seleccionar el ítem existente se rellenó costo RD$390 e ITBIS 18%, manteniendo cantidad 1.
- NCF: el formulario mostraba “Asignar NCF comprobante de compra” (desmarcado) y “No.”; se introdujo B0100000050 en No. No se mostró selector de tipo de comprobante ni campos explícitos 606 de tipo de gasto/bienes/servicios.
- No se observaron pestañas Productos/Cuentas contables: una tabla de conceptos/productos. “Personalizar opciones” solo ofrecía Almacén. También estaban Operación sujeta a proporcionalidad (desmarcada), Términos y condiciones y Notas.
- Asiento FP-1 (13/11/2026):
  - ITBIS a favor — Débito RD$7,020.00 — Crédito RD$0.00
  - Inventarios — Débito RD$39,000.00 — Crédito RD$0.00
  - Cuentas por pagar a proveedores nacionales — Débito RD$0.00 — Crédito RD$46,020.00
- Inventario: el historial muestra inicial 50; esta factura añadió 100 (saldo 150); otra factura de venta del mismo día restó 10; saldo actual 140. Sí hubo incremento bruto de 100 por la compra.

## 2. Pago a proveedor
- Comprobante de egreso No. 1, guardado como “Pago a factura”. Contacto Cementos Prueba SA; factura B0100000050; monto aplicado RD$46,020.00 (total); cuenta Banco 1; método Transferencia; fecha 13/11/2026; moneda DOP.
- Obligatorios (*): Cuenta bancaria, Fecha, Forma de pago y Moneda. Predeterminados: tipo Gasto, No. 1, fecha 13/11/2026, moneda DOP; renglón no asociado 0/1/Ninguno. Al seleccionar el contacto apareció Facturas pendientes y se aplicó el total a B0100000050.
- Asiento CE-1 (13/11/2026):
  - Cuentas por pagar a proveedores nacionales — Débito RD$46,020.00 — Crédito RD$0.00
  - Banco 1 — Débito RD$0.00 — Crédito RD$46,020.00
- Estado final de B0100000050: **Pagada**, pagado RD$46,020.00, por pagar RD$0.00. Esto fue un registro interno del pago, no una transferencia bancaria real.

## 3. Gasto menor
- Gasto menor No. B1300000001, fecha 13/11/2026, Caja chica, DOP, tipo de pago Contado. Categoría Combustibles y lubricantes, RD$500, impuesto Ninguno (0%), cantidad 1; observación “Transporte/combustible”; total RD$500.
- Obligatorios (*): Cuenta bancaria, Fecha, Moneda y el concepto/cuenta contable de la línea (al intentar guardar una línea sin concepto apareció “Requerido”). Valores por defecto: No. B1300000001, fecha actual, DOP, valor 0, cantidad 1; sin impuesto. No pidió NCF del proveedor; No. es la numeración interna B13.
- No se encontró campo/concepto de fondo o reposición de caja chica; solo selección de Cuenta bancaria (incluye Caja chica) y cuentas contables. Notas de egreso y Comentarios son opcionales; tras guardar el tipo figura Contado.
- Asiento CE-B1300000001 (13/11/2026):
  - Combustibles y lubricantes — Débito RD$500.00 — Crédito RD$0.00
  - Caja chica — Débito RD$0.00 — Crédito RD$500.00

### Gastos menores adicionales (sin capturas)
- B1300000002: “Café/agua”, cuenta Agua, Caja chica, RD$250.00, Ninguno (0%), cantidad 1, Contado. Asiento CE-B1300000002: Agua Débito RD$250.00; Caja chica Crédito RD$250.00.
- B1300000003: “Papelería”, cuenta Papelería, Caja chica, RD$300.00, Ninguno (0%), cantidad 1, Contado. Asiento CE-B1300000003: Papelería Débito RD$300.00; Caja chica Crédito RD$300.00.
- Rareza: “Comidas y entretenimiento” apareció como grupo no seleccionable y dio “Requerido”; se usó la cuenta hoja Agua. El primer intento no creó ningún comprobante.

## Capturas
- 06-compra-vacia.png, 06-compra-llena.png, 06-compra-guardada.png, 06-compra-asiento.png
- 06-pago-proveedor-vacio.png, 06-pago-proveedor-lleno.png, 06-pago-proveedor-asiento.png
- 06-gasto-menor-vacio.png, 06-gasto-menor-lleno.png, 06-gasto-menor-asiento.png
