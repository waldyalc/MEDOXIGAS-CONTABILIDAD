# Guía de diseño — Estado de resultados (Alegra)

**Fuente:** `app.alegra.com/report/profit-and-loss` — capturado con SingleFile el 2026-11-20.

Contenido del paquete:

| Archivo | Qué es |
|---|---|
| `screenshot.png` | Captura del reporte renderizado |
| `page.html` | Página completa autocontenida (ábrela en el navegador) |
| `styles.css` | Todo el CSS de la página, formateado |

---

## Stack

- **CSS framework:** Tailwind CSS — utilidades con prefijo de scope `.app_alegra_reports_frontend_next` y `.ac-tailwind`.
- **Fuente:** `Inter, Roboto, sans-serif` en toda la UI.
- **Iconos:** Tabler icons (`.tabler-icon`).
- **Moneda:** `RD$` con formato `17,600.00`; porcentajes con 2 decimales.

## Paleta de color

El sistema de diseño usa variables CSS con tripletes RGB (`--sm-color-*`) — conviene replicarlas igual para poder usar `rgb(var(--x) / <alpha>)`:

```css
:root {
  /* Acento principal (teal Alegra) */
  --sm-color-primary-500: 0, 177, 157;   /* #00b19d — botones, enlaces, montos positivos */
  --sm-color-primary-100: 207, 242, 241;
  --sm-color-primary-300: 155, 228, 224;
  --sm-color-primary-400: 114, 213, 209;

  /* Neutros (paleta slate de Tailwind) */
  --texto:        #334155;  /* slate-700 — texto principal */
  --texto-suave:  #94a3b8;  /* slate-400 — labels secundarios */
  --borde:        #e2e8f0;  /* slate-200 — bordes de cards/filas */
  --borde-suave:  #cbd5e1;  /* slate-300 */
  --fondo-card:   #ffffff;

  /* Estados */
  --negativo: #e11d48;  /* rose-600 — montos negativos, -RD$2,200.00 */
  --exito:    #22c55e;  /* focos/anillos de éxito */
}
```

Hex sueltos que aparecen también: `#30aba9`, `#30bbb7`, `#14b8a6` (variantes del teal en controles como el datepicker), `#3b82f6` (azul informativo).

## Radios y sombras

- Cards del reporte: `border-radius: 0.5rem–0.75rem` con borde `1px #e2e8f0` (sin sombra).
- Pills de filtros: `border-radius: 9999px`.
- Sombras casi nulas: el diseño es plano; solo overlays/menús usan `0 25px 50px -12px rgba(0,0,0,.25)`.

## Layout del reporte

```
Sidebar (rail fija, fondo claro, ítems con icono + label)
└── Contenido
    ├── Breadcrumb: Reportes > Contables > Estado de resultados (gris, pequeño)
    ├── Título H1 bold slate-900 + subtítulo descriptivo
    ├── Acciones derecha: Ayuda (link teal) + "Descargar" (botón teal sólido, pill)
    ├── Barra de filtros: pills outlined — "Este mes" · "Centro de costos" ·
    │   "Vista: Reporte detallado" + "Actualizar" (link teal con icono refresh)
    ├── Card "Resumen" (Beta): párrafo de análisis generado + botón "Saber más"
    └── Card tabla del reporte
```

## La tabla — patrón clave

- Encabezado: label de rango a la derecha ("Del 1 al 30 de noviembre: Comparativo 2026 - 2025") + input "Buscar cuenta contable".
- Columnas: `Cuenta | Nov, 2026 | % de ingresos | Nov, 2025 | % de ingresos | Var. Absoluta | Var. Relativa (%)`.
- **Grupos** (Ingresos de actividades ordinarias, Costos de ventas y operación, Utilidad bruta): fila bold con chevron `›/⌄` para expandir/colapsar.
- **Cuentas hijas**: indentadas una muesca, peso normal.
- **Números**: alineados a la derecha, moneda `RD$17,600.00`; positivos/variaciones en teal/verde, negativos en rojo `#e11d48` con prefijo `-RD$`.
- Totales tipo "Utilidad bruta" en bold.
- Filas separadas por hairline `#e2e8f0`, sin zebra striping.

## Cómo reproducirlo

1. Usa Tailwind (el original es Tailwind puro). La estructura de una fila:
   ```html
   <tr class="border-b border-slate-200">
     <td class="py-2 pl-4 font-medium text-slate-700">Ventas</td>
     <td class="py-2 pr-4 text-right text-slate-700 tabular-nums">RD$19,800.00</td>
     <td class="py-2 px-4 text-center text-slate-500">112.50%</td>
     <td class="py-2 px-4 text-right text-slate-500">RD$0.00</td>
     <td class="py-2 px-4 text-center text-slate-500">0.00%</td>
     <td class="py-2 px-4 text-right text-teal-600 tabular-nums">RD$19,800.00</td>
     <td class="py-2 pr-4 text-right text-slate-500">0%</td>
   </tr>
   ```
2. Los grupos expandibles son `<tr>` bold con un chevron que rota; las filas hijas llevan `pl-8` adicional.
3. Cards: `rounded-xl border border-slate-200 bg-white p-4` (sin shadow).
4. Pills de filtro: `rounded-full border border-slate-300 px-3 py-1.5 text-sm text-slate-600` + icono teal a la izquierda.
5. Botón primario: `rounded-full bg-[#00b19d] px-4 py-2 text-white` con hover un tono más oscuro.

## Notas

- El archivo `page.html` renderiza el reporte con datos reales (noviembre 2026, comparativo 2025) — úsalo como referencia visual directa.
- El CSS completo incluye estilos de todo app.alegra.com (sidebar, datepicker, menús), no solo del reporte — busca `.app_alegra_reports_frontend_next` para el scope de la tabla.
