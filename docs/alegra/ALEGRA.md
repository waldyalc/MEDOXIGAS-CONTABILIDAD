# Alegra: estudio para Medoxigas Contabilidad

Inspiración, no copia. Fuente: cuenta de prueba de Waldy (empresa "Fiel Ferreteria", RD), recorrida el 13 nov 2026.
Capturas en `capturas/`.

## 1. Mapa de menús (Alegra Contabilidad)

Base: https://app.alegra.com

### Ingresos
| Pantalla | URL | Qué tiene |
|---|---|---|
| Facturas de venta | /invoice | Buscar cliente, Filtrar, Nueva factura de venta, Más acciones. Columnas: # Interno, NCF/Número, Cliente, Creación, Vencimiento, Total, Por cobrar, Estado, acciones |
| Facturas recurrentes | /recurring-invoice | Crear factura recurrente |
| Pagos recibidos | /income-payments | Nuevo pago recibido |
| Notas de crédito | /credit-note | Filtrar, buscar |
| Notas de débito | /income-debit-note | Buscar cliente, Exportar, Nueva nota de débito |
| Cotizaciones | /estimate | Exportar, Nueva cotización |
| Conduces | /remission | Exportar, Nuevo conduce |

### Compras
| Pantalla | URL | Qué tiene |
|---|---|---|
| Facturas de proveedores | /bill | Columnas: Número, Proveedor, Creación, Vencimiento, Total, Pagado, Por pagar |
| Pagos / Gastos | /payment | Crear pago |
| Gastos menores | /minor-expense | Nuevo gasto menor (caja menor) |
| Pagos recurrentes | /recurring-payment | Crear pago recurrente |
| Notas de crédito en compras | /debit-note | Nueva nota de crédito |
| Órdenes de compra | /purchase-order | Columnas: Código, Contacto, Fecha, Plazo de pago, Estado, Total |
| Recepción de comprobantes | /stamp-document-received | Ligado a factura electrónica |

### Contactos
- /client. Pestañas Todos, Clientes, Proveedores. Papelera, Más acciones, Nuevo contacto. Columnas: Nombre o Razón social, Identificación, Teléfono, Tipo, Acciones.

### Inventario
| Pantalla | URL | Qué tiene |
|---|---|---|
| Productos y servicios | /item | Columnas: Nombre, Referencia, Precio, Descripción, Acciones; filtro Estado |
| Valor de inventario | /report/inventory | Descargar |
| Ajustes de inventario | /inventory-adjustment | Columnas: Número, Fecha, Almacén, Total ajustado, Observaciones |
| Gestión de productos | /item/items-management | Importar nuevos, Actualización masiva |
| Listas de precios | /price-list | Nombre, Principal, Tipo |
| Almacenes | /warehouse | Transferencia de almacenes, Nuevo almacén |
| Categorías | /item-category | Nueva categoría |
| Atributos | /item/attributes | Atributos, Variantes, Campos adicionales |

### Bancos
- Bancos y cajas /account: Transferir, Agregar banco. Columnas: Nombre, Tipo de cuenta, Número de cuenta, Saldo, Conciliación.
- Conciliaciones bancarias /conciliation: Nueva conciliación.

### Contabilidad
- Catálogo de cuentas /category (Exportar a Excel).
- Entrada de diario /ledger/documents (Nueva entrada de diario).
- Activos /fixed-assets.
- Libro diario /report/ledger-journals/from/AAAA-MM-DD/to/AAAA-MM-DD.
- Complementos contables /accounting: Cierre contable de resultados, Cartas de retención.

### Reportes (/report)
Categorías: Ventas (7), Administrativos (7), Financieros (1), Contables (9), Fiscales (8), Para trabajar (2), Favoritos.
- Administrativos: Cuentas por cobrar, Cuentas por pagar, Ingresos y compras, Valor de inventario, Transacciones, Compras, Reporte anual.
- Financieros: Flujo de caja.

### Configuración (/configuration)
- Empresa: Empresa, Usuarios, Mi perfil, Centros de costos, Monedas.
- Facturación: Términos de pago (/term), Numeraciones (/resolution), Configuración de documentos, Vendedores.
- Plantillas de impresión (/company/print-templates).
- Impuestos: Impuestos (/tax), Retenciones (/retention), Configuración de reportes fiscales, Configuración avanzada.
- Contabilidad: Actualizar registros contables, Configuraciones contables (/category/accounting-parameterization), Control de períodos contables (/closing-periods), Tipos de entrada de diario, Numeraciones contables.
- Notificaciones y correos, Inventario (campos adicionales, variantes), Integraciones, Historial, Suscripción.

## 2. Formulario de factura de venta (/invoice/add)

Pestañas: Factura convencional y Factura rápida.
Orden en pantalla, de arriba a abajo:
1. Logo y bloque de la empresa arriba a la izquierda; comprobante y NCF arriba a la derecha, con botón "Configurar numeración".
2. Tipo de comprobante: Crédito fiscal (01), Consumo (02), Régimen especial (14), Gubernamentales (15), Exportación (16).
3. Ajustes: Moneda, Vendedor, Almacén, Centro de costo, Lista de precios, plantilla de impresión.
4. Cliente*, Fecha de creación*, Fecha de vencimiento*.
5. Líneas: Producto o servicio, Cantidad, Precio, Descuento %, Impuesto, Subtotal; Agregar línea.
6. Retenciones (Agregar retención) y totales: Subtotal, Descuento, Impuestos, Total.
7. Plegables: Notas, Términos y condiciones, Pie de factura.
8. Pago recibido dentro de la factura: Numeración, Fecha, Cuenta bancaria, Método de pago, Valor.
9. Botones Vista previa y Guardar.

Captura: `capturas/01-factura-nueva-vacia.png`.

## 3. Motor contable

### Cuentas por defecto (Configuración > Configuraciones contables)
Captura: `capturas/02-config-cuentas-defecto.png`.
- Ingresos: Ventas. Devoluciones en ventas: Devoluciones en ventas.
- Inventario: Inventarios. Ajustes de inventario: Ajustes al inventario.
- CxC clientes: Cuentas por cobrar clientes. Devoluciones de clientes: Devoluciones de clientes.
- Proveedores: Cuentas por pagar a proveedores nacionales. Devoluciones de proveedores: Devoluciones a proveedores.
- Patrimonio: Ganancias acumuladas, Utilidad del ejercicio, Pérdida del ejercicio, Ajustes iniciales en bancos, Ajustes iniciales en inventario.
- Diferencia en cambio: ganancia y pérdida. Aproximaciones de ingresos y gastos: Ajustes por aproximaciones en cálculos.
- Cada producto trae por defecto: Ventas (ingreso), Inventarios (activo) y Costos del inventario (costo).
- Cada contacto trae por defecto: CxC "Cuentas por cobrar clientes" y CxP "Cuentas por pagar a proveedores nacionales".
Idea clave: el usuario nunca escoge cuentas; salen solas de producto, contacto y configuración, y se pueden cambiar en "más opciones".

### Catálogo de cuentas
Grupos: Activos, Pasivos, Patrimonio, Ingresos, Costos, Gastos, Cuentas de orden, Transferencias bancarias.
Cuentas clave: Caja general, Caja chica, Bancos, Cuentas por cobrar clientes, ITBIS a favor, Inventario de mercancías, Cuentas por pagar a proveedores nacionales, ITBIS por pagar, Ventas, Devoluciones en ventas, Costos del inventario, Ajustes al inventario.
La cuenta de prueba no muestra códigos (columna "Número de cuenta" vacía). Exportado en `catalogo-cuentas-alegra.xlsx`. Captura `capturas/02-catalogo-cuentas.png`.

### Numeraciones (NCF)
Tipos no electrónicos ya creados: B01 Crédito fiscal, B02 Consumo, B14 Régimen especial, B15 Gubernamentales, B16 Exportación; cada uno empieza en 1. Captura `capturas/02-numeraciones.png`.

### Asientos por documento
Probados en Fiel Ferreteria el 13 nov 2026. Cada documento genera su asiento solo al guardar; el usuario no escoge cuentas.

#### Factura de venta a crédito (B01)
Constructora Prueba SRL, NCF B0100000001, vence a 30 días. Cemento 10 x 650 y Varilla 20 x 380. El ITBIS 18 % sale solo del producto.
Subtotal 14,100; ITBIS 2,538; total 16,638. Estado: Por cobrar. Asiento FV-B0100000001.

| Cuenta | Débito | Crédito |
|---|---|---|
| Cuentas por cobrar clientes | 16,638.00 | |
| ITBIS por pagar | | 2,538.00 |
| Ventas | | 14,100.00 |
| Costos del inventario | 8,460.00 | |
| Inventarios | | 8,460.00 |
| **Totales** | **25,098.00** | **25,098.00** |

El costo de venta sale en el mismo asiento (inventario perpetuo): costo del producto x cantidad (390 x 10 + 228 x 20 = 8,460).
Al guardar sale un cuadro para compartir la factura y un aviso para activar factura electrónica; se cerraron sin aceptar.
Capturas: `03-factura-credito-llena.png`, `03-factura-credito-guardada.png`, `03-factura-credito-asiento.png`.

#### Factura de venta de contado (B02)
Juan Pérez, NCF B0200000001. Tubo PVC 10 x 150 y Pintura galón 2 x 1,450. Subtotal 4,400; ITBIS 792; total 5,192. El pago se registra dentro de la misma factura; queda "Cobrada".
Ojo: la factura de contado NO va directo a caja. Genera DOS asientos: la factura igual que una a crédito (pasa por CxC) y un recibo de caja aparte que salda la CxC.

Asiento FV-B0200000001:
| Cuenta | Débito | Crédito |
|---|---|---|
| Cuentas por cobrar clientes | 5,192.00 | |
| ITBIS por pagar | | 792.00 |
| Ventas | | 4,400.00 |
| Costos del inventario | 2,640.00 | |
| Inventarios | | 2,640.00 |
| **Totales** | **7,832.00** | **7,832.00** |

Asiento RC-1 (recibo de caja creado solo por el pago dentro de la factura):
| Cuenta | Débito | Crédito |
|---|---|---|
| Tarjeta de crédito empresarial (la cuenta que venía seleccionada) | 5,192.00 | |
| Cuentas por cobrar clientes | | 5,192.00 |

Rareza de Alegra: la cuenta preseleccionada para cobrar fue "Tarjeta de crédito empresarial", no Caja general. En nuestro sistema el defecto debe ser Caja general. El recibo queda "Abierto"/"No conciliado" para conciliación bancaria.
Capturas: `04-factura-contado-llena.png`, `04-factura-contado-guardada.png`, `04-factura-contado-asiento.png`, `04-factura-contado-pago-asiento.png`.

#### Pago recibido (abono parcial)
Formulario (`04-pago-recibido-vacio.png`, `04-pago-recibido-lleno.png`): numeración Recibo de caja (consecutivo), fecha de hoy por defecto, cuenta bancaria y forma de pago vacías (sin defecto), tipo "Pago a factura de cliente" seleccionado. Cliente sin asterisco pero necesario: al escogerlo aparecen sus facturas pendientes con monto a pagar y retenciones. Centro de costo y notas opcionales.
Cuentas disponibles: Banco 1, Caja chica, Caja general, Tarjeta de crédito empresarial. Formas de pago incluyen Efectivo y Transferencia.
Prueba: Constructora Prueba SRL abona 8,000 a B0100000001 por Caja general / Transferencia. Saldo queda 8,638 y la factura sigue "Por cobrar".

Asiento RC-2:
| Cuenta | Débito | Crédito |
|---|---|---|
| Caja general | 8,000.00 | |
| Cuentas por cobrar clientes | | 8,000.00 |
Captura: `04-pago-recibido-asiento.png`.

**FP-1: factura de proveedor a crédito** (Cementos Prueba SA, No. B0100000050, 100 Cemento gris 42.5kg × 390, ITBIS 18 %, 30 días). Total 46,020.

| Cuenta | Débito | Crédito |
|---|---|---|
| Inventarios | 39,000 | |
| ITBIS a favor | 7,020 | |
| Cuentas por pagar a proveedores nacionales | | 46,020 |

- Obligatorios: Proveedor, Creación y Vencimiento. Por defecto: almacén Principal, fecha de hoy, cantidad 1, precio 0, descuento 0, impuesto Ninguno. Al elegir el producto se cargan solos el costo (390) y el ITBIS 18 %.
- El NCF del proveedor va en el campo "No.", y la casilla "Asignar NCF comprobante de compra" se deja sin marcar. No vi un selector de tipo de comprobante ni campos del 606 a la vista.
- "Personalizar opciones" solo ofrece Almacén. También están proporcionalidad, Términos y condiciones y Notas.
- El inventario sube 100 unidades al guardar.
- Capturas: `06-compra-{vacia,llena,guardada,asiento}.png`.

**CE-1: pago a proveedor** (46,020 aplicados a B0100000050, Banco 1, Transferencia). La factura pasa a **Pagada**.

| Cuenta | Débito | Crédito |
|---|---|---|
| Cuentas por pagar a proveedores nacionales | 46,020 | |
| Banco 1 | | 46,020 |

- Obligatorios: Cuenta bancaria, Fecha, Forma de pago y Moneda. Al elegir el proveedor salen sus "Facturas pendientes".
- Capturas: `06-pago-proveedor-{vacio,lleno,asiento}.png`.

**Gasto menor** (formulario de pago sin factura, con número B13 que Alegra pone solo y no pide el NCF del proveedor).

| Documento | Débito | Crédito |
|---|---|---|
| CE-B1300000001, transporte | Combustibles y lubricantes 500 | Caja chica 500 |
| CE-B1300000002, café/agua | Agua 250 | Caja chica 250 |
| CE-B1300000003, papelería | Papelería 300 | Caja chica 300 |

- Obligatorios: Cuenta bancaria (aquí Caja chica), Fecha, Moneda y la cuenta contable de la línea. No hay campo para el fondo ni para reponer la caja chica.
- Solo se pueden elegir cuentas hoja. "Comidas y entretenimiento" es cuenta padre y salió "Requerido", así que se usó Agua.
- Capturas: `06-gasto-menor-{vacio,lleno,asiento}.png`. Las notas completas están en `capturas/06-notas.md`.

## 4. Formularios

### Contacto
Formulario rápido (`02-contacto-rapido.png`) y avanzado (`02-contacto-avanzado-vacio.png`, `02-contacto-lleno.png`).
- Obligatorio: solo Nombre o razón social. Tipo cliente y/o proveedor.
- Identificación: tipo (RNC de 9 dígitos, Cédula, extranjero) y número. Municipio/provincia, dirección, correo, teléfonos.
- Comercial: plazo de pago (por defecto "De contado"), vendedor, lista de precios (General), límite de crédito (sin límite), tipo de NCF.
- Contabilidad: CxC y CxP con valor por defecto. Comentarios. Opción de enviar estado de cuenta.

### Producto
`02-producto-vacio.png`, `02-producto-lleno.png`, `02-producto-guardado.png`.
- Tipo: Producto, Servicio o Combo. Obligatorios: nombre, almacén (Principal por defecto) y unidad.
- Categoría, referencia, descripción, cantidad inicial, costo unitario, precio base, impuesto (empieza en "Ninguno"), total calculado con impuesto.
- Escondido en secciones: variantes, almacenes, listas de precios, campos extra y contabilidad.

### Datos de prueba ya creados en Fiel Ferreteria
- Contactos: Constructora Prueba SRL (RNC de prueba 132456789), Juan Pérez, Ferretería Cliente Final, Cementos Prueba SA y Distribuidora Eléctrica Prueba.
- Productos, con 50 unidades, ITBIS 18 % y precio/costo: Cemento gris 42.5kg 650/390, Varilla 3/8 380/228, Tubo PVC 1/2 150/90, Pintura galón 1,450/870, Clavos libra 85/51.
- Productos añadidos por Asistente Code (50 u., ITBIS 18 %, precio/costo): Cable THHN #12 (metro) 45/27, Llave de paso 1/2 350/210, Bombillo LED 9W 120/72.

## 5. Impresión (PDF) de la factura

Logo de Fiel Ferretería subido en Configuración > Empresa (`05-logo-subir.png`, `05-logo-guardado.png`). Acepta .jpg, .jpeg y .png hasta 2 MB. Alegra lo recorta en horizontal: el logo cuadrado pierde el techo y la palabra "Ferretería". Para el nuestro conviene aceptar logo horizontal o encajarlo sin recortar.

PDFs reales: `capturas/05-factura-B01.pdf` (crédito fiscal) y `capturas/05-factura-B02.pdf` (consumo). Vista: `05-factura-B01-impresion.png`, `05-factura-B02-impresion.png`.
Una página, tamaño carta vertical, plantilla "Factura de venta estándar", estilo Clásico (carta).

De arriba abajo:
1. Arriba a la izquierda va el logo y, debajo, el nombre de la empresa, el correo y el teléfono, más las fechas de creación y de vencimiento de la factura. En la prueba no salen ni la dirección ni el RNC de la empresa porque no están llenos.
2. Arriba a la derecha va el título del comprobante ("Factura de Crédito Fiscal" / "Factura de Consumo") con el NCF y la fecha de vencimiento del NCF. En la B02 esa fecha sale en blanco.
3. Bloque del cliente: nombre, RNC y teléfono. En la B01 salen también la moneda (DOP) y el saldo pendiente.
4. Tabla con las columnas Cantidad, Descripción, Unidad, Precio, Descuento, Impuesto y Valor.
5. Totales: Subtotal, Descuento, Monto gravado, ITBIS y Total. El total sale también en letras ("Dieciseis mil seiscientos treinta y ocho").
6. Pie con "Original: Cliente" y el texto de que lo generó Alegra. Las notas y las firmas no se ven porque están vacías.
7. Colores: fondo blanco, texto azul oscuro y franjas grises claras en los encabezados.

Plantillas (`05-plantillas-impresion.png`): hay "Factura de venta estándar" y "Cotización estándar", las dos preferidas. Estilos: Clásico (carta, media carta o tirilla), Simple (carta), Compacto (media carta), Moderno (carta), Clásico FE (carta) y Estándar (carta). El editor deja escoger letra y tamaño, 3 colores, tamaño del logo (pequeño, mediano o grande), datos de empresa y documento, columnas de productos, total en letras, términos, notas, firmas y pie. No se cambió nada.
Pendiente: cotización y conduce (remisión).

### 5.1 Cotización (Ingresos > Cotizaciones)

- Formulario: solo **Cliente** es obligatorio. El número (1) y las fechas de creación y vencimiento (hoy) vienen puestos, y no hay un campo aparte de validez. En "Más ajustes" vienen por defecto Almacén Principal, DOP y la lista de precios General. Vendedor y Centro de costo quedan vacíos.
- No hace asiento contable.
- PDF: tiene el logo y el nombre de la empresa arriba a la izquierda, y el correo y el teléfono arriba a la derecha. Debajo va el cliente con su RNC a la izquierda, y a la derecha "Cotización No. 1" con las fechas.
  - Columnas: Concepto, Precio, Unidad, Cantidad, Descuento, Impuesto, Subtotal.
  - Totales: Subtotal, ITBIS y Total, con el monto en letras y "Página 1 de 1".
- Prueba: Constructora Prueba SRL, 20 Varilla × 380 y 10 Cemento × 650, total 16,638.
- Capturas: `07-cotizacion-{vacia,llena,impresion}.png` y `07-cotizacion.pdf`.

### 5.2 Remisión / Conduce (Ingresos > Remisiones)

- Formulario: son obligatorios **Tipo de documento** (viene en "Conduce") y **Cliente**. El número y las fechas vienen puestos, y "Más ajustes" trae los mismos valores que la cotización.
- No hace asiento contable y no baja el stock. El producto muestra aparte cuánto está "en conduces": en la prueba, Tubo PVC siguió en 40 con 5 en conduces y Pintura en 48 con 2 en conduces.
- PDF: el logo va arriba a la izquierda, los datos de la empresa al centro y "Conduce No. 1" a la derecha. Debajo, el cliente a la izquierda y las fechas a la derecha.
  - Columnas: Ítem, Precio, Cantidad, Descuento, Impuesto, Subtotal. **Sí muestra precios.**
  - Totales: Subtotal, ITBIS y Total.
  - Pie: "ELABORADO POR" y líneas de aceptación, firma y fecha.
- Prueba: Ferretería Cliente Final, 5 Tubo PVC × 150 y 2 Pintura × 1,450, total 4,307.
- Capturas: `07-remision-{vacia,llena,impresion}.png` y `07-remision.pdf`.

## 8. Reportes

Lista completa y detalle por categoría. Las notas completas, con cifras de la prueba, están en `capturas/08-notas-contables.md` y `capturas/08-notas-administrativos.md` y `capturas/08-notas-ventas.md`. Ningún reporte pidió plan pagado.

Categorías en /report (en orden): Ventas (7), Administrativos (7), Financieros (1: Flujo de caja), Contables (9), Fiscales (8: 606, 607, 608, IT1, Reporte detallado de impuestos, Impuestos y retenciones, IR-17, Cartas de retención) y Para trabajar (2: Exportar facturas, Informe contador). Captura de la portada: `08-reportes-inicio.png`.

### 8.1 Contables

| Reporte | URL | Filtros por defecto | Columnas (en orden) | Exportar |
|---|---|---|---|---|
| Estado de resultados | `/report/profit-and-loss` | Este mes; Centro de costos; Vista detallada; buscar cuenta | Cuenta, mes actual, % ingresos, mismo mes año anterior, %, Var. absoluta, Var. relativa | Descargar Excel / PDF, Personalizar |
| Estado de situación financiera | `/report/general-balance` | Hasta hoy; Vista detallada; buscar cuenta | Cuenta, fecha, análisis vertical, año anterior, análisis vertical, Var. abs., Var. rel. | Descargar |
| Estado de flujo de efectivo | `/report/statement-of-cash-flows?from=&to=` | Este mes; buscar cuenta (método indirecto) | Concepto, mes, análisis vertical, mes anterior, análisis vertical, Var. abs., Var. rel. | Personalizar, Descargar |
| Libro diario | `/report/ledger-journals/from/<f>/to/<f>` | Fechas del mes; Tipo de registro (todos) | Selección, Asiento, Estado, Fecha, Tercero, Código, Cuenta, Centro de costo, Débito, Crédito | Descargar |
| Auxiliar por tercero | `/report/subsidiary-ledger-by-client` | Tercero (obligatorio, vacío); Este mes; Cuenta | Cuenta, Tercero, Saldo anterior, Débito, Crédito, Neto, Saldo final | Descargar |
| Balanza de comprobación | `/report/general-ledger` | Fechas; buscar cuenta; Cierre anual no; Saldos en cero no | Cuenta, Saldo inicial D/C, Movimientos D/C, Saldo final D/C, fila Total | Descargar |
| Movimientos por cuenta contable | `/report/ledger-journal-categories/from/<f>/to/<f>?category_id=<id>` | Este mes; Cuenta (vacía); Asiento | Tipo doc., Fecha, Asiento, Estado, Tercero, Código, Cuenta, Saldo inicial, Débito, Crédito, Mov. neto, Saldo final (más tarjetas de resumen) | Personalizar, Compartir, Descargar |
| Movimientos por cuenta agrupado | `/report/ledger-journal-categories-grouped/...&groupBy=category-only` | Este mes; Cuenta; Agrupar por cuenta; Tercero | Resumen: Cuenta, Saldo inicial, Débito, Crédito, Mov. neto, Saldo final. Detalle: Asiento, Fecha, Estado, Tercero, Código, Cuenta, Tipo doc., Débito, Crédito, Mov. neto | Personalizar, Compartir, Descargar |
| Balanza por tercero | solo formulario en `/report/category/accounting` | Periodo (obligatorio), Cuenta, Tercero, Saldos en cero | No tiene vista en pantalla, solo Excel | Exportar (Excel) |

Nota: el efectivo sale en -39,070 porque Banco 1 pagó la compra sin saldo inicial, y Alegra deja los bancos en negativo sin avisar.

### 8.2 Administrativos

| Reporte | URL | Filtros por defecto | Columnas (en orden) | Totales en la prueba | Enlaces | Exportar |
|---|---|---|---|---|---|---|
| Cuentas por cobrar | `/report/invoices-open` | Hasta fin de mes; Filtrar: NCF, Cliente, Creación, Vencimiento; 5 vistas por antigüedad (≤30, 31-60, 61-90, 91+, No vencidas) | Selección, NCF/Número, Tipo doc., Cliente, Creación, Vencimiento, Total, Cobrado, Por cobrar | Por cobrar 8,638 (B0100000001) | Número abre la factura | Descargar, Compartir |
| Cuentas por pagar | `/report/bills-open` | Periodo del mes; mismos filtros y 5 vistas | Tipo doc., NCF/Número, Proveedor, Creación, Vencimiento, Total, Pagado, Por pagar | 0 ("¡No tienes facturas pendientes por pagar!") | Número abre la factura | Descargar, Compartir |
| Ingresos y compras | `/report/income-and-expense/ledger/yes` | Periodo del mes; buscar cuenta; Saldos en cero sí | Cuenta contable, Total (árbol que se abre y cierra) | Ingresos 18,500; egresos -12,150; saldo 6,350 | Cuenta abre Movimientos por cuenta | Descargar |
| Valor de inventario | `/report/inventory` | Hasta hoy; Almacén; Producto; Referencia | Producto, Referencia, Descripción, Cantidad, Unidad, Estado, Costo promedio, Total, acción | 124,800 (8 productos) | Producto abre su ficha | Descargar |
| Transacciones | `/report/transactions` | Este mes; Filtrar: Comprobante, Fecha, Estado, Tipo, Valor | Comprobante, Fecha, Cuenta, Proveedor, Detalle, Entradas, Salidas | Entradas 13,192; salidas 47,070 (6 movimientos; sin transferencias entre bancos) | Comprobante abre el pago o recibo | Descargar, Compartir |
| Compras | `/report/purchases` | Periodo del mes; Proveedor | Número de factura, Proveedor, Fecha, Antes de impuestos, Después de impuestos | 39,000 / 46,020 | Número abre la factura de proveedor | Descargar |
| Reporte anual | `/report/annual?year=2026` | Año (abre en el año pasado); Comparar con año anterior sí; gráfico Mensual o Diario | Resumen: promedio mensual, semanal y diario, ventas, costos y gastos, utilidad neta, margen. Tarjetas con gráfico o tabla: más vendidos, mejores vendedores, mejores clientes, principales gastos | Ventas 18,500; utilidad 6,350; margen 34.32% | Títulos abren Ventas por producto, por cliente, por vendedor e Ingresos y compras | Compartir |

Capturas: `08-reporte-{cuentas-por-cobrar,cuentas-por-pagar,ingresos-y-compras,valor-de-inventario,transacciones,compras,reporte-anual}.png`, con vistas extra (`-vencidas-*`, `-no-vencidas`, `-graficas`, `-diario`, `-resumen-expandido`, `-*-tabla`).

Para copiar: en los reportes de Administrativos el número del documento o el nombre del producto son enlace. En los Contables, no.

### 8.3 Ventas

Notas completas: `capturas/08-notas-ventas.md`.

| Reporte | URL | Filtros por defecto | Columnas (en orden) | Totales en la prueba | Enlaces | Exportar |
|---|---|---|---|---|---|---|
| Ventas generales | `/report/sales` | Periodo del mes; Almacén; Numeración (01, 02, 03, 04, 14, 15, 16); Más filtros; gráfico Diario o Mensual | Documento, Cliente, Estado, Creación, Subtotal, Descuento, Antes de impuestos, Impuestos, Después de impuestos | 18,500 + ITBIS 3,330 = 21,830; notas de crédito 0 | Documento abre la factura | Personalizar, Compartir, Descargar |
| Ventas por producto/servicio | `/report/sales-by-item` | Periodo (obligatorio); Filtrar | Producto/servicio, Referencia, Número de productos/servicios, Antes de impuestos, Después de impuestos | 18,500 / 21,830 | Ninguno | Personalizar, Compartir, Descargar |
| Ventas por cliente | `/report/sales-by-client/from/<f>/to/<f>` | Periodo; Buscar cliente | Cliente, Número de ventas, Subtotal, Descuentos, Devoluciones, Antes de impuestos, Impuestos, Después de impuestos | 18,500 / 21,830 | Cliente abre su ficha | Personalizar, Compartir, Descargar |
| Rentabilidad por producto | `/report/items-profit` | Periodo; Filtrar | Producto/servicio, Referencia, Total vendido, Costo total, Rentabilidad total, Porcentaje | Vendido 18,500; costo 11,100; ganancia 7,400 | Producto abre su ficha | Personalizar, Descargar |
| Ventas por vendedor | `/report/sales-by-seller` | Periodo; Todos los vendedores; Almacén | Sin datos (las facturas de prueba no tienen vendedor) | — | — | Personalizar, Compartir, Descargar |
| Estado de cuenta por cliente | `/report/client-statement?idClient=<id>` | Cliente (obligatorio); Corte a hoy; Estado de vencimiento (Sin vencer, 1-30, 31-60, 61-90, 91+); Buscar documento | Documento, Creación, Vencimiento, Antigüedad, Días vencidos, Estado, Moneda, Total, Retenido, Cobrado, Saldo, acción | Ventas 16,638; cobrado 8,000; por cobrar 8,638 | Documento abre la factura | Personalizar, Descargar, Enviar al cliente |
| Ventas por almacén | `/report/sales-by-warehouse/from/<f>/to/<f>?idWarehouse=<id>` | Periodo; Todos los almacenes; gráfico Diario o Mensual | Documento, Cliente, Estado, Creación, Almacén, Centro de costos, Subtotal, Descuento, Antes de impuestos, Impuestos, Después de impuestos | 18,500 + 3,330 = 21,830 | Documento abre la factura | Personalizar, Descargar |

Capturas: `08-reporte-{ventas-generales,ventas-por-producto-servicio,ventas-por-cliente,rentabilidad-por-producto,ventas-por-vendedor,estado-de-cuenta-por-cliente,ventas-por-almacen}.png`, con las vistas extra `-mensual` y `-sin-vencer`.

Pendientes: Financieros, Fiscales y Para trabajar.

### 8.4 Financieros

| Reporte | URL | Filtros por defecto | Columnas | Notas |
|---|---|---|---|---|
| Flujo de caja | /report/cash-flow-financial | Periodo de los últimos 3 meses (sep–nov 2026), buscar cuenta contable | Cuenta, una columna por mes | Filas: Saldo inicial en caja y bancos, Entradas (por cuenta, por ejemplo Cuentas por cobrar clientes), Salidas (por cuenta: proveedores, agua, papelería, combustible), Saldo del periodo y Saldo final. Entradas y Salidas se abren y se cierran. Gráfico con dos vistas: "Flujo" (entradas y salidas por mes) y "Saldo". Botones Descargar y Actualizar. Capturas `08-reporte-flujo-de-caja.png` y `-saldo.png` |

Con los datos de prueba de noviembre: entradas 8,000, salidas 47,070 y saldo del periodo **−39,070**.

### 8.5 Fiscales (DGII)

Ninguno se exportó ni se mandó a la DGII.

| Reporte | URL | Filtros por defecto | Qué muestra |
|---|---|---|---|
| Reporte 606 (compras) | ventana sobre /report/category/tax | Periodo* = mes actual; Tipo de archivo = Archivo plano | No muestra nada en pantalla, solo el botón Exportar. Tiene enlace a "configuración del reporte" (/report/edit-report-categories) |
| Reporte 607 (ventas) | igual | igual | igual que el 606 |
| Reporte 608 (comprobantes anulados) | igual | igual | igual, sin enlace de configuración |
| Reporte IT1 (ITBIS mensual) | /report/it1 | Año y mes | Asistente que **crea un documento** al darle Continuar. Pestañas "Anexo A" e "IT-1" con las mismas casillas del formulario de la DGII. Botones Guardar como borrador, Finalizar, Editar y Descargar |
| Reporte detallado de impuestos | /report/detailed-tax-report | Periodo* = mes; Impuesto = Todos | 4 tablas (impuestos en ventas, en compras, devoluciones de ventas y de compras) con Impuesto, Total base imponible y Total impuesto, por tasa: ITBIS 18 %, 16 %, 0 %, Exento, Propina 10 %, CDT 2 %. Abajo, el detalle por documento: NCF, Tipo, Contacto, Creación, Impuesto, Base, Valor. El NCF es un enlace a la factura |
| Impuestos y retenciones | /report/taxes-and-retentions | Mes; Vista Impuestos; Todos; pestañas Ventas y Compras | Nombre, Tipo, Tarifa, Base gravable, Impuestos, Base devoluciones, Impuestos en devoluciones, Saldo, "Ver detalles" (panel con documento, producto, cantidad, precio y base) |
| Reporte IR-17 (retenciones) | /report/ir-17 | — | "Aún no tienes reportes creados". Igual que el IT1, se crea con "Nuevo reporte" (no se abrió) |
| Cartas de retención | /report/withholding-certificates | Este mes | Pestañas "Listos para enviar" y "Por completar". Buscar proveedor. Sin datos en la prueba |

**IT1 con los datos de prueba (noviembre 2026):** total de operaciones RD$18,500 (todo al 18 %), ITBIS cobrado RD$3,330, ITBIS deducible RD$0, impuesto a pagar y total general **RD$3,330**. Fecha límite 20/12/2026. Ojo: el IT1 no tomó el ITBIS de compras (7,020), aunque el reporte detallado sí lo muestra. Puede ser porque esa compra no trae el NCF del proveedor bien puesto; no se investigó.

**Cifras que cuadran entre reportes:** ITBIS en ventas 3,330, en compras 7,020, diferencia 3,690 a favor (reporte detallado), y ventas gravadas 18,500 (B01 14,100 + B02 4,400).

**Incidente:** al entrar al asistente del IT1, Alegra creó solo el borrador "Nuevo Reporte IT1 - Noviembre 2026" (/report/it1/view/942b2395-…). No se finalizó ni se mandó, y se dejó como estaba. Para Medoxigas: no crear nada hasta que el usuario le dé a guardar.

Notas completas: `capturas/08-notas-fiscales.md`.

### 8.6 Para trabajar

Ruta: `/report/category/to-work`. Tiene 2 tarjetas. Ninguna de las dos muestra una tabla en pantalla: al abrirlas sale un diálogo con un filtro de fechas y después se descarga un archivo. No exporté nada, así que no vi qué columnas trae el archivo.

| Reporte | Qué abre | Periodo por defecto | Botones | Captura |
|---|---|---|---|---|
| Exportar facturas | Diálogo con rango de fechas | Mes actual (01/11/2026 - 30/11/2026) | Exportar todo, Exportar, cerrar (X) | `capturas/08-reporte-exportar-facturas.png` |
| Informe contador | Diálogo con rango de fechas | Mes actual (01/11/2026 - 30/11/2026) | Cerrar, Exportar | `capturas/08-reporte-informe-contador.png` |

Confirmado: la categoría **Financieros** tiene un solo reporte, Flujo de caja (`capturas/08-reportes-financieros.png`).

Idea para Medoxigas Contabilidad: con un botón "Exportar para el contador" que pida solo el rango de fechas (por defecto el mes actual) ya se cubre esta parte.

## 9. Fichas y enlaces

El detalle completo, con columnas y URL, está en `capturas/09-notas.md`. Las capturas son `capturas/09-*.png`.

**Ficha de contacto** (`/client/view/id/N`)
- Arriba van los datos del contacto, su plazo de pago y sus cuentas por defecto (CxC y CxP).
- Luego vienen tarjetas de resumen: por cobrar, anticipos, por pagar y notas sin aplicar.
- Debajo hay pestañas, todas con un filtro por número:

| Pestaña | Columnas |
|---|---|
| Transacciones | Fecha (abre el pago), Detalle, Estado, Gastos, Ingresos |
| Facturas | Número, Creación, Vencimiento, Total, Cobrado, Por cobrar, Estado de emisión, Estado, Acciones |
| Facturas de proveedor | Número, Creación, Vencimiento, Total, Pagado, Por pagar, Acciones |
| Devoluciones en ventas | Número, Fecha, Total, Por aplicar, Acciones |
| Notas débito | Número, Fecha, Total, Por aplicar, Acciones |
| Cotizaciones | Número, Creación, Estado, Total, Acciones |
| Remisiones | Número, Creación, Vencimiento, Estado, Total, Acciones |
| Órdenes de compra | Código, Fecha, Plazo de pago, Estado, Total, Acciones |
| Comprobantes contables | Número, Fecha, Referencia, Observaciones, Débito, Crédito, Acciones |

- El mismo contacto puede ser cliente y proveedor a la vez. El proveedor no tiene una pestaña de pagos aparte: los pagos se ven dentro de cada factura de proveedor.
- **Estado de cuenta:** se abre con "Más acciones" > "Ver estado de cuenta" (`/report/client-statement?idClient=N`).
  - Filtros: cliente, fecha de corte y antigüedad.
  - Columnas: Documento, Creación, Vencimiento, Antigüedad, Días vencidos, Estado, Moneda, Total, Retenido, Cobrado, Saldo.
  - Totales: ventas, retenciones, cobrado y por cobrar.
  - Se descarga en Excel o PDF.

**Ficha de producto** (`/item/view/id/N`)
- Muestra código, tipo, unidad, existencia total y una tabla por almacén con inicial, actual, mínimo, máximo y "en conduces". También trae el precio sin ITBIS y con ITBIS, la lista de precios y el costo unitario.
- Las 3 cuentas contables (Ventas, Inventarios y Costos) son enlaces a cada cuenta.
- Pestañas con filtro:
  - Facturas de venta: Número, Cliente, Creación, Vencimiento, Total, Pagado, Por cobrar, Estado.
  - Facturas de compras: Número, Proveedor, Creación, Vencimiento, Total, Pagado, Por pagar.
  - Además: notas crédito y débito, cotizaciones, remisiones, órdenes de compra y transferencias entre almacenes.
- "Historial de operaciones" se descarga en Excel (kárdex): documento, fecha, cantidad, costo y existencia después de cada movimiento. Kárdex quiere decir el historial de entradas y salidas del producto.

**Enlaces desde los documentos**
- Factura de venta: el cliente abre su ficha y cada producto abre la suya. En "Pagos asociados", el número del recibo **no** es enlace. La factura de venta no tiene "Ver asiento" y su pestaña Contabilidad sale vacía.
- Factura de proveedor: el proveedor y el producto abren su ficha. La fecha del pago abre el pago. La sección Contabilidad muestra el asiento FP-1, con un botón Imprimir y las cuentas como enlace.
- Pago a proveedor (CE-1): el proveedor y la factura pagada son enlaces, y trae un botón Imprimir. La cuenta Banco 1 no es enlace.
- Libro diario: el número de asiento parece enlace, pero no abre el documento. El tercero y la cuenta son texto.

**Lo que Alegra no tiene y convendría en el nuestro:** que todo sea clicable, con el mismo enlace en todas partes: número de recibo, asiento y fila de reporte. Y que cada factura muestre su asiento.

## 10. Bancos

### 10.1 Cuentas de banco y caja (/account)

Lista inicial (captura `capturas/10-bancos-lista.png`): Tarjeta de crédito empresarial (Tarjeta, RD$5,192.00), Banco 1 (Banco, RD$-46,020.00), Caja general (Efectivo, RD$8,000.00), Caja chica (Efectivo, RD$-1,050.00). La lista no muestra la cuenta contable de cada una.

**Formulario "Nueva cuenta"** (vacío `10-bancos-cuenta-vacia.png`, lleno `10-bancos-cuenta-llena.png`). Es corto y no tiene "más opciones":

| Campo | Obligatorio | Por defecto |
|---|---|---|
| Nombre de la cuenta | Sí | vacío |
| Tipo de cuenta (Banco / Efectivo / Tarjeta) | Sí | Banco |
| Número de cuenta | No | vacío (en la ficha sale enmascarado `****6789`) |
| Saldo inicial | Sí | vacío |
| Fecha de saldo inicial | Sí | hoy |
| Descripción | No | vacío |

Al guardar, Alegra crea sola una cuenta contable con el mismo nombre. También sale un aviso para conectar el banco, que se cerró con "Más tarde".

Prueba: "Banco Popular Prueba", saldo inicial 50,000. Alegra hace el asiento **CB-5** (`10-bancos-cuenta-asiento.png`):

| Cuenta | Débito | Crédito |
|---|---|---|
| Banco Popular Prueba | 50,000.00 | |
| Ajustes iniciales en bancos | | 50,000.00 |

Ficha de la cuenta: /account/view/id/{id} (`10-bancos-cuenta-detalle.png`). Muestra sus movimientos y tiene botones de editar, filtrar, refrescar y **Conciliar**. El menú de acciones (`10-bancos-acciones.png`) trae Crear pago recibido, Crear nuevo pago, Transferir, Ver conciliaciones y Desactivar.

### 10.2 Transferencia entre cuentas

Formulario (vacío `10-bancos-transferencia-vacia.png`, campos adicionales `10-bancos-transferencia-adicionales.png`, lleno `10-bancos-transferencia-llena.png`):

| Campo | Obligatorio | Por defecto |
|---|---|---|
| Cuenta de origen | Sí | vacío (si se abre desde la ficha de una cuenta, viene puesta y bloqueada) |
| Cuenta de destino | Sí | vacío |
| Monto | Sí | vacío |
| Fecha de transferencia | Sí | hoy |
| Descripción | No | vacío |
| *Campos adicionales:* Numeración ingreso, Numeración egreso | No | vacío |

Prueba: de Caja general a Banco Popular Prueba, 5,000, con la descripción "Depósito de caja al banco". En Alegra un depósito de caja al banco es esto mismo, una transferencia. Se guarda como **Pago recibido 3** (/income-payments/view/id/8) con el asiento **RC-3** (`10-bancos-transferencia-asiento.png`):

| Cuenta | Débito | Crédito |
|---|---|---|
| Banco Popular Prueba | 5,000.00 | |
| Transferencias bancarias (cuenta puente) | | 5,000.00 |

Después quedaron así los saldos: Banco Popular Prueba 55,000 y Caja general 3,000. El lado de salida (el egreso de Caja general) y la conciliación van en 10.3.

### 10.3 Lado de salida de la transferencia y conciliación

**Egreso de la transferencia.** La misma transferencia también crea un **Gasto CE-2** (/payment/view/id/7) en Caja general (`10-bancos-transferencia-egreso-asiento.png`):

| Cuenta | Débito | Crédito |
|---|---|---|
| Transferencias bancarias | 5,000.00 | |
| Caja general | | 5,000.00 |

O sea, una transferencia son dos documentos: el RC (entrada al destino) y el CE (salida del origen). Los dos pasan por la cuenta puente "Transferencias bancarias", que al final queda en cero.

**Conciliación bancaria** (/conciliation/index/id/{cuenta}, ficha de cuenta → "Conciliar"):
- Vacía: `10-bancos-conciliacion-vacia.png`. La cuenta viene puesta y el rango de fechas trae hoy por defecto. El resumen muestra Saldo anterior, Entradas, Salidas, Saldo total y Diferencia.
- Campos:

| Campo | Obligatorio | Por defecto |
|---|---|---|
| Cuenta | Sí | la cuenta desde donde se abrió |
| Rango de fechas | Sí | hoy a hoy |
| Saldo bancario (según el estado del banco) | Sí en la práctica: sin él, "Conciliar" no se activa | vacío |
| Gastos bancarios | No | 0.00, cuenta Gastos por Intereses financieros |
| Impuestos bancarios | No | 0.00, cuenta Gastos por Intereses financieros |
| Entradas bancarias (intereses) | No | 0.00, cuenta Ingresos por Intereses financieros |

- Movimientos (`10-bancos-conciliacion-movimientos.png`): es una tabla con casillas y "seleccionar todo". El saldo inicial no sale como fila, porque ya va en el Saldo anterior (50,000). Al marcar la transferencia de 5,000, las Entradas suben a 5,000 y el Saldo total a 55,000. Al poner Saldo bancario 55,000, la Diferencia queda en 0.00 y se pone verde (`10-bancos-conciliacion-llena.png`).
- "Conciliar" se activa solo cuando hay saldo bancario y al menos un movimiento marcado. Alegra va guardando un borrador solo, y después ofrece "¡Retoma tu conciliación!".
- Resultado (/conciliation/view/id/1, `10-bancos-conciliacion-resultado.png`) y lista "Ver conciliaciones" (/conciliation/view-account/id/5, `10-bancos-conciliacion-lista.png`): fecha, saldo 55,000 y estado "Conciliada".
- **La conciliación no hace asiento** cuando los gastos, impuestos y entradas están en 0. Si traen monto, se asume que se registran contra las cuentas por defecto de arriba. Eso no se probó.

**Otras acciones de la cuenta.** "Crear pago recibido" abre el pago recibido normal con la cuenta ya puesta (/income-payments/add?idAccount=2), y "Crear nuevo pago" abre el pago normal (/payment/add). No son formularios nuevos.

**Para Medoxigas:** la cuenta de banco crea su propia cuenta contable. La transferencia hace RC y CE con una cuenta puente. La conciliación marca movimientos contra un saldo del banco y no hace asiento.

## 11. Contabilidad

### 11.1 Catálogo de cuentas (/category)

Árbol (`capturas/11-catalogo-arbol.png`). Grupos de arriba (Alegra los llama "Elemento"): Activos, Pasivos, Patrimonio, Ingresos, Costos, Gastos, Cuentas de orden y Transferencias bancarias. Llega hasta unos 10 niveles.

- Columnas por defecto: Nombre de la cuenta (con el código al lado), Uso de cuenta y Descripción. En "Personalizar vista" se pueden agregar Tipo de cuenta, Naturaleza y Saldo, y también Mostrar códigos y Mostrar colores.
- Botones: buscar, Nueva cuenta, Expandir todo, Filtrar, Personalizar vista, Saldos iniciales y Exportar a Excel.
- Más acciones: Importar catálogo de cuentas, Cuentas eliminadas y Configuraciones contables.
- Acciones de cada fila: Agregar subcuenta, Editar, Ver movimientos y Eliminar.

**Formulario "Nueva cuenta"** (vacío `11-catalogo-cuenta-vacia.png`, lleno `11-catalogo-cuenta-llena.png`). No hay "más opciones".

| Campo | Obligatorio | Por defecto / opciones |
|---|---|---|
| Nombre de la cuenta | Sí (*) | vacío |
| Tipo de cuenta | Sí | Cuenta de movimiento (la otra opción es Cuenta mayor, que agrupa) |
| Elemento | Sí (sin él no deja crear) | vacío. Opciones: los 8 grupos de arriba |
| Cuenta mayor (padre) | Sí (sin ella no deja crear) | vacío. Salen las mayores del elemento; en Gastos son Gastos, Gastos de venta, Gastos de administración, Gastos generales, Gastos financieros, Otros gastos y Gastos por impuestos |
| Código | No | vacío |
| Uso de cuenta | No | Sin uso contable. Otras: Gastos de nómina, Retención asumida sobre renta, Cuentas incobrables, Impuestos no acreditables, Descuentos financieros |
| Naturaleza | La pone sola (bloqueada) | sale del elemento; Gastos es Débito |
| Ubicación en el estado de resultados | Sí | en Gastos: Costo de ventas y operación, **Gastos** (por defecto), Otros gastos, Gastos de impuestos |
| Ver saldo de cuenta por terceros | No | activado |
| Descripción | No | vacío |

Prueba: "Gastos de fletes prueba", código 9999, en Gastos > Gastos generales (`11-catalogo-cuenta-creada.png`).

**Editar** (`11-catalogo-cuenta-editar.png`): se pueden cambiar nombre, código, descripción, tipo y uso. La naturaleza y la ubicación quedan bloqueadas, y la cuenta padre ya no aparece, así que no se puede mover. La descripción se cambió a "Prueba editada" y se guardó.

**Cuenta del sistema** (Caja general, `11-catalogo-cuenta-sistema.png`): tipo, naturaleza y uso están bloqueados. Nombre, código y descripción sí se pueden cambiar. "Agregar subcuenta" está desactivado. Sale el aviso "Esta cuenta está conectada a una caja en el menú de bancos". Se canceló sin guardar.

**Ver movimientos** de una cuenta (`11-catalogo-cuenta-movimientos.png`) abre el reporte "Movimientos por cuenta contable": /report/ledger-journal-categories?from=ledger-categories&category_id={id}. Columnas: Tipo de documento, Fecha, Asiento, Estado, Tercero, Código contable, Cuenta contable, Saldo inicial, Débito, Crédito, Movimiento neto y Saldo final. Banco Popular Prueba tenía 2 asientos (CB-5 y RC-3).

Nota: /categories (con s) muestra una pantalla de acceso limitado. La buena es /category.

### 11.2 Asientos manuales ("Entrada de diario", /ledger/documents)

Lista: /ledger/documents (`capturas/12-asientos-lista.png`). Sin asientos sale vacía, con "¡Crea tu primera entrada de diario!" y el botón "Nueva entrada de diario ▾". Aquí solo salen los asientos manuales: los automáticos de facturas y pagos no aparecen.

**Formulario "Nueva entrada de diario"**: /ledger/documents/add (vacío `12-asiento-vacio.png`). Subtítulo: "Registra ajustes y traslados del saldo contable entre tus cuentas."

Datos básicos:

| Campo | Obligatorio | Por defecto |
|---|---|---|
| Fecha | Sí | hoy |
| Tipo de entrada de diario | Sí | Ajuste contable |
| Numeración | Sí | Ajuste contable |
| Código | Lo pone solo (bloqueado) | AC-1 (prefijo AC + consecutivo) |
| Observaciones | No | vacío |

Movimientos: la tabla trae 2 líneas vacías, cada una con columnas Cuenta contable, Contacto, Nº de documento, Descripción, Débito (0), Crédito (0) y un botón para borrar la línea. Abajo está "+ Agregar línea" y luego los renglones **Total** (débito y crédito) y **Diferencia** (en rojo). Si se escribe en el débito de una línea, su crédito se bloquea, y al revés.

**Validación** (`12-asiento-descuadrado.png`): con débito 1,500 y crédito 1,400 sale Diferencia RD$100 en rojo. Los botones "Guardar y crear otro" y "Guardar" están desactivados con el formulario vacío y se activan al llenar las líneas. Se arregló a 1,500 antes de guardar (`12-asiento-lleno.png`), así que no se probó qué pasa al guardar descuadrado. Para Medoxigas: bloquear el guardado si la diferencia no es 0.

**Prueba**: "Pago de flete en efectivo (prueba)". Quedó guardada como **Entrada de diario 1, código AC-1** (/ledger/documents/view/id/1, `12-asiento-detalle.png`):

| Código | Cuenta | Descripción | Débito | Crédito |
|---|---|---|---|---|
| 9999 | Gastos de fletes prueba | Pago de flete en efectivo (prueba) | 1,500 | 0 |
| | Caja general | | 0 | 1,500 |
| | **Total** | | 1,500 | 1,500 |

La ficha tiene los botones Editar, Clonar y ⋮ (más acciones), y una tarjeta "Asiento contable" con "Mostrar detalles". Las cuentas son enlaces.

**Opciones de las listas** (vistas al abrir el formulario):

- Tipo de entrada de diario: Ajuste contable (AC), Ajustes por diferencia en tasa de bancos (DTB), Amortizaciones (A), Cierre de periodos contables (CA), Cuentas por cobrar (CPC), Cuentas por pagar (CPP), Depreciaciones (D), Impuestos (IMP), Ingresos (ING), Nómina (NO), Provisiones (PV), Retenciones (RET), Saldos iniciales (SI). Al final está "Nuevo tipo de entrada de diario". Cada tipo pone su prefijo en el código.
- Numeración: "Ajuste contable" y la acción "Nueva numeración".

### 11.3 Activos fijos (/fixed-assets)

Lista: /fixed-assets (`capturas/12-activos-lista.png`). Formulario nuevo: vacío `12-activo-vacio.png`, lleno `12-activo-lleno.png`, opciones avanzadas `12-activo-avanzadas.png`.

Arriba se elige **Activo tangible** o **Activo intangible**.

| Campo | Obligatorio | Por defecto |
|---|---|---|
| Nombre | Sí | vacío |
| Referencia | No | vacío |
| Tipo de activo | No | Otros tangibles |
| Proveedor | No | vacío |
| Fecha de adquisición | Sí | hoy |
| Costo de adquisición | Sí | vacío |
| Cantidad | Sí | 1 |
| Monto total de inversión | Sí | costo × cantidad |
| Cuenta contable del activo | Sí | vacío |
| Cuenta de depreciación acumulada | Sí | vacío |
| Cuenta contable del gasto | Sí | vacío |
| Valor residual | No | 0 (no puede pasar del costo) |
| Método de depreciación | Fijo, desactivado | Lineal |
| Forma del cálculo | Sí | Vida útil (la otra opción es Porcentaje) |
| Fecha de inicio de depreciación | Sí | hoy |
| Periodo de depreciación | Sí | Anual (opciones: Anual, Mensual) |
| Vida útil | Sí | 1 |
| Contabilizar creación del activo | Interruptor | encendido |

"Otras opciones avanzadas" (escondido): **Valor restante por depreciar** (vacío, ayuda: "Para activos con depreciación en curso.") y **Próxima depreciación** (hoy). También se puede subir foto y adjuntos.

Opciones de Tipo de activo: Terrenos, Edificios o construcciones, Maquinarias, Equipos de computación, Equipos de oficina, Mobiliarios y enseres, Equipos de transporte, Otros tangibles. Ojo: el tipo no cambia solo según la cuenta. La prueba quedó como "Otros tangibles" aunque la cuenta es de vehículos.

**Prueba**: "Camioneta reparto prueba", tangible, 13/11/2026, costo RD$800,000, cantidad 1, cuenta "Vehículos y equipos de transporte", depreciación acumulada "Depreciación vehículos y equipos de transporte", gasto "Depreciacion vehiculos y equipos de transporte" (Alegra lo muestra sin tilde), residual 0, lineal, anual, 5 años.

**Asiento que sale solo** (con "Contabilizar creación" encendido): **AC-2** del 13/11/2026, tipo Ajuste contable (/ledger/documents/view/id/2, `12-activo-asiento.png`):

| Cuenta | Débito | Crédito |
|---|---|---|
| Vehículos y equipos de transporte | 800,000 | 0 |
| Cuentas por pagar a proveedores nacionales | 0 | 800,000 |

O sea, Alegra da por hecho que el activo se compró a crédito: la contrapartida va a cuentas por pagar, no a caja ni a depreciación. No se probó si cambia al poner proveedor.

**Ficha del activo** (/fixed-assets/view/id/…, `12-activo-detalle.png`): botones Editar, Ver entrada de diario y Anular entrada de diario. No hay botones visibles de Depreciar, Vender o Dar de baja; las filas de la tabla tienen botones sin texto que no se tocaron. Valor depreciado actual RD$0 y la tabla de proyección con todas las filas "Pendiente":

| Año | Depreciación |
|---|---|
| 2026 | 21,333.33 |
| 2027 | 160,000 |
| 2028 | 160,000 |
| 2029 | 160,000 |
| 2030 | 160,000 |
| 2031 | 138,666.67 |
| Total | 800,000 |

El 2026 se prorratea desde la fecha de inicio (13/11), y lo que falta se completa en 2031. No se corrió ninguna depreciación, así que su asiento (tipo D) está sin ver.

## 13. Notas de crédito y débito

### 13.1 Nota de crédito de venta (/credit-note)

Lista: /credit-note (`capturas/13-nc-venta-lista.png`). Nueva: /credit-note/add (vacía `13-nc-venta-vacio.png`, llena `13-nc-venta-lleno.png`).

| Campo | Obligatorio | Por defecto |
|---|---|---|
| Número (NCF) | Lo pone solo | B0400000001 (prefijo B04, sin selector de numeración a la vista) |
| Contacto | Sí | vacío |
| Fecha | Sí | hoy |
| Tipo de nota de crédito | Sin asterisco | "Seleccionar" |
| Notas | No | vacío |
| Lista de precios (en "Más opciones") | No | vacío (al guardar queda General) |
| Comentarios | No | vacío ("no se ven en la impresión") |

Tipo de nota de crédito (los motivos de la DGII): "Anula el NCF modificado", "Corrige texto documento de referencia", "Corrige monto". En el formulario no salió nada de B14/B15/B16 ni de e-CF.

Líneas: Producto/servicio, Referencia, Precio, Desc %, Impuesto, Descripción, Cantidad, Total. Al elegir el producto se llenan solos el precio (650), el descuento (0 %), el ITBIS (18 %) y la cantidad (1). Abajo salen Subtotal, ITBIS y Total.

**Qué se hace con el dinero** (abajo del formulario, dos opciones):
- **Hay devolución de dinero** (viene marcada): tabla con Fecha, Cuenta bancaria, Monto y Observaciones, más el enlace "Agregar devolución de dinero".
- **Crédito a facturas**: se eligen las facturas del cliente y el monto que se aplica a cada una.
- No hay una opción aparte de "saldo a favor". Lo que no se aplica sale en la ficha como "Por aplicar".

**Prueba**: B0400000001 para Constructora Prueba SRL, 1 Cemento gris 42.5kg a RD$650 + ITBIS RD$117 = **RD$767**, aplicada completa a la factura B0100000001. El saldo de esa factura bajó a RD$7,871 y la nota quedó con RD$0 por aplicar. Ficha: /credit-note/view/id/1 (`13-nc-venta-detalle.png`).

**Asiento que sale solo** (NC-B0400000001, 13/11/2026, `13-nc-venta-asiento.png`; para imprimirlo: /ledger/print/id/1/document/creditNote):

| Cuenta | Débito | Crédito |
|---|---|---|
| ITBIS por pagar (18 %, base 650) | 117 | |
| Devoluciones en ventas | 650 | |
| Cuentas por cobrar clientes | | 767 |
| Inventarios | 390 | |
| Costos del inventario | | 390 |
| **Total** | 1,157 | 1,157 |

O sea, la nota es la factura al revés: baja la venta (por una cuenta aparte, "Devoluciones en ventas"), baja el ITBIS y baja lo que debe el cliente. Además el cemento vuelve al inventario a su costo (390) y se reversa el costo de venta. Como aquí se aplicó a la factura, la cuenta por cobrar baja directo. No se probó la devolución de dinero, que debería acreditar el banco o la caja en vez de cuentas por cobrar.

### 13.2 Nota de débito de venta (/income-debit-note)

Está en Ingresos > Notas de débito. Formulario vacío `capturas/13-nd-venta-vacio.png`, lleno `13-nd-venta-lleno.png`.

| Campo | Obligatorio | Por defecto |
|---|---|---|
| Numeración | Lo pone sola | "Numeración notas débito en ingresos (03)", No. B03 00000001 |
| Cliente | Sí | vacío |
| Tipo de nota de débito | Sí | vacío |
| Fecha de creación | Sí | hoy |
| Documento asociado / Factura de venta asociada | Sí | vacío |
| Tipo de pago | Sí (sale al elegir la factura) | se puso Crédito |
| Método de pago | Sí (sale al elegir la factura) | se puso Venta a crédito |
| "Más ajustes": Almacén, Lista de precios, Vendedor | No | Principal, General, vacío |

Tipo de nota de débito: "Corrige texto del comprobante fiscal modificado" y "Corrige montos del NCF modificado". Al elegir la factura, el motivo sale solo: "Nota de débito a factura B0100000001."

Ojo: en la ficha guardada, Tipo de pago y Método de pago salen con las etiquetas al revés (parece un error de Alegra).

**Prueba**: B0300000001 para Constructora Prueba SRL, línea "Venta simple", descripción "Cargo por flete", 1 × RD$500 + ITBIS 18 % = **RD$590**. Estado "Generada" / "No electrónica". Ficha /income-debit-note/view/id/1 (`13-nd-venta-detalle.png`).

**Asiento** ND-B0300000001 (`13-nd-venta-asiento.png`): es igual al de una factura de venta.

| Cuenta | Débito | Crédito |
|---|---|---|
| Cuentas por cobrar clientes | 590 | |
| ITBIS por pagar | | 90 |
| Ventas | | 500 |

### 13.3 Nota de crédito en compras (devolución a proveedor, /debit-note)

Está en Compras > Notas de crédito en compras. Aunque el menú dice "nota de crédito", la URL es /debit-note y la numeración se llama "Numeración notas débito (03)" con prefijo B03. Vacío `13-nc-compra-vacio.png`, lleno `13-nc-compra-lleno.png`.

| Campo | Obligatorio | Por defecto |
|---|---|---|
| Numeración | La pone sola | B03 |
| Almacén | Sí | Principal ("Personalizar opciones" lo trae marcado) |
| Proveedor | Sí | vacío (RNC o Cédula y Teléfono se llenan solos al elegirlo) |
| Fecha | Sí | hoy |

No hay selector de tipo de nota. Líneas: Concepto, Precio (0), Desc % (0.0), Impuesto (Ninguno), Cantidad (1), Observaciones, Total.

Qué se hace con el dinero: "Agregar devolución de dinero" (a una cuenta de banco o caja) o "Agregar factura de proveedor" (aplicarlo a una factura de compra).

**Prueba**: B0300000001 para Cementos Prueba SA, 1 Cemento gris 42.5kg a RD$390 + ITBIS RD$70.20 = **RD$460.20**. No había factura de proveedor para enlazar, así que se registró la devolución completa a Banco Popular Prueba ("Devolución por 1 unidad de cemento"). Por aplicar RD$0. Ficha /debit-note/view/id/1 (`13-nc-compra-detalle.png`).

**Asiento** ND-B0300000001 (`13-nc-compra-asiento.png`):

| Cuenta | Débito | Crédito |
|---|---|---|
| Devoluciones a proveedores | 460.20 | |
| ITBIS a favor | | 70.20 |
| Inventarios | | 390 |

El cemento sale del inventario a su costo y se reversa el ITBIS que se había pagado. Lo que el proveedor debe queda en "Devoluciones a proveedores". El asiento de la nota no toca el banco aunque se marcó la devolución a Banco Popular Prueba. Ese movimiento debe ir en otro documento, que no se abrió.

Ojo: tanto la nota de débito de venta como la nota de crédito de compra usan B03 y las dos quedaron como B0300000001, cada una con su propia numeración.

### 13.4 Menú de Ingresos y Compras (como se ve en Fiel Ferreteria)

- **Ingresos**: Facturas de venta, Facturas de venta recurrentes, Pagos recibidos, Notas de crédito, Notas de débito, Cotizaciones, Conduces.
- **Compras** (no se llama "Gastos"): Facturas de proveedores, Pagos / Gastos, Gastos menores, Pagos recurrentes, Notas de crédito en compras, Órdenes de compra, Recepción de comprobantes.

## 14. Numeraciones y tipos de NCF (B01, B02, B14, B15, B16)

Está en Configuración > Facturación > Numeraciones, URL /resolution (/number-template da pantalla de acceso restringido). Lista: `capturas/14-numeraciones-lista.png`.

En Fiel Ferreteria ya vienen creadas y activas las 5 numeraciones de factura de venta. Ninguna tiene fecha de vencimiento y ninguna es electrónica:

| Nombre | Prefijo | Siguiente | Preferida |
|---|---|---|---|
| Crédito fiscal (01) | B01 | 2 | Sí |
| Consumo (02) | B02 | 2 | No |
| Régimen especial de tributación (14) | B14 | 1 | No |
| Gubernamentales (15) | B15 | 1 | No |
| Comprobante para exportación (16) | B16 | 1 | No |

Cada fila tiene la acción "Desactivar numeración". La "Preferida" es la que sale primero al hacer una factura.

**En la factura** (/invoice/add, `14-factura-tipos-ncf.png`) se elige el tipo de comprobante en una lista con esas mismas 5 opciones. Para Medoxigas: B14 se usa con zonas francas y régimen especial, B15 con el gobierno (hospitales públicos, licitaciones) y B16 con exportaciones. Se elige igual que B01 y B02, sin pasos extra.

**Nueva numeración** (`14-numeracion-vacia.png`, no se guardó nada):

| Campo | Obligatorio | Por defecto |
|---|---|---|
| Tipo de documento | Sí | Factura de venta (si se entra desde la lista filtrada) |
| Tipo (NCF) | Sí | vacío. Opciones: B01 Crédito fiscal, B02 Consumo, B14 Régimen especial, B15 Gubernamentales, B16 Exportación, Sin NCF |
| Nombre | Sí | vacío |
| Numeración automática | Casilla | marcada |
| Preferida | Casilla | desmarcada |
| Pie de factura | No | vacío |

En la forma genérica (/resolution/add) también salen Número inicial (obligatorio), Prefijo y Sucursal (opcionales). Su lista de Tipo de documento: Factura de venta, Nota de crédito, Nota de crédito en gastos, Recibo de caja, Gasto, Factura de proveedor, Cotización, Orden de compra, Conduce, Nota débito en ingresos, Ajuste de inventario. O sea, cada tipo de documento lleva su propio consecutivo, y por eso la nota de débito y la nota de crédito de compra pueden tener los dos el número B0300000001 (ver 13.3).

No salió ningún tipo E (e-CF). La facturación electrónica no se activó ni se tocó.

### 11.4 Depreciación de un activo (agregado a 11.3)

En la ficha del activo, cada fila de la tabla de proyección tiene un botón sin texto. Al darle, **la depreciación se registra al instante**, sin formulario y sin pedir confirmación (`capturas/16-depreciacion-form.png` es la tabla antes del clic). Ojo para Medoxigas: conviene pedir confirmación.

**Prueba**: se registró solo la fila 2026 de la "Camioneta reparto prueba", por RD$21,333.33. Después de eso, el valor depreciado es RD$21,333.33 y el valor actual RD$778,666.67 (`16-depreciacion-detalle.png`).

**Asiento que sale solo**: AC-3 (/ledger/documents/view/id/3, `16-depreciacion-asiento.png`). Tiene fecha **31/12/2026**, el cierre del periodo y no el día del clic. Es tipo "Ajuste contable (AC)", no "Depreciaciones (D)". Observación: "Se genera por la depreciación del activo Camioneta reparto prueba - 2026."

| Cuenta | Débito | Crédito |
|---|---|---|
| Depreciacion vehiculos y equipos de transporte (gasto) | 21,333.33 | |
| Depreciación vehículos y equipos de transporte (acumulada) | | 21,333.33 |

Las dos cuentas casi se llaman igual (una sin tilde), y eso confunde. En Medoxigas conviene nombrarlas distinto, por ejemplo "Gasto de depreciación" y "Depreciación acumulada".

### 13.5 Nota de crédito de venta con devolución en efectivo (no se pudo guardar)

Se intentó una segunda nota (B0400000002, no guardada) para Constructora Prueba SRL: tipo "Corrige monto", 1 Cemento gris 42.5kg, RD$650 + ITBIS 117 = RD$767, con devolución desde Caja general (`capturas/16-nc-devolucion-lleno.png`).

Lo que se aprendió de las reglas de Alegra:
- Al ponerle tipo de NCF, Alegra **obliga a ligar la nota a una factura** del cliente, y el monto aplicado a esa factura no puede estar vacío ni en 0.
- Si el monto se divide (RD$267 a la factura y RD$500 devueltos en efectivo), sale el error: **"El monto asociado a la factura debe ser igual al monto total de la nota de crédito."**
- O sea, la nota con NCF B04 siempre tiene que apuntar a una factura por su monto completo. No se encontró cómo devolver el efectivo desde la misma nota cuando también se liga a una factura. Por eso no se vio el asiento de una devolución en efectivo.

Para Medoxigas: la nota de crédito siempre referencia la factura (el NCF modificado) por el total, y la devolución de dinero, si la hay, se maneja aparte.

## 17. Cierre, órdenes de compra, recurrentes y recepción de comprobantes

Todo esto se miró sin guardar nada.

### 17.1 Cierre de periodos (/closing-periods)

`capturas/17-cierre.png`. Es una pantalla de control del año 2026. Noviembre y diciembre salen "Abierto" y no tienen fechas de último cierre ni de apertura. Tiene el botón **"Cerrar año"**, que no se tocó. La pantalla no dice a qué cuenta cierra ni si se puede deshacer. La ayuda de Alegra (abrió la versión de México) dice que al cerrar el año se elige una cuenta y se crea un asiento de cierre, y que un periodo cerrado se puede volver a abrir. No se vio una cuenta por defecto como "utilidad del ejercicio". Recordar: la depreciación del activo de prueba quedó con fecha 31/12/2026 (ver 11.4).

### 17.2 Orden de compra (/purchase-order/add)

`17-orden-compra-vacia.png`.

| Campo | Obligatorio | Por defecto |
|---|---|---|
| Proveedor | Sí | vacío (RNC/Cédula y teléfono se llenan al elegirlo) |
| Fecha | Sí | hoy |
| Fecha de entrega | Sí | hoy |
| Almacén | Sí ("Personalizar opciones" lo trae marcado) | Principal |
| Moneda | No | sin elegir (la lista salió vacía) |
| Términos, notas, comentarios | No | vacío |

Líneas: concepto, precio, desc %, impuesto, cantidad (1), observaciones, total. La lista dice que la orden **es un documento de control y no mueve inventario**. No se vio que haga asiento.

### 17.3 Pago recurrente (/recurring-payment/add)

`17-pago-recurrente-vacio.png`. Sirve para gastos fijos que se repiten, como alquiler o luz.

| Campo | Obligatorio | Por defecto |
|---|---|---|
| Numeración | Sí | Gasto (opciones: Gasto, Comprobante para pagos al exterior (17), Numeración gastos menores (13)) |
| Cuenta (de dónde sale el dinero) | Sí | vacío (opciones: Tarjeta de crédito empresarial, Caja general, Caja chica, Banco Popular Prueba, Banco 1) |
| Forma de pago | Sí | vacío (Efectivo, Cheque, Transferencia, Depósito, Tarjeta débito, Tarjeta crédito, Venta a crédito, Permuta, Mixto, Compra a crédito) |
| Fecha de inicio | Sí | mañana (14/11/2026) |
| Frecuencia (meses) | Sí | vacío (es un número, no una lista) |
| Vigencia hasta | No | vacío |
| Contacto, Observaciones | No | vacío |

### 17.4 Factura de venta recurrente (/recurring-invoice/add)

`17-factura-recurrente-vacia.png`. Sirve para clientes con contrato fijo, como alquiler de cilindros o un suministro mensual.

| Campo | Obligatorio | Por defecto |
|---|---|---|
| Numeración | Sí | — |
| Generar como | Sí | Borrador |
| Contacto | Sí | vacío |
| Fecha de inicio | Sí | mañana (14/11/2026) |
| Plazo de pago | Sí | — |
| Frecuencia (meses) | Sí | 1 |
| Lista de precios | Sí | General |
| Almacén | Sí | Principal |
| Vigencia hasta, Observaciones, Notas de la factura | No | vacío |

Líneas como en la factura normal. Importante: por defecto la factura se genera como **borrador**, así que alguien la revisa antes de emitirla.

### 17.5 Recepción de comprobantes (/stamp-document-received)

`17-recepcion-comprobantes.png`. Sirve para recibir los e-CF (facturas electrónicas) que mandan los proveedores, aprobarlos y registrarlos solos como facturas de proveedor. Solo funciona con la facturación electrónica activa. Muestra el botón "Habilitar facturación electrónica", que **no se tocó**.

## 18. Copia del diseño del formulario de factura

Se guardó el formulario vacío de nueva factura con su CSS en `css-factura/`, como referencia de diseño. `index.html` + `styles.css` abren bien sin Alegra; los detalles y límites están en [css-factura/NOTA.md](css-factura/NOTA.md). Capturas: `capturas/18-factura-original.png` (Alegra) y `capturas/18-factura-copia-local.png` (copia local).

Guía de diseño para rehacer nuestro formulario de factura: tiene medidas, grid/flex, columnas, colores, tipografía, CSS y HTML propios, equivalentes en Tailwind y una lista para comparar. Está en [css-factura/GUIA-DISENO-FACTURA.md](css-factura/GUIA-DISENO-FACTURA.md). Capturas: `capturas/18-guia-*.png`.

## Inicio (dashboard)

Ruta: `/` (menú izquierdo "Inicio"). Revisado el 13/11/2026 en Fiel Ferreteria, solo mirando. No se creó, ocultó ni borró nada. El filtro quedó en "Mes actual".

La página es corta: todo cabe en una pantalla sin scroll, así que `12-inicio-arriba.png`, `-medio.png` y `-abajo.png` son la misma imagen. Abajo de la gráfica no hay nada más (solo un botón flotante teal "?" de ayuda, abajo a la derecha). Ojo: `12-inicio-arriba.png` salió mientras cargaban los datos (las tarjetas dicen RD$0.00). Los valores ya cargados se ven en `12-inicio-agregar-grafica-abierto.png`. Al cargar, las tarjetas muestran primero RD$0.00 o un bloque gris (skeleton) y luego se llenan.

Orden de la página, de arriba a abajo:

### Bloque 1. "Funciones sugeridas" (guía de inicio)

- Título h2 "Funciones sugeridas". Subtítulo: "Basados en tus necesidades, hemos preparado estas funciones ideales para ti."
- Enlace "Ocultar" arriba a la derecha del panel. No se probó, porque podría ocultarlo para siempre.
- Columna izquierda con 5 pasos. Los completados salen con check verde y tachados:
  1. "Facturación electrónica": sin completar, seleccionado por defecto.
  2. "Crea tu primera factura": completado.
  3. "Organiza tu inventario": completado.
  4. "Añade tus contactos": completado.
  5. "Administra usuarios y roles": sin completar.
- Debajo de la lista: "3 de 5 funcionalidades completadas".
- Panel derecho: cambia según el paso que se elija.
  - "Facturación electrónica": ícono de documento, título "Activa tu facturación electrónica", texto "Configura tu facturación electrónica para tener todo organizado y al día con la DGII." y botón teal "Activar facturación ↗". No se dio clic (es e-CF).
  - "Administra usuarios y roles": título "Gestiona tus usuarios", texto "Protege tu información asignando roles y permisos a tu equipo de trabajo." y botón "Configurar usuarios ↗", que abre una pestaña nueva en `https://mi.alegra.com/users`.
  - No se vio el panel de los pasos 2, 3 y 4.
- Capturas: `12-inicio-sugeridas-facturacion.png`, `12-inicio-sugeridas-usuarios.png`.

### Bloque 2. Encabezado "Resumen del negocio"

- Título h1 "Resumen del negocio" a la izquierda. A la derecha hay dos botones:
- **Filtro de periodo** (botón blanco con flecha, por defecto "Mes actual"). Se aplica a las tarjetas y a la gráfica. Tiene 3 opciones; cada una muestra su rango de fechas debajo, en gris:
  - "Mes actual": 01/11/2026 - 13/11/2026 (desde el día 1 hasta hoy).
  - "Últimos 3 meses": 13/08/2026 - 13/11/2026.
  - "Últimos 6 meses": 13/05/2026 - 13/11/2026.
  - No hay rango personalizado.
- **"Agregar gráfica"** (botón teal con flecha). Abre un menú con 4 gráficas opcionales, cada una con ícono: "Flujo de transacciones", "Distribución de gastos", "Productos más vendidos" y "Mejores clientes". No se agregó ninguna, así que no se sabe cómo se ven.
- Capturas: `12-inicio-periodo-cerrado.png`, `12-inicio-periodo-abierto.png`, `12-inicio-agregar-grafica-cerrado.png`, `12-inicio-agregar-grafica-abierto.png`.

### Bloque 3. Tarjetas de cifras (KPI)

Hay dos tarjetas grandes (Cuentas por cobrar y Cuentas por pagar) y, a su derecha, una cuadrícula de 2×2 con cuatro tarjetas chicas. Al pasar el mouse sobre cualquier tarjeta sale un ícono de basura. Ese ícono abre el diálogo "Eliminar gráfica", con el texto `Al confirmar, se eliminará la gráfica "Cuentas por cobrar" de tu resumen.` y los botones "Conservar" y "Sí, eliminar". Se dio "Conservar". O sea, cada tarjeta se puede quitar y volver a poner con "Agregar gráfica". Captura: `12-inicio-tarjeta-eliminar-dialogo.png`.

En el título de algunas tarjetas hay un enlace (subrayado). Los "a dónde lleva" marcados como verificados se probaron dando clic.

| Tarjeta | Valor en "Mes actual" | Qué muestra | Clic lleva a |
|---|---|---|---|
| "Cuentas por cobrar" (grande) | RD$7,871.00 | Total arriba. Debajo, una barra verde con "Vigentes" RD$7,871.00 y "1 documento", y una barra roja con "Vencidas" RD$0.00 y "0 documentos". Sale de las facturas de venta con saldo pendiente (vigentes = no vencidas). | `/report/invoices-open/from/2026-11-01/to/2026-11-13` (verificado) |
| "Cuentas por pagar" (grande) | RD$0.00 | Igual que la anterior, pero con facturas de proveedor: "Vigentes" RD$0.00, 0 documentos; "Vencidas" RD$0.00, 0 documentos. | `/report/bills-open/from/2026-11-01/to/2026-11-13` (verificado) |
| "Impuestos en venta" | RD$3,303.00 | Impuestos (ITBIS) de las ventas del periodo. | El enlace apunta a `/` y se queda en el Inicio |
| "Productos vendidos" | 42 | Cantidad de unidades vendidas en el periodo (dato de Alegra; no se cuadró contra las facturas). | El enlace apunta a `/` (no se probó) |
| "Devoluciones de clientes" | RD$767.00 | Subtítulo "Incluye impuestos". Coincide con la nota de crédito B0400000001 de RD$767 (sección 13.1). | El enlace apunta a `/` (no se probó) |
| "Clientes con ventas" | 2 | Clientes distintos con ventas en el periodo. | `/report/sales-by-client/from/2026-11-01/to/2026-11-13` (verificado) |

Los enlaces a reportes llevan en la URL el rango de fechas del filtro de periodo. Al cambiar a "Últimos 3 meses" y "Últimos 6 meses", todas las cifras quedaron iguales, porque los datos de prueba son de noviembre. "Cuentas por cobrar" pasó un momento por skeleton y luego mostró RD$7,871.00 en 3 meses; en 6 meses no se esperó a que cargara.

### Bloque 4. Gráfica "Total de ventas"

- Título "Total de ventas" (enlace) con un ícono "ⓘ". Subtítulo: "La gráfica muestra el valor de tus ventas con impuestos incluidos."
- Arriba a la derecha está el total del periodo, "RD$21,653.00", con una etiqueta "0%" al lado. Esa etiqueta parece ser la variación contra el año anterior, pero no se comprobó.
- El título lleva a `/report/sales/from/2026-11-01/to/2026-11-13` (verificado).
- Al pasar el mouse salen dos íconos: expandir (⤢), que abre la misma gráfica en un modal grande con "×" para cerrar, y basura (no se probó). Captura: `12-inicio-grafico-expandido.png`.
- **Con "Mes actual", la gráfica es de líneas:**
  - Eje X: un punto por día, "1 nov" … "13 nov".
  - Eje Y: RD$0, RD$5 K, RD$10 K, RD$15 K, RD$20 K, RD$25 K.
  - Serie 1, línea sólida azul oscuro: "1 nov de 2026 - 13 nov de 2026". Está en 0 hasta el 12 nov y sube a unos RD$22 K el 13 nov. Como todas las ventas de prueba son del 13/11, no se sabe si la línea es diaria o acumulada.
  - Serie 2, línea punteada verde: el mismo rango del año anterior ("1 nov de 2025 - 13 nov de 2025"). Está en RD$0.
  - La leyenda de abajo solo muestra la serie azul, "1 nov de 2026 - 13 nov de 2026".
  - El tooltip, al pasar sobre 13 nov, muestra el encabezado "13 nov" y dos líneas con un punto de color: "1 nov de 2026 - 13 nov de 2026: RD$22 K" y "1 nov de 2025 - 13 nov de 2025: RD$0". Captura: `12-inicio-grafico-tooltip.png`.
- **Con "Últimos 3 meses" o "Últimos 6 meses", la gráfica es de barras por mes:**
  - Eje X: Nov, Oct, Sept, Ago (en 6 meses también Jul, Jun, May). El mes más reciente sale a la izquierda.
  - Eje Y: RD$0 a RD$25 K. Leyenda: "2026", en azul.
  - Solo la barra de Nov tiene altura. El tooltip dice "Nov" y "2026: RD$21,653.00".
  - Capturas: `12-inicio-grafico-barras-tooltip.png`, `12-inicio-periodo-3meses.png`, `12-inicio-periodo-6meses.png`.

### Lo que no se vio

- Las 4 gráficas de "Agregar gráfica" (no se agregaron).
- Qué pasa con "Ocultar" en Funciones sugeridas.
- Los paneles de los pasos 2, 3 y 4.
- La basura de la gráfica.
- La fórmula exacta de "Productos vendidos" y de la etiqueta "0%".

## Formularios de pago

Revisado el 13/11/2026 en Fiel Ferreteria, solo mirando: no se guardó ningún pago. Capturas en `capturas/19-pago-*.png` y `capturas/19-guia-*.png`. Copias offline de las dos páginas en `css-pagos/` (ver `css-pagos/NOTA.md`).

### 1. Nuevo pago recibido

Ruta: `/income-payments/add` (Ingresos > Pagos recibidos > "Nuevo pago recibido"). Título de la página: "Nuevo pago recibido". Lista: `/income-payments`. Revisado sin guardar nada.

**Encabezado** (`19-pago-recibido-encabezado.png`, recorte ampliado):
- A la izquierda, el nombre de la empresa "Fiel Ferreteria". En este formulario **no sale el RNC**.
- A la derecha, "No. 5" y debajo "Recibo de caja", con un lápiz.
- El lápiz abre el modal "Cambiar numeración" (`19-pago-recibido-lapiz.png`, `-lapiz-numeracion.png`):
  - "Numeración *": por defecto "Recibo de caja". Opciones: "Numeración registro único de ingreso (12)" y "Recibo de caja".
  - "Siguiente numero *": por defecto 5.
  - Botones "Cancelar" y "Guardar cambios" (este último desactivado hasta que se cambia algo).

**Campos** (en orden; `19-pago-recibido-vacio-arriba.png`):

| Campo | Obligatorio | Defecto / placeholder | Opciones | Captura |
|---|---|---|---|---|
| Cliente | No lleva asterisco, pero sin cliente no salen facturas | "Seleccionar" | Lista paginada de 5 en 5 ("1-5 de 9"), con el RNC o cédula debajo del nombre y el enlace "Crear nuevo cliente" | `-cliente.png`, `-cliente-pag2.png` |
| Cuenta bancaria | Sí (*), con ícono de ayuda | "Seleccionar" | Banco 1, Banco Popular Prueba, Caja chica, Caja general, Tarjeta de crédito empresarial | `-cuenta-bancaria.png` |
| Fecha de pago | Sí (*) | hoy (13/11/2026), con ícono de calendario y × para borrar | calendario de un mes con selectores de mes y año | `-fecha-pago.png` |
| Forma de pago | Sí (*) | "Seleccionar" | Efectivo, Cheque, Transferencia, Depósito, Tarjeta débito, Tarjeta crédito, Venta a crédito, Permuta, Bonos o certificados de regalos, Otras formas de ventas | `-forma-pago.png` |
| Centro de costo | No, con ícono de ayuda | "Seleccionar" | vacío en esta empresa ("0-0 de 0") | `-centro-costo.png` |

Al elegir el cliente "Constructora Prueba SRL", Alegra llenó solas la Cuenta bancaria ("Caja general") y la Forma de pago ("Transferencia"). Parece que usa los datos del último pago de ese cliente o los de su ficha; no se comprobó cuál de los dos.

**Tipo de ingreso**: un interruptor de dos pestañas, "Pago a factura de cliente" (por defecto) y "Otros ingresos". Los campos de arriba no cambian entre pestañas; solo cambia el bloque del medio.

**Pestaña "Pago a factura de cliente"**
- Sin cliente elegido sale un aviso azul: "Selecciona un cliente para traer sus facturas por cobrar."
- Si el cliente no debe nada, sale un aviso amarillo: "El cliente seleccionado no tiene facturas pendientes de cobro." (`-cliente-sin-facturas.png`, con Juan Pérez).
- Con facturas pendientes sale la tabla (`19-pago-recibido-facturas.png`):
  - Título "Facturas por cobrar" y subtítulo "Agrega el monto recibido a las facturas relacionadas con este ingreso."
  - Buscador con el placeholder "Buscar por número de factura".
  - Columnas: **Número** | **Vencimiento** | **Total** | **Retenciones** | **Por cobrar** | **Monto recibido**.
  - Ejemplo: B0100000001, 13/12/2026, RD$ 16,638.00, "RD$ 0" con lápiz, RD$ 8,461.00, campo "RD$ 0".
  - Paginación "1-1 de 1" con flechas.
  - **Vencimiento en rojo**: no se pudo ver. La única factura pendiente no está vencida, y su fecha sale en gris normal.
- **Monto recibido** (`-monto-escribiendo.png`, `-monto.png`):
  - Al escribir sale un globo con "RD$8,461.00 Restante por pagar".
  - Al salir del campo, este queda "RD$ 1,000" y el Total de abajo pasa de RD$ 0.00 a RD$ 1,000.00.
  - No hay botón para "pagar todo"; el monto se escribe a mano.
- **Lápiz de Retenciones**: abre el modal "Retenciones aplicadas" (`-retenciones-modal.png`, `-retenciones-dropdown.png`).
  - Arriba dice "Número de factura: B0100000001" y "Monto pendiente: RD$ 8,461.00".
  - Cada fila tiene "Tipo de retención *" ("Seleccionar") y "Valor retenido *" (RD$, en 0), con una × para quitar la fila. Debajo está "+ Agregar otra retención".
  - Pie: "Los campos marcados con * son obligatorios". Botones "Cancelar" y "Guardar" (desactivado hasta llenar).
  - Opciones de Tipo de retención (los cortes con "..." son de Alegra):
    - Retencion ITBIS: 30%, 75% y 100%
    - Alquileres del 10% (10%) y Alquileres del 15% (15%)
    - Honorarios por servicios del...: 10% y 15%
    - Otras rentas Ley 11-92 del 1...: 10% y 15%
    - Otras rentas Decreto 139-98 ...: 2% y 3%
    - Otras retenciones Norma 07-2...: 2% y 3%
    - Premios Ley 253-12 del 25% (25%)
    - Transferencia de título y pr... (2%)
    - Dividendos del 10% (10%)
    - Intereses jurídicas no resid...: 10% y 5%
    - Intereses físicas no residen...: 10% y 5%
- **Varias facturas**: no se pudo probar. El único cliente con deuda tiene una sola factura, y guardar estaba fuera de esta revisión. Por cómo está hecha la tabla, cada fila lleva su propio "Monto recibido" y el Total suma todas las filas; un solo recibo puede cubrir varias facturas. Lo que hace el asiento con varias facturas no se vio. Con una factura, el asiento del recibo está en la sección 3 ("Pago recibido (abono parcial)", `04-pago-recibido-asiento.png`).

**Pestaña "Otros ingresos"** (`-otros-ingresos.png`, `-otros-cuenta.png`)
- La tabla de facturas se cambia por "Cuentas contables", con el subtítulo "Selecciona las cuentas contables que están relacionadas con este ingreso".
- Columnas: **Concepto** | **Cantidad** | **Valor** | **Impuesto** | **Total**, y una × para borrar la fila.
  - Concepto: "Seleccionar".
  - Cantidad: placeholder 1.
  - Valor: RD$, placeholder 0.
  - Impuesto: "Seleccionar". No se abrió.
  - Total: RD$ 0.00.
- El Concepto es el catálogo de cuentas en árbol, con niveles sangrados y carga por páginas. Empieza así: Activos > Activos corrientes > Efectivo y equivalentes > Caja (Caja general, Caja chica), Bancos (Banco Popular Prueba, Banco 1), Deudores comerciales > Cuentas por cobrar clientes…
- Debajo van "+ Agregar línea", luego una sección "Retenciones" con "+ Agregar retención", y después Total.

**Debajo de la tabla, en las dos pestañas**
- "Total RD$ 0.00", alineado a la derecha.
- "Notas", un área de texto con el placeholder "Agrega detalles adicionales que serán visibles en la impresión."
- Un solo botón: **"Guardar"**, teal. No hay botón "Cancelar" en la página, ni menú "Guardar y …", ni "Adjuntar archivos", ni Subtotal.
- Al salir sin guardar (con clic en el menú izquierdo), Alegra no pidió confirmar.
- Más abajo hay un panel de "Comentarios" y "Recordatorios":
  - Filtro "Recientes" y el texto "Aún no hay comentarios".
  - Una caja "Escribir un comentario" con el texto "Menciona con @, asigna tareas o agenda recordatorios para tu equipo" y un contador de 0/1000.
- `19-pago-recibido-botones.png` es la misma imagen que `-otros-ingresos.png`.

### 2. Nuevo pago a proveedor (Compras > Pagos / Gastos > "Nuevo pago")

Ruta: `/payment/add`. Título "Nuevo pago" y el subtítulo "Los comprobantes de egreso te ayudarán a respaldar los gastos o salidas de dinero de tu empresa." Lista: `/payment`.

**Ojo: este formulario tiene un diseño distinto al de pago recibido.** Pago recibido usa el diseño nuevo: una sola tarjeta, rejilla de 3 columnas y pestañas. Pago a proveedor usa el diseño viejo: dos tarjetas ("Información general del pago" y "Cuentas contables"), campos en 3 columnas que no llenan la tarjeta y botones Cancelar y Guardar abajo, fuera de las tarjetas. Compara `19-pago-recibido-facturas.png` con `19-pago-proveedor-vacio.png`.

**Arriba de la tarjeta**: un aviso azul con la "i", que se puede cerrar con ×: "Para **trasladar dinero** entre tus **cuentas bancarias**, utiliza la opción de [Transferencias bancarias]."

**Tarjeta 1: "Información general del pago"** (subtítulo "Indica los detalles generales asociados a este egreso")
- Arriba a la derecha:
  - Selector de numeración. Por defecto "Gasto"; opciones "Gasto" y "Comprobante para pagos al exterior (17)" (`19-pago-proveedor-numeracion-dropdown.png`).
  - Debajo, "No." con el número 3 y un lápiz. El lápiz no abrió nada en la prueba (`19-pago-proveedor-encabezado.png`).
  - No sale el nombre de la empresa ni el RNC.

| Campo | Obligatorio | Defecto | Opciones | Captura |
|---|---|---|---|---|
| Contacto | No | vacío | "Nuevo contacto" y luego todos los contactos (clientes y proveedores mezclados) | `-contacto.png` |
| Cuenta bancaria | Sí (*), con ícono de ayuda | vacío | Agrupadas: Bancos (Banco Popular Prueba, Banco 1), Tarjeta de crédito (Tarjeta de crédito empresarial), Efectivo (Caja general, Caja chica) | `-cuenta-bancaria.png` |
| Fecha | Sí (*) | hoy, 13/11/2026 | calendario con LU…DO | `-fecha.png` |
| Forma de pago | Sí (*) | vacío | Efectivo, Cheque, Transferencia, Depósito, Tarjeta débito, Tarjeta crédito, Venta a crédito, Permuta (sale dos veces), Bonos o certificados de regalos, Mixto, Otras formas de ventas, Compra a crédito | `-forma-pago.png` |
| Moneda | Sí (*), con ícono de ayuda | DOP | DOP y "Nueva moneda" | `-moneda.png` |
| Nota de egreso | No | vacío | área de texto ancha (2 columnas) | `19-pago-proveedor-vacio.png` |

Al lado de Nota de egreso va el texto "Los campos marcados con * son obligatorios." Este formulario **no tiene Centro de costo**.

**Facturas pendientes del proveedor**
- Hoy ningún contacto de Fiel Ferreteria tiene facturas de proveedor pendientes: la única, B0100000050, ya se pagó con CE-1.
- Al elegir cualquier contacto sale el aviso: "El proveedor no tiene facturas pendientes de pago. Puedes asociar una cuenta contable a este egreso." (`19-pago-proveedor-sin-facturas.png`).
- Por eso hoy no se pudo ver la tabla de facturas por pagar ni su lápiz de retenciones.
- Cuando sí había deuda, la tabla salía como "Facturas pendientes". Eso está en la sección 3 (CE-1) y en la captura `06-pago-proveedor-lleno.png`.
- **No hay pestañas** como en pago recibido. La tabla de facturas (si hay) y la de cuentas contables salen juntas en la misma página.

**Tarjeta 2: "Cuentas contables"** (subtítulo "Selecciona a qué cuentas contables pertenece este egreso.")
- Columnas: **Concepto** | **Valor** | **Impuesto** | **Cantidad** | **Observaciones** | **Total**, y una × para borrar la fila. El orden es distinto al de "Otros ingresos", que es Concepto, Cantidad, Valor, Impuesto, Total.
  - Concepto: "Seleccionar".
  - Valor: 0.
  - Impuesto: "Ninguno".
  - Cantidad: 1.
  - Observaciones: placeholder "Descripción".
  - Total: RD$0.00.
- El Concepto es el catálogo en árbol, empezando por Gastos > Gastos de venta > Gastos de personal de ventas > … (`19-pago-proveedor-cuenta-contable.png`).
- Opciones de Impuesto: "Nuevo impuesto", Ninguno, ITBIS (18.00%), ITBIS 16% (16.00%), ITBIS 0% (0.00%), Exento (0.00%), Propina (10.00%) y CDT (2.00%) (`19-pago-proveedor-impuesto.png`).
- Debajo va el enlace teal "+ Agregar cuenta contable".
- Luego viene la sección plegable "Retenciones sobre valores de cuentas contables" (`19-pago-proveedor-retenciones-cuentas.png`):
  - Su texto: "Aplica retenciones únicamente a los valores registrados en Cuentas contables. Estas retenciones no afectan las facturas de compra".
  - Remite al "Valor retenido" de la tabla de facturas, con el enlace "Ir a facturas pendientes".
- En la imagen vacía no se ve un Total general aparte.

**Abajo**
- Un panel "Comentarios" con ícono de ayuda, una caja "Escribe un comentario" y el texto "Utiliza los comentarios para agregar información importante. No son visibles en la impresión."
- Abajo a la derecha, fuera de las tarjetas, van los botones **"Cancelar"** (blanco con borde) y **"Guardar"** (teal). Guardar no tiene menú.
- Al salir sin guardar, Alegra no pide confirmar.

### 3. Guía de estilo de los formularios

La guía completa, con medidas tomadas de las copias locales, está en [`css-pagos/GUIA-FORMULARIOS.md`](css-pagos/GUIA-FORMULARIOS.md). Las capturas con medidas son `19-guia-pago-recibido.png`, `19-guia-rejilla.png`, `19-guia-campo.png`, `19-guia-botones.png` y `19-guia-pago-proveedor.png`.

Lo principal, del diseño nuevo (pago recibido), que es el que conviene copiar:
- **Página**
  - Fondo `#f4f5fb`, letra Inter y contenido de máximo 1040 px.
  - Título de la página fuera de la tarjeta, en 20 px, peso 600 y color `#0f172a`.
- **Tarjeta**
  - Blanca, con radio 12 y borde 1 px `#e2e8f0`, sin sombra.
  - Los campos quedan a unos 33 px del borde.
- **Rejilla**
  - 3 columnas desde 768 px de ancho, con 32 px entre columnas y 16 px entre filas.
  - Abajo de 768 px pasa a 2 columnas.
- **Etiqueta**
  - 14 px, peso 500, color `#334155`, a 4 px encima del campo.
  - El asterisco va en teal `#30aba9`, a 12 px; el "?" de ayuda es de 18 px.
- **Campo**
  - 40 px de alto, radio 10 y borde 1 px `#cbd5e1`.
  - El borde pasa a `#94a3b8` al pasar el mouse y a 2 px `#30bbb7` al escribir.
  - Texto de 16 px; el placeholder va en `#94a3b8`.
- **Pestañas**
  - Barra gris de 42 px con radio 8.
  - La pestaña activa es una píldora blanca de 32 px con sombra suave.
- **Botones**
  - Un solo "Guardar" teal `#30aba9` de unos 109×44, con radio 12, fuera de la tarjeta, 24 px debajo y alineado a la derecha. No hay Cancelar.
  - En el diseño viejo (pago a proveedor) van "Cancelar" (blanco con borde) y "Guardar" (teal), los dos de unos 97×36, también fuera de las tarjetas y abajo a la derecha.
- **Sin medir**: la tabla de facturas con datos, los estados de error, el hover de los botones y la pantalla de menos de 640 px.
