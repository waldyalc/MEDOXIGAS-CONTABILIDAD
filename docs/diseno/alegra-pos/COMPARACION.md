# Comparación pixel a pixel — Alegra POS vs Medoxigas POS

Comparación automática al mismo viewport usando Canvas del navegador (Playwright),
sin dependencias nuevas en el repo. Se calcularon dos lecturas:

1. **Diferencia estructural** (la que manda): se excluyen textos, imágenes, datos
   variables, logos y las zonas que Alegra tiene y Medoxigas no debe copiar.
2. **Diferencia cruda**: el recorte completo sin máscaras, solo como referencia.

Threshold por canal: diferencia máxima RGB > 24. Ancho/alto idénticos por par.

## Cómo se alineó la comparación

- Viewports: **1440×900** y **1024×600**, zoom 100 %.
- Referencia: SingleFile local del POS de Alegra (la copia local del SingleFile).
  Se le quitaron, **solo para esta comparación**, dos bloques que no forman parte
  del POS de Medoxigas: el aviso de onboarding («Plan Demo…») y la línea
  «Turno cerrado · Abrir turno» sobre el buscador (el turno se movió a la barra
  inferior por el Punto 1). Se recortó la barra superior de 56 px, incluida la
  zona derecha prohibida (Disponible, sincronizar, portapapeles, reloj, apps,
  logo).
- Medoxigas: se ocultó **solo para esta comparación** la fila de filtros
  (Todas las categorías / Favoritos / conteo), que es una función propia que
  Alegra no tiene en esa posición. Así el buscador y la primera fila de tarjetas
  quedan en las mismas coordenadas: buscador `y=14`, primera tarjeta `x=82`,
  `y=70`; panel `x=890`, ancho 550.
- El carrito se dejó vacío en ambas capturas estructurales para comparar el
  estado «0 productos» y el botón «Vender» deshabilitado.
- **Máscaras** (coordenadas de la unión de ambas páginas): cada caja de texto,
  imágenes, zonas de imagen de producto, insignias de favorito y contador de
  cantidad, selector de cliente, contenido del carrito, estado vacío del panel,
  acciones del encabezado del panel, riel lateral y barra interior del buscador.
- La barra inferior no entra en el recorte estructural: se compara aparte,
  anclada a su propio rectángulo, porque Alegra tiene 56 px de barra superior y
  Medoxigas usa ese alto para el catálogo. Ojo: la barra queda a `y=856` en
  ambos a 1440×900 y a `y=556` en ambos a 1024×600; lo que cambia es el alto del
  contenido de arriba.

## Resultado

| Medida | 1440×900 | 1024×600 |
| --- | --- | --- |
| Diferencia **estructural** (sobre píxeles comparables) | **1.062 %** (2 918 / 274 651) | **1.404 %** (2 734 / 194 684) |
| Diferencia sobre el recorte total (incluye zonas excluidas) | 0.340 % (2 918 / 858 240) | 0.543 % (2 734 / 503 808) |
| Diferencia **cruda** (sin máscaras, con datos y textos) | 8.767 % (75 240 / 858 240) | 13.410 % (67 563 / 503 808) |
| Área comparable tras las máscaras | 32 % del recorte | 39 % del recorte |

La diferencia cruda sube porque compara nombres, precios, fotos, clientes y
productos distintos —justamente lo que se excluye de la estructural—, además de
la fila de filtros propia. El cuerpo del panel quedó con el fondo real de Alegra
(`#f8fafc`) y eso bajó la diferencia cruda respecto de la primera pasada
(8.848 % / 13.610 %).

Muestras de control del panel (mismo estado, carrito vacío):

| Zona | 1440×900 | 1024×600 |
| --- | --- | --- |
| Encabezado | `(255,255,255)` en ambos | `(255,255,255)` en ambos |
| Bloque superior (Lista/Numeración/Cliente) | `(255,255,255)` en ambos | `(255,255,255)` en ambos |
| Cuerpo / estado vacío | `(248,250,252)` en ambos | `(248,250,252)` en ambos |
| Renglón del carrito | `(255,255,255)` | `(255,255,255)` |
| Pie (Vender / Productos) | `(255,255,255)` | `(255,255,255)` |

## Por componente (1440×900, recortes anclados a su rectángulo)

| Componente | Diferencia | Qué queda |
| --- | --- | --- |
| Tarjeta «Venta simple» (220×250) | **2.95 %** | Forma de los iconos (carrito+rayo del repo vs el de Alegra) y rasterizado del texto. Borde, radio, sombra, círculo y posición coinciden. |
| Fila del buscador (838×40) | **4.10 %** | Botón de escáner, texto/posición de «Nuevo producto» y el atajo F2 que agrega Medoxigas. La caja, el borde y el radio coinciden. |
| Barra inferior (1388×44) | **3.55 %** | Glifos de la cesta, texto de la pestaña, icono «+» y el bloque de turno que Alegra no tiene (se enmascara su zona). |
| Encabezado del panel (550×60) | **1.58 %** | Iconos de acción y rayo (forma distinta); el título, el alto y los espacios coinciden. |
| Pie del panel (550×113) | **0.49 %** | Casi idéntico: botón «Vender», botón historial y fila «Productos/Cancelar». |
| Tarjeta «Venta simple» a 1024×600 | **2.95 %** | El mismo residuo de iconos/texto. |

Los recortes lado a lado y sus imágenes de diferencias están en
`comparacion/componentes/`.

## Imágenes

| Archivo | Qué muestra |
| --- | --- |
| `comparacion/lado-a-lado-1440x900.png` | UI real de Alegra (izquierda) y de Medoxigas (derecha) a 1440×900. |
| `comparacion/lado-a-lado-1024x600.png` | La misma comparación a 1024×600. |
| `comparacion/diferencia-1440x900.png` | Estructural sin textos/datos: Alegra × Medoxigas arriba y diferencias en rojo abajo (1.062 %). |
| `comparacion/diferencia-1024x600.png` | Igual a 1024×600 (1.404 %). |
| `comparacion/componentes/*-lado.png` | Recorte comparado de tarjeta, buscador, barra, encabezado y pie. |
| `comparacion/componentes/*-diff.png` | Diferencia en rojo de cada recorte. |
| `referencia/alegra-1440x900.png` | Captura de referencia de Alegra a 1440×900. |
| `referencia/alegra-1024x600.png` | Captura de referencia de Alegra a 1024×600. |

## Fondo del panel

El hallazgo del Orquestador se corrigió en el `aside`: el cuerpo usa `bg-pos-panel`
(`#f8fafc`) y quedan blancos el encabezado, el bloque superior, los renglones del
carrito y el pie, igual que Alegra. La comparación estructural no cambia porque
el cuerpo del panel está enmascarado (contiene estados y datos variables); la
diferencia cruda sí bajó y las muestras de control dan el mismo color en ambos.

## Diferencia residual (por qué no es 0)

- **Iconos:** Medoxigas usa los iconos de `@/components/icons` (Phosphor); la
  forma exacta del carrito, el rayo, el escáner y la impresora no es idéntica y
  no se copian SVG de Alegra.
- **Texto:** el nombre de producto en mayúsculas y la fuente Inter se rasterizan
  distinto según el motor; el antialiasing de cada glifo cuenta como diferencia.
- **Datos:** nombres, precios, fotos, cliente y foco de la venta son reales de la
  base compartida y no se pueden igualar sin tocar datos (prohibido).
- **Extras de Medoxigas:** atajo F2, fila de categorías/favoritos, estado del
  turno en la barra y aviso de terminal. Son funciones propias, no diseño de
  Alegra.
- **Cambio pedido en el Punto 1:** el turno ya no está sobre el buscador; por eso
  la comparación quita esa línea de la referencia y compara la barra inferior
  aparte.

## Reproducir

Los scripts de medición, normalización y diff se corrieron **fuera del repo**
(`/tmp`) con Playwright, que ya es devDependency. No se agregó ninguna dependencia
ni se commiteó ningún export crudo de Alegra. Pasos:

1. Abrir el SingleFile local a 1440×900 y 1024×600, quitar onboarding y línea de
   turno, recortar la barra superior.
2. Capturar `/pos` en Medoxigas a los mismos viewports, mismo modo claro, ocultar
   la fila de filtros solo para la captura estructural.
3. Comparar en Canvas con threshold 24 y las máscaras descritas.
4. Revisar que la barra inferior esté a `y=856` (1440) y `y=556` (1024) en ambos.
