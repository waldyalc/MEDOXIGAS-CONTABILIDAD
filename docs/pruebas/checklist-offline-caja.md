# Checklist — ventas offline con una fallida (prueba larga en caja real)

Prueba de aceptación del arreglo de la cola offline del POS: **una venta rechazada por el servidor no puede trancar las demás**, queda visible en la bandeja de «Ventas con problema» y **no impide cerrar el turno** (sale avisada).

- **Dónde:** terminal de pruebas (usuario **ZZTEST**, terminal de caja con turno) y el POS en `https://medoxigas-contabilidad.vercel.app/pos` o el preview.
- **Duración:** 30–40 minutos.
- **No usar datos reales:** todos los productos, contactos y ventas de esta prueba son de prueba.
- **Qué se necesita:** 3 productos inventariables activos con existencia (`vende_negativo = false`), impresora de tickets (o vista previa de impresión), acceso a Contabilidad en otra pestaña/dispositivo para forzar el rechazo.

## Antes de empezar

1. Entra al POS con ZZTEST y confirma que la barra inferior dice `0 operaciones por subir · En línea`.
2. Abre un turno en la caja de pruebas con una base inicial conocida (ej. RD$1,000.00).
3. Anota el número de turno y los nombres de los 3 productos:

   | Venta | Producto | Cantidad | Cómo debe terminar |
   | --- | --- | --- | --- |
   | A | Producto 1 | 1 | Sube al reconectar |
   | B | Producto 2 | 1 | **Fallida** (rechazo de negocio) |
   | C | Producto 3 | 1 | Sube al reconectar |

4. Confirma que los 3 productos tienen existencia suficiente **ahora**. El rechazo de B se fuerza después, mientras la caja está offline.

## 1. Poner la caja offline

1. En el navegador del POS abre DevTools → Network → marca **Offline** (o desconecta el cable/Wi-Fi).
2. Espera hasta 15 segundos.
3. **Debe verse:** el estado de la barra inferior cambia a `Sin conexión — 0 ventas por subir`.
4. **No debe verse:** pantalla en blanco, error de Supabase ni pérdida del catálogo ya cargado.

## 2. Vender A, B y C offline

Para cada venta, usa **Efectivo**, monto exacto y cobra:

1. Venta **A**: Producto 1 × 1 → cobrar → confirmar.
2. Venta **B**: Producto 2 × 1 → cobrar → confirmar.
3. Venta **C**: Producto 3 × 1 → cobrar → confirmar.

**Debe verse en cada ticket:**

- Folio local con el formato `POS-LOCAL-<uuid>`.
- **Ningún NCF** ni número de factura del servidor todavía.
- Total, ITBIS y cambio correctos según la venta.

**No debe verse:** la venta desaparece, se duplica o se cae la pestaña.

## 3. Forzar el rechazo de negocio de B (sin tocar A ni C)

Con la caja todavía offline, en **otra pestaña o dispositivo** con un usuario admin:

1. Ve a **Inventario → Ajustes** y crea un ajuste de salida para el **Producto 2** que lo deje en existencia **0** (o por debajo de la cantidad vendida en B).
2. Confirma que el producto sigue con `vende_negativo` apagado (comportamiento por defecto).
3. Guarda el ajuste y espera la confirmación.

Esto hace que, al sincronizar, el servidor rechace B con un error de negocio tipo `no hay existencia suficiente del producto…`, sin afectar A ni C.

## 4. Reconectar y verificar que la cola NO se tranca

1. Quita el modo Offline (o reconecta la red).
2. Mira la barra inferior y abre la **Sincronización del POS**.

**Debe verse:**

- A y C **suben** y aparecen en «Ver ventas ya subidas» con su número de factura y NCF.
- B queda en **«Ventas con problema»** con el error del servidor y sus intentos.
- La barra inferior muestra `1 venta con problema` y ya no dice `1 por subir` por A/C.
- **La cola sigue procesando aunque B esté en medio:** si B era la segunda venta, C sube igual en la misma pasada. Este es el punto central del arreglo.

**No debe verse:**

- La sincronización se queda en «Subiendo ventas…» para siempre.
- A o C quedan pendientes por culpa de B.
- Se crea una factura duplicada de A o C.

## 5. Bandeja de ventas con problema

1. En Sincronización del POS, localiza la tarjeta de B: muestra cliente/total, folio, intentos y el error.
2. Pulsa **Reintentar** con la existencia todavía en 0.

   **Debe verse:** el error se mantiene, los intentos aumentan y A/C no se tocan.

3. Corrige la causa: crea un ajuste de entrada para el **Producto 2** (por ejemplo +5 unidades) y guarda.
4. Pulsa **Reintentar** de nuevo.

   **Debe verse:** B sale de «Ventas con problema», aparece en «Ver ventas ya subidas» con su número y NCF, y desaparece el badge de problema.

5. Prueba el descarte con otra venta fallida de prueba (puedes repetir los pasos 2–4 con un cuarto producto o volver a dejar B sin existencia):
   - Pulsa **Descartar** → **Debe abrirse** la confirmación «¿Descartar esta venta?» con el aviso de que no se puede recuperar.
   - Pulsa **Cancelar** → la venta sigue en la bandeja.
   - Pulsa **Descartar → Sí, descartar** → la venta desaparece de la cola.
   - **Verifica en Contabilidad** que esa venta descartada **no** generó factura, NCF ni asiento.

## 6. Cerrar el turno con una venta fallida pendiente

1. Deja a propósito **una venta fallida** en la bandeja (por ejemplo, vuelve a dejar el Producto 2 sin existencia y crea la venta D offline).
2. Reconecta y espera a que suban las ventas válidas.
3. Ve a **Turnos → Cerrar turno**.

**Debe verse:**

- El botón **no se bloquea** por la venta fallida.
- Aparece el aviso ámbar: `1 venta con problema no subirá. Queda guardada en este dispositivo.` (o el plural si hay varias).
- El cierre se completa y el diálogo de «Turno cerrado» repite el aviso.
- El efectivo esperado y el cuadre **solo incluyen las ventas sincronizadas**.

**No debe verse:** «Conéctate para subir 1 ventas antes de cerrar» cuando la única operación restante es una venta con problema.

## 7. Verificación contable después de reconectar

En Contabilidad, con el turno de prueba:

1. **POS → Historial / Ventas:** A, B (si se reintentó) y C aparecen como facturas del turno, con NCF consecutivo y sin duplicados.
2. **Ingresos → Facturas:** totales, ITBIS, cliente y fecha correctos; la venta descartada no existe.
3. **Contabilidad → Asientos:** cada factura subida tiene su asiento cuadrado (débito = crédito) y ningún asiento huérfano.
4. **Inventario → Existencias:** el stock bajó solo por las ventas que subieron y por los ajustes de la prueba; la venta fallida no movió inventario.
5. **Turnos:** el cierre muestra solo las ventas sincronizadas y conserva el aviso de la venta con problema.
6. **Idempotencia (opcional, si se puede simular):** al reintentar una venta cuya respuesta se perdió, no se duplica la factura; el mismo `client_uuid` devuelve el mismo número y NCF.

## 8. Evidencias para el informe

Capturas o fotos de:

1. Barra inferior en `Sin conexión` con 3 ventas hechas.
2. Ticket con folio `POS-LOCAL-…` (sin NCF).
3. Sincronización con A/C subidas y B en «Ventas con problema» con su error.
4. Confirmación de descarte (Cancelar / Sí, descartar).
5. Diálogo de cierre con el aviso ámbar y el botón habilitado.
6. Historial con los NCF y asientos de las ventas que subieron.

## Criterios de aceptación

- [ ] Una venta fallida **no** impide que las siguientes suban (A y C suben con B fallida en medio).
- [ ] La venta fallida queda visible con su error, intentos y acciones.
- [ ] Reintentar la vuelve a encolar con el mismo folio/UUID; descartar pide confirmación y no deja rastro contable.
- [ ] El turno se puede cerrar con ventas fallidas y el aviso aparece antes y después del cierre.
- [ ] Los NCF, asientos e inventario coinciden con las ventas que realmente subieron.
- [ ] No hay facturas duplicadas ni ventas perdidas.

## Limpieza

1. Descarta o corrige las ventas fallidas de prueba.
2. Cierra el turno de prueba si quedó abierto.
3. Revierte los ajustes de inventario usados para forzar el rechazo.
4. No dejes productos de prueba con existencia alterada.
