# Logo de Medoxigas en el ticket del POS (MSG-35)

Capturas del 23/11/2026 desde el POS en desarrollo (`http://localhost:3032`,
viewport 1440 px, `deviceScaleFactor: 2`) con la terminal ZZCAPTURA Caja 1 y
ventas ZZTEST existentes. No se creó ninguna venta.

| Archivo                                        | Qué muestra                                                                                                     |
| ---------------------------------------------- | --------------------------------------------------------------------------------------------------------------- |
| `2026-11-23-pos-logo-antes-ticket-sin-logo.png` | Antes: ticket 80 mm sin logo (referencia previa; `empresa.logo_url` era NULL y el bucket `logos` estaba vacío). |
| `2026-11-23-pos-logo-factura.png`               | Después: factura 80 mm con el logo arriba, centrado sobre «MEDOXIGAS ALC, SRL».                                  |
| `2026-11-23-pos-logo-cierre.png`                | Cierre de 57 mm: no aplica logo, igual que el cierre de Alegra (sin encabezado de empresa).                     |

Medidas verificadas en el DOM del ticket (mm a 96 px/in): el elemento del logo
mide 69.8 × 20.9 mm y queda centrado sobre el nombre de la empresa (diferencia
< 0.01 px). El PNG mide 500 × 260, así que `object-contain` respeta la
proporción y pinta ~40.2 × 20.9 mm dentro del máximo.

La prefactura y la cotización usan el mismo `TicketPos`; el candado
`src/lib/pos/ticket-pdf.test.tsx` genera los cuatro PDF y exige la imagen de
logo en factura, prefactura y cotización.

`empresa.logo_url` quedó en
`https://ljfdhrnvlsfaweuvnqxz.supabase.co/storage/v1/object/public/logos/logo-medoxigas.png`
(bucket público `logos`, archivo subido desde `public/marca/logo-medoxigas.png`).
Sin logo en la empresa el componente no monta la imagen: no queda hueco.
