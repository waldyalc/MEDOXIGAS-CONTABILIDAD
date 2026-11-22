# POS 9 — pestañas de venta con ⋮, renombrar y eliminar

Capturas tomadas con Playwright en el dev server del worktree, puerto **3028**, el 22-11-2026.
Escritorio 1600 × 900 a 2× y móvil 390 × 844 a 2×. Solo se usó el carrito en memoria: **no se creó ni editó ninguna venta ni turno**.

## Capturas

| Archivo                    | Qué muestra                                                              |
| -------------------------- | ------------------------------------------------------------------------ |
| `menu-pestana.png`         | Pestaña extra «Venta 1» con el menú ⋮ abierto: Renombrar / Eliminar.      |
| `menu-pestana-detalle.png` | Recorte de la barra y el menú ⋮.                                         |
| `renombrar.png`            | Input inline de renombrar sobre la pestaña extra.                         |
| `renombrar-detalle.png`    | Recorte del input, con el nombre actual «Mostrador».                     |
| `confirmar-eliminar.png`   | Confirmación al eliminar una pestaña extra **con productos**.            |
| `confirmar-eliminar-detalle.png` | Recorte del diálogo «¿Eliminar «Mostrador»?».                      |
| `menu-pestana-oscuro.png`  | Mismo menú ⋮ en tema oscuro.                                             |
| `pestanas-movil.png`       | Barra móvil con la pestaña activa desplazada a la vista.                 |

## Medidas

| Elemento                 | Clase / valor CSS                    | Medido en el navegador          |
| ------------------------ | ------------------------------------ | ------------------------------- |
| Pestaña                  | `w-[160px]`                          | 159 × 41 px (160 con el borde)  |
| Barra inferior           | `h-11`                               | 44 px de alto                   |
| Icono de la pestaña      | `size-[18px]`                        | 18 × 18 px (`Basket`)           |
| Pestaña activa           | borde inferior teal 2 px             | `2px solid rgb(0, 177, 157)`    |
| Fondo de la pestaña      | blanco / `dark:bg-card`              | `rgb(255, 255, 255)` en claro   |
| Botón ⋮                  | `size="icon-xs"`, absoluto a 4 px    | 24 × 24 px                      |
| Menú ⋮                   | `w-40`                               | 160 px; Renombrar y Eliminar    |
| Input de renombrar       | `h-8 w-32`, `maxLength=30`          | 128 × 32 px                     |
| Botón +                  | `w-11`, alto de la barra             | 44 × 43 px                      |
| Diálogo de confirmación  | `max-w-sm`, `p-4`                    | 384 × 147 px                    |

La pestaña conserva la medida de 160 px y el alto de la barra de 44 px de la referencia de Alegra. El menú mantiene el orden de Alegra: **Renombrar** y, solo en pestañas extra, **Eliminar** en rojo.

## Comprobaciones de comportamiento

- Menú de una pestaña extra: `Renombrar`, `Eliminar`.
- Menú de «Venta principal»: solo `Renombrar`; no existe forma visual de eliminarla.
- Pestaña extra **con productos**: aparece «¿Eliminar «Mostrador»? / Se perderán sus productos.» y solo borra al confirmar.
- Pestaña extra **vacía**: se elimina al instante, sin diálogo; queda activa la vecina («Mostrador»).
- Renombrar con Enter guarda y el nombre se mantiene al cambiar de pestaña; Escape cancela; vacío conserva el anterior.
- El estado vive en memoria en el provider; la primera pestaña tiene id fijo para no romper la hidratación del SSR.
- Consola del navegador: **0 errores** durante el recorrido.

El badge de desarrollo de Next se ocultó solo en el script de captura (CSS `nextjs-portal`); no se tocó el código de la app por eso.
