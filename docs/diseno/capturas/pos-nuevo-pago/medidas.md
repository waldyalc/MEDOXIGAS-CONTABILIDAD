# Medidas — «Nuevo pago» del POS (PLAN POS 2, Punto 5)

Comparación del modal «Nuevo pago» del Registro de pagos del POS contra Alegra
(capturas `09-nuevo-pago-alegra-tipo.png` y `10-nuevo-pago-alegra-form.png`).

## Cómo se midió

- **Alegra:** el HTML/CSS guardado de Alegra no trae este modal (solo
  `css-pos/vender/` y `css-pos/turno/`). Las medidas de Alegra salen **en píxeles
  sobre las capturas 09 y 10**, que están a **1×** (imagen de 1920 px = viewport
  de 1920 px). Se midieron bordes y fondos con ImageMagick; donde el antialias
  deja el borde en 1–2 px se toma el centro. No se inventó ningún valor de CSS.
- **Medoxigas antes:** sale del código que estaba en `dialogo-movimiento.tsx`
  (`sm:max-w-[640px]`, `p-4`, inputs `h-10`, footer por defecto). La captura
  `08-movimiento-medoxigas.png` está a **~1.25×** (el modal mide 800 px de imagen
  para 640 px de CSS), así que no se usa para comparar píxeles con Alegra; solo
  como referencia de la pantalla anterior (`antes-modal.png`).
- **Medoxigas después:** medido sobre las capturas de esta carpeta, también a 1×
  (viewport 1440×900, `deviceScaleFactor: 1`).

## Tabla

| Parte | Alegra (px / fuente) | Medoxigas antes | Medoxigas después | Diferencia |
|---|---|---|---|---|
| Ancho del modal | **800** (medido 09 y 10) | 640 (código) | **800** | 0 vs Alegra |
| Alto modal, tarjeta de tipo | **425** (09) | variable | **426** | +1 |
| Alto modal, formulario | **601** (10) | variable | **600** | −1 |
| Header, tarjeta de tipo | **60**, título 20/600 a 20 px del borde | header por defecto con `p-4` | **60**, título 20/600 a 20 px | 0 |
| Header, formulario | **80**, flecha atrás + título + X | sin flecha atrás | **80**, flecha + título + X | 0 |
| Padding del cuerpo | **20** horizontal (texto arranca en x=581 del modal) | 16 (`p-4`) | **20** | +4 |
| Título «Nuevo pago» | **20 px / 600** | 16 px / 500 («Registrar movimiento») | **20 px / 600** | +4 |
| Texto «Selecciona el tipo…» | **16 px**, línea 24 | no existía | **16 px**, línea 24 | nuevo |
| Tarjetas Ingreso/Egreso | **374 × 250**, gap **10**, radio **8**, borde `#e5e7eb`, fondo blanco, icono 22 + label 16 | no existían (pestañas de línea Ingreso/Retiro) | **375 × 250**, gap **10**, radio **8**, fondo verde/rojo, icono 24 + label 16 | +1 ancho; color pedido por Waldy |
| Segmented control | barra **50** de alto, pastilla **40**, radio **8**, fondo `#f2f5f8`, borde `#e2e8f0`; 2 pestañas 14/600 | tabs de línea (`TabsList variant="line"`) | barra **48**, pastilla **40**, radio **8**, fondo `bg-muted`, borde `--pos-linea`; 2 pestañas 14/600 | −2 de barra |
| Etiquetas | **14 px / 500**, 8 px hasta el campo | 14 px / 500, 4 px | **14 px / 500**, 8 px | 0 |
| Inputs y selects | **46** de alto, radio 10, borde `#cbd5e1`, texto 16 | **40** (`h-10`), radio 8 | **48**, radio 10, texto 16 (brief: 48) | +2 |
| Textarea Observaciones | **106** de alto, radio 10 | 64 (`min-h-16`), máx. 500 caracteres | **106**, radio 10, máx. **300** | +42; nuevo contador |
| Contador de Observaciones | **12 px**, `0/300` a la derecha de la etiqueta | no existía | **12 px**, `0/300` | nuevo |
| Rejilla | **2 columnas**, gap horizontal **10**, gap de fila **19** | flujo de una columna | **2 columnas** (1 en móvil), gap horizontal **10**, gap de fila **20** | +1 de fila |
| Footer | **85** de alto, fondo `#f8fafc`, borde superior; CTA a la derecha | footer por defecto `p-4` con borde y `bg-muted/50` | **80** de alto, fondo `--pos-panel` (`#f8fafc`), CTA a la derecha | −5 |
| CTA | **163 × 46**, radio 10, `#00b19d`, texto blanco 16/500; deshabilitado teal claro | 48 de alto, azul `#1e56c7`, texto 16 | **144 × 48**, radio 10, `#00b19d`, texto blanco 16/500; deshabilitado `#00b19d/30` | −19 de ancho, +2 de alto |
| Cerrar (X) | **12 px**, a 24 px del borde derecho | 16 px (botón por defecto del diálogo) | **16 px**, a 20 px | +4 |
| Flecha atrás | 16 px en el header, solo en el formulario | no existía | 16 px, solo en el formulario y si no viene prellenado | nueva |

Notas de fidelidad:

- La **flecha atrás** de Alegra está a 37 px del borde y el título a 79 px; en
  Medoxigas quedan a 28 y 57 px. Es la diferencia visual más notoria del header.
- El **ancho del CTA** depende del texto. «Registrar pago» mide 144 px con
  `px-6`; Alegra mide 163 px. «Registrar ingreso» queda más ancho por el texto.
- La **tarjeta de tipo** de Alegra es blanca con borde; por decisión de Waldy
  (22-11-2026) Medoxigas usa Ingreso **verde** y Egreso **rojo**, con texto
  blanco. Iconos: Alegra usa flecha diagonal en círculo; Medoxigas usa
  `CircleArrowDown` / `CircleArrowUp` (no hay `ArrowDownLeft` en
  `src/components/icons.tsx`, que no estaba en el alcance).
- El **método de pago** de Alegra es un `Select` con opciones. En el POS el
  movimiento del turno es solo efectivo, así que se muestra como estado
  («Efectivo · Solo efectivo») y no se agregó un campo nuevo.

## Colores

| Uso | Alegra | Medoxigas después | Token / clase |
|---|---|---|---|
| Acción primaria | `#00b19d` | `#00b19d` | `--pos-primario` / `bg-pos-primario` |
| Acción primaria hover | `#008e79` | `#008e79` | `--pos-primario-hover` |
| Fondo del footer | `#f8fafc` | `#f8fafc` | `--pos-panel` / `bg-pos-panel` |
| Borde de tarjetas y header | `#e2e8f0` | `#e2e8f0` | `--pos-linea` / `border-pos-linea` |
| Borde de campos | `#cbd5e1` | `#dbe3f2` | `--input` del preset (no se tocó) |
| Texto principal | `#334155` | `#212529` | `--pos-texto` / `text-pos-texto` |
| Texto secundario / placeholder | `#94a3b8` | `#707070` / placeholder del sistema | `--pos-texto-suave`, `--pos-icono` |
| Ingreso (tarjeta) | — (blanca) | `#059669`, hover `#047857` | `bg-emerald-600` / `hover:bg-emerald-700` |
| Egreso (tarjeta) | — (blanca) | `#e11d48`, hover `#be123c` | `bg-rose-600` / `hover:bg-rose-700` |
| Texto sobre tarjetas y CTA | — | blanco | `text-white` |

## Capturas

| Archivo | Qué muestra |
|---|---|
| `antes-modal.png` | Modal anterior «Registrar movimiento» (recorte de la captura 08, a ~1.25×) |
| `despues-tipo.png` | Paso 1: tarjetas Ingreso (verde) y Egreso (rojo) |
| `despues-egreso-gastos.png` | Egreso → Gastos generales, con cuenta elegida |
| `despues-egreso-caja-negativa.png` | Guarda: un egreso mayor al efectivo esperado deshabilita el CTA |
| `despues-egreso-factura-proveedor.png` | Pestaña «Pago a factura de proveedor»: estado «No disponible en el POS todavía» |
| `despues-ingreso.png` | Ingreso con cuenta, total y observaciones llenos |
| `despues-oscuro.png` | Egreso → Gastos generales en tema oscuro |
| `despues-movil.png` | 390×844: tarjetas apiladas |
| `despues-movil-formulario.png` | 390×844: formulario apilado |
