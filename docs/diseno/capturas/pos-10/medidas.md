# POS 10 — Tres impresiones, una plantilla 80 mm + cierre 57 mm

Capturas actualizadas el 23-11-2026 (MSG-22), rama `fix/pos-10-medidas-exactas`.
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

- Fuente incrustada: LiberationSans y LiberationSans-Bold, sustituto métrico de Arial.
- Empresa, cliente y Total: 13.5 pt nominales; caja bbox ~15.08 pt.
- Encabezado/datos de cliente/título/subtotales/conteos/pie: 9 pt; caja ~10.05 pt.
- Item/Total de tabla: 8.1 pt bold; ítem/importe: 7.29 pt; detalle: 6.55 pt.
- Logo: caja 69.8×20.9 mm cuando existe logo_url (la captura actual no tiene).
- Cierre No 3 y No 4: título **26.25 pt normal, una sola línea**, filas 7.5 pt y dinero 9 pt. Márgenes de título de 4 mm autorizados; filas mantienen 5.6 mm. Sin caja ni logo inventado.
- El alto bbox NO es el tamaño nominal: se convierte dividiendo entre 1.1171875, métrica de Arial/Liberation Sans, antes de comparar ±0.3 pt. El candado genera cuatro PDFs desde los componentes reales y comprueba ambos tipos de fuente, tamaños, página y logo.

## Comparación por partes vs `alegra-ticket-1.png`

- **Encabezado:** Alegra imprime logo + nombre + «Sucursal», «RNC»,
  dirección, «Teléfono», correo y «Régimen». Medoxigas imprime nombre
  (grande, negrita) + «RNC: 130893489». La tabla `empresa` **aún no
  tiene** columnas `sucursal` ni `regimen`: el formulario de
  Configuración > Empresa ya las captura (`config-empresa.png`), el
  esquema zod y el payload de `actualizar_empresa` las llevan, y la
  migración aditiva propuesta está en
  `docs/pruebas/migracion-empresa-sucursal-regimen.sql`
  (BEGIN/ROLLBACK, pendiente del OK de Waldy). Mientras tanto la
  consulta lee `select("*")`, así que los campos llegan al ticket en
  cuanto existan. La fila de empresa tampoco trae `direccion`,
  `telefono`, `correo` ni `logo_url` cargados: esas líneas se omiten
  (no se inventan); `config-empresa.png` muestra el estado actual y
  los datos finales los cargará Waldy en la pantalla.
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

## MSG-22: contrato exacto y comparación a igual escala

La tabla completa de Coder (PyMuPDF, tamaños nominales y posiciones) vive en `.opencode/skills/ticket-80mm/SKILL.md`, enlazada desde AGENTS.md. Reemplaza las medidas provisionales del MSG-15, que confundían el alto de caja bbox con pt nominales.

Las comparaciones actuales se renderizan desde AMBOS PDFs a 150 dpi, sin redimensionar columnas. Se ocultan logo/datos sensibles del referente; no se versiona su PDF crudo. El título partido de la columna Alegra es la referencia, NO un cierre actual de Medoxigas. Las otras dos columnas están rotuladas como No 3 ACTUAL y No 4 ACTUAL.

Prueba: `pnpm test:pdf`. Requiere Chromium Playwright, Poppler y Arial/Liberation Sans; el job `pdf` de CI instala las herramientas sin secretos y el test no consulta la base. Preview oficial falló dos veces por el sandbox de Chrome al ejecutar T3 como root; las capturas del flujo real se hicieron en 3029 con Playwright local, sin tocar 3010.

Migración: tras consultar el conflicto del timestamp futuro, se eligió **Conservar propuesta**. El SQL sigue en docs/pruebas, sin aplicar ni cambiar el candado de migrations. Faltan dirección, teléfono, correo, sucursal, régimen y logo configurados para la captura del encabezado completo; no se inventaron.

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
- `config-empresa.png` — formulario Configuración > Empresa con los
  campos Sucursal y Régimen (vacíos: dependen de la migración).
- `cierre.pdf` / `cierre.png` — cierre de turno 57 mm, «Cierre No 4» una línea.
- `cierre-3.pdf` / `cierre-3.png` y `cierre-4.pdf` / `cierre-4.png` — los
  dos cierres reales, ambos con el título en una línea.
- `comparacion.png` — Alegra ticket vs factura/prefactura/cotización.
- `comparacion-cierres.png` — Alegra cierre vs los dos cierres Medoxigas.
- `comparacion-encabezado.png`, `comparacion-cliente-doc.png`,
  `comparacion-items-totales.png`, `comparacion-pie.png` — comparación por
  partes recortadas (Alegra izquierda, Medoxigas derecha).
