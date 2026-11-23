# referencia-de-diseno.md — Cómo Alegra diseña (tokens extraídos de su app)

> Fuente: medido directamente del HTML/CSS capturado de app.alegra.com
> (`/root/alegra-refs/*.html`, cuenta de Waldy, nov-2026). Los exports crudos
> viven fuera del repo; este archivo es la destilación.
> **Visor visual:** abre `referencia-de-diseno.html` (mismo directorio) para ver las
> muestras renderizadas y compararlas con lo nuestro.

## 1. Color

### Primario — la escala Tailwind `blue` completa

| Token Alegra | Valor | Uso en su UI |
|---|---|---|
| `--sm-color-primary-50` | `#eff6ff` | Fondo de chips seleccionados, estados focus suaves |
| `--sm-color-primary-100` | `#dbeafe` | Tintes de hover en cards |
| `--sm-color-primary-200` | `#bfdbfe` | Bordes activos suaves |
| `--sm-color-primary-300` | `#93c5fd` | — |
| `--sm-color-primary-400` | `#60a5fa` | Iconos de énfasis |
| `--sm-color-primary-500` | `#3588ff` | Anillos de focus (`--tw-ring-color`), estrellas activas |
| `--sm-color-primary-600` | `#2563eb` | **Botón primario filled** (Descargar, guardar), acentos |
| `--sm-color-primary-700` | `#1d4ed8` | Hover del primario |
| `--sm-color-primary-800` | `#1e40af` | — |
| `--sm-color-primary-900` | `#1e3a8a` | Texto dentro de chips tintados |

### Neutros — la escala `slate`

| Valor | Uso observado |
|---|---|
| `#f8fafc` slate-50 | Fondo de página, fondo de filas de totales |
| `#f1f5f9` slate-100 | Fondo del sidebar |
| `#e2e8f0` slate-200 | Bordes de cards, divisores, riel del submenú |
| `#cbd5e1` slate-300 | Bordes de chips sin seleccionar |
| `#94a3b8` slate-400 | Iconos inactivos, "+" de los menús |
| `#64748b` slate-500 | Texto secundario, títulos de grupo, descripciones |
| `#475569` slate-600 | Texto de apoyo en hover |
| `#334155` slate-700 | Texto de ítems de menú |
| `#0f172a` slate-900 | Texto principal, nombres de cuenta |

### Semánticos

| Valor | Uso |
|---|---|
| `#e11d48` rose-600/700 | Devoluciones, montos contra, error |
| `#16a34a` green-600/700 | Variación positiva, estados ok |
| `#fbbf24` amber-400 | Estrella de favorito activa |
| `#4f46e5` indigo-600 | Tag "Beta" de la card Resumen |
| `#00b19d` teal | **Solo el botón flotante de chat** — no es el color del sistema |

### Colores por categoría de reporte (cards)

| Categoría | Icono | Fondo del chip |
|---|---|---|
| Ventas | `#16a34a` | `#dcfce7` |
| Administrativos | `#30aba9` | `#d8f4f2` |
| Financieros | `#f54a00` | `#ffedd5` |
| Contables | `#f59e0b`/`#fbbf24` | `#fef3c7` |
| Fiscales | `#e11d48` | `#ffe4e6` |
| Para trabajar | `#4f46e5` | `#e0e7ff` |
| Favoritos | `#fbbf24` | `#fef3c7` |

## 2. Tipografía

- **Familia única:** `Inter` en todo (body, inputs, tablas, menú).
- Escala observada:

| Token | Tamaño / altura | Peso | Uso |
|---|---|---|---|
| xs | 12px / 16px | 400-500 | Celdas de tabla, contadores, títulos de grupo, etiquetas |
| sm | 14px / 20px | 400 | Menú, chips, botones, descripciones |
| base | 16px / 24px | 500-600 | Títulos de sección ("Clasificación por categoría") |
| lg | 18px / 28px | 600 | Título de página |
| xl | 20px / 28px | 700 | H1 de página ("Reportes") |
| num | 12-14px | 500-600 | Montos en tablas (tabular-nums implícito) |

## 3. Espaciado y radios (medidos)

- **Sidebar:** ancho 272px; fondo slate-100; `padding-top:16px`, listas `padding 0 12px`, **gap 4px** entre ítems.
- **Ítem de menú:** `padding:6px 8px` (~32-36px de alto), `gap:8px`, `border-radius:8px`, icono 20px stroke 1.5, indicador activo `::before` de **3×14px** a la izquierda.
- **Submenú:** riel `border-left:1px slate-200` a `margin-left:17px`, `padding-left:11px`, gap 4px.
- **Título de grupo:** `padding-top:12px; padding-bottom:2px`, 12px slate-500 medium.
- **Header del sidebar:** 64px, padding 0 12px, logo alineado a la izquierda.
- **Cards de categoría/reporte:** `border-radius:16px` (`rounded-2xl`), borde `1px slate-200`, `min-height:120px`, grid `minmax(228px,1fr)` (en <530px `minmax(168px,1fr)`), gap 16px, padding interno 16-20px.
- **Chip de categoría en card:** `32×24px` `border-radius:8px` con icono 16px.
- **Botones:** altura 40px, `border-radius:10px`, padding 0 16px; variante filled = primary-600 texto blanco; icono trailing chevron-down.
- **Chips de filtro:** altura 32px, `border-radius:9999px`, borde slate-300 o tintado primary-50 cuando están activos, icono 16px + texto sm + chevron.
- **Tabla de reporte:** celdas `padding:8px 16px` aprox, texto xs; filas de totales `background:slate-50` + `font-weight:600`; indentación del árbol: nivel 0 = 0px, nivel 1 = 32px (`2rem`); chevron 20px.
- **Sombras:** sombra por defecto casi nula; cards usan borde, no sombra. Modal/popover: `0 20px 25px -5px #0000001a, 0 8px 10px -6px #0000001a`.
- **Dark mode:** Alegra corre todo en claro en esta captura; no se midieron tokens oscuros.

## 4. Iconografía

- Librería **Tabler Icons** (`tabler-icon-*` en el DOM), `stroke-width:1.5`, tamaño 20px en menú, 16px en chips/botones.
- Mapa observado: Ingresos `circle-arrow-down-left`, Compras `circle-arrow-up-right`, Reportes `timeline`, Mis tareas `clipboard-check`, Contabilidad `calculator`, Bancos `building-bank`, Contactos `users`, Inventario `package`, Config `settings`, cards de reportes `coin/chart-bar-popular/cash/file-invoice/report-money/briefcase/star`.

## 5. Comportamientos distintivos

- **Card de categoría hover:** el icono se desvanece (opacity→0), el título sube ~8px, el contador se desvanece y aparece el texto descriptivo — todo con transición ~200ms.
- **Buscador de reportes:** filtra en vivo las cards; sin resultados muestra estado vacío.
- **Recientes/Favoritos:** secciones que solo aparecen si hay datos (localStorage en nuestro caso).
- **Sidebar riel:** colapsado a 53px de riel con iconos centrados; hover/expand a 272px.
- **Tabla árbol:** secciones expandibles con chevron; las filas "contra" (devoluciones) pintan rose-700 incluyendo el nombre; el resto de negativos van en negro con `-RD$`.
- **Sin números de cuenta visibles** en el Estado de resultados: solo nombre + enlace.

## 6. Cómo se traduce a Medoxigas (ver docs/DESIGN.md)

- Estructura/espaciado/tipografía = **copia exacta** de lo de arriba.
- Color: `--sm-color-primary-600 #2563eb` → `--primary #1e56c7` (azul Medoxigas); el resto de la escala se traduce por el preset `medoxigas` de `src/app/globals.css`. Neutros slate idénticos.
- Excepción: `/pos` mantiene el teal `--pos-*` (decisión anterior, protegida por test).
