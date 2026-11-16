# Nota: copia del menú lateral de Alegra

El menú lateral se estudió desde la copia local **css-inicio/inicio** de la cuenta de prueba **Fiel Ferreteria** (guardada el 14/11/2026 con SingleFile, rama `docs/alegra-inicio`), porque esta caja no tiene sesión en app.alegra.com ni la extensión SingleFile. El menú es el mismo en toda la app.
Es solo material de estudio para Coder. **No es código para el sistema.** La guía con medidas y nuestro CSS propio está en `GUIA-MENU.md`.

## Qué hay

| Carpeta / archivo | Qué es | En Alegra |
|---|---|---|
| `menu/index.html` + `menu/styles.css` | Copia lista para abrir (carga el CSS real desde `sua.alegra.com`, así que necesita internet para verse bien) | menú lateral de toda la app |
| `menu/original/menu-singlefile.html` | Lo que bajó SingleFile de la página de Inicio, limpio (sin scripts, correo cambiado) | — |
| `menu/copia-local.png` | Cómo se ve la copia a 1280 px | — |
| `.procesar.py` | El mismo script de `css-inicio`/`css-vista`; genera `index.html` y `styles.css` desde el singlefile | — |

Capturas anotadas en `../capturas/` con el prefijo `21-guia-menu-*` (general, zoom del ítem activo, submenú abierto, hover con "+", colapsado 53 px, colapsado con hover, móvil abierto y cerrado).

## Cómo abrir sin sesión

- Doble clic en `menu/index.html`, o en Chrome: `file:///…/css-menu/menu/index.html`. Necesita internet: el CSS del menú no va dentro del archivo, son `<link>` a `sua.alegra.com` y `single-spa.alegra.com`.
- Para medir como en la guía: puppeteer-core en `/tmp` + el Chrome del sistema (`--no-sandbox`), ventana 1280×800, `deviceScaleFactor: 1`.
- Para forzar estados (la copia no tiene JS): añadir `sm-active` a `li.sm-accordion-item`, `.sn-accordion-item-header` y `.sm-accordion-item-body` + alto real en `style.height`; `sm_sidebar_sub_item_active` al sub-ítem; `collapsed` a `.s-sidebar` (quitar el mouse de encima o se expande); `s-sidebar--drawer-open is-open` para el cajón móvil.

## Qué se limpió

- Se quitaron **todos los `<script>`**. La copia no hace nada al hacer clic.
- El correo de la cuenta se cambió por `correo@ejemplo.com`.
- En `index.html` se quitó la etiqueta `<meta http-equiv=content-security-policy>` de SingleFile (si no, bloquea `styles.css`). En `original/` sigue puesta.

## Límites

- **Sin JS**: los acordeones no se abren solos; los estados (submenú abierto, "+", colapsado, móvil abierto) se forzaron por clases, como arriba.
- El CSS del menú **no está** en `styles.css` (eso es solo el `<style>` del `<head>`): está en las hojas externas de `sua.alegra.com` (`3162.*.css` tiene casi todo lo del menú; `3390.*.css` la variante nueva; `2292.*.css` título de grupo y drawer; `770.*.css` el layout).
- La copia es de la página de **Inicio** (no `/invoice`): el ítem activo es "Inicio". El menú es idéntico en todas las páginas.
- No copiar el HTML ni el CSS de Alegra al sistema. Usar solo las medidas.
