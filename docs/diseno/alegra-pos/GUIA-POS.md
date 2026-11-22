# Guía de implementación — POS de Medoxigas con el diseño de Alegra

El POS vive en `src/app/(pos)/pos/` y usa un shell propio: riel de iconos de 52 px
(expande a 271 px) y área de trabajo sin el sidebar de Contabilidad. Los valores
exactos están en `MEDIDAS.md`; esta guía dice cómo se arman con Tailwind/shadcn.

## Estructura

```
layout.tsx                 CarritoPosProvider + riel + main
page.tsx                   Server component de /pos
_components/vender/
  vender-pos.tsx           Catálogo + panel + barra inferior
  catalogo-pos.tsx         Buscador, filtros, rejilla propia
  tarjeta-producto-pos.tsx 220×250, foto, Inv. N, nombre, precio
  tarjeta-venta-simple-pos.tsx
  panel-factura.tsx        Encabezado, selects, cliente, renglones, pie
  barra-inferior-pos.tsx   Pestañas + «+» a la izquierda; turno a la derecha
  pestanas-venta-pos.tsx   Tabs de ventas pendientes
```

- `page.tsx` es un server component chico; lo interactivo va en componentes
  cliente.
- El carrito no se toca desde la UI: usa `useCarritoPOS()` (pestañas, líneas,
  totales). La barra y el panel solo lo consumen.
- El turno llega como `{ id, numero } | null` desde `layout.tsx`; `Abrir turno`
  abre `DialogoAbrirTurno` y `Cerrar turno` navega a `/pos/turnos`, igual que
  antes.

## Tokens

Todo el POS usa los tokens `--pos-*` de `src/app/globals.css` (aliases
`bg-pos-*`, `text-pos-*`, `border-pos-*`): teal `#00b19d`, hover `#008e79`,
línea `#e2e8f0`, texto `#212529`, texto suave `#707070`, icono `#94a3b8`, oscuro
`#1e293b`. El candado `src/lib/pos/diseno-pos.test.ts` prohíbe `--primary` y
`#1e56c7` en `src/app/(pos)/pos/` (salvo la lista de pendientes que solo puede
encoger).

Colores puntuales que Alegra usa y no tienen token propio se escriben como
arbitrarios y con su equivalencia en oscuro cuando aplica: `#30aba9` (insignia de
favorito), `#e85e42` (Agotado), `#c2c9d6` (Vender deshabilitado), `#cff2f1` /
`#1a7e7f` (Nuevo producto), `#e5e7eb` (borde de Venta simple), `#f9fafb` (chip
de inventario), `#d1d5db` (foto vacía).

## Catálogo

- Contenedor: `flex min-h-0 flex-col`; el buscador y los filtros no scrollean; la
  rejilla sí (`min-h-0 flex-1 overflow-y-auto`).
- Fila del buscador: `px-4 sm:px-6 pt-3.5`, `gap-1.5`. Buscador con
  `InputGroup` (h-10, radio 10), botón de escáner de 42×40 y «Nuevo producto» de
  151×40. En móvil el botón queda solo con el icono.
- Fila de filtros: categoría (`Select` de 32 px), favoritos y conteo. Es propia
  de Medoxigas.
- Rejilla: `flex flex-wrap content-start items-start justify-around pt-3`; cada
  tarjeta mide 220 px y lleva `m-1 mx-5 mb-5` (caja de 260×274). Da 3 columnas a
  1440, 2 a 1024 y 5 a 1920, con scroll propio.
- Tarjeta: `border-2`, radio 8, `shadow-[1px_2px_5px_rgba(0,0,0,0.1)]`, zona de
  imagen 196×98, `Tag` de 64 px si no hay foto, chip `Inv. N` de 16 px, nombre de
  2 líneas en mayúsculas y precio al pie. En carrito: borde teal; el contador de
  cantidad va en un círculo de 22 px con anillo blanco.
- «Venta simple» va primera, con el mismo tamaño, borde `#e5e7eb`, círculo de
  100 px y carrito+rayo.

## Panel «Factura de venta»

- `aside` de `w-[40%] max-w-[550px]` con borde izquierdo `slate-300`, fondo
  blanco y `h-full min-h-0 flex-col`.
- Encabezado de 60 px con título 18/700.
- Bloque superior `shrink-0`: selects de 40 px (Lista de precio / Numeración),
  fila de Cliente con `SelectorContacto` + «Nuevo», y Vendedor si hay.
- Lista de renglones `min-h-0 flex-1 overflow-y-auto`; el estado vacío usa cesta
  gris y el texto de Alegra.
- Pie `shrink-0` con «Vender» de 43 px (total dentro), botón oscuro de historial
  de 44×45 y la fila «N Productos / Cancelar» de 43 px. **Sin pestañas dentro**
  del panel: van en la barra inferior.
- El `Sheet` móvil reutiliza el mismo panel con `idPanel="panel-factura-pos-movil"`.

## Barra inferior

- `footer` de 44 px, `shrink-0`, de lado a lado bajo catálogo y panel.
- Izquierda: `PestanasVentaPos` (tab de 160 px con cesta, nombre, borde inferior
  teal en la activa, menú ⋮ al hover para renombrar/eliminar) y el «+» de 44 px
  para abrir otra venta. La lista es scrolleable si hay muchas ventas; el «+»
  queda pegado a la última pestaña.
- Derecha: punto de estado + «Turno No N abierto» / «Turno cerrado» y la acción
  «Cerrar turno» / «Abrir turno». En móvil el texto largo se acorta a
  «Turno N» para no romper.
- La barra no se muestra en las demás pantallas del POS.

## Dark mode y pantallas chicas

- Todo color de texto/fondo usa tokens o lleva su variante `dark:`; no hay
  `bg-white` ni grises claros sin pareja oscura.
- El panel se oculta por debajo de 1024 px y se abre en `Sheet` con el botón
  «Ver factura» (resumen de total arriba de la barra inferior). El Sheet y su
  velo terminan 44 px antes del borde inferior (`calc(100dvh - 2.75rem)`): la
  barra queda visible al pie y el carrito termina justo encima.
- En móvil la barra conserva pestañas y turno; el botón «Nuevo producto» pasa a
  icono y las tarjetas se apilan centradas sin desbordar.

## Candados que aplican

- `src/lib/pos/diseno-pos.test.ts`: tokens `--pos-*`, sin azul en el POS.
- `src/lib/diseno-paginas.test.ts`: `EncabezadoPagina` en las pantallas `*-pos.tsx`
  (la terminal `/pos` es la excepción a propósito).
- `src/lib/tablas-listas.test.ts`: las listas maestro-detalle del POS usan el kit
  compartido; `/pos` (vender) es la terminal a pantalla completa.
- `src/lib/fechas-nativas.test.ts` y `src/lib/selects-nativos.test.ts`: fechas con
  `DatePicker` y listas con `Select`/`Combobox`, no controles nativos.
