# Nota: copias de los formularios de pago de Alegra

Guardado el 13/11/2026 de la cuenta de prueba **Fiel Ferreteria** (no de una empresa real), con la extensión SingleFile del Chrome de la caja.
Es solo material de estudio para Coder. **No es código para el sistema.** La guía con medidas está en `GUIA-FORMULARIOS.md`.

## Qué hay

| Carpeta / archivo | Qué es | En Alegra |
|---|---|---|
| `pago-recibido/` | Formulario "Nuevo pago recibido" (diseño **nuevo**: una tarjeta, rejilla de 3, pestañas) | `/income-payments/add` |
| `pago-proveedor/` | Formulario "Nuevo pago" a proveedor (diseño **anterior**: dos tarjetas, Cancelar / Guardar fuera) | `/payment/add` (Pagos / Gastos) |
| `*/index.html` + `*/styles.css` | Copia lista para abrir: el CSS de `<head>` va aparte en `styles.css` | — |
| `*/original/*-singlefile.html` | Lo que bajó SingleFile, limpio (sin scripts, correo cambiado) | — |
| `*/copia-local.png` | Cómo se ve la copia local a 1280 px | — |
| `.procesar.py` | El script que limpia el HTML de SingleFile y saca `styles.css` | — |
| `GUIA-FORMULARIOS.md` | La guía corta de estilo (medidas, botones, qué diseño copiar) | — |

Capturas anotadas de estas copias en `../capturas/19-guia-*.png`. Las capturas del flujo en vivo (desplegables, modal, tabla con facturas) están en `../capturas/19-pago-*.png`.

## Cómo abrir sin internet

- Doble clic en `pago-recibido/index.html` (o el de proveedor), o en Chrome: `file:///…/css-pagos/pago-recibido/index.html`.
- Para una captura sin ventana:
  `google-chrome --headless=new --no-sandbox --window-size=1280,1800 --screenshot=salida.png file:///ruta/css-pagos/pago-recibido/index.html`
- Para medir con JS (como en la guía): puppeteer-core + el Chrome del sistema. Para leer las reglas de `styles.css` desde `file://` hace falta `--allow-file-access-from-files`.

## Qué se limpió

- Se quitaron **todos los `<script>`**. La copia no hace nada al hacer clic: no se abren los desplegables, el calendario ni las pestañas.
- El correo de la cuenta se cambió por `correo@ejemplo.com`.
- En `index.html` se quitó la etiqueta `<meta http-equiv=content-security-policy>` de SingleFile (si no, bloquea `styles.css`). En `original/` sigue puesta, porque ahí el CSS va dentro del mismo archivo.
- Los datos que se ven son de prueba (empresa "Fiel Ferreteria"). El RNC no aparece en esta copia.

## Límites

- **Sin JS**: no se puede elegir un cliente, así que la tabla "Facturas por cobrar" no está en `pago-recibido/`. El diseño anterior sí trae la tabla de cuentas contables (una fila vacía).
- SingleFile guarda **solo el CSS que se usa** en la página. Estados que no estaban en pantalla (foco de la fecha, hover de botones, errores, menús abiertos) no se pueden medir aquí.
- En "Recibo de caja", SingleFile rompió el tag de la leyenda; el estilo previsto está en la guía (sección 4).
- Las fuentes Inter van dentro de `styles.css` en base64. No copiarlas: ya tenemos Inter en la app.
- No copiar el HTML ni el CSS de Alegra al sistema. Usar solo las medidas de `GUIA-FORMULARIOS.md`.
