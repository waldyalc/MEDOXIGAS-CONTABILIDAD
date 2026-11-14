# Nota: copias de la vista de documentos de Alegra

Guardado el 13/11/2026 de la cuenta de prueba **Fiel Ferreteria** (no de una empresa real), con la extensión SingleFile del Chrome de la caja.
Es solo material de estudio para Coder. **No es código para el sistema.** La guía con medidas y nuestro CSS propio está en `GUIA-VISTA.md`.

## Qué hay

| Carpeta / archivo | Qué es | En Alegra |
|---|---|---|
| `factura/` | Vista de factura de venta guardada | `/invoice/view/id/1` |
| `cotizacion/` | Vista de cotización guardada | `/estimate/view/id/1` |
| `conduce/` | Vista de conduce (remisión) guardada | `/remission/view/id/1` |
| `*/index.html` + `*/styles.css` | Copia lista para abrir: el CSS de `<head>` va aparte en `styles.css` | — |
| `*/original/*-singlefile.html` | Lo que bajó SingleFile, limpio (sin scripts, correo cambiado) | — |
| `*/copia-local.png` | Cómo se ve la copia local a 1280 px | — |
| `vista-*.png` | Capturas reales en Alegra (arriba, abajo y con el menú ⋮ abierto) | — |
| `nuestra-version/vista.css` + `prueba.html` | Nuestro CSS propio (sección 8 de la guía) y una página de prueba | — |
| `GUIA-VISTA.md` | La guía con todas las medidas | — |

Capturas copiadas a `../capturas/` con el prefijo `19-vista-*`.

## Cómo abrir sin internet

- Doble clic en `factura/index.html` (o la de cotización/conduce), o en Chrome: `file:///…/css-vista/factura/index.html`.
- Para una captura sin ventana:
  `google-chrome --headless=new --no-sandbox --window-size=1280,1600 --screenshot=salida.png file:///ruta/css-vista/factura/index.html`
- Para medir con JS (como en la guía): puppeteer-core en `/tmp` + el Chrome del sistema. Para leer las reglas de `styles.css` desde `file://` hace falta `--allow-file-access-from-files`.

## Qué se limpió

- Se quitaron **todos los `<script>`**. La copia no hace nada al hacer clic.
- El correo de la cuenta se cambió por `correo@ejemplo.com`.
- En `index.html` se quitó la etiqueta `<meta http-equiv=content-security-policy>` de SingleFile (si no, bloquea `styles.css`). En `original/` sigue puesta, porque ahí el CSS va dentro del mismo archivo.
- Los datos que se ven son de prueba (cliente "Constructora Prueba SRL", RNC de prueba).

## Límites

- **Sin JS**: los menús (⋮, Convertir, Compartir), "Ver más", las otras pestañas y la lista móvil de pagos no se abren. El menú ⋮ se midió en las capturas reales (`vista-menu-tres-puntos.png`, `vista-cotizacion-menu.png`, `vista-conduce-menu.png`).
- SingleFile guarda **solo el CSS que se usa** en la página. Estados que no estaban en pantalla (otros colores de etiqueta, errores) no están.
- Las fuentes Inter van dentro de `styles.css` en base64. No copiarlas: ya tenemos Inter en la app.
- No copiar el HTML ni el CSS de Alegra al sistema. Usar solo las medidas.
