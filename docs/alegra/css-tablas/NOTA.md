# Nota: copia de la lista de facturas de Alegra

Guardado el 16/11/2026 de la cuenta de prueba **Fiel Ferreteria** (no de una empresa real), midiendo en vivo en app.alegra.com con puppeteer-core sobre el Chrome de la caja.
Es solo material de estudio para Coder. **No es código para el sistema.** La guía con medidas y nuestro CSS propio está en `GUIA-TABLAS.md`.

## Qué hay

| Carpeta / archivo | Qué es | En Alegra |
|---|---|---|
| `facturas/` | Lista de facturas de venta guardada | `/invoice` (Ingresos → Facturas de venta) |
| `facturas/index.html` + `facturas/styles.css` | Copia lista para abrir: el CSS va aparte en `styles.css` | — |
| `facturas/original/facturas-singlefile.html` | La página tal como se guardó, limpia (sin scripts, correo cambiado) | — |
| `facturas/copia-local.png` | Cómo se ve la copia local a 1600 px | — |
| `GUIA-TABLAS.md` | La guía con todas las medidas | — |

Las capturas de referencia van en `../capturas/` con el prefijo `21-tabla-*`.

## Cómo abrir sin internet

- Doble clic en `facturas/index.html`, o en Chrome: `file:///…/css-tablas/facturas/index.html`.
- Para una captura sin ventana:
  `google-chrome --headless=new --no-sandbox --window-size=1600,950 --screenshot=salida.png file:///ruta/css-tablas/facturas/index.html`

## Qué se limpió

- Se quitaron **todos los `<script>`**. La copia no hace nada al hacer clic.
- El correo de la cuenta se cambió por `correo@ejemplo.com`.
- En `index.html` se quitó la etiqueta `<meta http-equiv=content-security-policy>` (si no, bloquea `styles.css`).

## Límites

- **Sin JS**: "Filtrar", "Más acciones", los checkboxes y la paginación no hacen nada; los estados hover no se ven.
- La copia guarda el CSS usado en la página; estados que no estaban en pantalla (otras pills, errores) pueden no estar.
- Las fuentes Inter van dentro de `styles.css` si venían embebidas. No copiarlas: ya tenemos Inter en la app.
- No copiar el HTML ni el CSS de Alegra al sistema. Usar solo las medidas.
