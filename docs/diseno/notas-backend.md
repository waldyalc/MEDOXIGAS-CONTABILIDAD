# Notas para el backend (rediseño)

Cosas que Waldy decidió en el rediseño y que el backend **no debe esconder, renombrar ni cambiar** cuando este diseño se migre a producción. El rediseño es solo frontend: estos datos ya llegan del backend actual y deben seguir llegando igual.

## Facturación — lista de facturas de venta

Tabla: `facturas` (consulta `getFacturasLista` en `src/lib/facturacion/consultas.ts`).

| Lo que se ve en pantalla | Campo del backend | Nota |
| --- | --- | --- |
| NCF (columna principal, texto grande) | `facturas.ncf` | Es el identificador que Waldy usa siempre. Puede ser `null` → se muestra `Factura {numero}` como respaldo. |
| N.º debajo del NCF (texto gris pequeño) | `facturas.numero` | **Es el número interno de la factura guardado en el backend.** No lleva etiqueta "interno" en pantalla, pero debe seguir existiendo y llegando a la lista. |
| Cliente (avatar + nombre) | `contactos.nombre` vía `facturas.contacto_id` | El nombre viene del join; el enlace usa `contacto_id`. |
| Tipo (badge: 01 Crédito fiscal, 02 Consumo…) | `facturas.tipo_comprobante` | Valores `'01'`, `'02'`, `'14'`, `'15'`, `'16'`. |
| Fecha | `facturas.fecha` | Formato `DD/MM/AAAA` en pantalla. |
| Vencimiento | `facturas.vencimiento` | Misma fecha. |
| Estado (punto de color) | `facturas.estado` | `abierta` → amarillo, `pagada` → verde, `anulada` → rojo. |
| Total | `facturas.total` | `numeric(14,2)`, se muestra `RD$`. |
| Por cobrar | saldo calculado | `total − pagado − credito − retenido` (`saldoDeFactura`). No es una columna de la tabla; se calcula con `pagado`, `credito` y `retenido` que deben seguir llegando. |

Reglas:

- La búsqueda y el orden por defecto usan `numero` y `ncf`: ambos campos deben seguir en la consulta aunque el número no sea una columna visible.
- Nada de esto se crea en el frontend: si un dato falta, es TODO backend — avisar a Waldy en vez de inventarlo.

## Producto — pantalla completa de edición

Ruta: `/dashboard/productos/[id]/editar`. Usa el mismo shell de la ficha y guarda con `actualizarProducto` (`actualizar_producto` en la base).

| Lo que se ve en pantalla | Campo del backend |
| --- | --- |
| Tipo | `productos.tipo` (`producto` o `servicio`) |
| Nombre, referencia, descripción | `productos.nombre`, `productos.referencia`, `productos.descripcion` |
| Categoría | `productos.categoria_id` → `categorias_productos.nombre` |
| Estado | `productos.activo` |
| Precio base e impuesto | `productos.precio`, `productos.impuesto_id`, `productos.itbis_tasa` |
| Controlar inventario, existencia actual y costo | `productos.inventariable`, `productos.cantidad`, `productos.costo` |
| Almacenes (solo lectura) | `existencias.cantidad` por `almacenes` |
| Listas de precios | `producto_precios.precio` por `listas_precios` |
| Cuentas contables | `productos.cuenta_ingreso_id`, `productos.cuenta_inventario_id`, `productos.cuenta_costo_id` |

Campos de Alegra que la base **no** soporta todavía. No se inventaron; quedan pendientes de decidir:

- **Combo** como tipo de producto: el check de `productos.tipo` solo acepta `producto` y `servicio`.
- **Almacén obligatorio en el formulario**: no existe `productos.almacen_id`; el stock vive por almacén en `existencias`.
- **Unidad de medida** y **tipo de referencia**: no hay columnas para esos datos.
- **Existencia inicial, mínimo y máximo por almacén**, y **en conduces**: `existencias` solo guarda `cantidad`; la inicial se deduce del kárdex.
- **Variantes**, **campos extra** e **imagen del producto**: no existen tablas ni columnas.
- **Archivos adjuntos**: no hay tabla de adjuntos de productos; la sección se muestra vacía.
