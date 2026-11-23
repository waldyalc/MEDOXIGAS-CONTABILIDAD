---
name: ticket-80mm
description: Mantener las medidas exactas del ticket PDF POS (factura, prefactura, cotización) y del cierre de 57 mm; generar y comprobar los cuatro PDFs.
---

# Contrato de impresión POS — MSG-22

Fuente: mediciones PyMuPDF de Coder en `/root/referencias/plan-pos-2/medidas-alegra.txt`.
Las medidas son reglas de diseño, nunca datos de otra empresa para imprimir.
No copiar logos, datos, HTML ni CSS de Alegra. Usar solo configuración de Medoxigas.
Esta especificación sustituye la corrección provisional basada en em del PR #120.

## Plantilla única y ciclo de impresión

- `src/components/pos/ticket-pos.tsx`: UNA plantilla para factura, prefactura y cotización.
- `src/lib/pos/impresion.ts`: builders de payload; no duplicar cálculos ni generar NCF para documentos de presentación.
- `src/components/pos/ticket-cierre-pos.tsx`: variante de cierre de 57 mm; `src/lib/pos/impresion-cierre.ts` prepara datos.
- `src/components/pos/impresion-pos.tsx`: portal y ciclo `window.print()`.
- Prefactura: carrito en memoria, sin escrituras, pagos, factura ni NCF. Cotización: lectura, sin NCF.
- El portal de prefactura/cotización vive en `vender-pos.tsx`, nunca en un panel condicionado por `matchMedia`. El ancho del papel puede cambiar esa condición y desmontar el portal durante print.
- Páginas nombradas de 80×250 y 57×250 mm, margen de hoja cero. No romper Carta global.

## Tipografía (pt reales, no em ni escalado)

Arial normal/bold; en Linux Liberation Sans normal/bold es el sustituto métrico. No usar system-ui antes de Arial ni escalar el PDF para hacerlo caber.

| Elemento | pt | Peso |
|---|---:|---|
| Empresa | 13.50 | bold |
| Sucursal, RNC, dirección, teléfono, correo, régimen | 9.00 | normal; etiquetas Sucursal/Teléfono/Régimen bold |
| Cliente: nombre | 13.50 | bold |
| Dirección y documento cliente | 9.00 | normal |
| Título del documento, NCF | 9.00 | bold |
| Fecha, tipo/método pago, vendedor, vencimiento | 9.00 | valor normal, etiqueta bold |
| Item / Total de tabla | 8.10 | bold |
| Nombre y total del ítem | 7.29 | normal |
| Cantidad × precio | 6.55 | normal; cantidad bold en referencia |
| Subtotal, exento, gravado, impuestos | 9.00 | etiqueta bold, importe normal |
| Total: e importe | 13.50 | bold |
| Total recibido, líneas, productos | 9.00 | etiqueta bold, valor normal |
| Pie propio configurable | 9.00 | normal |
| Cierre: título | 26.25 | normal, una línea |
| Cierre: fecha, filas, observaciones | 7.50 | normal |
| Cierre: total ventas/movimientos | 7.50 | bold |
| Cierre: dinero en efectivo del cierre | 9.00 | normal |

Logo: caja 69.8×20.9 mm, x=5.0 y=5.6 mm, centrada, object-contain sin deformación; solo si hay `logo_url`. Nunca sustituirlo por un logo inventado.

## Tabla completa de posiciones de referencia (mm)

Coordenadas de origen de texto PyMuPDF; varían verticalmente al omitir datos o envolver nombres/direcciones propios. No fijar coordenadas absolutas para datos dinámicos.

| Papel 80.1×250.1 mm: elemento | x | y |
|---|---:|---:|
| Empresa | 22.8 | 31.1 |
| Sucursal etiqueta / valor | 25.7 / 42.1 | 37.6 |
| RNC | 27.7 | 42.4 |
| Dirección línea 1 / 2 | 7.1 / 22.6 | 47.4 / 52.2 |
| Teléfono etiqueta / valor | 22.2 / 38.1 | 56.4 |
| Correo | 18.4 | 61.2 |
| Régimen etiqueta / valor | 19.7 / 36.1 | 65.7 |
| Cliente etiqueta / nombre | 10.8 / 30.1 | 74.3 |
| Dirección cliente línea 1 / 2 | 8.0 / 22.6 | 81.3 / 86.0 |
| Título | 24.2 | 94.2 |
| NCF | 26.3 | 99.0 |
| Fecha etiqueta / valor | 19.9 / 32.0 | 103.5 |
| Tipo de pago etiqueta / valor | 22.7 / 45.3 | 108.3 |
| Método etiqueta / valor | 20.7 / 48.0 | 112.7 |
| Vendedor etiqueta / valor | 16.1 / 33.5 | 117.5 |
| Vencimiento etiqueta / valor | 21.4 / 43.0 | 122.0 |
| Item / Total | 5.0 / 57.1 | 130.5 |
| Nombre ítem / importe | 5.0 / 57.2 | 136.3 |
| Cantidad / × precio | 5.0 / 6.9 | 139.5 |
| Subtotal etiqueta / importe | 45.1 / 60.7 | 148.7 |
| Subtotal exento etiqueta / importe | 33.6 / 60.7 | 153.2 |
| Subtotal gravado etiqueta / importe | 33.1 / 62.5 | 158.0 |
| Total etiqueta / importe | 39.1 / 53.6 | 162.4 |
| Recibido etiqueta / importe | 5.0 / 28.5 | 171.8 |
| Líneas etiqueta / cantidad | 5.0 / 29.7 | 176.5 |
| Productos etiqueta / cantidad | 5.0 / 36.2 | 181.0 |
| Pie línea 1 / 2 | 10.2 / 32.4 | 193.2 / 196.9 |
| Línea de plataforma de referencia (NO reproducir) | 9.7 | 205.1 |

| Papel cierre 57.1×250.1 mm: elemento | x | y |
|---|---:|---:|
| Título línea 1 / número de referencia | 5.6 / 5.6 | 9.6 / 20.7 |
| Fecha etiqueta | 5.6 | 41.5 |
| Inicio / fin | 12.9 / 12.9 | 39.4 / 43.4 |
| Total ventas etiqueta / importe | 5.6 / 38.1 | 52.9 |
| Base etiqueta / importe | 5.6 / 35.8 | 64.3 |
| Efectivo etiqueta / importe | 5.6 / 38.1 | 72.2 |
| Débito etiqueta / importe | 5.6 / 41.0 | 80.2 |
| Crédito etiqueta / importe | 5.6 / 41.0 | 88.1 |
| Transferencias etiqueta / importe | 5.6 / 41.0 | 96.0 |
| Devolución etiqueta / importe | 5.6 / 41.0 | 104.0 |
| Retiros etiqueta / importe | 5.6 / 35.4 | 111.9 |
| Movimientos etiqueta / importe | 5.6 / 35.8 | 119.8 |
| Dinero texto línea 1 / 2 | 5.6 / 5.6 | 129.4 / 134.2 |
| Dinero importe | 32.7 | 131.8 |
| Observaciones etiqueta / valor | 5.6 / 50.6 | 144.4 / 142.6 |

La referencia parte el título del cierre; Waldy exige una línea. A 26.25 pt mide aproximadamente 48 mm y no cabe en 45.8 mm útiles. Se AUTORIZÓ reducir solo los márgenes del título a 4 mm; las filas conservan 5.6 mm. No reducir/comprimir la fuente. Si otro número no cabe, medir y preguntar.
Débito/crédito se separan solo si los datos permiten atribuirlos; no inventar un desglose histórico.

## Datos de Configuración > Empresa

Logo (`logo_url`), nombre, Sucursal (`sucursal`), RNC, dirección, Teléfono, correo, Régimen (`regimen`), en ese orden. Omitir vacíos, no inventar logo ni información fiscal. El RNC configurado de Medoxigas es 130893489.
Cliente: nombre, dirección y RNC/cédula reales. Vendedor y vencimiento solo cuando existan; la prefactura no inventa vencimiento.
La propuesta SQL sucursal/régimen permanece en docs/pruebas hasta aprobación y timestamp UTC válido; no aplicar migraciones ni cargar datos para capturas.

## Verificación obligatoria

Ejecutar `pnpm vitest run src/lib/pos/ticket-pdf.test.tsx` (Chromium Playwright instalado y Poppler: pdfinfo, pdffonts, pdftotext, pdftoppm). Genera cuatro PDFs desde los componentes reales sin servidor, credenciales ni base.

- `pdfinfo archivo.pdf`: una página, 80 o 57 mm de ancho, 250 mm de alto (tolerancia de redondeo Chromium).
- `pdffonts archivo.pdf`: Arial/LiberationSans normal y bold incrustadas; no system-ui.
- `pdftotext -bbox archivo.pdf salida.html`: mide cajas de palabras, NO confundir alto de caja con tamaño nominal de fuente. Para Arial/Liberation Sans el alto de caja es 1.1171875×pt; el test convierte antes de comparar ±0.3 pt.
- Para inspección nominal adicional se puede usar PyMuPDF `page.get_text('dict')` y `span['size']`.
- `pdftoppm -png -r 150 -singlefile archivo.pdf salida`: renderizar AMBOS lados a los mismos dpi, sin resize. Capturar factura/prefactura/cotización y ambos cierres reales; no comparar PNGs de distinto dpi.
- Comparar por encabezado, cliente, documento, ítems, totales y pie; ocultar datos sensibles del referente antes de publicar. Guardar en docs/diseno/capturas/pos-10/.
- `pnpm typecheck`, `pnpm check`, `pnpm test`, `pnpm build`. Revisar que sigue sin escrituras y no aparece marca ajena en los tickets.
