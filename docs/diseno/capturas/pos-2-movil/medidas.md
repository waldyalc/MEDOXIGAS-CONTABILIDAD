# POS 2 — hojas móviles, carrito táctil y totales largos

Medición del ajuste sobre la rama `fix/pos-2-movil` (base `feat/pos-alegra-exacto`, merge `cb8eb13` del PR #108). Solo presentación: no se creó, editó ni borró ninguna venta, movimiento ni dato; el carrito se usó en memoria. Navegador Playwright (Chromium del repo), DPR 2 para las capturas, dev server en el puerto 3026.

## Anchos de las hojas

| Hoja | Antes (390×844) | Después (390×844) | Nota |
|---|---|---|---|
| Menú móvil (`menu-pos.tsx`) | **292.5 px** (75%, x=0) | **271 px** (x=0) | Medido también a 640, 800 y 1023 px: 271. |
| Factura (`vender-pos.tsx`) | **292.5 px** (x=97.5) | **390 px** (x=0) | En `sm` (640–1023) mide 420 px, su `max-w` previsto. |
| Detalle de pagos (`pagos-pos.tsx`) | 292.5 px (clase `w-full` perdía) | `w-full!` / 480 px en `sm` | La terminal ZZTEST no tiene pagos registrados (0 filas): no se pudo abrir el detalle en vivo sin crear datos. Se corrigió la misma causa (`w-full!`) y el candado la cubre. |

Causa: `sheet.tsx` aplica `data-[side=left]:w-3/4` y `data-[side=right]:w-3/4`; la variante `data-*` gana a una clase suelta aunque vaya después. El `!` de Tailwind hace ganar el ancho por uso. `sheet.tsx` no se tocó, así que las hojas del dashboard conservan su comportamiento; se comprobó que la búsqueda global de `/dashboard` sigue abriendo su Sheet a 390×844.

## Línea del carrito

Fila de 76 px, nombre 14/700, unitario 12, stepper `− N +` con botones de 36 px e iconos de 18 px, total 15/700: geometría de #108 intacta.

| Medida | Antes | Después |
|---|---|---|
| Input de cantidad | 40 px (`scrollWidth 58`, se cortaba `1234.56`) | **60 px**: `scrollWidth = clientWidth = 60` con `1234.56` a 390, 1024, 1280 y 1440 |
| Columna del total | fija en `w-[112px]` (`152` en xl) | `min-w-[112px]` (`min-w-[152px]` en xl) + `whitespace-nowrap`; crece con el importe |
| `RD$12,980.00` (qty 55 × RD$200 + ITBIS) | — | total 108 px; separación al `+`: **16 px a 1024**, **56 px a 1280 y 1440** |
| Estrés `RD$291,356.16` (qty 1234.56) | se montaba sobre el `+` | total 118 px; separación al `+`: **12 px a 1024**, **46 px a 1280 y 1440**; sin solape |
| Acciones lápiz/papelera | flotantes sobre el total, visibles con hover emulado en táctil | `[@media(hover:none)]:hidden`: en táctil no existen como zona de toque |

### Prueba táctil (390×844, `hasTouch: true`)

- Tap en el centro del total: líneas antes **1**, después **1**. No borra ni edita.
- `Quitar` (papelera) no visible en táctil (`accionesVisibles: false`).
- El editor de la línea (tap en el nombre) muestra **«Quitar línea»** como vía de borrado.

## Capturas

- `antes-menu-390.png` / `despues-menu-390.png` — cajón del menú, 292.5 → 271 px.
- `antes-factura-390.png` / `despues-factura-390.png` — factura, 292.5 → 390 px.
- `despues-linea-1234.png` — 1440, cantidad `1234.56` completa y stepper de 36 px.
- `despues-total-largo-1024.png` — 1024, `RD$12,980.00` sin tocar el `+`.
- `despues-total-largo-1280.png` — 1280, mismo total.
- `despues-linea-touch.png` — táctil sin acciones de hover sobre el total.
- `despues-linea-touch-editor.png` — táctil con «Quitar línea» en el editor.

## Verificación

`pnpm typecheck`, `pnpm check`, `pnpm test` (163 archivos, 1566 tests) y `pnpm build` en verde. Candado nuevo en `src/lib/pos/diseno-pos.test.ts`: anchos `w-[271px]!` / `w-full!`, input de 60 px, total con `min-w` y acciones ocultas en `hover: none`.

Fuera de alcance (no se tocó): la X del Sheet de la factura sigue sobre los iconos del encabezado, y la columna del nombre se trunca a 1024 cuando la cantidad es enorme; ambos vienen de antes de este ajuste.
