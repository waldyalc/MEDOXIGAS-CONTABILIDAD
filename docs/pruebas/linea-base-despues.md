# Línea base DESPUÉS de las pruebas — cuadre.sql

Corrido: 14 nov 2026 ~19:52 (hora RD), base ljfdhrnvlsfaweuvnqxz.

**Método:** réplica exacta de `docs/pruebas/cuadre.sql` vía API de datos
(PostgREST) con `tests/carga/cuadre.ts` — se bajaron las tablas completas
(paginadas de a 1,000; los conteos `head` coincidieron fila por fila con lo
descargado) y se calcularon los mismos 15 chequeos en JS con dinero en
centavos enteros. Resultado crudo: `docs/pruebas/resultados/cuadre-despues.json`.

**Importante:** el SQL tiene **15 chequeos** (A1–A7, D1–D6, I1–I2), no 16.
I2 (`pg_database_size`) **no es medible por la API**: queda pendiente la
corrida autoritativa de `cuadre.sql` en el SQL Editor de Supabase, que debe
hacer Waldy. Los valores de esta tabla son una réplica fiel pero no la
corrida oficial.

Volumen descargado: `asiento_lineas` 258,467 · `asientos` 39,540 (306 de
reverso) · `facturas` 19,476 · `facturas_proveedor` 5,002 · `productos` 317 ·
`existencias` 259 · `notas_credito_venta` 501 · `contactos` ZZTEST-% 1,009.

| Chequeo | Antes | Después | Delta |
|---|---|---|---|
| A1 asientos descuadrados (absoluto) | 0 | 0 | 0 |
| A2 facturas con saldo negativo (absoluto) | 0 | 319 | +319 |
| A3 compras con saldo negativo (absoluto) | 0 | 0 | 0 |
| A4 facturas pagada con saldo o abierta sin saldo (absoluto) | 0 | 0 | 0 |
| A5 facturas anuladas sin asiento de reverso (absoluto) | 0 | 0 | 0 |
| A6 productos con existencia por almacén distinta del total (absoluto) | 0 | 0 | 0 |
| A7 NCF repetidos en facturas (absoluto) | 0 | 0 | 0 |
| D1 huecos en NCF B de facturas (delta) | 0 | 0 | 0 |
| D2 CxC mayor menos saldo de facturas (delta) | 0.00 | 0.00 | 0.00 |
| D3 CxP mayor más saldo de compras (delta) | 0.00 | 0.00 | 0.00 |
| D4 ITBIS por pagar mayor más ITBIS ventas netas (delta) | 0.00 | 0.00 | 0.00 |
| D5 ITBIS adelantado mayor menos ITBIS compras (delta) | 0.00 | 0.00 | 0.00 |
| D6 inventario mayor menos cantidad x costo (delta, redondeo) | -97500.0000 | -112946627.3300 | -112849127.3300 |
| I1 facturas ZZTEST | 0 | 19468 | +19468 |
| I2 tamaño de la base en MB | 25.7 | no medible por API | — |

## Explicación de diferencias

- **A2 (+319):** las 319 son **todas** facturas `ZZTEST-L1 SINPAGO` en estado
  `pagada` donde `pagado + credito + retenido > total` (ej.: total 15,591.34,
  pagado 15,591.34, credito 3,774.82 → saldo −3,774.82). El generador de la
  prueba 1 creó 800 facturas "sin pago"; en 319 quedó `credito` y `pagado`
  duplicados/inconsistentes. Es un **artefacto de los datos de prueba, no un
  bug de la app**: el SQL los cuenta igual y desaparecerán al borrar los
  datos `ZZTEST-*`. Ojo: si el generador se vuelve a usar, conviene corregir
  esa combinación para que A2 no ensucie el cuadre.
- **D6 (−112,849,127.33 de delta):** el saldo de la cuenta inventario en el
  mayor es RD$571,449,170.22 y `Σ cantidad × costo` de los 259 productos
  inventariables es RD$684,395,797.55 (casi todos `ZZTEST-Producto-*` con
  ~2,000–2,500 unidades a ~RD$2,800). El SQL esperaba solo centavos de
  redondeo por costo promedio; la carga produjo una divergencia grande. El
  mayor libera COGS a costos históricos mientras `productos.costo` es el
  promedio vigente, y las compras de la prueba llegaron a costos aleatorios:
  el promedio subió y la valoración actual quedó ~20 % por encima de la base
  del mayor. Agravantes posibles: las 300 anulaciones y el stock negativo
  permitido en C4 (−2) pueden distorsionar el promedio; si anular una compra
  no repone existencias/costo, cada anulación aleja más ambas cifras.
  **Recomendado:** confirmar con la corrida autoritativa en el SQL Editor y
  que Contable revise si es deriva esperada del promedio o un bug real del
  costeo/anulación.
- **I1 (+19,468):** facturas cuyo contacto es `ZZTEST-*` (L1 ~15,000 + C1
  500 + C7 ~3,932 + humo y C2–C6). De las 19,476 facturas totales solo 8 no
  son ZZTEST: la base tenía prácticamente datos de prueba, no facturación
  real, antes de las pruebas.
- **D1 = 0 con detalle:** NCF `B01` cubre 1–15,235 y `B02` 1–4,241, todos
  consecutivos y sin huecos (incluidas las 500 de C1 en paralelo).
- **El resto en 0:** el motor cuadró perfecto bajo carga — 258,467 líneas de
  asiento en 39,540 asientos, todos cuadrados (A1); CxC/CxP/ITBIS
  reconcilian al centavo contra el mayor (D2–D5 = 0.00 exacto); existencias
  por almacén = total del producto (A6); 306 anulaciones con reverso (A5);
  NCF únicos (A7).
- **I2:** no medible por API — pendiente para Waldy en el SQL Editor.
