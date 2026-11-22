# Medidas del ticket POS 80 mm — Alegra vs Medoxigas

Medido con `pdfinfo`, `pdftotext -bbox` y `pdftoppm` sobre:

- **Alegra:** `/root/referencias/plan-pos-2/alegra-ticket-80mm.pdf` (PDF real de la
  cuenta, 1 página, 227.04 × 708.96 pt; **NO se commitea** — datos de OXYMAT.
  La captura `alegra-ticket-1.png` tampoco; en `comparacion-80mm.png` va tapada).
- **Medoxigas antes:** `antes-ticket-80mm.pdf` (código de `eae6704`).
- **Medoxigas después:** `despues-ticket-80mm.pdf` (esta rama).

## Página

| Parte              | Alegra              | Medoxigas antes        | Medoxigas después       | Diferencia |
| ------------------ | ------------------- | ---------------------- | ----------------------- | ---------- |
| Ancho de página    | 227.04 pt (80 mm)   | 612 pt (Letter)        | 227.04 pt (80 mm)       | 0 pt ✅    |
| Alto de página     | 708.96 pt (250 mm)  | 792 pt                 | 708.96 pt (250 mm)      | 0 pt ✅    |
| Páginas            | 1                   | 1 (hoja grande sobra)  | 1                       | ✅         |
| Margen lateral     | ~14.2 pt (5 mm)     | 12 mm de @page letter  | 5 mm (padding papel)    | ✅         |
| Márgenes de hoja   | 0                   | 12 mm                  | 0                       | ✅         |

Causa del antes: Chrome ignora `size: 80mm auto` en `@page` y cae a Letter;
con alto fijo (`size: 80mm 250mm`) sale exactamente 227.04 × 708.96 pt.

## Tipografía (altura de glifo medida en el PDF)

| Parte                    | Alegra (pt / ~em) | Medoxigas antes | Medoxigas después | Diferencia          |
| ------------------------ | ----------------- | --------------- | ----------------- | ------------------- |
| Nombre empresa           | 15.08 (1.5em)     | ~7.7 (1.15em)   | 10.84 (1.5em)     | mismo ratio, fuente |
| Cuerpo (líneas datos)    | 10.05 (1em)       | ~6.4 (0.92em)   | 7.23 (1em, 10pt)  | fuente distinta*    |
| «Cliente:»               | 15.08 (1.5em)     | ~7.0 (bold 1em) | 10.84 (1.5em)     | ✅ ratio igual      |
| Encabezado Item/Total    | 9.05 (0.9em)      | ~5.4            | 6.51 (0.9em)      | ✅ ratio igual      |
| Nombre ítem              | 8.14 (0.81em)     | ~5.9            | 5.78 (0.8em)      | ✅ ratio igual      |
| «cant x precio»          | 7.32 (0.73em)     | ~5.4            | 5.2 (0.72em)      | ✅ ratio igual      |
| Total (monto)            | 15.08 (1.5em)     | ~7.7            | 10.84 (1.5em)     | ✅ ratio igual      |

\* La fuente base quedó en 10 pt (mediana). Los glifos de Alegra miden ~10 pt
porque usa Arial; la nuestra (ui-sans-serif) mide ~7.2 pt al mismo cuerpo, pero
los ratios entre partes y los pasos de línea coinciden.

## Paso de línea (pt entre líneas consecutivas)

| Bloque            | Alegra | Medoxigas después |
| ----------------- | ------ | ----------------- |
| Datos comprobante | 13.5   | 13.5 ✅           |
| Totales           | 12.8   | 13.5              |
| Ítem → detalle    | 8.9    | 10.2              |
| Entre secciones   | 20–26  | 17–29             |

## Orden (igual en ambos)

1. Encabezado centrado: logo (si hay), empresa, RNC, dirección, teléfono,
   correo. **Sucursal y Régimen no existen como datos en nuestra app: se
   omiten** (no se crearon campos ni tablas).
2. Separador + `Cliente: <nombre>` en negrita grande y documento/dirección.
3. Separador + tipo de comprobante, NCF, `Fecha: dd/mm/aaaa h:mm am/pm`,
   `Tipo de pago:`, `Método de pago:`, `Vendedor:` (si hay dato),
   `Vencimiento:` (si difiere), `Vence NCF:` (propio, se conserva).
4. Tabla `Item / Total`: nombre izquierda, total derecha sin moneda;
   debajo `cantidad x precio` (`2 x 112.10`, sin `RD$`).
5. Totales a la derecha con etiqueta en negrita: Subtotal, Subtotal Exento,
   Subtotal Gravado, ITBIS por tasa, Total (1.5em). Descuento/otros solo si existen.
6. `Total recibido: RD$X` a la izquierda (+`Cambio:` si hay). Crédito:
   `Pagado`/`Crédito`/`Saldo` dentro de los totales, como antes.
7. `Total de líneas: N` y `Total de productos: N`.
8. Pie configurable (`pie_ticket`); si está vacío no se imprime nada
   (la venta capturada no tiene pie: por eso no sale en el DESPUÉS).

Quitado respecto al antes: `Terminal:`, `Turno No`, `Cajero:`, el bloque
«Pagos» separado, la nota «ITBIS incluido» y los números de línea `1.`/`2.`.
El «Generado en Alegra POS» no se copia (es su marca).
