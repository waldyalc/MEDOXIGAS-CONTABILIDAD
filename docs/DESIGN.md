# DESIGN.md — Sistema de diseño Medoxigas Contabilidad

> **Regla rectora (Waldy, nov-2026):** la app copia la estructura, el layout y el
> comportamiento de **Alegra Contabilidad** pantalla por pantalla — pero viste la
> marca **Medoxigas** (logo propio, azul corporativo, nunca el teal de Alegra).
>
> Referencia local de medición (nunca se commitea): `/root/alegra-refs/*.html`.
> Este documento es la ley: si una regla contradice `docs/alegra/*` o una captura
> vieja, manda este archivo.

---

## 1. Decisiones base

| Tema | Decisión |
|---|---|
| Estructura / layout / comportamiento | **La de Alegra**, copiada de sus capturas HTML |
| Color de marca | **Azul Medoxigas `#1e56c7`**, nunca el teal `#0a9e9a`/`#00b19d` de Alegra |
| Logo | Siempre **Medoxigas**, nunca el de Alegra |
| Fuente | **Inter** (misma que Alegra), `--font-inter` |
| Iconos | **Tabler Icons** (`@tabler/icons-react`) — la misma librería que Alegra usa |
| Moneda | `RD$` con separador de miles, negativos `-RD$1,234.00` |
| Idioma | Español dominicano |

Excepción: el **POS** (`/pos`) sí usa el teal `#00b19d` por decisión anterior
(tokens `--pos-*`); ahí se mantiene porque su copia es literal y ya fue aprobada.

### Mapa de color obligatorio

Cuando una captura de Alegra muestra teal, se traduce así **siempre**:

| Alegra (teal) | Medoxigas | Uso |
|---|---|---|
| `#0a9e9a` / `#00b19d` | **`--primary` `#1e56c7`** | Botón filled, chips activos, links de acción, píldora del menú, iconos de acento |
| `#00535e` / `#004a52` (hover oscuro) | **`#123c8c`** | Hover de botones primarios |
| `#005452` (texto sobre tinte) | **`--secondary-foreground` `#0a2352`** | Texto dentro de chips/píldoras tintadas |
| `#ebfafa` / `#d4f2f1` (tinte fondo) | **`--secondary` `#eaf0fc`** y hover `#dbe6fa` | Fondo de chips seleccionados, hover de píldoras |
| `--sm-color-primary-*` (su paleta) | preset `medoxigas.css` | No copiar nunca |

Los tokens viven en `src/styles/presets/medoxigas.css` (`--primary`,
`--secondary`, `--accent`, `--ring`, `--sidebar-primary`, `--chart-*`).
**Prohibido** escribir hex teal en componentes nuevos; usar las clases
semánticas (`bg-primary`, `text-primary`, `bg-secondary`,
`text-secondary-foreground`, `border-primary/50`, `before:bg-sidebar-primary`).

---

## 2. Tipografía

- Familia: **Inter**, variable `--font-inter`, aplicada globalmente.
- Menú lateral usa `font-[family-name:var(--font-inter)]` explícito.

| Escala | Clase | Uso en las pantallas copiadas |
|---|---|---|
| 12 px | `text-xs` | Celdas de tabla, contadores de cards, chips, etiquetas "N Reportes", descripción de cards |
| 14 px | `text-sm` | Texto de menú (`leading-[21px]`), resumen narrativo, labels |
| 16 px | `text-base` | Títulos de sección `font-semibold text-slate-700`, nombre de categoría `font-medium` |
| Encabezado de página | título del `EncabezadoPagina` | "Estado de resultados" + subtítulo descriptivo |

- Totales y nombres de sección en tablas: `font-semibold`.
- Montos siempre `tabular-nums` + `whitespace-nowrap` + `text-right`.

## 3. Neutros y semánticos (los de Alegra)

| Token | Uso |
|---|---|
| `slate-50` | Fondo de filas de totales, hover de cards |
| `slate-200` | Bordes de cards y separadores (`border-slate-200`) |
| `slate-300` | Borde en hover de cards, bordes de chips no seleccionados |
| `slate-400` | Iconos de menú inactivos, chevrons, "Ctrl K" |
| `slate-500` | Texto secundario, subtítulos, "N Reportes", migas inactivas |
| `slate-700` | Texto principal de cards, tablas y menú |
| `slate-900` | Ítem de menú activo, nombres de hoja en tablas |
| `#f1f5f9` | Fondo del sidebar (panel fijo de Alegra) |
| `rose-700` | Filas "contra" (devoluciones) completas y variaciones negativas |
| `green-700` | Variación absoluta positiva |
| `amber-400` | Estrella de favorito marcada (`fill-amber-400 text-amber-400`) |

### Colores por categoría de reporte (hex exactos de Alegra)

| Categoría | Icono | Fondo pastel del chip |
|---|---|---|
| Ventas | `#16A34A` | `#DCFCE7` |
| Administrativos | `#30ABA9` | `#D8F4F2` |
| Financieros | `#F54A00` | `#FFEDD5` |
| Contables | `#FBBF24` | `#FEF3C7` |
| Fiscales | `#E11D48` | `#FFE4E6` |
| Para trabajar | `#4F46E5` | `#E0E7FF` |
| Favoritos | `#64748B` | `#F1F5F9` |

Viven en `META_CATEGORIAS` / `META_FAVORITOS` de
`src/app/(main)/dashboard/reportes/_components/datos-reportes.ts`.

## 4. Iconos — Tabler en todo el sistema

- Librería: `@tabler/icons-react` (MIT, la misma que usa Alegra).
- Punto único de importación: `src/components/icons.tsx` — envoltorios
  `Tabler*` con `stroke={1.5}` (el grosor que usa Alegra); **no se importa
  `@tabler` ni Phosphor directo en componentes**.
- El resto de la app sigue con Phosphor hasta migrarse; en las superficies que
  copian a Alegra **solo Tabler**.
- Tamaños: `size={16}` en chips de cards, `size={20}` en ítems del menú,
  `size={24}` en iconos de categoría.

### Icono por ítem del menú (el mismo que el HTML de Alegra)

| Ítem | Icono Tabler | Envoltorio |
|---|---|---|
| Inicio | `home` | `TablerHome` |
| Bandeja de entrada | `inbox` | `TablerInbox` |
| Ingresos | `circle-arrow-down-left` | `TablerIngresos` |
| Compras | `circle-arrow-up-right` | `TablerCompras` |
| Contactos | `users` | `TablerUsers` |
| Inventario | `package` | `TablerPackage` |
| Bancos | `building-bank` | `TablerBank` |
| Contabilidad | `calculator` | `TablerCalculator` |
| Reportes | `timeline` | `TablerTimeline` |
| Mis tareas | `clipboard-check` | `TablerClipboardCheck` |
| Configuración | `settings` | `TablerSettings` |
| Nómina | `users-group` | `TablerNomina` |
| POS | `building-store` | `TablerPos` |
| Reportes DGII | `file-invoice` | `TablerFileInvoice` |

Categorías de Reportes: `coin`, `chart-bar-popular`, `cash`, `file-invoice`,
`report-money`, `briefcase`, `star` (envoltorios `TablerCoin`, `TablerChartBar`,
`TablerCash`, `TablerFileInvoice`, `TablerReportMoney`, `TablerBriefcase`,
`TablerStar`).

Otros de su UI: `chevron-down`/`chevron-right`/`chevron-up` (árbol y acordeones),
`plus` (botón "+" de creación), `star` (favoritos), `sparkles` (card Resumen),
`thumb-up`/`thumb-down` (feedback), `search`, `refresh` (Actualizar),
`calendar`, `tag` (chip centro de costos), `report` (chip vista).

## 5. Menú lateral (el de Alegra)

- Panel fijo `w-[272px]`, fondo `#f1f5f9`, logo Medoxigas arriba a la izquierda +
  botón `layout-sidebar` para colapsar a riel.
- Orden exacto: **Inicio · Bandeja de entrada** — separador — **Ingresos ·
  Compras · Contactos · Inventario · Bancos · Contabilidad · Reportes · Mis
  tareas · Configuración · Reportes DGII** — grupo **"Descubre más soluciones"**
  (Nómina, POS).
- Ítem: `h-8`, `rounded-[6px]`, `px-2`, `gap-2`, `text-sm leading-[21px]`,
  icono 20px `text-slate-400` (activo `text-slate-900`).
- Activo: píldora `before:` de 3×12px (`h-3 w-[3px]`) en el borde izquierdo
  con `bg-sidebar-primary` (azul) + fondo `bg-slate-200/45`.
- Hover: `bg-slate-200/45`; subítems llevan línea vertical guía a la izquierda
  y botón **"+"** al hover hacia la pantalla de creación (`addUrl`).
- Pie: tarjeta de usuario (nombre + correo), `v0.1.0` y "Soporte".

## 6. Página de Reportes (patrón de landing por categorías)

- Encabezado: migas `Inicio › Reportes`, título + subtítulo
  ("Consulta, descarga y comparte la información contable, administrativa y
  fiscal de tu empresa.").
- Sección `h2 text-base font-semibold text-slate-700` "Clasificación por
  categoría" + buscador a la derecha ("Buscar reporte").
- Grid fluido: `repeat(auto-fill, minmax(14.25rem, 1fr))`, `gap-4`
  (móvil ≤530px: `minmax(10.5rem,1fr)` `gap-2`).
- Card de categoría (clases literales):
  `article p-4 w-full h-full bg-white rounded-2xl border border-slate-200
  min-h-[7.5rem] hover:bg-slate-50 hover:border-slate-300 transition-all
  duration-500 group overflow-hidden`, contenido
  `flex flex-col justify-between w-full h-full`.
  - Icono 24px con su color, `group-hover:opacity-0`.
  - Título `text-base font-medium text-slate-700 group-hover:-translate-y-11`.
  - "N Reportes" `text-xs text-slate-500 group-hover:opacity-0`.
  - Descripción `absolute text-xs opacity-0 group-hover:opacity-100
    group-hover:-translate-y-3` (revelada en hover).
- Cards de reporte: chip de icono `w-8 h-6 rounded-lg` con fondo pastel +
  icono 16px del color de la categoría, estrella de favorito a la derecha
  (`text-transparent` → `hover:text-amber-400`, marcada `fill-amber-400`),
  título `text-sm font-medium text-slate-700`, descripción `text-xs
  text-slate-700`, cuerpo `flex flex-col gap-1.5 min-h-[60px]`, chip "Excel" en
  los reportes DGII (606/607/608).
- **Recientes** y **Favoritos** se guardan en `localStorage`
  (`medoxigas:reportes-*`) — Recientes solo se muestra si hay visitas.

## 7. Páginas de reporte (Estado de resultados y familia)

- Migas: `Reportes › Contables › <Nombre del reporte>`; miga activa en negrita.
- Filtros como **chips píldora seleccionados**: `h-8 rounded-full border
  border-primary/50 bg-secondary px-3 text-xs text-secondary-foreground` con
  icono 16px (calendar, tag, report) + chevron. Botón de acción
  **"Actualizar"** a la derecha (`text-primary`).
- Botón **Descargar**: `h-10 rounded-[10px] bg-primary text-white text-sm
  font-medium` con chevron-down (dropdown de formatos).
- **Card Resumen**: icono sparkles `text-primary` + "Resumen" + tag `Beta`
  (indigo), chevron-up para colapsar; párrafo `text-sm`; botón píldora
  **"Saber más"** a la izquierda y "¿Te pareció útil?" + pulgares a la derecha.
- **Tabla del reporte** (`text-xs`, `tabular-nums`):
  - Columnas: cuenta, periodo actual, % ingresos, periodo anterior, % ingresos,
    Var. Absoluta, Var. Relativa (%).
  - Árbol expandible: chevron-down/-right de 16px, indentación por nivel
    (hojas a ~2rem), botón invisible si la fila no tiene hijas.
  - **Hojas sin código** — solo el nombre (los códigos viven en el modelo para
    búsqueda/exportación, no en pantalla); nombre como enlace color heredado
    con subrayado solo en hover.
  - Secciones/subgrupos `font-semibold`; **totales `bg-slate-50 font-semibold`**.
  - Filas "contra" (devoluciones) completas en `text-rose-700`; gastos/costos
    en negro aunque muestren `-RD$`.
  - Var. Absoluta: `text-green-700` / `text-rose-700` según signo;
    porcentajes a 2 decimales; Var. Relativa entera (`0%`).

## 8. Controles base (adaptados a nuestro kit)

- Los componentes shadcn/Base UI (`Button`, `InputGroup`, `Select`, `Card`)
  siguen siendo la base; el estilo Alegra se aplica con clases encima.
- Listas desplegables: siempre `Select`/`SelectCampo`/`Combobox` (regla del
  repo), nunca `<select>` nativo — solo cambia el estilo del trigger.
- Chips, píldoras y botones filled siguen §5–7.

## 9. Regla al crear una página nueva

1. Buscar la pantalla equivalente en Alegra (en `/root/alegra-refs/` o pidiendo
   captura a Waldy) y **copiar su estructura y clases**, no inventar el diseño.
2. Traducir cada teal al azul Medoxigas con el mapa de §1.
3. Iconos: buscar el `tabler-icon-*` equivalente y envolverlo `Tabler*` en
   `icons.tsx` si no existe.
4. Logo y textos de marca: Medoxigas; textos de UI: los de Alegra cuando
   apliquen (los del dominio fiscal RD van adaptados: DGII, NCF, RD$).
5. Si Alegra no tiene la pantalla: componer con los patrones de este documento
   (cards `rounded-2xl`, `text-xs`/`text-sm`, slate, chips píldora, Tabler).

## 10. Lo que nunca va al repo ni a la UI

- El teal de Alegra fuera de `/pos` (tokens `--pos-*` quedan intactos).
- El logo de Alegra ni enlaces a `app.alegra.com`.
- Exports crudos de Alegra (`*.html`, capturas con datos de su cuenta) — viven
  en `/root/alegra-refs/` y hay un test-candado que lo vigila.
- Iconos de otra librería en superficies que copian a Alegra (Tabler o nada).
