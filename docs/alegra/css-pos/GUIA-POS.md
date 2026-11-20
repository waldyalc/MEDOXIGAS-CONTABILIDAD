# Guía rápida — copias del POS de Alegra

Medidas y estilo completos: `../design-alegra-pos.md`. Flujo narrado: `../alegra-pos.md`.

## vender/ — pantalla de venta

- Dos columnas: catálogo fluido + factura fija ~400px a la derecha.
- Tarjeta de producto ~140px cuadrada: ícono, `Inv. N` teal, nombre, precio; badge teal con cantidad.
- Botón Vender teal `#00b19d` a todo lo ancho con el total dentro.
- Factura: selects Lista de precio / Numeración, cliente con botón Nuevo, líneas con stepper `− N +`.

## turno/ — cierre de turno

- Lista de turnos a la izquierda con pill de estado (ABIERTO teal / CERRADO rojo-naranja).
- Detalle: tabla de movimientos, montos a la derecha, devoluciones en rojo `#e11d48`.
- Caja "Dinero esperado en caja" = base + efectivo − devoluciones/retiros.

## Tokens principales

`#00b19d` primario · `#008e79` hover · `#e2e8f0` bordes · `#707070`/`#212529` textos · `#e11d48` peligro · Inter · radios 5/8/10px/1rem/pill.
