# Interpretación del cuadre — corrida autoritativa de `cuadre.sql`

**Estado: PENDIENTE.** Falta que Waldy corra `docs/pruebas/cuadre.sql` en el
SQL Editor de Supabase y pegue la salida aquí. Cuando llegue, se llena la
columna «Después (SQL Editor)» y el veredicto.

## Cómo se lee (reglas del plan)

- **A1–A7 (absoluto):** deben dar **0**. Si la línea base ya daba distinto,
  es hallazgo aparte (la base daba 0 en todas).
- **D1–D5 (delta):** `después − antes` debe ser **0.00**.
- **D6 (inventario):** se toleran solo centavos de redondeo del costo
  promedio; la línea base ya traía −97,500.0000.
- **I1–I2:** informativos (facturas `ZZTEST` y tamaño de la base en MB).
  I2 es el único chequeo que la réplica por API no pudo medir.

## Tabla de interpretación

| Chequeo | Antes | Después (réplica API, `linea-base-despues.md`) | Después (SQL Editor) | Delta esperado | ¿Ok? |
|---|---|---|---|---|---|
| A1 asientos descuadrados | 0 | 0 | _pendiente_ | 0 | ⏳ |
| A2 facturas saldo negativo | 0 | 319 | _pendiente_ | 0 ⚠ | ⏳ |
| A3 compras saldo negativo | 0 | 0 | _pendiente_ | 0 | ⏳ |
| A4 pagada con saldo / abierta sin saldo | 0 | 0 | _pendiente_ | 0 | ⏳ |
| A5 anuladas sin reverso | 0 | 0 | _pendiente_ | 0 | ⏳ |
| A6 existencias ≠ total producto | 0 | 0 | _pendiente_ | 0 | ⏳ |
| A7 NCF repetidos | 0 | 0 | _pendiente_ | 0 | ⏳ |
| D1 huecos NCF B | 0 | 0 | _pendiente_ | 0 | ⏳ |
| D2 CxC mayor − saldo facturas | 0.00 | 0.00 | _pendiente_ | 0.00 | ⏳ |
| D3 CxP mayor + saldo compras | 0.00 | 0.00 | _pendiente_ | 0.00 | ⏳ |
| D4 ITBIS por pagar + ventas netas | 0.00 | 0.00 | _pendiente_ | 0.00 | ⏳ |
| D5 ITBIS adelantado − ITBIS compras | 0.00 | 0.00 | _pendiente_ | 0.00 | ⏳ |
| D6 inventario mayor − cant×costo | −97,500.00 | −112,946,627.33 | _pendiente_ | solo centavos ⚠ | ⏳ |
| I1 facturas ZZTEST | 0 | 19,468 | _pendiente_ | informativo | ⏳ |
| I2 tamaño base (MB) | 25.7 | no medible por API | _pendiente_ | informativo | ⏳ |

## Desviaciones ya conocidas (de la réplica API — a confirmar con tu corrida)

- **A2 = 319** (debería ser 0): son **todas** facturas `ZZTEST-L1 SINPAGO` en
  estado `pagada` donde `pagado + credito + retenido > total` (ej.: total
  15,591.34, pagado 15,591.34, credito 3,774.82 → saldo −3,774.82). Es un
  **artefacto del generador de datos de prueba** (creó 800 facturas "sin
  pago" y en 319 quedó `credito`+`pagado` duplicado), no un bug de la app.
  Si tu corrida da exactamente 319, coincide con la réplica y no hay
  sorpresa; si da otro número, hay que mirar de cerca.
- **D6 ≈ −112,849,127.33 de delta** (esperaban solo centavos): el mayor de
  inventario da RD$571.4M y `Σ cantidad × costo` da RD$684.4M (~20 % de
  divergencia). Explicación probable: el mayor libera COGS a costo histórico
  mientras `productos.costo` es el promedio vigente; las compras de prueba
  llegaron a costos aleatorios y el promedio subió. Agravantes: 300
  anulaciones y stock negativo de C4. **Recomendado: que Contable revise el
  costeo/anulación** — no podemos descartar un bug real.
- **I1 ≈ 19,468** e **I2 solo tú lo puedes medir** (`pg_database_size` no va
  por la API): úsalo para ver qué tan cerca está la base del tope de 500 MB
  del plan gratis.

## Qué se comparará cuando llegue la salida

1. A1–A7: cada valor contra 0 (A2 contra el 319 explicado arriba).
2. D1–D5: `después − antes` contra 0.00.
3. D6: delta contra la tolerancia de centavos (y comparación con el
   −112,849,127.33 de la réplica).
4. I1 contra ~19,468; I2 como dato nuevo de tamaño real.
