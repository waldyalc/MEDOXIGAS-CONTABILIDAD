# Nota: copias de pantallas del POS de Alegra

Guardado el 20/11/2026 de la cuenta de prueba **Fiel Ferreteria** (no de una empresa real), con `single-file-cli` sobre el Chrome de la caja vía CDP.
Es solo material de estudio. **No es código para el sistema.** La guía con medidas está en `../design-alegra-pos.md`.

## Qué hay

| Carpeta / archivo | Qué es | En Alegra |
|---|---|---|
| `vender/` | Pantalla principal de venta (catálogo + factura a la derecha, turno abierto) | `/#/` |
| `turno/` | Detalle de "Cierre No 1" ya cerrado (resumen de movimientos del turno) | `/shifts` |
| `*/index.html` + `*/styles.css` | Copia lista para abrir: el CSS de `<head>` va aparte en `styles.css` | — |
| `*/original/*-singlefile.html` | Lo que bajó SingleFile, limpio (sin scripts, correo cambiado) | — |
| `*/copia-local.png` | Cómo se ve la copia local a 1280 px | — |
| `.procesar.py` | El script que limpia el HTML de SingleFile y saca `styles.css` | — |

Capturas del flujo en vivo en `../capturas/22-*.png`; la narración del flujo en `../alegra-pos.md`.

## Cómo abrir sin internet

- Doble clic en `vender/index.html` o `turno/index.html`.
- Para una captura sin ventana:
  `google-chrome --headless=new --no-sandbox --window-size=1280,1600 --screenshot=salida.png file:///ruta/css-pos/vender/index.html`

## Qué se limpió

- Se quitaron **todos los `<script>`**: la copia no hace nada al hacer clic.
- El correo de la cuenta se cambió por `correo@ejemplo.com`.
- En `index.html` se quitó el `<meta http-equiv=content-security-policy>` de SingleFile. En `original/` sigue puesta.

## Límites

- **Sin JS**: el buscador, el stepper de cantidades y los modales no funcionan en la copia.
- SingleFile guarda solo el CSS usado en pantalla; estados de hover/foco no se miden aquí.
- El modal de checkout y el de cerrar turno no tienen copia HTML (el modal no estaba abierto al capturar); sus medidas están en la guía y las capturas.
- No copiar el HTML ni el CSS de Alegra al sistema. Usar solo las medidas de `../design-alegra-pos.md`.
