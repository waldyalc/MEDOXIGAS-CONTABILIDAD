# Medidas — POS 7 (más funciones y cotizaciones enlazadas) y POS 8 (cerrar cobro directo)

Capturas tomadas en `http://localhost:3027/pos` con `ZZTEST_USER`, viewport 1920×1000, navegador Chromium (Playwright).

## Botón «más funciones» (cuadro oscuro de la barra de cobro)

| Dato | Valor |
| --- | --- |
| Ancho × alto | 44 × 45 px |
| Fondo | `oklab(0.279491 -0.00636676 -0.0362855 / 0.99506)` |
| Radio | `10px` |
| Texto/icono | `rgb(255, 255, 255)` |

## Menú emergente (anclado arriba del botón, alineado a la derecha)

| Dato | Valor |
| --- | --- |
| Ancho × alto | 221.79052734375 × 100.00372314453125 px |
| Opciones | Guardar como cotización · Cargar cotización · Historial de ventas |

| Item | Texto y medida |
| --- | --- |
| Item 1 | Guardar como cotización — 213.869384765625 × 27.7237548828125 px, padding `4px 6px` |
| Item 2 | Cargar cotización — 213.869384765625 × 27.72381591796875 px, padding `4px 6px` |
| Item 3 | Historial de ventas — 213.869384765625 × 27.72381591796875 px, padding `4px 6px` |

## Diálogo «Cargar cotización» filtrado por cliente

| Dato | Valor |
| --- | --- |
| Ancho × alto | 640 × 257 px |
| Cliente en el carrito | PRUEBA CAPTURA ER |
| Cotizaciones listadas | 1 |

Texto renderizado:

- Cargar cotización
- Solo las cotizaciones abiertas de PRUEBA CAPTURA ER.
- Cotización No 1
- PRUEBA CAPTURA ER
- 22/11/2026
- Vence 22/12/2026
- RD$ 3,245.00
- Cerrar



## Cerrar cobro directo (Punto 8)

| Dato | Valor |
| --- | --- |
| Modal antes de cerrar | Pagar factura |  | ZZCAPTURA Caja 1 · Turno No 5 |
| Aviso «¿Cerrar el cobro?» | 0 coincidencias |
| Modales abiertos tras la X | 0 |
| Líneas del carrito conservadas | sí |

## Red (no se guardó ni editó nada)

Peticiones sin `GET` durante el recorrido (las server actions de lectura del POS también viajan por POST de Next; ninguna escribe en Supabase):

- `POST http://localhost:3027/login`
- `POST http://localhost:3027/pos`
- `POST https://ljfdhrnvlsfaweuvnqxz.supabase.co/storage/v1/object/sign/productos`
- `POST https://ljfdhrnvlsfaweuvnqxz.supabase.co/storage/v1/object/sign/productos`
- `POST http://localhost:3027/__nextjs_original-stack-frames`
- `POST https://ljfdhrnvlsfaweuvnqxz.supabase.co/storage/v1/object/sign/productos`
- `POST http://localhost:3027/pos`

No se pulsó «Guardar como cotización» ni se completó la venta: la cotización y la venta no se tocaron.
