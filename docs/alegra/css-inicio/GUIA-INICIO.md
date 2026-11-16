# Guía de estilo: Inicio (dashboard) de Alegra

Para Coder, para que el **Inicio** de **Medoxigas Contabilidad** (Next.js) se parezca al de Alegra. **Aquí no hay código de Alegra, solo medidas.** Todo sale de la cuenta de prueba "Fiel Ferreteria", del 14 nov 2026. En Alegra no se cambió nada (solo se abrieron menús y diálogos; en "Eliminar gráfica" se pulsó **Conservar**, nunca "Sí, eliminar").

Las otras pantallas ya están en:

- `../css-factura/GUIA-DISENO-FACTURA.md`
- `../css-factura/GUIA-CALENDARIO.md`
- `../css-pagos/GUIA-FORMULARIOS.md`
- `../css-vista/GUIA-VISTA.md`

Copia local de la página (para ver sin internet): `css-inicio/inicio/index.html` (con `styles.css` y `original/inicio-singlefile.html`). Verificada: se ve igual que la captura real.

## 0. De dónde salen los números

- Medí con puppeteer-core y el Chrome del sistema, sobre **app.alegra.com en vivo** (la página es una app con gráficas que se dibujan en el navegador; la copia local se usó para verificar que renderiza igual). Ventana de **1280 × 800**, `deviceScaleFactor: 1`.
- Los valores son `getBoundingClientRect` y `getComputedStyle`. Los colores van en hex (o `rgb()` tal cual). `#94a3b8/10` quiere decir 10 % de opacidad.
- Los estados hover, el menú de periodo, el diálogo y el modal se midieron **en vivo** (se abrieron y se cerraron sin guardar nada).
- Si algo no se pudo medir, lo digo con **(no medido)**.

Capturas anotadas (en `../capturas/`):

| Captura | Qué muestra |
|---|---|
| `20-guia-inicio-general.png` | Página entera a 1280×800: cabecera, tarjetas KPI y primera gráfica, con medidas |
| `20-guia-inicio-kpis.png` | Zoom de las tarjetas KPI (grande y pequeña), a 2× |
| `20-guia-inicio-grafica-ventas.png` | Zoom de la tarjeta "Total de ventas" con su gráfica |
| `20-guia-inicio-menu-periodo.png` | Menú "Mes actual" abierto |
| `20-guia-inicio-dialogo.png` | Diálogo "Eliminar gráfica" |
| `20-guia-inicio-modal.png` | Gráfica ampliada (modal) |

## 1. Qué diseño copiar

El Inicio es un **tablero**: una cabecera con título y dos botones, debajo una **rejilla de 2 columnas** de tarjetas blancas redondeadas, y al final dos huecos vacíos ("Productos más vendidos" y "Clientes con más ventas") que se pueden llenar con "Agregar gráfica".

Orden vertical medido (a 1280 px de ancho):

1. Cabecera: "Resumen del negocio" + botones **Mes actual** y **Agregar gráfica**.
2. Dos tarjetas **grandes** (cuentas por cobrar / por pagar), lado a lado.
3. Cuatro tarjetas **pequeñas** en 2×2 (impuestos, clientes con ventas, devoluciones, productos vendidos).
4. Tres gráficas a **ancho completo** (ocupan las 2 columnas): Total de ventas, Distribución de costos, Flujo de transacciones.
5. Dos huecos vacíos a media columna (Productos más vendidos / Clientes con más ventas).

En Medoxigas, usa este orden. El teal de Alegra `#30aba9` pasa al primario `#1e56c7`, igual que en las otras guías.

## 2. Tokens

Fuente: **Inter, Roboto, sans-serif**. Tamaño base 16 px.

| Cosa | Valor |
|---|---|
| Fondo de la página | `#f4f5fb` |
| Texto principal (títulos, valores) | `#0f172a` (slate-900) |
| Texto de etiquetas y nombres | `#334155` (slate-700) |
| Texto secundario (subtítulos, íconos) | `#64748b` (slate-500) |
| Texto del cuerpo / placeholders | `#6b7280` (gray-500) |
| Fondo de tarjeta y modal | `#ffffff` |
| Borde de tarjeta y campos | `#e2e8f0` (slate-200) / `#cbd5e1` (slate-300) |
| Borde de botón outline | `#94a3b8` al 40 % (`rgba(148,163,184,0.4)`) |
| Primario (Alegra teal) | `#30aba9` — botón "Agregar gráfica" y botón "Sí, eliminar" |
| Primario deshabilitado | `#30aba9` al 30 % (`rgba(48,171,169,0.3)`) |
| Foco / ayuda (según otras guías) | `#30bbb7` (primary-500) |
| Verde (barra "vigente", ícono) | `#34d399` (rgb 52,211,153) |
| Rojo (barra "vencido", ícono) | `#ef4444` (rgb 239,68,68) |
| Velo de modal y diálogo | negro al 50 % (`rgba(0,0,0,0.5)`) |
| Menú desplegable | fondo blanco, radio **12 px** (estimado desde captura), sombra suave |

| Cosa | Tamaño |
|---|---|
| Título de página ("Resumen del negocio") | **20 px / 600 / 28 px**, `#0f172a` |
| Título de tarjeta KPI grande | **14 px / 600 / 20 px**, `#334155` |
| Valor de tarjeta KPI grande | **20 px / 400 / 28 px**, `#0f172a` |
| Título de tarjeta KPI pequeña | **13.5 px / 600 / 20 px**, `#334155` |
| Valor de tarjeta KPI pequeña | **18 px / 400 / 28 px**, `#0f172a` |
| Subtítulo de KPI | **12 px / 400 / 16 px**, `#64748b` |
| Título de gráfica | **14 px / 600 / 20 px**, `#0f172a` |
| Subtítulo de gráfica | **12 px / 400 / 16 px**, `#64748b` |
| Total de gráfica | **20 px / 400 / 28 px**, `#0f172a` |
| Porcentaje junto al total | **14–16 px / 400**, `#64748b` |
| Botones de cabecera (Medio) | alto **40 px**, radio **10 px**, texto **14 px / 500**, padding `7px 16px` (outline) / `8px 16px` (relleno) |
| Botón de acción hover (tacho / ampliar) | **32 × 32 px**, radio **8 px** |
| Contenedor de acciones hover | **90 × 42 px** (gráficas) / **50 × 42 px** (tarjetas KPI), radio **8 px**, sombra suave |

## 3. Marco de la página

No copies la barra lateral ni la superior (ya están en la app).

| Pieza | Valor medido (a 1280 px) |
|---|---|
| Barra lateral | el contenido empieza en **x = 275 px** (barra de **275 px**) |
| Barra superior | **56 px** de alto (buscador de 427 × 32 px a y = 12 px) |
| Área de contenido | empieza en **x = 291 px**, ancho útil **969 px** |
| Rejilla de tarjetas | **2 columnas de 471 px**, separación **16 px** (gaps de 15–16 px medidos) |
| Tarjetas a ancho completo | **956 px** de ancho (ocupan las 2 columnas + el gap) |

La página **hace scroll dentro de un contenedor** (`.s-layout__content`), no en `window`. En Medoxigas basta el scroll normal del documento.

## 4. Cabecera

| Pieza | Valor |
|---|---|
| Título "Resumen del negocio" | 20 px / 600 / 28 px, `#0f172a`, a y ≈ 98 px |
| Botón **Mes actual** | outline, 127 × 40 px, radio 10 px, borde `rgba(148,163,184,0.4)`, fondo blanco, texto `#0f172a` 14 px / 500, con ícono chevron |
| Botón **Agregar gráfica** | relleno teal, 157 × 40 px, radio 10 px, fondo `#30aba9`, texto blanco 14 px / 500, con ícono chevron. **En la prueba estaba deshabilitado** (`rgba(48,171,169,0.3)`); el menú con las 4 opciones se ve en la captura `12-inicio-agregar-grafica-abierto.png` (guía anterior) |

Ambos botones están a la derecha, a y = 92 px, separados 16 px.

## 5. Tarjetas KPI

Todas: fondo blanco, radio **16 px**, sin borde visible, sombra no medida (se ve una sombra muy suave; **(no medido)** el `box-shadow` exacto).

### Tarjeta grande (Cuentas por cobrar / por pagar) — 471 × 219 px, padding 24 px

Estructura de arriba abajo:

1. **Título** 14 px / 600 / 20 px, `#334155` (a y = 189).
2. **Valor total** 20 px / 400 / 28 px, `#0f172a` (a y = 213).
3. **Barra de proporción** 421 × 8 px, radio 2 px, compuesta por segmentos verde `#34d399` y rojo `#ef4444`, separados 2 px (a y = 257).
4. **Dos grupos** de texto ("Vigentes" y "Vencidas"), cada uno con una **barra vertical de 4 px de ancho × 64 px de alto** (radio 2 px, verde o rojo) y 3 líneas de **12 px / 400**: etiqueta `#334155`, valor `#0f172a` (16 px en el segundo grupo), detalle `#334155`.
5. Esquina superior derecha: **botón tacho** 32 × 32 px (ver sección 8).

### Tarjeta pequeña (Impuestos, Clientes, Devoluciones, Productos) — 471 × 102 px, padding 16 px

1. **Título** 13.5 px / 600 / 20 px, `#334155`.
2. **Valor** 18 px / 400 / 28 px, `#0f172a`.
3. Opcional: **subtítulo** 12 px / 400 / 16 px, `#64748b` (solo en algunas, p. ej. Devoluciones).

Las 4 pequeñas van en 2×2, en este orden: Impuestos en venta y Clientes con ventas (fila 1), Devoluciones de clientes y Productos vendidos (fila 2).

## 6. Rejilla de gráficas

Alegra usa una cuadrícula absoluta de 2 columnas (vue-grid-layout). En Medoxigas basta un CSS grid de 2 columnas.

| Gráfica | Tamaño medido | Columna |
|---|---|---|
| Total de ventas | 956 × 375 px | ancho completo (2 col) |
| Distribución de costos | 956 × 453 px | ancho completo (2 col) |
| Flujo de transacciones | 956 × 453 px | ancho completo (2 col) |
| Productos más vendidos | 471 × 414 px | media columna (hueco vacío) |
| Clientes con más ventas | 471 × 414 px | media columna (hueco vacío) |

- Las tarjetas de gráfica: fondo blanco, radio **16 px**, padding **24 px** (Flujo de transacciones: `24px 24px 4px`), borde fino `#e2e8f0`.
- Cada una tiene **acciones flotantes** arriba a la derecha que aparecen al pasar el mouse (ver sección 8): **ampliar** y **tacho**.

## 7. Gráficas (ApexCharts)

Los 3 gráficos se dibujan con **ApexCharts** (SVG). Medidas del lienzo:

| Gráfica | Lienzo (px) | Tipo |
|---|---|---|
| Total de ventas | 950 × 315 (SVG 950 × 300) | líneas (ventas con impuestos + línea punteada en 0) |
| Distribución de costos | 320 × 245 (donut) + tabla 570 × 309 | dona + tabla de datos |
| Flujo de transacciones | 950 × 335 (SVG 950 × 320) | barras |

Encabezado de cada tarjeta de gráfica:

- **Título** 14 px / 600, `#0f172a`, con **subrayado** (`underline`) en la modal ampliada; en la tarjeta normal no va subrayado.
- **Subtítulo** 12 px / 400, `#64748b`.
- **Total** 20 px / 400, `#0f172a`, a la derecha, con **porcentaje** al lado (14–16 px, `#64748b`).
- **Leyenda** de la gráfica de ventas: fila inferior, 950 × 18 px, padding `0 10px`.

En Medoxigas puedes usar cualquier librería de gráficas; lo importante son las medidas de la tarjeta y el encabezado.

## 8. Componentes interactivos

### Botón de cabecera (Medio)

- Alto 40 px, radio 10 px, texto 14 px / 500, padding `7px 16px` (outline) / `8px 16px` (relleno), ícono chevron de **16 px**.
- Outline: fondo blanco, borde `rgba(148,163,184,0.4)`, texto `#0f172a`.
- Relleno: fondo `#30aba9`, texto blanco.
- **Deshabilitado**: fondo `rgba(48,171,169,0.3)`, texto `rgba(255,255,255,0.9)`.

### Acciones flotantes al hacer hover (tarjetas y gráficas)

- Contenedor: `position: absolute`, arriba a la derecha (`top: 8px`, `right: 8px`), fondo blanco, borde fino, radio 8 px, sombra suave, **opacidad 0 → 1** al hover (transición 200 ms).
- Tamaño: **90 × 42 px** en gráficas (dos botones: ampliar + tacho), **50 × 42 px** en tarjetas KPI (solo tacho).
- Botones: **32 × 32 px**, radio 8 px, fondo blanco, ícono slate-900 (`#0f172a`), 16 px.
- En la copia local (sin JavaScript) las acciones no aparecen: es un estado hover.

### Menú "Mes actual" (desplegable de periodo)

- Panel: fondo blanco, radio **12 px** (estimado desde captura), sombra suave, debajo del botón, alineado a la derecha. Tamaño aproximado **165 × 200 px** (estimado desde captura; **(no medido)** con `getComputedStyle` porque el panel se renderiza fuera del árbol principal).
- Opciones (3): **Mes actual**, **Últimos 3 meses**, **Últimos 6 meses**.
- Cada opción: título **14 px / 500 / 20 px**, `#334155`, y debajo el rango de fechas en **12 px / 400**, `#64748b`. Alto de fila ≈ 40 px.
- Opción activa: fondo tenue (no medido el color exacto; ver captura).

### Diálogo "Eliminar gráfica"

- Velo: negro al 50 %, toda la pantalla, `z-index: 999`.
- Caja: **320 × 166 px**, fondo blanco, radio **8 px**, padding **20 px**, centrada.
- Título "Eliminar gráfica": **16 px / 600**, `#0f172a`.
- Texto: "Al confirmar, se eliminará la gráfica "X" de tu resumen." en **14 px / 400**, `#6b7280`.
- Botones (fila, cada uno 134 × 36 px, radio **10 px**, texto 14 px / 500):
  - **Conservar**: outline, fondo blanco, borde `rgba(148,163,184,0.4)`, texto `#0f172a`.
  - **Sí, eliminar**: relleno, fondo `#30aba9`, texto blanco.
- Se cierra con "Conservar", con la × o con Escape. **Nunca se pulsa "Sí, eliminar".**

### Modal "Gráfica ampliada"

- Velo: negro al 50 %, `position: fixed`, `z-index: 999`, centrado.
- Panel: **1024 × 535 px** a 1280 px de ancho (ancho **95 %** en móvil, **80 %** desde `lg`), fondo blanco, radio **8 px**, padding **24 px**, `position: relative`.
- Botón **cerrar**: **40 × 40 px**, arriba a la izquierda del panel, ícono × gris.
- Título "Total de ventas": **14 px / 600**, `#0f172a`, **subrayado**, con ícono de información al lado.
- Subtítulo: **12 px / 400**, `#64748b`.
- Métrica total: **20 px / 400**, `#0f172a`, a la derecha, con porcentaje al lado.
- Gráfica: ocupa el resto del panel.
- Se cierra con la × o con Escape.

### Botón de ayuda (FAB)

- Esquina inferior derecha, fijo, a **16 px** del borde, tamaño **60 × 60 px**, `z-index: 197`. Ícono de chat de **24 px** blanco sobre círculo (el círculo no se midió; **(no medido)** el fondo exacto).
- En Medoxigas puedes omitirlo o usar el mismo botón de soporte.

## 9. Boceto mínimo de CSS

No copies clases de Alegra; esto es solo la forma. En Medoxigas el primario es `#1e56c7`.

```css
:root {
  --fondo: #f4f5fb;
  --texto: #0f172a;      /* slate-900 */
  --texto-2: #334155;    /* slate-700 */
  --texto-3: #64748b;    /* slate-500 */
  --borde: #e2e8f0;      /* slate-200 */
  --primario: #1e56c7;   /* Medoxigas (Alegra usa #30aba9) */
}

.inicio { background: var(--fondo); padding: 16px; }
.inicio__cabecera { display: flex; align-items: center; justify-content: space-between; margin-bottom: 24px; }
.inicio__titulo { font-size: 20px; font-weight: 600; color: var(--texto); line-height: 28px; }
.inicio__acciones { display: flex; gap: 16px; }

/* Rejilla de 2 columnas */
.inicio__grid { display: grid; grid-template-columns: repeat(2, 1fr); gap: 16px; }
.inicio__ancho-completo { grid-column: 1 / -1; }

/* Tarjeta */
.tarjeta { background: #fff; border-radius: 16px; }
.tarjeta--grande { padding: 24px; }
.tarjeta--pequena { padding: 16px; }
.tarjeta__titulo { font-size: 14px; font-weight: 600; color: var(--texto-2); line-height: 20px; }
.tarjeta__valor { font-size: 20px; color: var(--texto); line-height: 28px; }
.tarjeta--pequena .tarjeta__titulo { font-size: 13.5px; }
.tarjeta--pequena .tarjeta__valor { font-size: 18px; }
.tarjeta__sub { font-size: 12px; color: var(--texto-3); line-height: 16px; }

/* Botones */
.btn { height: 40px; border-radius: 10px; font-size: 14px; font-weight: 500; padding: 7px 16px; display: inline-flex; align-items: center; gap: 4px; }
.btn--outline { background: #fff; border: 1px solid rgba(148,163,184,.4); color: var(--texto); }
.btn--filled { background: var(--primario); color: #fff; border: none; }
.btn:disabled { background: rgba(30,86,199,.3); color: rgba(255,255,255,.9); }

/* Barra de proporción KPI */
.kpi-barra { display: flex; gap: 2px; height: 8px; }
.kpi-barra__seg { border-radius: 2px; }
.kpi-barra__seg--verde { background: #34d399; }
.kpi-barra__seg--rojo { background: #ef4444; }

/* Acciones hover */
.tarjeta__acciones { position: absolute; top: 8px; right: 8px; display: flex; gap: 8px; background: #fff; border: 1px solid var(--borde); border-radius: 8px; box-shadow: 0 1px 2px rgba(0,0,0,.06); opacity: 0; transition: opacity .2s; }
.tarjeta:hover .tarjeta__acciones { opacity: 1; }
.tarjeta__acciones button { width: 32px; height: 32px; border-radius: 8px; background: #fff; color: var(--texto); border: none; }

/* Modal / diálogo */
.velo { position: fixed; inset: 0; background: rgba(0,0,0,.5); display: flex; align-items: center; justify-content: center; z-index: 999; }
.modal { background: #fff; border-radius: 8px; padding: 24px; width: min(1024px, 80%); }
.dialogo { background: #fff; border-radius: 8px; padding: 20px; width: 320px; }
```

## 10. No medido / no visto

- **Sombras exactas** de tarjetas, botones y paneles: se ve que existen, pero no extraje el valor `box-shadow` completo (`(no medido)`).
- **Panel del menú "Mes actual"**: ancho/alto y radio estimados desde la captura (165 × 200 px, radio 12 px); el `getComputedStyle` no lo aisló.
- **Fondo del botón de ayuda (FAB)**: círculo exacto no medido.
- **Opción activa del menú de periodo**: fondo no medido.
- **Menú "Agregar gráfica"**: en la prueba el botón estaba deshabilitado, así que no pude medir sus opciones en vivo; usa la captura `12-inicio-agregar-grafica-abierto.png` de la guía anterior.
- **Gráficas a 1024 px y en móvil**: no medí el cambio de rejilla (la guía de pagos sí lo hizo para formularios). En el dashboard, a 1280 px son 2 columnas; **(no medido)** en qué ancho pasa a 1 columna.
- **Datos**: los números de la captura son de la cuenta de prueba "Fiel Ferreteria"; no son datos reales de Medoxigas.
