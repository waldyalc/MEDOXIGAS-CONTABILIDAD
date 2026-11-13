# Copia del diseño del formulario "Nueva factura de venta" (Alegra)

Fecha: 13 nov 2026. Cuenta de prueba Fiel Ferreteria, formulario vacío en https://app.alegra.com/invoice/add (no se guardó nada).

## Resultado: funciona
- `index.html` + `styles.css` abren fuera de Alegra (file://) y se ven igual que el original. Comparar `../capturas/18-factura-original.png` (Alegra) con `../capturas/18-factura-copia-local.png` (copia local en Chrome sin conexión a Alegra).
- `original/factura-singlefile.html`: la página tal como la guardó la extensión SingleFile, en un solo archivo.

## Cómo se hizo
1. "Guardar como" de Chrome estaba bloqueado en el box, así que se instaló la extensión gratis SingleFile (aprobado por Waldy) y se guardó la página.
2. Se quitaron los `<script>` (es solo diseño, no funciona nada: los menús y botones no responden) y se cambió el correo de la cuenta por `correo@ejemplo.com`.
3. Los 75 bloques `<style>` del `<head>` se pasaron a `styles.css`. 5 estilos quedaron dentro del body (componentes) para que no se rompan.
4. Hubo que quitar la etiqueta `<meta http-equiv=content-security-policy>` que pone SingleFile; si no, el navegador bloquea `styles.css` y la página sale sin diseño.

## Límites
- `styles.css` pesa ~730 KB porque trae todo el CSS de Alegra y las fuentes Inter en base64. No se recortó con PurgeCSS (no instalado).
- Las clases son de Vue con `data-v-xxxx`: sirven de referencia visual (tamaños, colores, espacios), no para copiar tal cual al sistema nuevo.
- Es diseño de Alegra: usarlo como referencia, no publicarlo idéntico.
