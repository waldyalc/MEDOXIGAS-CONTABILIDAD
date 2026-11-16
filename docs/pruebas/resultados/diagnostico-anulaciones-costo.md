# Diagnóstico — costeo en anulaciones (D6 de inventario)

Fecha: 2026-11-17. Solo lectura sobre el repo; no se corrió SQL contra la base
remota ni se aplicó ninguna migración. El cuadre de D6 (`docs/pruebas/cuadre-inventario.sql`)
sigue pendiente de que Waldy lo corra.

## Resumen

- **Bug real y vigente:** anular un ajuste de inventario de **entrada** devuelve
  la cantidad pero no deshace la ponderación del costo promedio. La creación sí
  lo pondera. Corregido en la migración aditiva
  `20261117200000_anular_ajuste_costo.sql` + pgTAP `anular_ajuste_costo_test.sql`.
- **El bug de compras ya estaba corregido en el código** desde
  `20261113270000_anular_compra_costo.sql` y sigue corregido en la definición
  vigente (`20261116200000_pagos_multifactura.sql`). Tiene pgTAP propio
  (`anular_compra_costo_test.sql`, 18 asserts). Lo que queda es **dato
  histórico** anterior al fix, o una migración sin aplicar en el remoto; no un
  bug de código actual. La línea de `docs/motor-contable.md` que decía lo
  contrario estaba desactualizada y se corrigió.
- **D6 no se cierra solo con este fix.** El código actual permite tres fuentes
  estructurales de diferencia entre `productos.cantidad × costo` y el mayor:
  1. `asiento_lineas.producto_id` **nunca se llena** (el motor no lo escribe),
     así que el mayor no se puede atribuir por producto con el esquema actual.
  2. Crear un producto con stock inicial o editar `cantidad`/`costo` en el
     formulario mueve existencias pero **no crea asiento** (stock inicial y
     revalúos sin contrapartida).
  3. Los ajustes de **salida** valoran el asiento al costo que escriba el
     usuario, mientras el costo promedio del producto no cambia.
  Las tres son decisiones de política contable (apertura/revalúo), no arreglos
  mecánicos.

## Flujo real (definiciones vigentes)

| Documento | Creación | Anulación |
| --- | --- | --- |
| Compra (`crear_factura_proveedor`) | Suma cantidad y pondera costo: `(Q*C + q*c)/(Q+q)` (`20261115500000_funciones_fusionadas_s15.sql:516-531`). Asiento Dr inventario / Cr CxP / Dr ITBIS. | Resta cantidad y deshace la ponderación: `(Q*C − q*c)/(Q−q)` con `greatest(...,0)`; si la cantidad nueva es 0 deja costo 0; si es negativa conserva el costo (`20261116200000_pagos_multifactura.sql:1191-1223`). Asiento inverso. |
| Nota de crédito de compra | Si devuelve inventario, resta cantidad y deshace la ponderación con el costo de la línea de la compra (`20261114900000_inventario_existencias_precios.sql:1684-1711`). | Suma cantidad y vuelve a ponderar con el costo de la nota (`20261116200000_pagos_multifactura.sql:1323-1351`). Simétrico. |
| Ajuste de **entrada** | Suma cantidad y pondera: `(Q*C + q*c)/(Q+q)`; asiento Dr inventario / Cr ajuste (`20261114900000_inventario_existencias_precios.sql:1880-1904, 1915-1929`). | **Solo** devuelve la cantidad con `_mover_existencia`; no lee ni actualiza `productos.costo` (`20261116200000_pagos_multifactura.sql:1288-1312`). **Bug.** |
| Ajuste de **salida** | Resta cantidad; `v_costo_nuevo := v_producto.costo`, no cambia el promedio (`20261114900000_inventario_existencias_precios.sql:1891-1894`). El asiento usa `costo_unitario` de la línea, que puede venir del formulario. | Devuelve cantidad; no toca el costo. Consistente con la creación. |
| Factura de venta | Resta cantidad y usa el costo promedio vigente para el costo de ventas; no cambia el promedio (`20261113140000_motor_contable.sql:1026-1047`). | Devuelve cantidad; no toca el costo. Consistente. |

## Causa exacta del bug de ajustes

En `anular_documento`, rama `ajuste_inventario`
(`supabase/migrations/20261116200000_pagos_multifactura.sql:1288-1312`):

```sql
for v_ajuste_linea in ... loop
  if v_ajuste_linea.tipo = 'entrada' then
    perform public._mover_existencia(... -cantidad);
  else
    perform public._mover_existencia(... cantidad);
  end if;
end loop;
-- no hay select/update de productos.costo
```

La creación de la entrada sí había cambiado el costo
(`20261114900000_inventario_existencias_precios.sql:1880-1904`). Al anular, la
cantidad vuelve pero el costo queda en el promedio ponderado con una entrada que
ya no existe. Efecto: `productos.cantidad × costo` queda **por encima** del
mayor de inventario (el asiento de anulación sí revierte el valor contable), que
es exactamente el signo de D6 (−RD$112.8M).

La fórmula aplicada en el fix es la inversa exacta de la creación:

```
costo_nuevo = (cantidad_actual * costo_actual − cantidad_línea * costo_línea)
              / (cantidad_actual − cantidad_línea)
```

con los mismos bordes que la anulación de compras (cantidad nueva 0 → costo 0;
cantidad nueva negativa → conserva el costo). Para salidas no se toca el costo,
porque la creación tampoco lo toca.

## Estado del bug de compras

La premisa «anular una compra devuelve la cantidad pero no recalcula el costo
promedio» era cierta antes de `20261113270000_anular_compra_costo.sql`, pero ya
no en el código vigente:

- La rama `factura_proveedor` recalcula el costo desde ese archivo
  (`20261113270000_anular_compra_costo.sql:117-148`) y la definición más nueva
  conserva la lógica (`20261116200000_pagos_multifactura.sql:1191-1223`).
- `supabase/tests/anular_compra_costo_test.sql:82-92, 133-142, 290-299` ya
  prueba cantidad y costo al anular (incluidos stock desde cero y stock
  insuficiente).
- `docs/motor-contable.md:109-111` seguía diciendo lo contrario; se actualizó.

Por tanto, si D6 muestra compras anuladas con costo no revertido, la causa es
**dato histórico** (anulaciones hechas antes de aplicar `20261113270000`) o que
esa migración no está aplicada en el proyecto. El SQL de verificación permite
contar y valorar esas compras anuladas.

## Hallazgos estructurales (no se tocaron: requieren decisión)

1. **`asiento_lineas.producto_id` no se llena nunca.**
   `_crear_asiento` inserta `asiento_id, cuenta_id, contacto_id,
   centro_costo_id, descripcion, debito, credito`
   (`20261115201000_centros_costo.sql:234-245`); el reparto de impuestos hace lo
   mismo (`20261115701000_motor_impuestos.sql:298-309`). La columna existe, pero
   ningún camino del motor la escribe. Consecuencia: la consulta 2 de
   `docs/pruebas/cuadre-inventario.sql` no puede atribuir el mayor por producto;
   la afirmación de `investigacion-p4.md` («el cuadre por producto es posible»)
   no se sostiene. Solo el total de cuentas `1130*` es comparable.
   Instrumentarlo exige tocar `_crear_asiento` y las reversiones, y decidir qué
   línea (costo de ventas o inventario) lleva el producto. Es un cambio de motor
   más amplio.

2. **Stock inicial y edición de costo sin asiento.**
   `crear_producto` inserta `cantidad` y `costo` directamente
   (`20261114900000_inventario_existencias_precios.sql:347-376`);
   `actualizar_producto` cambia `cantidad` y `costo` sin asiento y solo ajusta
   `existencias` por el delta (`20261114900000_inventario_existencias_precios.sql:484-512`).
   Es la vía normal para cargar inventario inicial o corregir un costo, pero
   crea valor en `productos` sin contrapartida en el mayor. Si el generador de
   pruebas cargó productos con cantidad/costo inicial, esta puede ser la mayor
   parte de los RD$112.8M. Decisión de Contable: asiento de apertura/revalúo o
   excluir el stock inicial del cuadre.

3. **Ajuste de salida valorado a costo manual.**
   La creación toma `costo_unitario` del payload y, si no viene, el promedio
   (`20261114900000_inventario_existencias_precios.sql:1870-1877`), pero no
   cambia el promedio (`1891-1894`). Si el usuario escribe un costo distinto, el
   asiento sale a ese costo y el promedio queda en otro: nueva fuente de deriva.
   Política pendiente.

4. **Promedio móvil sin capas.** La reversión por fórmula inversa es exacta si
   el movimiento fue el último. Si entre la compra/entrada y la anulación hubo
   ventas u otras compras, el resultado es aproximado (el promedio redondeado
   pierde la pista de qué unidades quedan). Es una limitación del método, no del
   fix; reconstruir el costo histórico exacto requeriría capas o kardex
   valorado, decisión de Contable.

## Cambio entregado

- `supabase/migrations/20261117200000_anular_ajuste_costo.sql` (aditiva, **no
  aplicada**): renombra la anulación vigente a `_anular_documento_base`, le
  quita permisos y crea un wrapper con la misma firma. Para
  `p_tipo = 'ajuste_inventario'` restaura cantidad y costo de las entradas con
  la fórmula inversa; el resto de documentos delega en la definición anterior
  sin cambios. El guard de doble anulación sigue siendo `estado = 'anulada'`.
- `supabase/tests/anular_ajuste_costo_test.sql`: pgTAP aislado, 16 asserts
  (entradas encadenadas, anulación en orden inverso, salida, estado, asiento de
  reversión y doble anulación). No se pudo correr aquí: este entorno no tiene
  Docker/Supabase CLI. Lo corre CI (job Supabase) o `supabase test db` local.
- `docs/pruebas/verificacion-anulaciones-costo.sql`: consultas de solo lectura
  para cuantificar el dato histórico y comprobar si `producto_id` está poblado.
- `docs/motor-contable.md`: se corrigió la nota de límites (compras ya revierten
  costo; ajustes de entrada ahora también).

## Qué queda para Contable / Waldy

1. Correr `docs/pruebas/verificacion-anulaciones-costo.sql` en el SQL Editor
   (solo lectura) y compartir el resultado. Con eso se cuantifica cuánto de D6
   es stock inicial/costos editados y cuánto son anulaciones históricas.
2. Decidir si el stock inicial y los cambios manuales de costo deben generar
   asiento de apertura/revalúo o quedar fuera del cuadre.
3. Decidir si se reconstruye el costo de los productos afectados por
   anulaciones históricas (requiere un asiento de ajuste y el OK de Waldy), o si
   el fix aplica solo de aquí en adelante.
4. Revisar y aplicar `20261117200000_anular_ajuste_costo.sql` (no se aplicó).
5. Si se quiere el cuadre por producto, decidir e instrumentar
   `asiento_lineas.producto_id` en una tarea aparte.

## Evidencia (archivo:línea)

- Ajuste creación con costo: `supabase/migrations/20261114900000_inventario_existencias_precios.sql:1880-1904`.
- Ajuste anulación sin costo: `supabase/migrations/20261116200000_pagos_multifactura.sql:1288-1312`.
- Compra anulación con costo: `supabase/migrations/20261113270000_anular_compra_costo.sql:117-148` y `20261116200000_pagos_multifactura.sql:1191-1223`.
- Prueba de compra: `supabase/tests/anular_compra_costo_test.sql:82-92`.
- `_crear_asiento` sin `producto_id`: `supabase/migrations/20261115201000_centros_costo.sql:234-245`.
- Alta/edición de producto sin asiento: `supabase/migrations/20261114900000_inventario_existencias_precios.sql:347-376, 484-512`.
- Salida a costo manual: `supabase/migrations/20261114900000_inventario_existencias_precios.sql:1870-1894`.
- Documento desactualizado: `docs/motor-contable.md:109-111`.
