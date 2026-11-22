# Guía rápida — copias del POS de Alegra

> **Reglas Medoxigas (anti-confusión):** Este documento es un ESTUDIO de Alegra. (1) **El punto de venta copia el diseño de Alegra exactamente** (decisión de Waldy, 22-11-2026), incluido el teal `#00b19d`, a través de los tokens `--pos-*` de `src/app/globals.css`; el resto del sistema usa los tokens de `docs/plantilla-diseno.md` (`--primary` azul). Sigue prohibido copiar código fuente de Alegra: nada de su HTML, CSS, selectores, textos largos ni logos. (2) Alcance del POS: solo Vender (facturas y cotizaciones rápidas), Turnos (entradas/salidas de efectivo), Historial de ventas del POS y Devoluciones; Inventario y Configuración viven en Contabilidad. (3) Sin multi-empresa; usa siempre empresa.nombre / empresa.rnc, sin textos hardcodeados de Medoxigas.

Medidas y estilo completos: `../design-alegra-pos.md`. Flujo narrado: `../alegra-pos.md`.

## vender/ — pantalla de venta

- Dos columnas: catálogo fluido + factura fija ~400px a la derecha.
- Tarjeta de producto ~140px cuadrada: ícono, `Inv. N` teal, nombre, precio; badge teal con cantidad.
- Botón Vender a todo lo ancho con el total dentro (teal `#00b19d`; en el POS, token `--pos-primario`).
- Factura: selects Lista de precio / Numeración, cliente con botón Nuevo, líneas con stepper `− N +`.

## turno/ — cierre de turno

- Lista de turnos a la izquierda con pill de estado (ABIERTO teal / CERRADO rojo-naranja).
- Detalle: tabla de movimientos, montos a la derecha, devoluciones en rojo `#e11d48`.
- Caja "Dinero esperado en caja" = base + efectivo − devoluciones/retiros.

## Tokens principales

Paleta del POS (copiada de Alegra): `#00b19d` primario · `#008e79` hover · `#e2e8f0` bordes · `#707070`/`#212529` textos · `#e11d48` peligro · Inter · radios 5/8/10px/1rem/pill.

En el POS el primario es el token `--pos-primario` (teal `#00b19d`, igual que Alegra); el resto de la app usa el `--primary` azul de `docs/plantilla-diseno.md`.
