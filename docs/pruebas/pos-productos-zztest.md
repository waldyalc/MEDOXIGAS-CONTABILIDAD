# Productos de prueba ZZTEST para el POS

Fecha: 22 nov 2026 · Rama: `chore/pos-productos-zztest` · Base: `origin/main`

Punto 2 del MEGA PLAN: crear 20+ productos de prueba en el POS, variados y
parecidos al catálogo de Medoxigas, con precios e inventario distintos, algunos
agotados y al menos 8 con foto real.

## Cómo se hizo

- Todo se creó desde la app con el usuario de pruebas `ZZTEST zztest1`, por el
  formulario **Inventario → Productos → Nuevo producto**, el mismo flujo que usa
  Waldy. No hubo SQL de escritura, migraciones, cambios de esquema ni
  `service_role`.
- Las fotos se descargaron de Wikimedia Commons (fotos reales, sin IA) y se
  subieron con el campo **Subir imagen** del formulario. La app guardó el
  `imagen_path` y firmó la miniatura; se comprobó que la vista previa aparece en
  el formulario y que la foto se ve en las tarjetas del POS.
- **No se modificó, editó ni borró ningún dato existente.** Solo se crearon los
  22 productos `ZZTEST` y sus imágenes. El producto «Producto captura ER», el
  contacto «PRUEBA CAPTURA ER», la terminal y el «Turno No 4 abierto» que ya
  estaban en la base se usaron únicamente como lectura/contexto; el turno sigue
  abierto y no se hizo ninguna venta.
- La base configurada en `.env.local` es `ljfdhrnvlsfaweuvnqxz`, la única del
  proyecto y la que también lee el deploy de producción. Por eso todo lo nuevo
  está marcado `ZZTEST` y no se tocó nada más: no existe una base de producción
  separada.
- La base no tiene categorías creadas (el selector solo ofrece «Sin
  categoría»), así que los 22 productos quedaron sin categoría. El filtro
  **Todas las categorías** del POS los muestra igual; no se crearon categorías
  porque la tarea era solo de productos.

## Checklist de aceptación

- [x] **20 o más productos ZZTEST visibles en el POS.** 22 tarjetas en total,
      tanto en el worktree (3012) como en el preview oficial. Evidencia:
      `pos-zztest-claro-1440x900.png`,
      `pos-zztest-preview-oficial-1440x900.png` (contador «22 productos»).
- [x] **Al menos 8 con foto real; el resto con el ícono de etiqueta.** 12 con
      foto cargada y visible (`naturalWidth > 0` en las 12), 10 sin foto con el
      ícono de etiqueta. Evidencia: capturas del POS y
      `formulario-producto-imagen-1440x900.png`.
- [x] **Algunos muestran «Agotado».** 3: Cilindro de argón 40 pies³, Flujómetro
      de oxígeno 0-15 L/min y Humidificador burbujeador para oxígeno.
- [x] **La búsqueda y «Todas las categorías» los encuentran.** Buscar `ZZTEST`
      devuelve las 22 tarjetas; buscar `cilindro` devuelve 8; sin búsqueda, con
      «Todas las categorías», el catálogo muestra 23 tarjetas (22 ZZTEST + el
      producto existente «Producto captura ER»). Evidencia:
      `pos-todas-categorias-claro-1440x900.png`,
      `pos-busqueda-cilindro-1440x900.png`.
- [x] **Captura del POS lleno.** Claro y oscuro a 1440×900; además, captura
      desplazada al final de la rejilla y captura del preview oficial.
- [x] **Ningún dato en producción.** No se tocó ningún registro existente; solo
      se agregaron los 22 ZZTEST a la única base del proyecto (la misma que lee
      producción). La lista completa está abajo; no se borró nada.

## Productos creados (22)

Todos los nombres reales llevan el prefijo `ZZTEST `. Precio = precio base sin
ITBIS (el que muestra el POS); todos tienen ITBIS 18 %.

| Producto | Precio base | Inventario | Unidad | Categoría | Foto |
| --- | ---: | ---: | --- | --- | :---: |
| Cilindro de oxígeno 10 L | RD$4,500.00 | 12 | Cilindro | Sin categoría | Sí |
| Cilindro de oxígeno 40 L | RD$9,850.00 | 6 | Cilindro | Sin categoría | Sí |
| Cilindro de oxígeno portátil 2 L | RD$3,250.00 | 9 | Cilindro | Sin categoría | Sí |
| Recarga de oxígeno 10 L | RD$850.00 | 25 | Recarga | Sin categoría | No |
| Recarga de oxígeno 40 L | RD$1,650.00 | 18 | Recarga | Sin categoría | No |
| Regulador de oxígeno 0-15 L/min | RD$2,450.00 | 8 | Unidad | Sin categoría | Sí |
| Flujómetro de oxígeno 0-15 L/min | RD$1,875.00 | 0 (Agotado) | Unidad | Sin categoría | No |
| Mascarilla de no reinhalación adulto | RD$185.00 | 40 | Unidad | Sin categoría | Sí |
| Cánula nasal adulto | RD$95.00 | 60 | Unidad | Sin categoría | Sí |
| Humidificador burbujeador para oxígeno | RD$675.00 | 0 (Agotado) | Unidad | Sin categoría | No |
| Manguera de oxígeno 7 pies | RD$220.00 | 35 | Unidad | Sin categoría | No |
| Válvula de cilindro de oxígeno pin index | RD$1,150.00 | 5 | Unidad | Sin categoría | Sí |
| Termo LOX 180 L | RD$38,500.00 | 2 | Termo | Sin categoría | Sí |
| Cilindro de acetileno 40 pies³ | RD$6,400.00 | 4 | Cilindro | Sin categoría | Sí |
| Regulador de acetileno | RD$2,950.00 | 3 | Unidad | Sin categoría | No |
| Cilindro de CO2 20 lb | RD$5,800.00 | 7 | Cilindro | Sin categoría | Sí |
| Recarga de CO2 20 lb | RD$1,250.00 | 14 | Recarga | Sin categoría | No |
| Cilindro de argón 40 pies³ | RD$7,200.00 | 0 (Agotado) | Cilindro | Sin categoría | Sí |
| Regulador de argón | RD$3,450.00 | 5 | Unidad | Sin categoría | No |
| Concentrador de oxígeno portátil | RD$62,000.00 | 3 | Equipo | Sin categoría | Sí |
| Kit de oxigenoterapia domiciliaria | RD$2,200.00 | 10 | Kit | Sin categoría | No |
| Carrito soporte para cilindro de oxígeno | RD$2,750.00 | 6 | Unidad | Sin categoría | No |

## Fotos: origen y licencia

Las 12 fotos son reales (Wikimedia Commons), descargadas y subidas por el
formulario de la app. No se generó ninguna con IA.

| Producto | Archivo original | Autor | Licencia |
| --- | --- | --- | --- |
| Cilindro de oxígeno 10 L | [10ltr oxygen cylinder.png](https://commons.wikimedia.org/wiki/File:10ltr_oxygen_cylinder.png) | Pawar0365 | CC BY-SA 4.0 ([texto](https://creativecommons.org/licenses/by-sa/4.0)) |
| Cilindro de oxígeno 40 L | [BOC Medical oxygen tanks Royal Women's Hospital.jpg](https://commons.wikimedia.org/wiki/File:BOC_Medical_oxygen_tanks_Royal_Women%27s_Hospital.jpg) | Sgroey | CC BY-SA 4.0 ([texto](https://creativecommons.org/licenses/by-sa/4.0)) |
| Cilindro de oxígeno portátil 2 L | [RECALLED – Portable oxygen cylinder units (8294127015).jpg](https://commons.wikimedia.org/wiki/File:RECALLED_%E2%80%93_Portable_oxygen_cylinder_units_(8294127015).jpg) | The U.S. Food and Drug Administration | Public domain |
| Regulador de oxígeno 0-15 L/min | [Oxygen regulator Linde by AGA.jpg](https://commons.wikimedia.org/wiki/File:Oxygen_regulator_Linde_by_AGA.jpg) | T. Bjornstad | CC BY-SA 4.0 ([texto](https://creativecommons.org/licenses/by-sa/4.0)) |
| Mascarilla de no reinhalación adulto | [Non Rebreather Mask.JPG](https://commons.wikimedia.org/wiki/File:Non_Rebreather_Mask.JPG) | ICUnurses | CC BY-SA 4.0 ([texto](https://creativecommons.org/licenses/by-sa/4.0)) |
| Cánula nasal adulto | [Nasal cannula.jpg](https://commons.wikimedia.org/wiki/File:Nasal_cannula.jpg) | Ctac | CC BY-SA 4.0 ([texto](https://creativecommons.org/licenses/by-sa/4.0)) |
| Válvula de cilindro de oxígeno pin index | [Pin index medical oxygen cylinder valve P8160080.jpg](https://commons.wikimedia.org/wiki/File:Pin_index_medical_oxygen_cylinder_valve_P8160080.jpg) | Peter Southwood | CC0 ([texto](http://creativecommons.org/publicdomain/zero/1.0/deed.en)) |
| Termo LOX 180 L | [Liquid Oxygen tank.jpg](https://commons.wikimedia.org/wiki/File:Liquid_Oxygen_tank.jpg) | Price Zero | CC0 ([texto](http://creativecommons.org/publicdomain/zero/1.0/deed.en)) |
| Cilindro de acetileno 40 pies³ | [Acetylene cylinders by Air liquide.jpg](https://commons.wikimedia.org/wiki/File:Acetylene_cylinders_by_Air_liquide.jpg) | Cjp24 | CC BY-SA 4.0 ([texto](https://creativecommons.org/licenses/by-sa/4.0)) |
| Cilindro de CO2 20 lb | [Carbon dioxide sample (1).jpg](https://commons.wikimedia.org/wiki/File:Carbon_dioxide_sample_(1).jpg) | Leiem | CC BY-SA 4.0 ([texto](https://creativecommons.org/licenses/by-sa/4.0)) |
| Cilindro de argón 40 pies³ | [Bottles of argon gas in CERN.jpg](https://commons.wikimedia.org/wiki/File:Bottles_of_argon_gas_in_CERN.jpg) | Unnerving duck | CC BY-SA 4.0 ([texto](https://creativecommons.org/licenses/by-sa/4.0)) |
| Concentrador de oxígeno portátil | [Portable Oxygen Concentrator by Inogen.jpg](https://commons.wikimedia.org/wiki/File:Portable_Oxygen_Concentrator_by_Inogen.jpg) | Oxystore | CC BY-SA 4.0 ([texto](https://creativecommons.org/licenses/by-sa/4.0)) |

## Capturas

Todas a 1440×900, en `docs/pruebas/capturas/pos-zztest/`:

| Archivo | Qué muestra |
| --- | --- |
| `pos-zztest-claro-1440x900.png` | POS claro, búsqueda `ZZTEST`, 22 productos, fotos y «Agotado». |
| `pos-zztest-claro-abajo-1440x900.png` | La misma rejilla desplazada hasta el final (los últimos productos). |
| `pos-zztest-oscuro-1440x900.png` | POS oscuro, búsqueda `ZZTEST`, 22 productos. |
| `pos-zztest-oscuro-abajo-1440x900.png` | POS oscuro desplazado al final de la rejilla. |
| `pos-todas-categorias-claro-1440x900.png` | Sin búsqueda, «Todas las categorías», 23 productos (22 ZZTEST + el existente). |
| `pos-busqueda-cilindro-1440x900.png` | Búsqueda `cilindro`: 8 resultados. |
| `formulario-producto-imagen-1440x900.png` | Formulario de edición con la miniatura asociada al producto. |
| `pos-zztest-preview-oficial-1440x900.png` | Preview oficial, búsqueda `ZZTEST`: 22 productos, 12 fotos y 3 agotados. |

## Verificación

- POS local (3012): 22 tarjetas `ZZTEST` con la búsqueda; 12 con imagen cargada;
  3 con «Agotado»; 23 tarjetas con «Todas las categorías».
- Preview oficial (`https://medoxigas-agentes.tail25e53a.ts.net/pos`): mismas 22
  tarjetas, 12 imágenes y 3 agotados.
- Comprobación tarjeta por tarjeta contra esta lista: nombre, precio, stock o
  «Agotado» y presencia/ausencia de foto, sin diferencias.
- No se borró nada. Los 22 productos se pueden localizar después con la
  búsqueda `ZZTEST`; su borrado queda pendiente del OK de Waldy.
