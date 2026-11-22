# POS 10 — Tres impresiones, una plantilla 80 mm + cierre 57 mm

Capturas del 22-11-2026, rama `feat/pos-prefactura-cotizacion-pdf`.
Dev server en `http://localhost:3029` con datos reales de Medoxigas
(MEDOXIGAS ALC, SRL — RNC 130893489). Los PDFs se generaron con
Playwright (`page.pdf` + `preferCSSPageSize`) sobre el portal
`[data-print-root][data-print-pos]` real de la app; no se creó ningún
dato (la prefactura se armó desde el carrito en memoria y la cotización
usa una guardada existente).

## pdfinfo

| Archivo          | Páginas | Tamaño              | Equivale a     |
|------------------|---------|---------------------|----------------|
| factura.pdf      | 1       | 227.04 × 708.96 pt  | 80 × 250 mm    |
| prefactura.pdf   | 1       | 227.04 × 708.96 pt  | 80 × 250 mm    |
| cotizacion.pdf   | 1       | 227.04 × 708.96 pt  | 80 × 250 mm    |
| cierre.pdf       | 1       | 162 × 708.96 pt     | 57 × 250 mm    |

Sin hoja en blanco extra en ninguno (todas 1 página).

## Medidas tipográficas (pdftotext -bbox, nuestra factura)

- Nombre de empresa: ~10.8 pt alto de letra, negrita, centrado.
- Etiquetas (`RNC:`, `Cliente:`, `Fecha:`…): ~7.2 pt, negrita.
- Cuerpo e ítems: ~7.2 pt regular.
- Total grande (`RD$…`): ~11 pt negrita.
- Cierre: título `Cierre No 4` en **una sola línea** (~17.25 pt, negrita,
  `white-space: nowrap`), filas con separador horizontal como Alegra,
  sin caja alrededor de la tabla y sin logo (la referencia de Alegra
  tampoco lo muestra).

## Comparación por partes vs `alegra-ticket-1.png`

- **Encabezado:** Alegra imprime logo + nombre + «Sucursal», «RNC»,
  dirección, «Teléfono», correo y «Régimen». Medoxigas imprime nombre
  (grande, negrita) + «RNC: 130893489». La tabla `empresa` **no tiene**
  columnas `sucursal` ni `regimen` (verificado en
  `src/lib/supabase/types.ts`); el código ya soporta esas líneas de
  forma opcional (`sucursal?`/`regimen?` en `Empresa`/`EmpresaPOS`) y
  las imprimiría en el orden de Alegra cuando existan — queda pendiente
  la migración aditiva + campos del formulario de Configuración, a la
  espera del OK de Waldy. La empresa configurada no trae `logo_url`,
  así que no se imprime logo (no se inventa).
- **Cliente:** «Cliente: <nombre>» grande y negrita + RNC debajo,
  igual que Alegra.
- **Bloque documento:** prefactura → «Prefactura» + «Sin valor fiscal»
  + fecha, sin NCF. Cotización → «Cotización No. N» + «Sin valor
  fiscal» + «Fecha» + «Vence». Factura → tipo + NCF + fecha + tipo y
  método de pago + vencimiento (igual que Alegra). «Vendedor» se
  imprime cuando hay uno seleccionado (en las capturas no hay).
- **Ítems:** tabla Item/Total con cantidad × precio debajo, igual.
- **Totales:** `Subtotal`, `Descuento` (si aplica), `Subtotal Exento`,
  `Subtotal Gravado`, `(A) ITBIS <tasa>` por tasa, `Total ITBIS`,
  `Total`, `Total recibido` (solo factura), `Total de líneas`,
  `Total de productos`. Alegra usa las mismas filas.
- **Pie:** `pie_ticket` de la plantilla; en estas capturas el pie
  configurado es el propio «Precios sujetos a cambio sin previo
  aviso.». Nunca «Generado en Alegra POS».

## Incidencia corregida durante las capturas

El portal de impresión del panel se desmontaba a mitad de
`window.print()`/PDF: al entrar el medio «print», Chromium evalúa
`matchMedia("(min-width: 1024px)")` con el ancho del papel (80 mm),
`esEscritorio` pasaba a `false` y React desmontaba `PanelFactura` con
el portal dentro (PDF de 982 B en blanco). Se movió el estado de
impresión a `vender-pos` (fuera del render condicional), que es donde
vive ahora `ImpresionPos` para prefactura/cotización.

## Archivos

- `factura.pdf` / `factura.png` — ticket de una venta existente.
- `prefactura.pdf` / `prefactura.png` — vista previa del carrito (sin venta).
- `prefactura-preview.png` — el diálogo «Vista previa» en pantalla.
- `prefactura-printroot.png` — el portal de impresión bajo media print.
- `cotizacion.pdf` / `cotizacion.png` — ticket de una cotización guardada.
- `cotizacion-pagina.png` — ficha de la cotización con la acción 80 mm.
- `cierre.pdf` / `cierre.png` — cierre de turno 57 mm, «Cierre No 4» una línea.
- `comparacion.png` — Alegra ticket vs factura/prefactura/cotización
  Medoxigas + Alegra cierre vs cierre Medoxigas.
