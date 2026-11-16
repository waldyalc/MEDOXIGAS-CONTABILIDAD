# Tablas unificadas — patrón «Facturas de venta»

Auditoría de diseño para Coder. Rama `diseno/tablas-unificadas`, 16 nov 2026.
Alcance de esta auditoría: solo frontend (`src/app`, `src/components`, `docs`). No toca backend, datos, `src/lib`, `supabase` ni tests existentes. La implementación va después, en las fases de este documento.

## 0. Decisión

- El default de **todas** las tablas es la lista **Facturas de venta** tal como está hoy en la app (captura de Waldy adjunta a este pedido), que a su vez sigue `docs/alegra/css-tablas/GUIA-TABLAS.md`. No se copia HTML/CSS de Alegra: se copian medidas y comportamiento con Tailwind + shadcn y tokens Medoxigas.
- Se copia el **patrón** (tarjeta, toolbar, cabecera, filas, pills, paginación, vacío), **no las features**. Si una lista no tiene buscador, filtros, selección o acciones, no se inventan. En particular: **si no hay un filtro real, no se pinta el botón «Filtrar»**.
- Nada que necesite un dato que la consulta no trae: se marca `// TODO backend` y se avisa a Waldy (regla de `docs/diseno/README.md`).
- La captura manda sobre la guía cuando choquen: la Facturas actual **no** lleva checkbox, acciones por fila ni «Filtrar», y así se queda por ahora.

> **Nota de espaciado (16 nov 2026, pedido de Waldy):** la captura de Alegra se veía más aireada que la primera implementación. El patrón vigente sube toolbar y pie a **56 px** (`h-14`, `px-4`), cabecera a **48 px** (`h-12`) y filas a **56 px** (`h-14`), con padding horizontal de **20 px** (`px-5`) y **24 px** en la primera/última celda (`pl-6`/`pr-6`). La densidad compacta queda en **44 px** (`h-11`) con **16 px** (`px-4`) y el vacío en `py-16`. La tarjeta se centra en un `ContenedorLista` de `max-w-[1289px]` (`mx-auto`). Donde §2 o §3.3 digan 40/48 px o padding 16, manda esta nota.

## 1. Inventario

**Cómo leerlo.** `B` buscador, `F` filtros, `P` paginación, `S` selección múltiple, `A` acciones por fila, `V` estado vacío. `(s)` = servidor (URL/consulta), `(l)` = local (estado del cliente). `Patrón`: ✅ ya se ve como Facturas, ◐ a medias (card o tabla sí, pills/paginación no), ✗ no se parece. Prioridad: **P0** producto/cliente/facturas, **P1** pagos y notas + documentos, **P2** resto de listas y configuración, **P3** detalle/líneas (solo fase 6), **Excl.** no se migra.

`D/…` = `src/app/(main)/dashboard/…`. `C/…` = `src/components/…`.

### 1.1 Ventas y documentos

| # | Archivo · ruta | Tipo | Columnas | B/F/P/S/A/V | Patrón | Prio |
|---|---|---|---|---|---|---|
| 1 | `D/facturacion/page.tsx` + `D/facturacion/_components/facturas-tabla.tsx` · `/dashboard/facturacion` | Lista principal | #, NCF, Tipo, Cliente, Fecha, Vencimiento, Total, Por cobrar, Estado | B(s), P(s), V | ✅ | Hecho (canónico) |
| 2 | `D/facturacion/[id]/page.tsx` · `/dashboard/facturacion/[id]` | Detalle | Líneas + pestañas Pagos / Notas crédito / Notas débito / Contabilidad | tabs, sin B/P | ✗ | P3 |
| 3 | `D/notas-credito/page.tsx` + `_components/notas-credito-tabla.tsx` · `/dashboard/notas-credito` | Lista | #, NCF, Factura, Cliente, Fecha, Total, Estado | B(s), P(s), V | ◐ | P1 |
| 4 | `D/notas-debito/page.tsx` + `_components/notas-debito-tabla.tsx` · `/dashboard/notas-debito` | Lista | #, NCF, Factura, Cliente, Fecha, Tipo, Total, Estado | B(s), P(s), V | ◐ | P1 |
| 5 | `D/cotizaciones/page.tsx` + `_components/documentos-tabla.tsx` · `/dashboard/cotizaciones` | Lista | Número, Cliente, Creación, Estado, Total | B(s), P(s), V | ◐ | P1 |
| 6 | `D/conduces/page.tsx` (reusa `documentos-tabla.tsx`) · `/dashboard/conduces` | Lista | Número, Cliente, Creación, Estado, Total | B(s), P(s), V | ◐ | P1 |
| 7 | `D/facturas-recurrentes/page.tsx` + `_components/facturas-recurrentes-tabla.tsx` · `/dashboard/facturas-recurrentes` | Lista | #, Cliente, Frecuencia, Inicio, Hasta, Última generación, Facturas | B(s), P(s), V | ◐ | P2 |
| 8 | `D/facturas-recurrentes/[id]/page.tsx` · `…/[id]` | Detalle | Líneas + historial de facturas | sin B/P | ✗ | P3 |

### 1.2 Pagos y gastos

| # | Archivo · ruta | Tipo | Columnas | B/F/P/S/A/V | Patrón | Prio |
|---|---|---|---|---|---|---|
| 9 | `D/pagos-recibidos/page.tsx` + `_components/pagos-tabla.tsx` · `/dashboard/pagos-recibidos` | Lista | #, Fecha, Cliente, Factura, Método, Monto, Estado | B(s), P(s), V | ◐ | P1 |
| 10 | `D/pagos-recibidos/[id]/page.tsx` · `…/[id]` | Detalle | Número, NCF, Monto, Retención | sin B/P | ✗ | P3 |
| 11 | `D/pagos-recurrentes/page.tsx` · `/dashboard/pagos-recurrentes` | Lista | Nombre, Contacto, Cuenta gasto, Cuenta pago, Frecuencia, Próximo periodo, Monto, Estado, Acción | A, V, sin B/F/P | ✗ | P2 |
| 12 | `D/pagos-recurrentes/[id]/page.tsx` · `…/[id]` | Detalle | Gasto, NCF, Fecha, Periodo, Asiento, Total, Estado | sin B/P | ✗ | P3 |
| 13 | `D/gastos/page.tsx` + `_components/gastos-tabla.tsx` · `/dashboard/gastos` | Lista | #, Comprobante, Fecha, Descripción, Proveedor, Cuenta, Pagado desde, Subtotal, ITBIS, Total, Estado | B(s), P(s), V | ◐ | P1 |

### 1.3 Compras

| # | Archivo · ruta | Tipo | Columnas | B/F/P/S/A/V | Patrón | Prio |
|---|---|---|---|---|---|---|
| 14 | `D/compras/page.tsx` · `/dashboard/compras` | Lista | Número, No./NCF, Proveedor, Fecha, Vencimiento, Total, Pagado, Por pagar, Estado | B(s), P(s), V | ◐ | P1 |
| 15 | `D/compras/pagos/page.tsx` · `/dashboard/compras/pagos` | Lista | Número, Proveedor, Factura, Fecha, Método, Cuenta, Monto, Estado | B(s), P(s), V | ◐ | P1 |
| 16 | `D/compras/pagos/[id]/page.tsx` · `…/pagos/[id]` | Detalle | Número, NCF, Monto, Retención | sin B/P | ✗ | P3 |
| 17 | `D/compras/notas-credito/page.tsx` · `/dashboard/compras/notas-credito` | Lista | Número, NCF, Factura de proveedor, Proveedor, Fecha, Total, Estado | B(s), P(s), V | ◐ | P1 |
| 18 | `D/compras/notas-credito/[id]/page.tsx` · `…/[id]` | Detalle | Líneas + asiento contable | sin B/P | ✗ | P3 |
| 19 | `D/compras/[id]/page.tsx` · `…/compras/[id]` | Detalle | Líneas, pagos, asiento | sin B/P | ✗ | P3 |
| 20 | `D/ordenes-compra/page.tsx` · `/dashboard/ordenes-compra` | Lista | Número, Proveedor, Fecha, Entrega, Total, Factura de proveedor, Estado | B(s), P(s), V | ◐ | P2 |
| 21 | `D/ordenes-compra/[id]/page.tsx` · `…/[id]` | Detalle | Líneas | sin B/P | ✗ | P3 |

### 1.4 Contactos (perfil de cliente)

| # | Archivo · ruta | Tipo | Columnas | B/F/P/S/A/V | Patrón | Prio |
|---|---|---|---|---|---|---|
| 22 | `D/contactos/page.tsx` + `_components/contactos-cliente.tsx` · `/dashboard/contactos` | Lista | Nombre, RNC/Cédula, Teléfono, Tipo, Acciones | tabs, B(s), P(s), A, V | ✗ | **P0** |
| 23 | `D/contactos/[id]/_components/ficha-contacto.tsx` · `/dashboard/contactos/[id]` | Ficha (tabs) | 3 tablas: Transacciones (Transacción, Fecha, Tipo, Descripción, Monto, Estado), Personas (Nombre, Rol, Departamento, Correo, Teléfono), Documentos (Nombre, Tipo, Tamaño, Subido por, Fecha, Acciones) | B(l), F(l), P(l), A, V | ✗ | **P0** |
| 24 | `D/contactos/[id]/_components/pestanas-documentos.tsx` · misma ficha | Ficha (tabs) | 5 variantes: facturas venta/compra, cotizaciones/conduces, notas, pagos, asientos | B(l), P(l), V | ✗ | **P0** |
| 25 | `D/contactos/[id]/estado-cuenta/_components/tabla-estado-cuenta.tsx` · `/dashboard/contactos/[id]/estado-cuenta` | Reporte de ficha | Documento, Creación, Vencimiento, Antigüedad, Días vencidos, Estado, Total, Cobrado, Saldo + totales | V, footer | ◐ | P1 |

### 1.5 Productos (perfil de producto)

| # | Archivo · ruta | Tipo | Columnas | B/F/P/S/A/V | Patrón | Prio |
|---|---|---|---|---|---|---|
| 26 | `D/productos/page.tsx` + `_components/productos-cliente.tsx` · `/dashboard/productos` | Lista | Nombre, Referencia, Precio, ITBIS, Existencia, Costo, Estado, Acciones | B(s), P(s), S, A, V | ✗ | **P0** |
| 27 | `D/productos/[id]/_components/ficha-producto.tsx` · `/dashboard/productos/[id]` | Ficha (tabs) | Compone las tablas de abajo | tabs | — | **P0** (integración) |
| 28 | `D/productos/[id]/_components/informacion-general.tsx` · misma ficha | Ficha | Almacén, Cant. inicial, Cant. actual, Mín., Máx., En conduces + total | V, footer | ✗ | **P0** |
| 29 | `D/productos/[id]/_components/tablas-producto.tsx` · misma ficha | Ficha | Facturas venta/compra (Factura, Cliente/Proveedor, Fecha, Vence, Cantidad, Total, Por cobrar/pagar, Estado); comerciales; Kardex (Documento, Fecha, Tercero, Entrada, Salida, Costo unitario, Existencia) | B(l), F(l), P(l), V | ✗ | **P0** |
| 30 | `D/productos/_components/importar-productos-dialogo.tsx` · modal | Config/modal | Fila, Nombre, Referencia, Tipo, Precio, ITBIS, Estado | V | ✗ | P2 |

### 1.6 Inventario

| # | Archivo · ruta | Tipo | Columnas | B/F/P/S/A/V | Patrón | Prio |
|---|---|---|---|---|---|---|
| 31 | `D/inventario/ajustes/page.tsx` + `_components/ajustes-tabla.tsx` · `/dashboard/inventario/ajustes` | Lista | Número, Fecha, Almacén, Total ajustado, Estado, Observaciones | V, sin B/F/P | ◐ | P2 |
| 32 | `D/inventario/ajustes/[id]/page.tsx` · `…/[id]` | Detalle | Producto, Tipo, Cantidad, Costo unitario, Total | sin B/P | ✗ | P3 |
| 33 | `D/inventario/ajustes/_components/ajuste-form.tsx` · nuevo | Líneas de formulario | Producto, Tipo, Cantidad, Costo unitario, Total, Acciones | editable | ✗ | P3 |
| 34 | `D/inventario/transferencias/page.tsx` + `_components/transferencias-tabla.tsx` · `/dashboard/inventario/transferencias` | Lista | Número, Fecha, Origen, Destino, Productos, Estado | V, sin B/F/P | ◐ | P2 |
| 35 | `D/inventario/transferencias/[id]/page.tsx` · `…/[id]` | Detalle | Producto, Cantidad | sin B/P | ✗ | P3 |
| 36 | `D/inventario/transferencias/nueva/_components/transferencia-form.tsx` · nueva | Líneas de formulario | Producto, Cantidad, Acciones | editable | ✗ | P3 |
| 37 | `D/inventario/almacenes/page.tsx` + `_components/almacenes-cliente.tsx` · `/dashboard/inventario/almacenes` | Configuración | Nombre, Principal, Estado, Acciones | A, V, diálogo | ✗ | P2 |
| 38 | `D/inventario/categorias/page.tsx` + `_components/categorias-cliente.tsx` · `/dashboard/inventario/categorias` | Configuración | Nombre, Descripción, Estado, Acciones | A, V, diálogo | ✗ | P2 |
| 39 | `D/inventario/listas-precios/page.tsx` + `_components/listas-precios-cliente.tsx` · `/dashboard/inventario/listas-precios` | Configuración | Nombre, Principal, Tipo, Estado, Acciones | A, V, diálogo | ✗ | P2 |

### 1.7 Contabilidad

| # | Archivo · ruta | Tipo | Columnas | B/F/P/S/A/V | Patrón | Prio |
|---|---|---|---|---|---|---|
| 40 | `D/contabilidad/page.tsx` + `_components/catalogo-cuentas.tsx` · `/dashboard/contabilidad` | Lista (árbol) | Nombre, Código, Uso, Descripción, Saldo, Acciones | B(l), expansión, S, A, V | ✗ | P2 |
| 41 | `D/contabilidad/cuentas/[id]/page.tsx` · `…/cuentas/[id]` | Reporte/detalle | Fecha, Asiento, Tercero, Descripción, Débito, Crédito, Saldo acumulado | sin B/P | ✗ | P2 |
| 42 | `D/contabilidad/asientos/page.tsx` · `/dashboard/contabilidad/asientos` | Lista | Número, Fecha, Descripción, Origen, Total | B(s), P(s), F(fechas), V | ◐ | P2 |
| 43 | `D/contabilidad/asientos/[id]/page.tsx` · `…/[id]` | Detalle | Cuenta, Tercero, Descripción, Débito, Crédito + total | sin B/P | ✗ | P3 |
| 44 | `D/contabilidad/activos/page.tsx` · `/dashboard/contabilidad/activos` | Lista | Activo, Adquisición, Monto total, Depreciado, Valor actual, Estado | B(s), P(s), V | ◐ | P2 |
| 45 | `D/contabilidad/activos/[id]/page.tsx` · `…/[id]` | Detalle | Periodo, Depreciación, Estado, Asiento | sin B/P | ✗ | P3 |
| 46 | `D/contabilidad/numeraciones/page.tsx` + `_components/numeraciones-cliente.tsx` · `/dashboard/contabilidad/numeraciones` | Configuración | Tipo, Nombre, Prefijo, Siguiente, Hasta, Vence, Activa, Acciones | A, V, diálogo | ✗ | P2 |
| 47 | `D/contabilidad/periodos/page.tsx` + `_components/panel-periodos.tsx` · `/dashboard/contabilidad/periodos` | Configuración | Mes, Estado, Cerrado, Acción | A, sin V | ✗ | P2 |

### 1.8 Bancos

| # | Archivo · ruta | Tipo | Columnas | B/F/P/S/A/V | Patrón | Prio |
|---|---|---|---|---|---|---|
| 48 | `D/bancos/page.tsx` + `_components/panel-bancos.tsx` · `/dashboard/bancos` | Lista + config | Nombre, Tipo, Número, Saldo, Conciliación | A, V, diálogos | ✗ | P2 |
| 49 | `D/bancos/[id]/page.tsx` · `…/bancos/[id]` | Lista/reporte | Fecha, Documento, Tercero, Entrada, Salida, Saldo | F(fechas) | ◐ | P2 |
| 50 | `D/bancos/conciliaciones/page.tsx` · `…/conciliaciones` | Lista | Cuenta, Período, Saldo del extracto, Estado, Asiento | V | ◐ | P2 |
| 51 | `D/bancos/conciliaciones/[id]/_components/panel-conciliacion.tsx` · `…/[id]` | Detalle | ☐, ☐, Fecha, Documento, Tercero, Entrada, Salida | S, B(l) (InputGroup) | ✗ | P2 |
| 52 | `D/bancos/transferencias/[id]/page.tsx` · `…/transferencias/[id]` | Detalle | Cuenta, Descripción, Débito, Crédito | sin B/P | ✗ | P3 |

### 1.9 Configuración

| # | Archivo · ruta | Tipo | Columnas | B/F/P/S/A/V | Patrón | Prio |
|---|---|---|---|---|---|---|
| 53 | `D/configuracion/usuarios/page.tsx` · `/dashboard/configuracion/usuarios` | Configuración | Nombre, Correo, Rol, Creado | V | ✗ | P2 |
| 54 | `D/configuracion/impuestos/page.tsx` · `…/impuestos` | Configuración | Grupo, Impuesto, Tasa, Cuenta por pagar, Estado | sin V | ✗ | P2 |
| 55 | `D/configuracion/vendedores/page.tsx` + `_components/vendedores-cliente.tsx` · `…/vendedores` | Configuración | Nombre, Identificación, Observación, Estado, Acciones | A, V, diálogo | ✗ | P2 |
| 56 | `D/configuracion/centros-costo/page.tsx` + `_components/centros-costo-cliente.tsx` · `…/centros-costo` | Configuración | Código, Nombre, Descripción, Estado, Acciones | A, V, diálogo | ✗ | P2 |
| 57 | `D/configuracion/monedas/page.tsx` + `_components/monedas-cliente.tsx` · `…/monedas` | Configuración | Monedas (Código, Nombre, Símbolo, Última tasa, Fecha, Estado) + Tasas (Moneda, Fecha, Tasa, Acciones) | A, V, diálogos | ✗ | P2 |
| 58 | `D/configuracion/retenciones/page.tsx` + `_components/retenciones-cliente.tsx` · `…/retenciones` | Configuración | Nombre, Tipo, Porcentaje, Cuenta (retenemos), Cuenta anticipo, Estado | A, V | ✗ | P2 |
| 59 | `D/configuracion/terminos-pago/page.tsx` + `_components/terminos-cliente.tsx` · `…/terminos-pago` | Configuración | Nombre, Días, Estado | A, V | ✗ | P2 |

`configuracion/plantillas-impresion` y `configuracion/empresa` no tienen tabla (formularios); fuera.

### 1.10 Reportes

Todos son **reportes**, con filtros propios (fechas, selects) y botón de descarga; varios tienen `TableFooter` o cabeceras agrupadas. La tabla no lleva toolbar ni paginación de lista (algunos paginan por URL). Propuesta: **no se migran al componente de lista**; solo se les iguala la tipografía de cabecera/celdas en la fase 6, si Coder lo aprueba. Detalle:

| # | Archivo | Tabla / columnas | Decisión |
|---|---|---|---|
| 60 | `D/reportes/auxiliar-tercero/page.tsx` | Cuenta, Tercero, Saldo anterior, Débito, Crédito, Neto, Saldo final | Solo cabecera (P3) |
| 61 | `D/reportes/balance-comprobacion/page.tsx` | Matriz con saldo inicial/movimientos/saldo final y débito/crédito repetidos | **Excluida** |
| 62 | `D/reportes/balanza-tercero/page.tsx` | Igual que 61, por tercero | **Excluida** |
| 63 | `D/reportes/cartas-retencion/page.tsx` | Documento, Fecha, Retención, Tipo, Base, Retenido + Proveedor, RNC, ITBIS, ISR, Total | **Excluida** (impresión) |
| 64 | `D/reportes/compras/_components/tabla-compras.tsx` | Número, Proveedor, Fecha, Antes/Después de impuestos | Solo cabecera |
| 65 | `D/reportes/cxc/_components/tabla-cartera.tsx` | 2 tablas: NCF/Número, Tipo, Cliente/Proveedor, Creación, Vencimiento, Total, Cobrado/Pagado, Por cobrar/pagar | Solo cabecera |
| 66 | `D/reportes/estado-cuenta-cliente/page.tsx` | Documento, Creación, Vencimiento, Antigüedad, Días vencidos, Estado, Moneda, Total, Retenido, Cobrado, Saldo | Solo cabecera |
| 67 | `D/reportes/fiscales/_components/{resumen-tasas,tabla-detalle-impuestos,detalle-retencion}.tsx` | Tasas / NCF / retenciones | **Excluida** (fiscal) |
| 68 | `D/reportes/fiscales/_components/tabla-formato.tsx` (606/607/608) | Columnas dinámicas del formato DGII | **Excluida** (formato) |
| 69 | `D/reportes/impuestos-retenciones/page.tsx` | Nombre, Tipo, Tarifa, Base gravable, Impuestos, Saldo | Solo cabecera |
| 70 | `D/reportes/ingresos-compras/page.tsx` + `arbol-cuentas.tsx` | Árbol Cuenta, Total + detalle | **Excluida** (árbol) |
| 71 | `D/reportes/ir-17/page.tsx` | RNC, Proveedor, Documento, Fecha, Tipo, Retención, Base, Retenido | **Excluida** (formato) |
| 72 | `D/reportes/it1/page.tsx` | Casillas del IT-1 (sin `TableHeader`) | **Excluida** |
| 73 | `D/reportes/libro-diario/page.tsx` + `_components/libros/tabla-agrupada.tsx` | Asiento, Estado, Fecha, Tercero, Código, Cuenta, Centro de costo, Débito, Crédito (agrupado) | **Excluida** |
| 74 | `D/reportes/movimientos-cuenta/page.tsx` | Matriz saldo inicial/movimientos/saldo final | **Excluida** |
| 75 | `D/reportes/rentabilidad-producto/page.tsx` | Producto, Referencia, Total vendido, Costo, Rentabilidad, % | Solo cabecera |
| 76 | `D/reportes/reporte-anual/_components/tarjeta-ranking.tsx` | Ranking con tabs | **Excluida** |
| 77 | `D/reportes/transacciones/page.tsx` | Comprobante, Fecha, Cuenta, Proveedor, Detalle, Entradas, Salidas | Solo cabecera |
| 78 | `D/reportes/valor-inventario/_components/tabla-inventario.tsx` | Producto, Referencia, Descripción, Cantidad, Unidad, Estado, Costo promedio, Total | Solo cabecera |
| 79 | `D/reportes/ventas-cliente/page.tsx` | Cliente, Ventas, Subtotal, Descuentos, Devoluciones, Antes/Después de impuestos + total | Solo cabecera |
| 80 | `D/reportes/ventas-generales/_components/tabla-ventas.tsx` | Columnas dinámicas + gráfico | **Excluida** |
| 81 | `D/reportes/ventas-producto/page.tsx` | Producto, Referencia, N.º, Antes/Después de impuestos | Solo cabecera |
| 82 | `D/reportes/ventas-vendedor/page.tsx` | Vendedor, N.º ventas, Antes, Impuestos, Después | Solo cabecera |

`estado-resultados`, `flujo-efectivo` y `situacion-financiera` no usan `Table`; fuera.

### 1.11 Documentos, líneas de formulario y piezas compartidas

| # | Archivo | Tipo | Qué tiene | Prio |
|---|---|---|---|---|
| 83 | `C/documento-venta/vista-documento-venta.tsx` | Detalle | Encabezado, tabs, líneas del documento, pagos/notas; varios `DropdownMenu` por fila | P3 |
| 84 | `C/documento-venta/asiento-contable.tsx` | Detalle | Cuenta, Descripción, Débito, Crédito + total | P3 |
| 85 | `C/pagos/pago-form.tsx` | Líneas de formulario | Facturas (Número/NCF, Vencimiento, Total, Retenciones, Por cobrar), retenciones y otros ingresos/egresos | P3 |
| 86 | `D/notas-credito/nueva/_components/nota-credito-form.tsx` | Líneas | Descripción, Facturada, Acreditada, Pendiente, Precio, A devolver, Total + checkbox | P3 |
| 87 | `D/notas-debito/nueva/_components/nota-debito-form.tsx` | Líneas | Igual que 86 | P3 |
| 88 | `D/compras/notas-credito/nueva/_components/nota-credito-form.tsx` | Líneas | Descripción, Comprada, Acreditada, Pendiente, Costo, A devolver, Total | P3 |
| 89 | `C/documento-venta/documento-papel.tsx` | Impresión | Tabla nativa en pt, papel carta | **Excluida** |
| 90 | `C/dashboardblocks/data-table.tsx` + `table.tsx` | Plantilla | TanStack Table v9 sin uso en el dashboard | **Excluida** |
| 91 | `C/carga/esqueletos.tsx` | Carga | `EsqueletoTabla`/`EsqueletoLista` | P2 (acompañar fase 1) |

**Números de partida:** 93 archivos importan `components/ui/table`; 17 archivos usan `BuscadorLista` y 17 `PaginadorLista`; 16 archivos de la app usan `TableFooter`; 64 archivos usan `colSpan` para el vacío. Cualquier reemplazo masivo tiene que respetar esos `colSpan` y footers.

## 2. El patrón Facturas, punto por punto

Medidas de la guía (`GUIA-TABLAS.md`) contra `facturas-tabla.tsx` + `facturacion/page.tsx` de hoy:

| Pieza | Guía (Alegra) | Facturas hoy | Falta |
|---|---|---|---|
| Contenedor | Tarjeta radio 16, borde 1 px `#e2e8f0`, sin sombra | `rounded-xl` (14 px con el preset) + `ring-1 ring-foreground/10`, sin sombra | Radio exacto y decidir borde vs ring |
| Toolbar | 49 px, borde abajo | `h-12` (48) + `border-b`, `px-3` | 1 px (irrelevante); decidir 48 vs `h-[49px]` |
| Buscador | Caja ~267×32, lupa dentro | `sm:max-w-[267px] [&_input]:h-8` + `BuscadorLista` con lupa | Nada |
| «?» y «Filtrar» | Sí en Alegra | No | **No se agrega**: Facturas no tiene filtros |
| Cabecera | 40 px, `slate-200/20`, 12/500 | `h-10` (default), `bg-slate-200/20`, `text-xs`, `text-slate-700` | Nada |
| Filas | 48 px, separador, hover `slate-200/45` | `h-12`, `border-b`, `hover:bg-slate-200/45` | Nada |
| Celdas | 14/400 `#334155`, padding 16 | `text-sm` heredado, `px-4`, `text-slate-700` | Nada |
| Montos | Derecha | Total y Por cobrar a la derecha | Nada |
| Vencido | Rojo | `text-red-600 font-medium` si vence y está abierta | Nada (el rojo de la guía es ≈) |
| Pill estado | 11 px, 24 alto, radio 6, sin borde | `text-[11px]`, `rounded-md`, `px-[9px] pt-1.5 pb-1`, sin borde | Nada |
| Paginación | 48 px dentro de la tarjeta, «Ítems por página [10] 1-2 de 2 … Página [1] N ‹ ›» | Dentro (`border-t px-4 py-2`), «Mostrando 1–25 de 19.481», 4 botones, sin selector de tamaño | Alto 48, selector de tamaño, texto |
| Vacío | Ícono 40 + título + texto (+ botón si no hay datos) | Ícono + 2 líneas; sin botón; título «Aún no hay facturas» | CTA y tono del título |
| Selección | Checkbox (Alegra) | No (captura de Waldy) | **No por ahora** |
| Acciones de fila | Monedas + ⋮ (Alegra) | No (captura de Waldy) | **No por ahora** |
| Modo oscuro | No medido | Variantes `dark:` en cabecera/hover | Mantener en el componente |
| Móvil | No medido | Scroll horizontal | Definir columnas que se ocultan |

**Conclusión:** Facturas ya es el 90 % del patrón. Lo que falta es sobre todo **paginación** (alto, tamaño de página, texto), **radio/borde exactos** y **estado vacío con CTA**; lo demás se replica tal cual.

Diferencias deliberadas con Alegra en la tabla canónica: mostramos `#` (número interno) y `Tipo` de comprobante, no mostramos checkbox ni acciones de fila, y no existe «Estado de emisión» hasta que haya e-CF. Son decisiones de Waldy reflejadas en la captura; no se “corrigen” al migrar.

## 3. Componente compartido

### 3.1 Archivos

- **Nuevo** `src/components/listas/tabla-lista.tsx` — presentacional, **sin `"use client"`** (ver 3.4).
- **Editar** `src/components/listas/paginador-lista.tsx` — variante servidor (URL), misma API + props opcionales.
- **Nuevo** `src/components/listas/paginador-local.tsx` — variante cliente para fichas (`"use client"`).
- **Opcional** `src/components/listas/encabezado-lista.tsx` — título/subtítulo/acciones de página (hoy conviven `text-3xl` y `text-2xl`).
- **Deprecar** `TH` y `PiePagina` de `src/components/ficha/ficha-ui.tsx` cuando las fichas migren (fase 3). `TH` es mayúscula con tracking; la guía pide 12/500 normal.

No se toca `src/components/ui/*` (regla del repo). El pill **no** usa `Badge`: `Badge` es 12 px, `rounded-4xl` y con borde; la guía pide 11 px, radio 6 y sin borde.

### 3.2 API propuesta

```tsx
// src/components/listas/tabla-lista.tsx
import type { ReactNode } from "react";

export type TonoPill = "exito" | "pendiente" | "peligro" | "neutro" | "info";
export type Alineacion = "izquierda" | "derecha" | "centro";

export interface ColumnaLista<T> {
  clave: string;
  encabezado: ReactNode;
  celda: (fila: T) => ReactNode;
  alineacion?: Alineacion;      // default "izquierda"
  className?: string;           // ancho y responsive: "w-24", "hidden lg:table-cell"
}

export interface VacioLista {
  titulo: string;
  descripcion?: string;
  icono?: ReactNode;
  accion?: ReactNode;           // botón "Crear…" solo si el rol puede
  filtrada?: boolean;           // true = búsqueda/filtro sin resultados: sin CTA
}

export function TarjetaLista(props: {
  children: ReactNode;
  className?: string;
  "data-lista"?: string;        // p. ej. "facturas", para los e2e
});
export function BarraLista(props: { children: ReactNode; className?: string });

export function TablaLista<T>(props: {
  columnas: readonly ColumnaLista<T>[];
  filas: readonly T[];
  claveFila: (fila: T) => string;
  vacio: VacioLista;
  seleccion?: { cabecera: ReactNode; celda: (fila: T) => ReactNode }; // checkbox ya renderizado
  acciones?: (fila: T) => ReactNode;   // columna final de 88 px
  pie?: ReactNode;                     // TableFooter de totales
  densidad?: "normal" | "compacta";    // 48 | 40 px
  className?: string;
});

export function PillEstado(props: { tono: TonoPill; children: ReactNode });
export function EstadoVacioLista(props: VacioLista); // variante tarjeta completa
```

Uso en una lista de servidor:

```tsx
<TarjetaLista data-lista="facturas">
  <BarraLista>
    <BuscadorLista
      base={RUTA}
      parametros={params}
      valorInicial={opciones.q}
      placeholder="Buscar por número, NCF o cliente…"
      ariaLabel="Buscar facturas"
      className="sm:max-w-[267px] [&_input]:h-8"
    />
    {/* Filtro solo si existe y la página es cliente (BotonFiltro usa estado). */}
    {hayFiltro ? <BotonFiltro valor={filtro} opciones={OPCIONES} onCambiar={cambiarFiltro} /> : null}
  </BarraLista>

  <TablaLista
    columnas={columnas}
    filas={facturas}
    claveFila={(f) => f.id}
    vacio={{
      filtrada: Boolean(opciones.q),
      titulo: opciones.q ? "Sin resultados" : "¡Aún no tienes facturas!",
      descripcion: opciones.q
        ? "La búsqueda no arrojó facturas."
        : "Crea tu primera factura de venta para empezar.",
      icono: <FileText />,
      accion: puedeEscribir ? <BotonNuevaFactura /> : undefined,
    }}
  />

  <PaginadorLista base={RUTA} params={params} resumen={resumen} etiqueta="Ítems por página" />
</TarjetaLista>
```

Uso en ficha (sin tarjeta propia):

```tsx
<div className="flex flex-col gap-5">
  <BarraLista className="border-0 px-0">
    <BuscadorLista ... />
    <BotonFiltro ... /> {/* solo donde ya existe: estados de facturas */}
  </BarraLista>
  <TablaLista ... />
  <PaginadorLocal total={filtradas.length} porPagina={10} pagina={pagina} setPagina={setPagina} etiqueta="facturas" />
</div>
```

### 3.3 Tokens del componente

| Pieza | Clases |
|---|---|
| Tarjeta | `bg-card overflow-hidden rounded-2xl border border-border` (sin sombra) |
| Toolbar | `flex h-12 items-center gap-2 border-b border-border px-3` |
| Buscador | El de `BuscadorLista`; en listas `sm:max-w-[267px] [&_input]:h-8` |
| Cabecera fila | `h-10 border-b border-border bg-slate-200/20 hover:bg-slate-200/20 dark:bg-slate-800/40 dark:hover:bg-slate-800/40` |
| Cabecera celda | `px-4 text-xs font-medium text-slate-700 dark:text-slate-300` (sin `uppercase` ni `tracking-wider`) |
| Fila | `h-12 border-b border-border hover:bg-slate-200/45 dark:hover:bg-slate-800/40` |
| Celda | `px-4 text-sm text-slate-700 dark:text-slate-300`; numérica `text-right tabular-nums` |
| Pill | `inline-flex items-center rounded-md px-[9px] pb-1 pt-1.5 text-[11px] leading-[1.3]` |
| Acción | `Button variant="ghost" size="icon-sm"` (32×32) + `aria-label` |
| Pie | `flex h-12 items-center justify-between border-t border-border px-3 text-sm text-slate-700` |
| Vacío | Ícono `size-10 text-slate-300 dark:text-slate-600`; título `text-lg font-semibold`; texto `text-sm text-muted-foreground` |
| Compacta (líneas) | Filas `h-10`, celdas `px-3 text-[13px]`; sin toolbar ni paginación |

**Pills.** Tonos y usos:

| Tono | Clases | Estados que lo usan |
|---|---|---|
| `exito` | `bg-green-100 text-green-700 dark:bg-green-500/15 dark:text-green-400` | Cobrada, Pagada, Convertida, Activa, Conciliada, Depreciado |
| `pendiente` | `bg-amber-100 text-amber-700 dark:bg-amber-500/15 dark:text-amber-400` | Por cobrar, Abierta, Borrador, Por pagar |
| `peligro` | `bg-red-100 text-red-700 dark:bg-red-500/15 dark:text-red-400` | Anulada, Anulado, Vencida |
| `neutro` | `bg-slate-100 text-slate-600 dark:bg-slate-500/15 dark:text-slate-300` | Inactiva, Cerrado, Sin estado |
| `info` | `bg-sky-100 text-sky-700 dark:bg-sky-500/15 dark:text-sky-400` | Tipos de documento (si hace falta) |

Reglas:
- El tono se decide con el estado de dominio, no con el texto. Un solo mapa por módulo (hoy hay `EstadoBadge` repetido en compras, órdenes, notas y fichas).
- No se pinta la fila completa: solo la fecha vencida en rojo y el pill.

### 3.4 Restricciones técnicas (importantes)

1. **`TablaLista` no lleva `"use client"`.** Recibe `celda: (fila) => ReactNode`; si fuera cliente, las páginas de servidor no podrían pasarle funciones (no son serializables). Los checkboxes de selección se pasan ya renderizados desde un componente cliente (`productos-cliente.tsx` ya lo es).
2. **El buscador va fuera del `<Suspense>`** que envuelve tabla + paginación, como en Facturas. Si entra al Suspense, el input se remonta en cada búsqueda y pierde el foco.
3. **`colSpan`**: el vacío debe calcularse como `columnas.length + (seleccion ? 1 : 0) + (acciones ? 1 : 0)`. No hardcodear.
4. **`TableFooter`** se pasa en `pie`; el componente no lo inventa.
5. **Nada de `<div>` simulando tabla**: se mantiene `<table>`, `thead`, `tbody`, `th`, `td`; `TableHead` recibe `scope="col"`.
6. **Iconos**: lucide (`Search`, `ListFilter`, `CircleHelp`, `Coins`, `EllipsisVertical`, `FileText`). Botones-ícono con `aria-label`.
7. **Números**: `formatoMoneda`/`formatoMonedaCentavos` ya existentes; no recalcular en el cliente.
8. **Filtros interactivos** (`BotonFiltro`, `Select`) usan estado: si la página es de servidor, se aíslan en un componente cliente; jamás se pasa un handler desde el servidor.

### 3.5 Variantes que debe cubrir

| Variante | Cómo se resuelve |
|---|---|
| Lista principal (Facturas, Compras…) | `TarjetaLista` + `BarraLista` + tabla + `PaginadorLista` |
| Contactos con avatar y tabs | Tabs fuera de la tarjeta; la celda Nombre renderiza `<AvatarInicial>` + enlace (ya existe `src/components/avatar-inicial.tsx`) |
| Productos con selección | `seleccion` con checkbox de cabecera y de fila; acciones masivas en el extremo derecho de `BarraLista` |
| Ficha con pestañas | `BarraLista` sin borde + tabla + `PaginadorLocal`, dentro del panel de la ficha; no se anida otra tarjeta |
| Configuración | `TarjetaLista` + tabla + `EstadoVacioLista`; sin toolbar si no hay búsqueda; acciones en la última columna |
| Reporte | `TarjetaLista` + tabla + `pie`; sin toolbar ni paginación de lista; filtros y descarga siguen en la página |
| Líneas de formulario | `TablaLista densidad="compacta"`, sin toolbar/paginación, celdas editables fuera del componente |
| Impresión | **No usa el componente** (ver §6) |

## 4. Plan de migración

### Fase 1 — Extraer `TablaLista` y refactorizar Facturas sin cambio visual

Archivos:
- `src/components/listas/tabla-lista.tsx` (nuevo).
- `src/components/listas/paginador-lista.tsx` (misma API; agregar `etiqueta`, `tamano`, `visible`; alto 48; **no** cambiar el tamaño por defecto 25).
- `src/app/(main)/dashboard/facturacion/page.tsx`.
- `src/app/(main)/dashboard/facturacion/_components/facturas-tabla.tsx`.
- `src/components/carga/esqueletos.tsx` (solo si se iguala la tarjeta; opcional, cuidado: lo usan todas las rutas).

Candados:
- **Nuevo** `src/lib/tablas-listas.test.ts` (Vitest, lee archivos como `selects-nativos.test.ts`):
  - `LISTAS_MIGRADAS` (empieza con `facturas-tabla.tsx`) debe importar `TablaLista`.
  - Ningún archivo de `LISTAS_MIGRADAS` puede definir `function EstadoPill`/`EstadoBadge` local.
  - `tabla-lista.tsx` debe contener las clases canónicas `h-12`, `bg-slate-200/20`, `text-[11px]`; si alguien las borra, falla con el mensaje de la guía.
- **Nuevo** `tests/e2e/tablas.spec.ts` (se salta sin `E2E_EMAIL`/`E2E_PASSWORD`, como `listas.spec.ts`):
  - En Facturas, toolbar, tabla y paginación están dentro del mismo `[data-lista="facturas"]`.
  - **No** existe botón «Filtrar» (candado de «no inventar»).
  - Cabecera 40 ±1 px y fila 48 ±1 px (medido con `boundingBox`).
  - Búsqueda sin resultados muestra «Sin resultados» y conserva el pie.
- `pnpm typecheck`, `pnpm check`, `pnpm test`, `pnpm build`.

Riesgo: es un refactor "sin cambio visual"; cualquier diferencia debe ser solo la paginación. Capturas antes/después (claro, oscuro, móvil) las toma Coder.

### Fase 2 — Perfil de producto

Archivos:
- `D/productos/page.tsx`, `D/productos/_components/productos-cliente.tsx`.
- `D/productos/[id]/_components/ficha-producto.tsx` (integración de tabs).
- `D/productos/[id]/_components/informacion-general.tsx` (tabla de existencias + footer).
- `D/productos/[id]/_components/tablas-producto.tsx` (facturas, comerciales, kardex).
- Opcional: `D/productos/_components/importar-productos-dialogo.tsx` (tabla de vista previa del modal).

Qué cambia: buscador dentro de la tarjeta; selección y «Editar seleccionados» a la derecha de la toolbar; lápiz de 32 px; pill de estado; columnas numéricas a la derecha; vacío con CTA «Nuevo producto»; en la ficha, toolbar sin tarjeta + `PaginadorLocal`; `BotonFiltro` solo donde ya existe (facturas de venta/compra). **No** se agrega filtro por categoría/estado en la lista: la consulta no lo soporta (`// TODO backend`).

Candados: sumar los 4 archivos a `LISTAS_MIGRADAS`; e2e de productos (búsqueda, selección, vacío). Pruebas: `tests/e2e/tablas.spec.ts` o `listas.spec.ts`.

### Fase 3 — Perfil de cliente

Archivos:
- `D/contactos/page.tsx`, `D/contactos/_components/contactos-cliente.tsx`.
- `D/contactos/[id]/_components/ficha-contacto.tsx` (transacciones, personas, documentos).
- `D/contactos/[id]/_components/pestanas-documentos.tsx` (5 variantes).
- `D/contactos/[id]/estado-cuenta/_components/tabla-estado-cuenta.tsx`.
- `src/components/ficha/ficha-ui.tsx` (quitar `TH` y `PiePagina` cuando ya no se usen).
- `D/contactos/[id]/page.tsx` y `…/estado-cuenta/page.tsx` si cambia el encabezado.

Qué cambia: buscador dentro de la tarjeta (las tabs siguen fuera), avatar con inicial en la celda Nombre (reusar `AvatarInicial`), pill de tipo, lápiz 32, paginación dentro; en la ficha, las 3 tablas con toolbar local y `PaginadorLocal`; el botón «Filtrar» de Transacciones se conserva (ya existe `BotonFiltro`), el de la lista de contactos **no** se agrega (no hay filtro más allá de las tabs).

Candados: `LISTAS_MIGRADAS` + e2e de contactos (tabs, avatar, sin «Filtrar» en la lista) y de la ficha (búsqueda local).

### Fase 4 — Pagos, notas y documentos hermanos

Archivos:
- `D/pagos-recibidos/page.tsx`, `_components/pagos-tabla.tsx`.
- `D/compras/pagos/page.tsx`.
- `D/notas-credito/page.tsx`, `_components/notas-credito-tabla.tsx`.
- `D/notas-debito/page.tsx`, `_components/notas-debito-tabla.tsx`.
- `D/compras/notas-credito/page.tsx`.
- `D/pagos-recurrentes/page.tsx` (solo estilo; sin buscador ni paginación si la consulta no los tiene).
- `D/pagos-recibidos/[id]/page.tsx` y `D/compras/pagos/[id]/page.tsx` (opcional: tablas de facturas aplicadas, densidad compacta; si no, fase 6).

Qué cambia: tarjeta única, pills, pie dentro, vacío con CTA; no se agregan acciones nuevas. En `pagos-recurrentes` la acción «Generar» se mantiene.

Candados: `LISTAS_MIGRADAS` + e2e de pagos y notas (búsqueda y vacío). Paralelizable con fases 2 y 3.

### Fase 5 — Resto de listas y configuración

**5a. Documentos y almacén** (paralelo con 5b):
- `D/compras/page.tsx`, `D/gastos/page.tsx` + `_components/gastos-tabla.tsx`.
- `D/facturas-recurrentes/page.tsx` + `_components/facturas-recurrentes-tabla.tsx`.
- `D/ordenes-compra/page.tsx`.
- `D/inventario/ajustes/_components/ajustes-tabla.tsx`.
- `D/inventario/transferencias/_components/transferencias-tabla.tsx`.
- `D/cotizaciones/_components/documentos-tabla.tsx` (sirve a cotizaciones y conduces).

**5b. Contabilidad, bancos y configuración** (paralelo con 5a):
- `D/contabilidad/_components/catalogo-cuentas.tsx`, `D/contabilidad/asientos/page.tsx`, `D/contabilidad/activos/page.tsx`, `D/contabilidad/numeraciones/_components/numeraciones-cliente.tsx`, `D/contabilidad/periodos/_components/panel-periodos.tsx`.
- `D/bancos/_components/panel-bancos.tsx`, `D/bancos/conciliaciones/page.tsx`, `D/bancos/conciliaciones/[id]/_components/panel-conciliacion.tsx`, `D/bancos/[id]/page.tsx`.
- `D/configuracion/{usuarios,impuestos}/page.tsx`, `D/configuracion/vendedores/_components/vendedores-cliente.tsx`, `D/configuracion/centros-costo/_components/centros-costo-cliente.tsx`, `D/configuracion/monedas/_components/monedas-cliente.tsx`, `D/configuracion/retenciones/_components/retenciones-cliente.tsx`, `D/configuracion/terminos-pago/_components/terminos-cliente.tsx`.

Qué cambia: tarjeta y tabla unificadas, pills, vacío, `colSpan` correcto. **No** se agregan buscadores ni paginación donde la consulta no los tiene (ajustes, transferencias, pagos recurrentes, bancos, configuración). El catálogo mantiene su árbol, búsqueda local, expansión y panel lateral: solo cambia la presentación de filas y cabecera.

Candados: `LISTAS_MIGRADAS` crece por bloque; e2e de humo en cada módulo (la lista carga y el vacío se ve). `pnpm test` no debe romper `documento-papel.test.tsx`.

### Fase 6 — Líneas de formulario y reportes (opcional, al final)

Archivos: los de la tabla 1.11 (83–88) y, si Coder aprueba, solo cabecera/celdas en los reportes de la tabla 1.10. `documento-papel.tsx` no se toca.

Qué cambia: `TablaLista densidad="compacta"`, sin toolbar/paginación, para líneas editables y detalles de documento. En reportes, solo tipografía (12/500, 14/400) y alineación de montos; se conservan filtros, `print:hidden`, footer y exportación.

Candados: pruebas existentes de cálculo/impresión; typecheck/build. Nada de tocar `src/lib/reportes`.

### Paralelismo

- Fase 1 es bloqueante (componente + candado).
- Después: 2, 3 y 4 en paralelo (archivos disjuntos), y 5a/5b en paralelo.
- Fase 6 al final, cuando el patrón ya esté probado.

## 5. Riesgos

| Riesgo | Por qué | Mitigación |
|---|---|---|
| Reemplazo masivo de 93 archivos | Se pierden `colSpan`, footers o enlaces | Migrar por fases, con lista explícita; el test `LISTAS_MIGRADAS` evita archivos a medias |
| `TablaLista` cliente | Las funciones `celda` no cruzan servidor→cliente | Componente sin `"use client"`; selección como `ReactNode` ya renderizado |
| Buscador dentro del `Suspense` | El input se remonta y pierde foco | Toolbar fuera del Suspense, como Facturas |
| Paginador compartido por 17 listas | Cambiar la API rompe páginas no migradas | Props nuevas opcionales; no cambiar el tamaño por defecto 25 |
| `PaginadorLista` devuelve `null` con total 0 | El vacío por búsqueda pierde el pie | `visible`/`mostrarEnVacio`; en fase 1 decidir y probar |
| Tamaño de página 10/20/30 vs 25/50/100 | Cambia consultas y rendimiento | Mantener 25 por defecto; ofrecer 10/25/50/100 y no tocar consultas |
| Radio/borde | `rounded-xl`=14, `rounded-2xl`=18 con el preset; la guía pide 16 | Usar `rounded-2xl` y borde `border-border`; no mezclar con `ring` |
| Modo oscuro | Las clases nuevas pueden quedar solo en claro | Duplicar `dark:` en cabecera, hover y pills; capturas en oscuro |
| Móvil | 9–11 columnas no caben | Scroll horizontal + `hidden md:table-cell` en columnas secundarias; nunca ocultar montos |
| `overflow-hidden` + sticky | El contenedor de `Table` ya scrollea | No usar sticky en esta migración |
| Datos | Un filtro/columna nueva exige backend | `// TODO backend` y aviso; no tocar `src/lib` |
| Guía desactualizada | `docs/diseno/guia-estilo.md` manda a `dashboardblocks/data-table`, que no se usa y no es el patrón | Actualizar esa línea a `tabla-lista.tsx` en la fase 1 |
| `notas-backend.md` | Describe otra Facturas (NCF protagonista, avatar, punto de color) | Actualizarlo después del OK de Coder; este doc manda para la lista |

## 6. Tablas excluidas (y por qué)

| Tabla | Motivo |
|---|---|
| `C/documento-venta/documento-papel.tsx` | Impresión en papel carta con medidas en pt; cualquier clase de pantalla rompe el PDF |
| Reportes matriciales: balance de comprobación, balanza por tercero, movimientos de cuenta, libro diario agrupado, IT-1, 606/607/608, cartas de retención, ventas generales, ingresos/compras (árbol) | Cabeceras agrupadas, totales y formatos DGII; unificar el estilo puede volver ilegible el reporte o romper la exportación |
| Reportes con filtros y descarga propios (los «solo cabecera») | Se les iguala tipografía en fase 6, pero **no** se les pone toolbar/paginación de lista |
| Líneas de formularios editables (pago, notas, ajuste, transferencia) | No son listas: no llevan buscador, paginación ni tarjeta; solo `densidad="compacta"` en fase 6 |
| `C/dashboardblocks/data-table.tsx` y `table.tsx` | Plantilla de TanStack v9 sin uso; migrar a ella sería reescribir, no unificar |
| `importar-productos-dialogo.tsx` (vista previa) | Tabla dentro de un modal; se puede alinear en fase 2, pero no es prioridad |
| Rankings, gráficos y tarjetas de reportes | No son tablas |

## 7. Decisiones pendientes (Waldy/Coder)

1. **Radio**: `rounded-2xl` (18 px con el preset) o `rounded-[16px]` exacto de la guía. Recomendación: `rounded-2xl`.
2. **Tamaño de página**: mantener 25 por defecto y opciones 10/25/50/100, o copiar 10/20/30 de Alegra. Recomendación: 10/25/50/100.
3. **Paginación**: ¿solo ‹ › o también primera/última? La guía usa ‹ ›; hoy hay 4 botones. Recomendación: ‹ › + «Página n de N».
4. **NCF en mono**: hoy `font-mono` en algunas listas; la guía no lo pide. Recomendación: mantenerlo (ayuda a comparar números).
5. **Checkbox y acciones de fila en Facturas**: Alegra los tiene, la captura de Waldy no. Recomendación: dejarlos fuera hasta que haya acciones reales (registrar pago, anular).
6. **`Estado de emisión` (e-CF)**: solo cuando exista facturación electrónica; no inventar la columna.
7. **Filtros**: productos, contactos y facturas no tienen filtros de servidor hoy. Si Waldy los quiere, es tarea de backend (`src/lib/...`) y recién entonces aparece «Filtrar».

## 8. Checklist para decir «lista» una fase

- [ ] La tabla vive en la tarjeta (o en el panel de la ficha) con toolbar, tabla y pie alineados a `GUIA-TABLAS.md`.
- [ ] Pills de 11 px sin borde; montos a la derecha; vencido en rojo; hover de fila.
- [ ] Vacío con ícono, título, texto y CTA solo si el rol puede crear.
- [ ] `colSpan` correcto; `TableFooter` conservado donde existe.
- [ ] Sin features inventadas (Filtrar/checkbox/acciones) y sin datos nuevos.
- [ ] `pnpm typecheck`, `pnpm check`, `pnpm test` y `pnpm build` en verde.
- [ ] Capturas claro/oscuro/móvil de la lista tocada (las toma Coder).
- [ ] `LISTAS_MIGRADAS` actualizado y candado en verde.
