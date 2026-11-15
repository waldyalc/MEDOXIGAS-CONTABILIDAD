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
