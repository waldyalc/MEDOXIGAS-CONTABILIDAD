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

## Producto — pantalla completa de edición y alta

Rutas: `/dashboard/productos/[id]/editar` y `/dashboard/productos/nuevo`. Guardan con `actualizarProducto`/`crearProducto` (`actualizar_producto`/`crear_producto` en la base). Los campos nuevos solo viajan si el formulario los envía, igual que las cuentas contables.

| Lo que se ve en pantalla | Campo del backend |
| --- | --- |
| Tipo | `productos.tipo` (`producto`, `servicio` o `combo`) |
| Nombre, referencia, descripción | `productos.nombre`, `productos.referencia`, `productos.descripcion` |
| Almacén | `productos.almacen_id` → `almacenes.nombre` |
| Categoría | `productos.categoria_id` → `categorias_productos.nombre` |
| Unidad de medida | `productos.unidad_medida` (texto libre, por defecto `Unidad`) |
| Estado | `productos.activo` |
| Precio base e impuesto | `productos.precio`, `productos.impuesto_id`, `productos.itbis_tasa` |
| Precio total | Calculado en el servidor con `precioConItbis`; no es una columna |
| Inventariable y venta en negativo | `productos.inventariable`, `productos.vende_negativo` |
| Existencia actual, inicial y costo | `productos.cantidad`, `productos.costo` y `existencias.cantidad_inicial` del almacén |
| Imagen | `productos.imagen_path` en el bucket **privado** `productos`; se muestra con URL firmada |
| Almacenes (mín/máx por almacén) | `existencias.cantidad_inicial`, `existencias.cantidad`, `existencias.minimo`, `existencias.maximo` |
| Listas de precios | `producto_precios.precio` por `listas_precios` |
| Cuentas contables | `productos.cuenta_ingreso_id`, `productos.cuenta_inventario_id`, `productos.cuenta_costo_id` |

Reglas:

- La cantidad de la pantalla solo mueve el stock del **almacén elegido** (`actualizar_producto` ajusta la diferencia ahí). Las cantidades de los otros almacenes se muestran de solo lectura.
- Los mínimos y máximos por almacén se guardan con `_producto_guardar_minimos`; si el bloque de opciones avanzadas no se abre, no se envían y no se tocan.

Campos de Alegra que la base **no** soporta todavía. No se inventaron; quedan pendientes de decidir:

- **Tipo de referencia**: no hay columna para ese dato.
- **En conduces por almacén**: `remisiones` no guarda almacén, así que no se puede repartir lo comprometido; la columna se muestra con `—`.
- **Variantes** y **campos extra**: no existen tablas ni columnas.
- **Archivos adjuntos**: no hay tabla de adjuntos de productos; la sección se muestra vacía.
- **Limpieza de imágenes huérfanas**: al quitar o reemplazar la imagen, el objeto anterior queda en el bucket. Falta una tarea de limpieza o borrado al guardar.
