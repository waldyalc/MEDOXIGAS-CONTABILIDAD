# Guía de diseño — Alegra POS

Destilado de las copias en `css-pos/` (`vender/` = pantalla de venta, `turno/` = cierre de turno) y las capturas `capturas/22-*.png`. Usar como referencia de estilo para el POS de Medoxigas — **sin copiar** el HTML/CSS (ver `README.md`).

## Tokens

| Token | Valor | Uso |
|---|---|---|
| Primario teal | `#00b19d` | Botón Vender, Guardar, tabs activos, checkmarks |
| Teal hover/oscuro | `#008e79` | Estado hover/pressed de primario |
| Teal secundario | `#30aba9` | Acentos, iconos activos del rail |
| Borde | `#e2e8f0` / `#cbd5e1` | Bordes de tarjetas, inputs, separadores |
| Texto principal | `#212529` | Títulos, montos |
| Texto secundario | `#707070` | Etiquetas, ayudas |
| Peligro | `#e11d48` (familia `#be123c`/`#9f1239`) | Devoluciones, Cancelar textual |
| Aviso/naranja | `#e85e42` | Badge CERRADO, warnings |
| Acento lima | `#bfcd31` | Detalles de marca |
| Fondo página | gris muy claro (`#f2f2f2`/slate-50) | Detrás de las tarjetas blancas |
| Fuente | **Inter** / Inter Semibold | Todo el POS |
| Radios | 5px inputs · 8px botones/tarjetas · 10px/1rem modales · `9999px` pills/badges | |

## Layout general

- **Rail izquierdo** ~56px de ancho, fondo claro, iconos verticales; al hover abre panel con etiquetas a la izquierda del contenido.
- **Pantalla de venta** = 2 columnas: catálogo fluido (izquierda, ~2/3) + **factura fija** (derecha, ~400px, fondo blanco, sombra suave). La factura no hace scroll con el catálogo.
- **Tarjetas blancas** con borde `#e2e8f0`, radio 8–10px, sombra mínima.
- **Modales centrados** sobre overlay oscuro translúcido; radio ~1rem; footer con Cancelar (texto) + acción primaria teal a la derecha; leyenda "* Campos obligatorios" abajo a la izquierda.

## Pantalla de venta (vender/)

- **Buscador** con ícono lupa, ancho ~360px, borde teal al foco; a su lado botón de escáner y botón "Nuevo producto" (texto teal).
- **Tarjeta de producto**: cuadrada ~140px, blanca, borde fino; ícono/imagen centrado arriba, `Inv. N` en teal pequeño, nombre en 2 líneas, precio en semibold. Badge circular teal con cantidad al agregarla; borde teal cuando está en carrito.
- **"Venta simple"**: tarjeta grande con ícono de carrito+rayo — acceso a venta sin producto.
- **Factura de venta**: encabezado con íconos (venta rápida, imprimir vista previa, ajustes); selects "Lista de precio" y "Numeración" etiquetados arriba; cliente con lápiz/x y botón "Nuevo" (teal claro).
- **Línea de venta**: nombre + precio unitario pequeño | stepper `− N +` | total a la derecha.
- **Totales**: Subtotal e ITBIS en gris secundario; botón **Vender** a todo lo ancho, teal, blanco, con el total dentro a la derecha; debajo "N Productos / Cancelar".
- Barra de pestañas de ventas abajo ("Venta principal" + `+` para ventas paralelas).

## Checkout y confirmación

- Modal "Pagar factura": TOTAL centrado grande; **botones de método** = tiles blancos con ícono + etiqueta, 3 arriba / 3 abajo bajo divisor "Otros métodos"; borde teal + fondo teal claro al seleccionar.
- Efectivo: input de monto con `*` + "Opciones rápidas" = pills/botones outline con montos (exacto, redondeos); campo **Cambio** en rojo/acento; Vendedor y Observaciones a la derecha; "Cambiar método" arriba.
- Confirmación: círculo teal con check, "¡Muy bien! 🎉", chip con Total y Cambio; iconos Compartir (correo/WhatsApp/link); input "Correo electrónico del cliente" + Enviar; footer Imprimir (outline) / Nueva venta (teal).
- Toasts abajo-derecha, fondo oscuro "Sincronizando venta…" / verde "¡Turno cerrado! 💰".

## Turno y cierre (turno/)

- Lista maestra a la izquierda ("Turno en curso" + badge ABIERTO/CERRADO pill teal/rojo), detalle a la derecha.
- Detalle: H1 "Cierre No N" + badge, botón Imprimir arriba-derecha; tabla de movimientos en filas con separador fino, montos alineados a la derecha; **Devolución de dinero en rojo**; "Total de movimientos" en negrita con borde superior.
- Caja destacada "Dinero esperado/en efectivo del cierre" fondo gris claro, monto grande a la derecha + descripción en gris.
- Modal de cierre: mismo resumen + "Nuevo movimiento" (botón teal centrado) + input "Dinero real en caja*" + ayuda en texto pequeño + Observaciones.

## Reglas que llevamos a Medoxigas

- Teal único de acción: un solo color para "Vender", "Guardar", "Nuevo", confirmaciones.
- Montos siempre alineados a la derecha y en semibold; el total de la venta vive dentro del botón Vender.
- El checkout nunca abandona la pantalla: modal sobre la factura.
- Badges de estado como pills (ABIERTO teal suave / CERRADO rojo suave).
- Sin bordes pesados ni sombras duras; el contraste lo dan los montos, no los marcos.

## Componentes de la segunda pasada

- **Checklist onboarding ("Activa tu POS")**: panel lateral derecho, pasos numerados con barra de progreso segmentada verde, sub-ítems tipo accordion con ícono + chevron.
- **Popovers de barra superior**: tarjeta flotante anclada al icono, fondo oscuro en "Disponible"; el de Terminal lista pares etiqueta→valor (bancos, numeración, almacén) con badge de estado del turno; el de sincronización = checks teal por entidad.
- **Calculadora "Venta simple"**: modal con input de nombre, display de monto grande a la derecha y grid de teclas — dígitos blancos, operadores teal sólido, utilidades (ce/C/%) en teal claro; CTA "Aplicar a la venta" full-width.
- **Pestañas de venta paralela**: tabs estilo navegador al pie ("Venta principal", "Venta 1"…) con ⋮ (Renombrar/Eliminar) y botón `+`; tab activa con borde teal inferior.
- **Wizard de devolución**: paso 1 = tarjetas de método seleccionables (borde teal al elegir, permite combinada); paso 3 = dos columnas lado a lado con encabezados propios y "CAMBIAR MÉTODO" en texto teal.
- **Confirmaciones destructivas**: modal chico centrado, pregunta en una línea, botones ghost + teal ("Volver"/"Sí, cancelar venta"; "No"/"Sí").
- **Plantilla de impresión**: editor a la izquierda con 3 tabs (Diseño/Letra/Contenido), opciones como tarjetas seleccionables con borde teal, toggles para campos del ticket; **vista previa del ticket a la derecha** que re-renderiza en vivo.
- **Registro de pagos**: tabs Ingresos/Egresos como pills en franja gris; detalle con monto grande + icono, pares de datos en 3 columnas, fila de iconos de acción (imprimir/editar/ver/eliminar).
- **Hub de configuraciones**: tarjetas blancas con título teal, descripción gris y links de navegación; los que salen de la app lleven ⓘ.
- Movimientos negativos (devoluciones, retiros) siempre en **rojo** dentro de las filas del turno; esperado/efectivo del cierre en caja gris destacada.
