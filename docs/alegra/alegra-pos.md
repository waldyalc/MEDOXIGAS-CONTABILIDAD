# Alegra POS — Punto de Venta (estudio de flujo)

Cómo funciona **pos.alegra.com**, documentado en vivo con la cuenta de prueba "Fiel Ferreteria" (Plan Demo). Inspiración, no copia: ver `README.md` de esta carpeta.

Capturas: `capturas/22-*.png`. Guía de diseño y copias HTML: `design-alegra-pos.md` y `css-pos/`.

**Datos creados en la sesión:** producto `PRUEBA-POS Destornillador Phillips` (cant. 25, costo 4.00, precio base 100.00), contacto `PRUEBA-POS Cliente Mostrador` (RNC 132456780), venta por RD$241.60 en efectivo, cierre de turno "Cierre No 1".

## Mapa del menú lateral

El rail izquierdo (~56px, iconos) expande un panel al hacer hover. Captura: `22-menu-lateral.png`.

| Pantalla | URL | Qué tiene |
|---|---|---|
| Facturar (home) | `/#/` | Pantalla de venta: buscador, catálogo, factura a la derecha |
| Historial de ventas | `/invoices` | Lista de facturas emitidas |
| Registro de pagos | `/payment-records` | Ingresos/Egresos, detalle del pago a la derecha |
| Historial de turnos | `/shifts` | Turno en curso + cierres, detalle con montos y Cerrar turno |
| Reportes de turnos | `/shifts` (reportes) | Resumen de turnos cerrados |
| Devoluciones | `/refunds` | Notas de crédito / devoluciones |
| Contactos | `/contacts` | Lista de clientes/proveedores + Nuevo contacto |
| Inventario → Productos y servicios | `/inventory/items` | Lista de productos + Nuevo producto |
| Inventario → más | — | Promociones, Ajustes, Almacenes, Listas de precios, Gestión |
| Configuraciones | `/settings` | Métodos de pago, preferencias de venta, plantilla de impresión |

Pie del menú: Mi suscripción (Plan Demo), Atajos del teclado, Portal de clientes, "Última sincronización".

Atajos (`22-atajos-teclado.png`): `alt+H` atajos, `alt+M` vender, `F4` venta simple, `alt+P` pagos, `alt+I` crear producto, `alt+C` crear cliente, `alt+R` devoluciones, `alt+V` facturar, `alt+S` turnos, `alt+B` buscar productos, `alt+N` código de barras.

## Pantalla de venta (home)

`22-venta-item-agregado.png`, `22-carrito-2-productos.png`

- Izquierda: banner de plan, estado del turno ("Turno abierto desde 8:15 AM · Cerrar turno"), buscador de productos, tarjeta "Venta simple" (F4) y grid de tarjetas de producto (imagen/ícono, stock `Inv. N`, nombre, precio).
- Derecha: panel "Factura de venta" fijo: Lista de precio (General), Numeración (Crédito fiscal 01), Cliente (default "Consumidor Final 22222222222") + botón Nuevo.
- Cada línea: nombre, precio unitario, stepper −/+, total. Abajo: Subtotal, ITBIS por tasa, y botón grande teal **Vender RD$X** + "N Productos / Cancelar".
- Clic en tarjeta agrega 1 unidad; el badge de la tarjeta muestra cantidad en carrito.
- El impuesto se calcula por ítem: Bombillo 120 → ITBIS 18% = 21.60; el Destornillador quedó guardado sin impuesto (ver "Crear producto").

## Checkout (Pagar factura)

`22-checkout-metodos-pago.png`, `22-checkout-efectivo-cambio.png`, `22-venta-completada.png`

- Modal con TOTAL grande y botones de método: **Efectivo, Tarjeta de crédito, Transferencia** arriba; "Otros métodos": **Tarjeta débito, Combinado, Otros métodos de pago**.
- Efectivo: campo "Valor del pago en efectivo*" + **opciones rápidas** (monto exacto, redondeo superior como RD$250, RD$500), selector de Vendedor, Observaciones, Continuar. Muestra **Cambio** calculado en vivo (241.60 pagado 250 → Cambio RD$8.40).
- Al confirmar: "Guardando venta" con barra → toast "Sincronizando venta…" → modal "¡Muy bien! 🎉 Tu venta se guardó con éxito", Total + Cambio, **Compartir por** correo/WhatsApp/link, "Enviar factura" por email, **Imprimir**, **Nueva venta**.
- El carrito se limpia, el cliente vuelve a Consumidor Final, y el stock baja en la tarjeta (Inv. 25 → 24).
- La venta genera un **pago en Registro de pagos** asociado a la cuenta "Efectivo POS - Terminal Terminal 1" (`22-registro-pagos-venta.png`).

## Crear producto

`22-crear-producto-modal.png`, `22-producto-creado.png`

Modal "Nuevo producto" (desde la pantalla de venta o desde Inventario):

- Tipo: Producto / Servicio / Combo (permanente al guardar).
- Nombre*, Categoría, Unidad de medida*, Almacén* (Principal).
- Cantidad*, Costo inicial por unidad*.
- Precio base* + **Impuestos** (multi-select: Ninguno 0%, ITBIS 18%, ITBIS 16%, ITBIS 0%, Exento, Propina 10%, CDT 2%) → **Precio final*** calculado.
- "Ir al formulario avanzado" lleva al formulario completo.
- Toast de éxito: "¡Producto creado! 🎯".
- Ojo: al elegir ITBIS el Precio final se calculó (100 → 118) aunque el chip seguía mostrando "Ninguno"; el producto resultó cobrado sin ITBIS en la venta. Documenta el comportamiento multi-select real.

## Contactos

`22-contactos.png`, `22-nuevo-contacto.png`

Lista simple con buscador; "Nuevo contacto" abre drawer lateral derecho:
RNC o Cédula, Tipo de identificación (RNC / Cédula / Identificador extranjero), Nombre o Razón social*, Dirección, Correo, Teléfono, y secciones colapsables "Información de venta" y "Configuración contable".

## Turnos — el ciclo completo

`22-turnos-historial.png`, `22-cerrar-turno-modal.png`, `22-cierre-turno.png`

1. **Turno en curso** (`/shifts`): tarjeta "Turno en curso · ABIERTO", fecha/hora de inicio, y panel "Detalles del turno en curso": Total de ventas, Base inicial, Ventas en efectivo, Ventas por tarjeta de débito, Ventas por tarjeta de crédito, Ventas por transferencias, **Devolución de dinero** (en rojo), Total de movimientos del turno, y **Dinero esperado en caja** = base + efectivo − devoluciones/retiros.
2. Si el turno lleva abierto mucho tiempo, un banner amarillo avisa "Tienes un turno abierto hace más de una semana…" en todas las pantallas.
3. **Cerrar turno**: modal con el resumen completo de movimientos, "Dinero esperado en caja", botón **Nuevo movimiento** (permite registrar ingreso/retiro de efectivo antes de cerrar), campo obligatorio **"Dinero real en caja"\*** — el conteo físico; si difiere del esperado se puede justificar con un movimiento — y Observaciones. Botones Cancelar / Guardar.
4. **Cierre registrado**: toast "¡Turno cerrado! 💰". El turno pasa a "Cierre No N · CERRADO" con Fecha inicio–fin, Total de ventas, todos los movimientos, "Dinero en efectivo del cierre", Observaciones y botón **Imprimir** (reporte de cierre).
5. Al vender sin turno abierto, el sistema pide abrir uno (Base inicial).

## Devoluciones

`22-devoluciones.png` — lista de notas de crédito/devoluciones con buscador; las devoluciones en efectivo restan del dinero esperado del turno.

## Configuraciones

`22-configuraciones.png`, `22-config-*.png`

- **Métodos de pago**: Efectivo, Tarjeta crédito, Transferencia, Tarjeta débito, Combinado + "Nuevo método".
- **Preferencias de venta**: toggle de Propinas.
- **Plantilla de impresión**: Diseño Clásico / Minimalista / Detallado, Ancho 80mm / 57mm, pestañas Diseño / Letra / Contenido, y beta de IA "Personaliza con una frase".
- Numeraciones e Impuestos enlazan a `app.alegra.com` (la app contable, no el POS).
- Botón "Activar POS Restobar" (modo restaurante).

## Observaciones para Medoxigas POS

- La venta **vive en una sola pantalla**: catálogo + factura juntos; el checkout es solo elegir método y conteo.
- El turno es el ancla: banner global, esperado en caja siempre visible, cierre con conteo real obligatorio.
- Cada venta alimenta en automático: registro de pagos (cuenta "Efectivo POS - Terminal N"), historial de ventas, turno e inventario (stock en la tarjeta).
- Consumidor Final es el cliente por defecto; la numeración fiscal (NCF/e-CF) se elige en la factura misma.
- Inventario aquí es mínimo a propósito (va en otro módulo de Medoxigas): solo Productos y servicios + crear producto desde la venta.
