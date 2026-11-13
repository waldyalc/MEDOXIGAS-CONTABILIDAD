# Guía de diseño: selector de fechas y calendario (inspirado en Alegra)

Para Coder, para que el calendario de Medoxigas Contabilidad se parezca al de Alegra. **Aquí no hay código de Alegra, solo medidas.** Todo sale de la cuenta de prueba "Fiel Ferreteria", del 13 nov 2026. En Alegra no se cambió nada.

## 0. De dónde salen los números

- **Capturas.** Hay 4 capturas en `../capturas/`:
  - `calendario-selector-cerrado.png` y `calendario-selector-abierto.png` salen de Reportes → Ventas generales.
  - `calendario-factura-abierto.png` y `calendario-factura-hover.png` salen de Nueva factura → Fecha de creación.
- **Cómo medí.** Medí píxel por píxel sobre las capturas. En ellas, 1 píxel equivale a 1 px de CSS. Lo comprobé con el campo de fecha de la factura, que en Alegra mide 40 px de alto (ver GUIA-DISENO-FACTURA.md 6.2). Margen de error: unos ±1 px.
- **Colores.** Son el píxel exacto. Si el color coincide con un tono de Tailwind (slate), pongo el nombre del tono.
- **Valores de CSS.** Los que dicen "(CSS)" salen del styles.css que guardé con SingleFile (`css-factura/styles.css`), solo para el campo cerrado.
- **Base técnica.** Alegra usa el componente de calendario de Vue llamado vue-datepicker (sus clases empiezan con `dp__`). Es dato de referencia nada más. En nuestra app se hace el componente propio en React.
- **Lo que no medí.** Lo que dice **"no medido"** no se pudo leer bien. No lo inventes: decide tú o pregunta.

## 1. Resumen en 5 frases

1. Hay dos variantes. En **reportes**, un botón "pastilla" abre un panel con atajos a la izquierda, dos meses y botones Cancelar/Aplicar. En **formularios**, un campo de 40 px abre un mes solo y la fecha se aplica al hacer clic.
2. Cada día es un **cuadro de 40×40 px con radio 10 px**. Los números van en 16 px `#334155`, y los días de otro mes en `#cbd5e1`.
3. El día seleccionado lleva fondo **teal `#30aba9`** y número blanco. El hover y los días dentro del rango van en **`#f2f5f8`** (casi slate-100 `#f1f5f9`).
4. Los días de la semana van en mayúsculas (LU MA MI JU VI SÁ DO), más chicos y grises (`#64748b` aprox.), con una línea de 1 px `#e2e8f0` debajo.
5. El panel es blanco, con sombra suave y sin borde marcado. Se separa del campo unos 6 px.

## 2. Campo / botón cerrado

### 2.1 En reportes: botón pastilla (`calendario-selector-cerrado.png`)
| Cosa | Valor |
|---|---|
| Alto | **32 px** |
| Radio | completo (pastilla, 16 px) |
| Ancho (con "01/11/2026 - 13/11/2026") | ~194 px |
| Activo (con fecha puesta) | fondo `#e9fafa`, borde 1 px `#8cd3d2`, texto `#1c7f80`, ícono de calendario teal a la izquierda y flecha ▾ a la derecha |
| Otros filtros (Almacén, Numeración…) | fondo blanco, borde 1 px `#cbd5e1`, texto ~`#334155`, misma altura y forma |
| Texto | 14 px aprox. Rango escrito como `dd/mm/aaaa - dd/mm/aaaa` |
| Fondo de la página detrás | `#f4f5fb` |
| Separación entre pastillas | ~8 px (no medido exacto) |

### 2.2 En la factura: campo de fecha (`calendario-factura-abierto.png`)
| Cosa | Valor |
|---|---|
| Alto | **40 px** |
| Radio | **10 px** (CSS `--dp-border-radius:10px`) |
| Borde normal / hover | 1 px `#cbd5e1` / `#94a3b8` (CSS) |
| Borde enfocado (abierto) | teal `#30bbb7`, con un aro de foco de ~2 px del mismo tono más claro (`#63ccc9`) |
| Padding | `7px 30px 7px 12px` (CSS). El ícono queda a la izquierda, con el texto corrido hacia la derecha |
| Ícono | calendario, color `#64748b` (CSS `--dp-icon-color`, también medido) |
| Texto | 16 px, `#334155`, formato `13/11/2026` |
| Versión chica | 32 px de alto, radio 8 px y texto 14 px (CSS `.small`). Es la que usan los inputs del panel de reportes |
| Etiqueta | "Fecha de creación *", 14 px / 500 / `#334155`, con el asterisco teal (CSS) |

## 3. Panel de atajos (reportes, `calendario-selector-abierto.png`)

| Cosa | Valor |
|---|---|
| Tamaño total del panel | ~773 × 471 px |
| Fondo / borde / sombra | blanco, sin borde visible, sombra suave hacia abajo (valor exacto **no medido**) |
| Radio del panel | **no medido** (se ve ~12 px) |
| Columna de atajos | ~146 px de ancho, separada del calendario por una línea vertical de 1 px `#e2e8f0` |
| Atajos, en orden | Hoy · Ayer · Esta semana · Semana anterior · Este mes · Mes anterior · Este trimestre · Trimestre anterior · Este año · Año anterior |
| Cada atajo | texto 14 px / 400 / `#334155`, alineado a la izquierda, con 16 px de margen. **Paso de 32 px** entre uno y otro |
| Hover / atajo activo | **no medido** (en la captura ningún atajo está marcado aunque el rango puesto es "Este mes" a la fecha) |
| Arriba de cada mes | un input chico (32 px, radio 8, borde `#cbd5e1`, texto 14 px `#334155`, ~290 px de ancho): "Desde" sobre el mes izquierdo y "Hasta" sobre el derecho. Se puede escribir la fecha |
| Meses | **dos meses lado a lado** (Noviembre y Diciembre 2026), cada uno de 7 columnas de ~43 px |
| Encabezado del mes | "Noviembre ▾" y "2026 ▾" como menús (14–16 px / 600 / `#334155`), con las flechas ‹ › a la derecha, juntas |
| Pie | línea arriba de 1 px `#e2e8f0`, ~59 px de alto, botones a la derecha |
| Botón Cancelar | solo texto teal `#30aba9`, sin fondo, 14 px |
| Botón Aplicar | relleno teal `#30aba9`, texto blanco 14 px / 500, **~76 × 32 px**, radio ~8 px, a ~16 px del borde derecho |

**Cómo se pinta el rango** (del 1 al 13 nov):
- Los días de inicio y fin van en teal `#30aba9` con número blanco. El inicio lleva redondeadas solo las esquinas de la izquierda y el fin solo las de la derecha, con radio ~10 px.
- Los días del medio van en `#f2f5f8` con número `#334155`. Cada uno es un cuadro propio de ~41×41 px, con un hueco de ~3–4 px entre cuadros. No forman una franja continua.
- Los días de otro mes no se pintan aunque caigan dentro del rango.

## 4. Calendario de un mes (factura, `calendario-factura-*.png`)

| Cosa | Valor |
|---|---|
| Tamaño del panel | **~306 × 380 px** |
| Separación del campo | ~6 px por debajo del campo, alineado a la izquierda del campo |
| Fondo / borde / sombra | blanco, sin borde marcado y con sombra suave (unos 15 px de difuminado abajo y 7 px a los lados; el valor exacto **no medido**) |
| Radio del panel | **no medido** (se ve ~12 px) |
| Encabezado | ‹ a la izquierda, "Nov ▾" y "2026 ▾" en el centro (16 px / 600 / `#334155`), › a la derecha. Aquí el mes va **abreviado**, mientras que en reportes va completo |
| Flechas | `#334155`, ~16 px |
| Días de la semana | LU MA MI JU VI SÁ DO, en mayúsculas, ~12 px / 500, color ~`#64748b` (medido `#707f94` por el suavizado de la letra) |
| Línea bajo días de semana | 1 px `#e2e8f0`, de ancho completo menos los márgenes |
| Cuadrícula | 7 columnas con **paso de 40 px**, filas con **paso de 45 px** (cuadro de 40 + unos 5 px de hueco vertical) |
| Celda del día | **40 × 40 px, radio 10 px**, número 16 px / 400 centrado |
| Número normal | `#334155` (slate-700) |
| Días de otro mes | `#cbd5e1` (slate-300). Se muestran pero en gris |
| Seleccionado | fondo **`#30aba9`**, número **blanco** `#fff` |
| Hover | fondo **`#f2f5f8`** (≈ slate-100), número igual. Se ve en el día 14 de `calendario-factura-hover.png` |
| Hoy | **no medido aparte**, porque hoy era el mismo día seleccionado (13). No se vio un estilo extra |
| Botones | no tiene. Un clic en el día aplica y cierra |
| Fuente | la misma Inter del resto de la app (ver GUIA-DISENO-FACTURA.md). Lo que sí trae vue-datepicker por defecto es `-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto…` (CSS) |

## 5. Para nuestra versión (Medoxigas)

- **Colores.** Usa el mismo mapa de la guía de factura (7.2): teal `#30aba9` pasa al primario Medoxigas `#1e56c7`; el hover y el rango, `#f2f5f8`, pasan a slate-100; los textos siguen igual en slate.
- **Medidas.** Celda de 40×40 con radio 10 y paso de 40×45. Panel de un mes de ~306 px de ancho.
- **Reportes.** Atajos a la izquierda (columna de ~146 px), dos meses y pie con Cancelar/Aplicar.
- **Formularios.** Un mes solo y sin botones.
- **Comprobar.** Abre las 4 capturas junto a nuestra versión a 1280 px y compáralas.

## 6. No medido (decidir o volver a revisar)

- La sombra exacta y el radio de los dos paneles.
- Cómo se ve un atajo en hover y un atajo activo.
- Cómo se ve "hoy" cuando no es el día seleccionado.
- El hover de las flechas y de los menús de mes y año, y cómo se ve el menú de mes y año abierto.
- Los tamaños exactos de letra del encabezado. Los estimé por la altura de los números, con ±1 px.
- Cómo se ve en celular.
