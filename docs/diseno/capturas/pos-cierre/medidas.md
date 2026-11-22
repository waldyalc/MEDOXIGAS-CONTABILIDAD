# Cierre POS 6 — medidas y evidencia

Medido el 22/11/2026 con `pdfinfo`, `pdffonts`, `pdftotext -layout`, `pdftotext -bbox` y `pdftoppm -r 300`. Las coordenadas son pt desde la esquina superior izquierda; 1 pt = 0.352778 mm. PDF real de Medoxigas: cierre No 3, obtenido desde `/pos/turnos` → «Imprimir cierre» en Chromium/Playwright, con `page.pdf({ preferCSSPageSize: true, printBackground: true })`. La referencia cruda de Alegra permanece fuera del repositorio.

| Parte | Alegra (pt / mm / fuente medidos) | Medoxigas antes | Medoxigas después | Diferencia después − Alegra |
| --- | --- | --- | --- | --- |
| Hoja | 162 × 708.96 pt / 57.15 × 250.11 mm | 612 × 792 pt / Letter | 162 × 708.96 pt | 0 pt |
| Páginas | 1 | 1 | 1 | 0; sin hoja blanca |
| Margen de hoja | 0 | CSS global 12 mm, sobreescrito por ticket térmico; salida Letter | 0 | 0 |
| Texto: borde izquierdo | 15.75 pt / 5.56 mm | 8.50 pt / 3.00 mm | 15.75 pt | 0 |
| Texto: extremo derecho | 145.81 pt / 51.44 mm | ticket de 80 mm dentro de Letter | 145.81 pt | <0.01 pt |
| «Cierre No»: posición y | 27.24 pt / 9.61 mm | 44.48 pt; título pequeño, centrado | 27.24 pt | <0.01 pt |
| «Cierre No»: fuente | Arial MT 26.25 pt; interlínea 31.5 pt | Nimbus Sans Bold ~6.14 pt | Arial 26.25 pt solicitada; Liberation Sans incrustada en Linux | Métricas equivalentes, no mismo archivo de fuente |
| «Fecha»: posición y | 117.71 pt / 41.53 mm | Sin label; apertura/cierre en cabecera | 117.71 pt | <0.01 pt |
| Texto normal | Arial MT 7.5 pt / interlínea 11.25 pt | Nimbus Sans ~6.14 pt | Arial / Liberation Sans 7.5 pt / 11.25 pt | 0 pt en tamaño |
| «Total de ventas»: posición y | 149.96 pt / 52.90 mm; negrita | No existía esta fila | 149.96 pt | <0.01 pt |
| «Base inicial»: posición y | 182.21 pt / 64.28 mm | Label de sección y=107.23; valor y=119.48 | 182.21 pt | <0.01 pt |
| Paso de filas | 22.5 pt / 7.94 mm | Filas compactas ~9 pt | 22.5 pt | 0 pt |
| Tarjetas | Dos filas: débito/crédito | Una fila «Tarjeta» | Una fila «Ventas con tarjeta» en este cierre | Falta separación demostrable en datos; fallback aprobado |
| «Total de movimientos»: posición y | 339.71 pt / 119.84 mm | Sección de conteo de movimientos; no equivalente | 317.21 pt | −22.5 pt por una sola fila de tarjetas |
| «Dinero en efectivo»: posición y | 366.85 pt / 129.42 mm; 9 pt | «Efectivo real en caja», en resumen final | 344.35 pt; 9 pt | −22.5 pt por tarjetas; 0 pt en tamaño |
| «Observaciones»: posición y | 409.46 pt / 144.45 mm | No existía | 386.96 pt | −22.5 pt por tarjetas |

## Datos y decisiones

- El cierre siempre usa CSS `@page { size: 57mm 250mm; margin: 0; }` y `ancho={57}`, aunque la terminal tenga ticket de ventas de 80 mm. Chrome redondea la página a 162 × 708.96 pt, igual al PDF de referencia; no usar `57mm auto`.
- Layout independiente del ticket de ventas y de recibos; sin cabecera de empresa, logo, terminal ni pie promocional. Separadores internos de filas, sin marco exterior.
- Los importes de ambos cierres son diferentes por tratarse de datos reales distintos. No se copiaron los importes de Alegra: cierre Medoxigas No 3 total RD$250.00, base RD$0.00.
- Se pasan las cuentas configuradas de todas las terminales ya cargadas y se elige por `turno.terminal_id`, también en el filtro «Todas». Débito/crédito solo se separan con cuentas distintas y suma de `ventas.por_cuenta` (método tarjeta) igual al total combinado. Cuentas compartidas, ausentes o que no concilian → una sola línea «Ventas con tarjeta», sin inventar ceros ni repartir por nombre. Se confirmó por pregunta mantener este fallback. El cierre real No 3 usa el fallback; los tests cubren las dos líneas con datos separables y el rechazo de cuentas compartidas o importes no conciliables.
- «Dinero en efectivo del cierre» usa `efectivo_real`; si es null usa `efectivo_esperado`, como solicita el brief. Observaciones vacías → «-». Retiros positivos → `(-RD$500.00)`.
- El formulario conserva ancho de 640 px y validación obligatoria. Vacío no muestra sobrante, faltante, caja cuadrada ni el switch de diferencia. La prueba de navegador pulsó «Cerrar turno» únicamente con el campo vacío y comprobó el error obligatorio: no se llamó a la acción de cierre. Con monto solo se escribió y se canceló.
- La primera lectura no tenía turno abierto. Durante el trabajo apareció el turno No 5 abierto por otra sesión. Las capturas del formulario usan ese turno real sin crearlo ni cerrarlo; para el «antes» se restauraron temporalmente la precarga y etiquetas anteriores y luego se retiraron. No se usó fixture ni se hicieron mutaciones de negocio.
- El navegador compartido T3 no pudo abrir por el sandbox de root. Evidencia obtenida mediante Playwright local en el único dev server levantado para esta tarea: puerto 3025. No se tocó 3010 ni systemctl.

## Archivos visuales

- `antes-formulario.png`: precargado, «La caja cuadra» antes de contar.
- `despues-formulario-vacio.png`: campo vacío sin diferencia.
- `despues-formulario-con-monto.png`: monto escrito, diferencia visible, sin guardar.
- `despues-formulario-oscuro.png` y `despues-formulario-movil.png`: tema oscuro y viewport 390 px.
- `antes-cierre.pdf` / `despues-cierre.pdf`: PDFs reales del cierre No 3, antes y después.
- `antes-cierre.png` / `despues-cierre.png`: renderizados a 300 dpi.
- `comparacion-cierre.png`: izquierda antes (recorte de Letter), centro después, derecha Alegra. La referencia se muestra solo en esta comparación, no se incluye su PDF crudo. Los paneles después/referencia conservan la misma escala física; el panel anterior se amplía para legibilidad.

## Verificación

- `pnpm typecheck`: correcto.
- `pnpm check`: correcto, sin errores; advertencias de complejidad/ternarios y avisos de orden de clases en el proyecto.
- `pnpm test`: 164 archivos aprobados, 1 omitido; 1567 tests aprobados, 3 omitidos. Incluye 4 candados de cierre nuevos.
- `pnpm build`: correcto.
- Playwright: login normal, lectura de cierre histórico, campo vacío, diferencia oculta, error obligatorio sin invocar cierre, monto y cancelación; impresión del cierre No 3.
- `pdfinfo despues-cierre.pdf`: 1 página, 162 × 708.96 pt.
