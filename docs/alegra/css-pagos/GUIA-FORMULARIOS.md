# Guía de estilo: formularios de Alegra (pagos)

Para Coder, para que los formularios de **Medoxigas Contabilidad** (Next.js) se parezcan a los de Alegra. **Aquí no hay código de Alegra, solo medidas.** Todo sale de la cuenta de prueba "Fiel Ferreteria", del 13 nov 2026, de copias locales (`css-pagos/pago-recibido/` y `css-pagos/pago-proveedor/`). En Alegra no se cambió nada.

El calendario, la factura y la vista de documentos ya están en otras guías: no las repito.

- `../css-factura/GUIA-DISENO-FACTURA.md`
- `../css-factura/GUIA-CALENDARIO.md`
- `../css-vista/GUIA-VISTA.md`

## 0. De dónde salen los números

- Medí con puppeteer-core y el Chrome del sistema, en las copias `file://` (sin app.alegra.com). Ventana de **1280 px** y de **1024 px** de ancho, `deviceScaleFactor: 1`. También abrí 767 px solo para ver cuándo cambia la rejilla.
- Los valores son `getBoundingClientRect` y `getComputedStyle`. Los colores van en hex. `#94a3b8/10` quiere decir 10 % de opacidad.
- Si algo no se pudo medir, lo digo con **(no medido)**.

Capturas anotadas (en `../capturas/`):

| Captura | Qué muestra |
|---|---|
| `19-guia-pago-recibido.png` | Diseño nuevo: título, una tarjeta y el botón Guardar |
| `19-guia-pago-proveedor.png` | Diseño anterior: título, aviso, dos tarjetas, comentarios y Cancelar / Guardar |
| `19-guia-rejilla.png` | Las 3 columnas y los huecos, con medidas encima |
| `19-guia-campo.png` | Zoom de una etiqueta + campo (Cuenta bancaria), a 2× |
| `19-guia-botones.png` | Dónde van los botones en el diseño nuevo y en el anterior |

Las capturas de comportamiento (desplegables, modal de retenciones, tabla de facturas con un cliente) están en `../capturas/19-pago-*.png`. Esa tabla no está en la copia local vacía.

## 1. Qué diseño copiar

Hay **dos diseños** en Alegra:

1. **Nuevo** (`/income-payments/add`, "Nuevo pago recibido"): una sola tarjeta blanca, rejilla de 3 columnas con hueco de 32 px, campos de 40 px, pestañas "Pago a factura de cliente / Otros ingresos", un solo botón **Guardar** (grande) debajo de la tarjeta, a la derecha. **Copia este.**
2. **Anterior** (`/payment/add`, "Nuevo pago" a proveedor): dos tarjetas más gordas (radio 16 px, padding 48 px), campos chicos de 32 px, hueco de 16 px, y **Cancelar + Guardar** (medianos) debajo, fuera de las tarjetas.

En Medoxigas, usa el diseño nuevo. El teal de Alegra `#30aba9` pasa al primario `#1e56c7`, igual que en la guía de factura.

## 2. Tokens

Fuente: **Inter, Roboto, sans-serif**. (El campo de fecha, por dentro, declara la pila de vue-datepicker; en nuestra app usa Inter igual que el resto.)

| Cosa | Valor |
|---|---|
| Fondo de la página | `#f4f5fb` |
| Texto de etiquetas y valores | `#334155` (slate-700) |
| Título de página y "Total" | `#0f172a` (slate-900) |
| Texto secundario e íconos de calendario / × | `#64748b` (slate-500) |
| Placeholder y borde en hover | `#94a3b8` (slate-400) |
| Borde del campo | `#cbd5e1` (slate-300) |
| Borde de la tarjeta, de las pestañas y de la app | `#e2e8f0` (slate-200) |
| Primario (Alegra teal) | `#30aba9` — botón Guardar y asterisco |
| Foco y "?" de ayuda | `#30bbb7` (primary-500) |
| Hover del botón (CSS, no abrí el hover) | `#299e9c` (primary-700) |
| Aviso azul (fondo) | `#e0e7ff` (indigo-100) |
| Aviso azul (borde, diseño nuevo) | `#4f46e5/20` |
| Pestaña inactiva (texto) | `#475569` (slate-600) |
| Indicador de pestaña activa | blanco, con sombra suave (ver 5) |
| Encabezado de tabla (diseño anterior) | fondo `#f1f5f9` |

| Cosa | Tamaño |
|---|---|
| Título de la página | **20 px / 600 / 28 px** de alto de línea |
| Etiqueta del campo | **14 px / 500 / 20 px** de alto de línea |
| Asterisco | **12 px / 400**, color primario |
| Valor dentro del campo (diseño nuevo) | **16 px / 400** |
| "Total" y el monto | **20 px / 600** |
| Campo mediano (nuevo) | alto **40 px**, radio **10 px** |
| Campo chico (anterior) | alto **32 px**, radio **8 px** |
| Botón Guardar large (nuevo) | **~109 × 44 px**, radio **12 px**, padding `10px 24px`, texto 16 px / 500 |
| Botones medium (anterior) | **~97 × 36 px**, radio **10 px**, padding `8px 16px`, texto 14 px / 500 |

## 3. Marco de la página

No copies la barra lateral ni la superior (ya están en la app). Solo el contenido:

| Pieza | Valor medido |
|---|---|
| Barra lateral | 271 px, fija desde **1024 px** |
| Barra superior | 56 px |
| Padding del área de contenido | **20 px** |
| Contenedor del formulario | **max-width 1040 px**, centrado (`margin: 0 auto`) |
| A 1280 px | el contenedor mide **969 px** (llena el espacio que queda: 1280 − 271 − 20 − 20) |
| A 1024 px | el contenedor mide **713 px** (la barra lateral sigue visible; la rejilla **sigue en 3 columnas**) |

El título va **fuera** de la tarjeta, con 24 px de margen abajo.

## 4. La tarjeta (diseño nuevo)

Una sola tarjeta, no varias.

| Propiedad | Valor |
|---|---|
| Fondo | `#ffffff` |
| Borde | 1 px `#e2e8f0` |
| Radio | **12 px** |
| Sombra | **ninguna** (`box-shadow: none`) |
| Padding del `s-card` | `8px 16px 16px` |
| Padding del bloque interno | **16 px** más (`p-4`) |
| Inset visual hasta los campos | **33 px** a izquierda y derecha (16 + 16 + 1 de borde) |
| Margen debajo de la tarjeta | **24 px** (ahí empieza la fila del botón) |
| Ancho | el del contenedor (969 px a 1280, 713 px a 1024) |

Encabezado dentro de la tarjeta (`min-height: 80 px`, margen abajo 16 px, flex `space-between`):

- Izquierda: nombre de la empresa, **16 px / 600 / `#334155`**, con una línea vertical a la derecha (`border-right` 1 px `#94a3b8/20`).
- El RNC iría al lado, en **12 px / 500 / `#64748b`**. En esta empresa de prueba el span está vacío **(no medido con texto)**.
- Derecha: "No. 5" en 16 px / 600 / `#334155`, y debajo "Recibo de caja" + lápiz de 16 px. En el HTML de Alegra esa leyenda lleva `text-xs text-slate-500` (12 px / `#64748b`); en la copia local el tag se perdió y el texto heredó 16 px **(toma el CSS, no el computed de la copia)**.

## 5. Rejilla, campos y el resto de piezas (diseño nuevo)

### Rejilla de 3 columnas

CSS: `display: grid`. Hueco de fila siempre **16 px**.

| Ancho de ventana | Columnas | Hueco entre columnas | Ancho de cada columna (medido) |
|---|---|---|---|
| ≥ 768 px (incluye 1024 y 1280) | **3** | **32 px** | 279.7 px a 1280; 194.3 px a 1024 |
| 640–767 px | **2** | **8 px** | 326.5 px a 767 |
| < 640 px | **1** (lo dice el CSS; **no abrí una ventana de 600**) | — | — |

Orden de los campos: Cliente, Cuenta bancaria \*, Fecha de pago \*, Forma de pago \*, Centro de costo.

### Etiqueta, asterisco y "?"

- Etiqueta encima del campo, **14 px / 500 / `#334155`**, con **4 px** hasta el input.
- Asterisco `\*` de **12 px / 400 / `#30aba9`**. En el datepicker lleva `margin-left: 4 px`.
- El "?" de ayuda es un SVG de **18 px**, color **`#30bbb7`**, dentro de una caja de 20 × 20, **después** del texto (no antes).

### Input y select (tamaño mediano)

| Cosa | Valor |
|---|---|
| Alto / radio / fondo | **40 px / 10 px / blanco** |
| Borde normal | 1 px `#cbd5e1` |
| Hover (CSS) | 1 px `#94a3b8` |
| Foco (medido) | **2 px `#30bbb7`**, sin sombra |
| Texto | 16 px / 400 / `#334155`, padding interno `6px 8px` |
| Placeholder | `#94a3b8`, 16 px |
| Flecha del select | 20 px, `#64748b`, a la derecha |

### Fecha (con × para borrar)

Mismo alto, radio y borde que el input. Padding medido: `7px 30px 7px 35px` (el ícono de calendario queda a la izquierda y la × a la derecha, ambos `#64748b`). En el diseño anterior el campo es de 32 px, radio 8 y **no tiene ×**.

El **foco de la fecha no se activó** en la copia (el JS de vue-datepicker no está). Los tokens y el aro de foco están en `GUIA-CALENDARIO.md`.

### Textarea (Notas)

Misma etiqueta de 14 px y 4 px de hueco. Caja con radio **10 px**, borde 1 px `#cbd5e1`, foco 2 px `#30bbb7`. Alto mínimo **80 px**, padding **10.8 px** (0.675 rem), texto 16 px. Placeholder de esta pantalla: "Agrega detalles adicionales que serán visibles en la impresión."

### Pestañas "Pago a factura de cliente / Otros ingresos"

Encima, el título "Tipo de ingreso": 14 px / 500 / `#334155`, 4 px abajo.

| Cosa | Valor |
|---|---|
| Barra | alto **42 px**, padding **4 px**, radio **8 px**, fondo `#94a3b8/10`, borde 1 px `#e2e8f0`, ancho completo |
| Las dos pestañas | `flex: 1` (mitad y mitad), texto 14 px / 600, inactiva `#475569`, activa `#334155` |
| Indicador (la pastilla blanca) | alto **32 px**, radio **6 px**, fondo blanco, ancho ~481 px a 1280. Sombra con `filter`: `drop-shadow(0 1px 2px rgba(0,0,0,.10)) drop-shadow(0 1px 1px rgba(0,0,0,.06))` |

### Aviso azul

Fondo `#e0e7ff`, borde 1 px `#4f46e5/20`, radio **12 px**, padding `14px 16px`, flex con hueco de 16 px. Ícono de info de 24 px. Texto 14 px / 400 / `#334155`. En esta pantalla: "Selecciona un cliente para traer sus facturas por cobrar."

En el diseño anterior el aviso va **encima** de las tarjetas, el borde es `#c7d2fe` (sólido) y el texto es `#4b5563`, con un enlace subrayado y una × para cerrar.

### Total

Bloque de **400 px**, pegado a la derecha, con 32 px de margen arriba y abajo. "Total" y "RD$ 0.00" en **20 px / 600 / `#0f172a`**, en los extremos (`justify-content: space-between`).

### Tabla

**No está en la copia local** del pago recibido vacío: solo aparece al elegir un cliente. No inventes las medidas. Para el contenido y las columnas, usa `19-pago-recibido-facturas.png`.

Sí medí la tabla del diseño anterior ("Cuentas contables"): encabezado fondo `#f1f5f9`, texto 14 px / 700 / `#334155`, padding `16px 8px`, radio 8 px en la primera y la última celda. Los inputs de la fila son los chicos (32 px, radio 8). El enlace "+ Agregar cuenta contable" es un botón de texto teal, 14 px / 500, alto 36 px, radio 10 px.

## 6. Dónde van los botones

**En los dos diseños van fuera de la tarjeta, alineados a la derecha.** Nunca dentro.

| | Diseño nuevo (copiar) | Diseño anterior |
|---|---|---|
| Qué botones | Solo **Guardar** (no hay Cancelar) | **Cancelar** (borde) y **Guardar** (relleno) |
| Separación | **24 px** debajo de la tarjeta (`mb-6`) | **16 px** debajo del bloque de comentarios (`md:mt-4`) |
| Tamaño | large: ~109 × 44, radio 12, texto 16 / 500 | medium: ~97 × 36, radio 10, texto 14 / 500 |
| Guardar | fondo `#30aba9`, texto blanco, padding `10px 24px` | fondo `#30aba9`, texto blanco, padding `8px 16px` |
| Cancelar | no existe | fondo blanco, borde 1 px `#94a3b8/40`, texto `#0f172a` |

La fila es un flex `justify-end` con hueco de 8 px, del mismo ancho que la tarjeta.

## 7. Boceto mínimo de CSS (solo valores de referencia)

No copies el CSS de Alegra. Esto es un recordatorio de números, con el azul de Medoxigas:

```css
:root {
  --fondo: #f4f5fb;
  --texto: #334155;
  --titulo: #0f172a;
  --borde-campo: #cbd5e1;
  --borde-tarjeta: #e2e8f0;
  --placeholder: #94a3b8;
  --primario: #1e56c7;      /* en Alegra es #30aba9 */
  --foco: #1e56c7;          /* en Alegra el foco es #30bbb7 */
  --aviso: #e0e7ff;
}
.pagina { background: var(--fondo); font-family: Inter, Roboto, sans-serif; }
.contenedor { max-width: 1040px; margin: 0 auto; }
.titulo { font-size: 20px; font-weight: 600; line-height: 28px; color: var(--titulo); margin-bottom: 24px; }
.tarjeta {
  background: #fff; border: 1px solid var(--borde-tarjeta);
  border-radius: 12px; box-shadow: none;
}
.rejilla {
  display: grid; grid-template-columns: repeat(3, minmax(0, 1fr));
  column-gap: 32px; row-gap: 16px;
}
.etiqueta { font-size: 14px; font-weight: 500; color: var(--texto); margin-bottom: 4px; }
.asterisco { font-size: 12px; font-weight: 400; color: var(--primario); }
.campo {
  height: 40px; border: 1px solid var(--borde-campo); border-radius: 10px;
  font-size: 16px; color: var(--texto); background: #fff;
}
.campo:focus, .campo:focus-within { border: 2px solid var(--foco); }
.boton-guardar {
  height: 44px; padding: 10px 24px; border-radius: 12px;
  background: var(--primario); color: #fff; font-size: 16px; font-weight: 500;
}
.fila-botones { display: flex; justify-content: flex-end; gap: 8px; margin-top: 24px; }
@media (max-width: 767px) {
  .rejilla { grid-template-columns: repeat(2, minmax(0, 1fr)); column-gap: 8px; }
}
```

## 8. No medido (decidir o volver a revisar)

- La tabla **Facturas por cobrar** (columnas, buscador, paginación, inputs de la fila, retenciones): no está en la copia vacía. Ver `19-pago-recibido-facturas.png`.
- El foco del campo de fecha (el JS del calendario no está en la copia). Ver `GUIA-CALENDARIO.md`.
- Hover y active de los botones (el CSS dice primary-700 / primary-800).
- Los menús desplegables abiertos y los estados de error.
- El RNC con texto real (en la prueba iba vacío).
- La tipografía exacta de "Recibo de caja" en vivo (el tag se rompió en SingleFile; el CSS apunta a 12 px `#64748b`).
- Cómo queda la rejilla nueva en un ancho menor a 640 px (el CSS dice 1 columna; yo medí 2 columnas a 767 px).
- Adjuntos, y qué pasa al guardar con varias facturas: eso es comportamiento, no estilo de esta copia.
