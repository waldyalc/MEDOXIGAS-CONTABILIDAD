# Guía de estilo: menú lateral (sidebar) de Alegra

Para Coder, para que el **menú lateral** de **Medoxigas Contabilidad** (Next.js + shadcn) se parezca al de Alegra. **Aquí no hay código de Alegra, solo medidas.** No se copiaron textos, logos ni íconos al sistema. En Alegra no se cambió nada.

Las otras pantallas ya están en:

- `../css-factura/GUIA-DISENO-FACTURA.md`
- `../css-factura/GUIA-CALENDARIO.md`
- `../css-pagos/GUIA-FORMULARIOS.md`
- `../css-vista/GUIA-VISTA.md`
- `../css-inicio/GUIA-INICIO.md` (rama `docs/alegra-inicio`)

Copia local del menú (para ver sin sesión): `css-menu/menu/index.html` (con `styles.css` y `original/menu-singlefile.html`). Verificada: el menú se ve igual que en Alegra, con el submenú de "Ingresos" forzado abierto.

## 0. De dónde salen los números

- **No había sesión en Alegra** (sin cookies ni extensión SingleFile en esta caja). Se usó la copia local `css-inicio/inicio/index.html` de la cuenta de prueba **Fiel Ferreteria** (guardada el 14 nov 2026), que trae el mismo menú lateral con su HTML completo y los `<link>` a las hojas externas de `sua.alegra.com` y `single-spa.alegra.com`.
- Medí con **puppeteer-core + el Chrome del sistema** sobre esa copia (`file://`), que carga el CSS real desde `sua.alegra.com`. Ventana de **1280 × 800**, `deviceScaleFactor: 1`.
- Los valores son `getBoundingClientRect` y `getComputedStyle`. Los colores van en hex o `rgb()`. `/0.45` quiere decir 45 % de opacidad.
- Los estados que no se ven en la copia se **forzaron en el DOM** y se midieron: submenú abierto (`sm-accordion-item-body` con `sm-active` + alto real), sub-ítem activo, hover con el botón "+", colapsado (53 px), hover del riel colapsado y móvil (< 1024 px, cerrado y abierto).
- Las reglas CSS que producen estos valores se extrajeron con `curl` de las hojas `3162.*.css`, `3390.*.css`, `2292.*.css`, `770.*.css` (sua.alegra.com) y se citan sin los `[data-v-xxxx]`.
- Si algo no se pudo medir, lo digo con **(no medido)**.

Capturas anotadas (en `../capturas/`):

| Captura | Qué muestra |
|---|---|
| `21-guia-menu-general.png` | Menú expandido a 1280×800: logo, ítems, insignia "2", banner de prueba abajo |
| `21-guia-menu-item-activo-zoom.png` | Zoom del ítem activo con la barra teal a la izquierda |
| `21-guia-menu-submenu-abierto.png` | "Ingresos" desplegado con "Facturas de venta" activo |
| `21-guia-menu-hover-plus.png` | Hover en un sub-ítem: aparece el botón "+" |
| `21-guia-menu-colapsado.png` | Riel colapsado de 53 px (solo íconos, sobre el contenido) |
| `21-guia-menu-colapsado-hover.png` | Riel colapsado que se expande a 271 px al pasar el mouse |
| `21-guia-menu-movil.png` | Menú abierto como cajón a 800 px de ancho |
| `21-guia-menu-movil-cerrado.png` | A 800 px el menú queda oculto fuera de pantalla |

## 1. Qué diseño copiar

El menú es una **columna blanca de 271 px** pegada a la izquierda, con borde derecho de 1 px. De arriba abajo:

1. **Cabecera de 56 px**: logo (máx. 150 px de ancho, se ve de ~120 px) a la izquierda y botón cuadrado de **40 px** a la derecha que colapsa el menú.
2. **Zona con scroll** (`padding: 8px`, separación de **8 px** entre grupos): lista de ítems de **32 px de alto**, con acordeones para las secciones (Ingresos, Compras, Inventario, Contabilidad). Un `<hr>` separa los ítems sueltos de arriba.
3. **Título de grupo** "Descubre más soluciones" (12 px, gris) y 3 ítems más (Nómina, POS, Portal de clientes).
4. **Franja inferior** pegada abajo (`margin-top: auto`, `padding: 8px`): banner de la prueba ("Te quedan X días", barra de progreso, botón relleno).

En Medoxigas el teal de Alegra `#30aba9` / `#30bbb7` pasa al primario `#1e56c7`, igual que en las otras guías.

## 2. Tokens

Fuente: **Inter, Roboto, sans-serif**. Texto de ítems **14 px / altura de línea 21 px**.

| Cosa | Valor |
|---|---|
| Fondo del menú | `#ffffff` |
| Borde derecho del menú | `#e2e8f0` (slate-200), 1 px |
| Texto de ítem normal | `#334155` (slate-700) |
| Texto de ítem activo y sub-ítems | `#0f172a` (slate-900) |
| Íconos y chevron | `#94a3b8` (slate-400) |
| Ícono del ítem activo | `#0f172a` |
| Hover de ítem | `rgba(226,232,240,0.45)` (slate-200 al 45 %) |
| Activo (fondo) | `rgba(226,232,240,0.45)` — mismo que hover |
| Activo + hover | `rgba(226,232,240,0.7)` |
| Activo + pulsado (`:active`) | `rgba(226,232,240,0.9)` |
| Pulsado de ítem normal | `rgba(226,232,240,0.7)` |
| Barra indicadora del activo | **3 × 16 px** (escritorio) / **3 × 12 px** (móvil), teal `#30aba9`, radio completo |
| Anillo de foco | teal `#30bbb7` (primary-500), anillo de 2 px con offset de 1 px |
| Botón "+" | color `#30bbb7` (primary-500), fondo transparente; hover `#e2e8f0` |
| Insignia (sm-tag-next.primary) | fondo `#e9fafa` (primary-50), texto `#299e9c` (primary-700), borde primary-700 al 15 % |
| Riel del scroll | pulgar de **4 px**, `#e2e8f0`, radio completo; pista transparente |
| Velo móvil (backdrop) | slate-700 al 60 % |
| Título de grupo | 12 px / 500, `#64748b` (slate-500) |
| Línea de acordeón | `#e2e8f0`, 1 px a la izquierda del submenú |

Colores primarios de Alegra (para la equivalencia con `#1e56c7`):

- primary-50 `#e9fafa`, primary-500 `#30bbb7`, primary-600 `#30aba9`, primary-700 `#299e9c`.

## 3. Marco del menú (escritorio ≥ 1024 px)

| Pieza | Valor medido (a 1280 px) |
|---|---|
| Menú | **271 px** de ancho × alto de ventana, `position: static` (va en el flujo), fondo blanco, borde derecho 1 px `#e2e8f0`, `overflow: hidden`, transición `all 0.3s`, `z-index: 99999999` |
| Contenido de la página | empieza en **x = 271 px** (topbar de 56 px, contenido con padding 20 px) |
| Cabecera | **56 px** de alto; logo de **120 × 40 px** a (x=8, y=8), máx. 150 px de ancho; botón de colapsar **40 × 42 px** a x=222, radio 8 px, padding 8 px, hover `rgba(226,232,240,0.45)`, pulsado `0.7` |
| Zona con scroll | empieza en **y = 56 px**, ancho 270 px, `padding: 8px`, `gap: 8px`, `overflow-y: auto` |

## 4. Ítem del menú

| Pieza | Valor |
|---|---|
| Caja | **254 × 32 px** (a x=8), `display: flex`, alineado al centro, radio **6 px**, padding `6px 8px` (solo izquierdo medido: 8 px), `cursor: pointer` |
| Ícono | **20 × 20 px** (`min-width/height: 20px`), `#94a3b8`; en el activo `#0f172a` |
| Texto | **14 px / 400 / 21 px**, `#334155`, con `gap` de 8 px respecto al ícono |
| Chevron (acordeones) | **24 × 24 px** (`max-width/height: 20px` en la regla `sn-accordion-item-collapse`), `#94a3b8`, `margin-left: auto` |
| Insignia ("2" en Bandeja) | ~19 × 20 px, 12 px / 500 / 16 px, padding `1px 5px`, gap 4 px, radio 4 px |
| Ítem activo | fondo `rgba(226,232,240,0.45)`, texto e ícono `#0f172a` |
| Barra del activo | `::before` absoluto: **3 × 16 px**, teal `#30aba9`, `border-radius: 9999px`, `left: 0`, centrado vertical (top ≈ 8 px en ítem de 32 px) |
| Deshabilitado | `opacity: 0.3`, cursor normal |

## 5. Acordeón (Ingresos, Compras, …)

- El ítem con submenú es un ítem normal + chevron. Cabecera con transición `all 0.3s`.
- **Cuerpo** (`.sm-accordion-item-body`): `margin-left: 17px`, `padding-left: 10px`, **borde izquierdo de 1 px** `#e2e8f0`, `height: 0` → auto con transición `all 0.3s`; al abrirse gana `margin: 8px 0`. Medido abierto: **237 × 252 px** con 7 sub-ítems, a x=25.
- **Sub-ítem** (`.sm_sidebar_sub_item`): **226 × 32 px** (a x=36), `min-height: 32px`, padding izquierdo 8 px, radio 6 px, texto **14 px / 21 px** `#0f172a`, `margin-bottom: 4px`, `justify-content: space-between` (el "+" queda a la derecha).
- **Sub-ítem activo**: mismo fondo `rgba(226,232,240,0.45)` + barra `::before` **3 × 16 px** teal a `left: 0`.
- El chevron del acordeón no cambia de orientación en la copia (siempre ⌄); la rotación exacta al abrir **(no medido)**.

## 6. Botón "+" (acción rápida)

- **32 × 32 px** (`min-width: 32px`, `height: 32px`), radio 8 px, color `#30bbb7`, `margin-left: auto`.
- **Oculto por defecto** (`display: none`); aparece (`display: block`) solo en **hover del ítem o sub-ítem**.
- Hover del "+": fondo `#e2e8f0`.

## 7. Separador (s-divider)

- Variante usada entre los ítems sueltos y las secciones: `.s-divider.small` → caja **254 × 16 px**, padding `4px 0`, `margin-top: 4px`, con `<hr>` que ocupa todo el ancho.
- Otras variantes (solo de la hoja de estilos, no en el menú): xsmall `2px+4px`, medium `6px+12px`, large `8px+16px`, huge `12px+24px`.

## 8. Franja inferior (banner de prueba)

Pegada abajo con `margin-top: auto`, `padding: 8px` (mide 270 × 139 px a 1280×800):

- Etiqueta "Te quedan X días gratis": 14 px / 500, `#334155`, `margin-bottom: 16px`.
- Barra de progreso: **230 × 6 px**, radio completo, fondo `rgba(148,163,184,0.25)`, relleno `#30aba9` (86.7 % en la prueba).
- Botón "Elegir plan": **230 × 32 px**, radio 8 px, padding `6px 16px`, gap 4 px, fondo `#30aba9`, texto blanco 14 px / 500, `margin-top: 16px`.

En Medoxigas esta franja sirve para lo que haga falta abajo (usuario, versión, soporte); no hace falta el banner de prueba.

## 9. Colapsado (escritorio)

- Con `collapsed`: ancho **53 px**, `position: absolute`, `z-index: 101` — queda **encima** del contenido, que corre a la izquierda.
- Solo se ven los íconos (20 × 20 px, a x=16); el contenido sigue dentro pero recortado por `overflow: hidden`.
- **Hover sobre el riel colapsado**: vuelve a **271 px** flotando, con sombra `0 4px 6px -1px rgba(0,0,0,.1), 0 2px 4px -2px rgba(0,0,0,.1)` — sin mover el contenido.
- Al salir el mouse, vuelve a 53 px. Recién después de colapsar hay una clase `just-toggled` que bloquea el hover ~350 ms.

## 10. Móvil (< 1024 px)

- El menú pasa a `position: fixed`, `transform: translate(-271px)` — **oculto fuera de pantalla** a la izquierda, mismo ancho de 271 px y `z-index: 99999999`.
- Al abrirse (`drawer-open` / `is-open`) hace `translate(0)` y aparece un **velo** (`s-sidebar__backdrop`): `position: fixed` a toda la pantalla, slate-700 al **60 %**, `z-index: 99999998`. En escritorio el velo está `display: none`.
- Todo el interior es idéntico al escritorio; lo único que cambia: la **barra del ítem activo mide 3 × 12 px** (vs 16 px) y el botón "+" puede quedar visible según el hover.
- Medido a 800 px: cerrado `x = -271`, abierto `x = 0`.

## 11. Resumen de estados (ítem)

| Estado | Fondo | Texto/ícono | Extra |
|---|---|---|---|
| Normal | transparente | `#334155` / `#94a3b8` | — |
| Hover | `rgba(226,232,240,0.45)` | igual | aparece el "+" |
| Pulsado | `rgba(226,232,240,0.7)` | igual | — |
| Activo | `rgba(226,232,240,0.45)` | `#0f172a` / `#0f172a` | barra teal 3×16 a la izquierda |
| Activo + hover | `rgba(226,232,240,0.7)` | igual | — |
| Activo + pulsado | `rgba(226,232,240,0.9)` | igual | — |
| Foco (teclado) | — | — | anillo teal `#30bbb7` de 2 px, offset 1 px |
| Deshabilitado | — | igual | `opacity: 0.3` |

## 12. Comparación con nuestro sidebar (shadcn)

| Pieza | Alegra (medido) | Medoxigas actual |
|---|---|---|
| Ancho expandido | **271 px** | 256 px (`SIDEBAR_WIDTH = 16rem`) |
| Ancho colapsado | **53 px**, riel flotante que se expande al hover | 48 px (`3rem`, variante `icon`) |
| Móvil | cajón fijo de 271 px + velo 60 % | cajón de 288 px (`18rem`) |
| Alto de ítem | **32 px** | ~32 px (`h-8`) |
| Ítem activo | fondo slate-200/45 + **barra primaria 3×16** a la izquierda | fondo de acento, sin barra lateral |
| Íconos | 20 × 20 px | 16 px (`size-4`) |
| "+" al hover | 32 × 32 px, solo en hover | no existe |
| Acordeón | guía vertical de 1 px a `ml-17px` | SidebarMenuSub con borde similar |
| Colores | teal `#30aba9` | primario `#1e56c7` |

## 13. Boceto mínimo de CSS

No copies clases de Alegra; esto es solo la forma. En Medoxigas el primario es `#1e56c7`.

```css
:root {
  --menu-ancho: 271px;
  --menu-ancho-mini: 53px;
  --borde: #e2e8f0;
  --texto: #334155;
  --texto-fuerte: #0f172a;
  --gris-ico: #94a3b8;
  --hover: rgba(226, 232, 240, 0.45);
  --activo-bg: rgba(226, 232, 240, 0.45);
  --primario: #1e56c7; /* Alegra usa #30aba9 / #30bbb7 */
}

.menu {
  width: var(--menu-ancho); height: 100%;
  background: #fff; border-right: 1px solid var(--borde);
  display: flex; flex-direction: column; overflow: hidden;
  transition: width 0.3s cubic-bezier(.4, 0, .2, 1);
}
.menu__cab { height: 56px; display: flex; align-items: center; gap: 8px; padding: 0 8px; }
.menu__cab button { width: 40px; height: 40px; border-radius: 8px; padding: 8px; }
.menu__cab button:hover { background: var(--hover); }
.menu__scroll { flex: 1; overflow-y: auto; padding: 8px; display: flex; flex-direction: column; gap: 8px; }
.menu__scroll::-webkit-scrollbar { width: 4px; }
.menu__scroll::-webkit-scrollbar-thumb { background: var(--borde); border-radius: 9999px; }
.menu__pie { margin-top: auto; padding: 8px; }

.item {
  position: relative; display: flex; align-items: center; gap: 8px;
  height: 32px; padding: 6px 8px; border-radius: 6px;
  font-size: 14px; line-height: 21px; color: var(--texto); cursor: pointer;
}
.item svg { width: 20px; height: 20px; color: var(--gris-ico); flex-shrink: 0; }
.item:hover { background: var(--hover); }
.item:active { background: rgba(226, 232, 240, .7); }
.item--activo { background: var(--activo-bg); color: var(--texto-fuerte); }
.item--activo svg { color: var(--texto-fuerte); }
.item--activo::before {
  content: ""; position: absolute; left: 0; top: 50%; transform: translateY(-50%);
  width: 3px; height: 16px; border-radius: 9999px; background: var(--primario);
}
.item .chevron { margin-left: auto; color: var(--gris-ico); }
.item .mas { display: none; margin-left: auto; width: 32px; height: 32px; border-radius: 8px; color: var(--primario); }
.item:hover .mas { display: block; }
.item .mas:hover { background: #e2e8f0; }
.item:focus-visible { outline: none; box-shadow: 0 0 0 1px #fff, 0 0 0 3px var(--primario); }

.submenu {
  margin-left: 17px; padding-left: 10px; border-left: 1px solid var(--borde);
  display: flex; flex-direction: column; gap: 0; margin-top: 8px; margin-bottom: 8px;
}
.subitem {
  position: relative; display: flex; align-items: center; justify-content: space-between;
  min-height: 32px; padding-left: 8px; margin-bottom: 4px; border-radius: 6px;
  font-size: 14px; line-height: 21px; color: var(--texto-fuerte);
}
.subitem:hover { background: var(--hover); }
.subitem--activo { background: var(--activo-bg); }
.subitem--activo::before {
  content: ""; position: absolute; left: 0; top: 50%; transform: translateY(-50%);
  width: 3px; height: 16px; border-radius: 9999px; background: var(--primario);
}

.insignia {
  display: inline-flex; align-items: center; gap: 4px;
  padding: 1px 5px; border-radius: 4px; border: 1px solid rgba(30, 86, 199, .15);
  background: rgba(30, 86, 199, .08); color: var(--primario);
  font-size: 12px; font-weight: 500; line-height: 16px;
}

.grupo-titulo { padding-top: 12px; padding-bottom: 2px; font-size: 12px; font-weight: 500; color: #64748b; }

/* Colapsado: riel flotante que se expande al hover */
.menu--mini { width: var(--menu-ancho-mini); position: absolute; z-index: 101; }
.menu--mini:hover { width: var(--menu-ancho); box-shadow: 0 4px 6px -1px rgba(0,0,0,.1), 0 2px 4px -2px rgba(0,0,0,.1); }

/* Móvil */
@media (max-width: 1023px) {
  .menu { position: fixed; transform: translateX(calc(-1 * var(--menu-ancho))); z-index: 60; }
  .menu.abierto { transform: translateX(0); }
  .menu-velo { position: fixed; inset: 0; background: rgba(51, 65, 85, .6); z-index: 50; }
  .item--activo::before, .subitem--activo::before { height: 12px; }
}
```

## 14. Checklist para Coder

- [ ] Ancho 271 px expandido, 53 px colapsado (riel absoluto que se expande al hover con sombra).
- [ ] Cabecera de 56 px: logo + botón de colapsar de 40 px.
- [ ] Ítems de 32 px, radio 6, padding `6px 8px`, ícono 20 px gris, texto 14/21 `#334155`.
- [ ] Activo: fondo slate-200/45 + barra primaria de 3 px (16 px escritorio, 12 px móvil) a la izquierda.
- [ ] Hover / pulsado / foco como en la tabla de estados.
- [ ] Acordeón con guía de 1 px a `ml: 17px / pl: 10px`, sub-ítems de 32 px en `#0f172a`.
- [ ] Botón "+" de 32 px que solo aparece al hover.
- [ ] Scroll propio con pulgar de 4 px.
- [ ] Móvil < 1024 px: cajón fijo de 271 px + velo slate-700/60.
- [ ] Teal → `#1e56c7`. Sin clases, textos, logo ni íconos de Alegra.

## 15. No medido / no visto

- **Rotación del chevron** al abrir el acordeón: la copia lo muestra siempre como ⌄; en vivo probablemente rota (la variante nueva `s-sidebar-item__chevron--open` rota 180°, pero es de otro marcado). **(no medido)**
- **Animación del acordeón**: `transition: all 0.3s` en el cuerpo; en vivo el alto lo calcula JS (en la copia se forzó con alto fijo). **(no medido en vivo)**
- **Menú de usuario / empresa** arriba a la derecha (fuera del sidebar) y el riel de "apps" (`s-product-rail`): fuera del alcance de esta guía.
- **Variante nueva del sidebar**: las hojas también traen otra generación de clases (`s-sidebar` sin `--new`, `s-sidebar-item__trigger`, ancho 272 px, colapsado a 0 px, fondo `#f1f5f9`, radio 16) que no usa el marcado de esta página; Alegra parece estar migrando. La guía describe la variante que se ve hoy (`s-sidebar--new` + `sm_sidebar_item`).
- **Sombras del botón y del velo en hover del riel colapsado** ya medidas; el `box-shadow` del menú expandido normal es `none`.
- La copia es de la página de **Inicio** (no de `/invoice`): el menú es el mismo en toda la app; el ítem activo en `menu/index.html` es "Inicio", no "Facturas de venta" (ese estado se forzó en las capturas).
