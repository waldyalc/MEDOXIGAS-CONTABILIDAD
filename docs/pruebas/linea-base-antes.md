# Línea base ANTES de las pruebas — cuadre.sql
Corrido: 14 nov 2026, 6:05 pm (hora RD), base ljfdhrnvlsfaweuvnqxz.

| Chequeo | Valor |
|---|---|
| A1 asientos descuadrados (absoluto) | 0 |
| A2 facturas con saldo negativo (absoluto) | 0 |
| A3 compras con saldo negativo (absoluto) | 0 |
| A4 facturas pagada con saldo o abierta sin saldo (absoluto) | 0 |
| A5 facturas anuladas sin asiento de reverso (absoluto) | 0 |
| A6 productos con existencia por almacén distinta del total (absoluto) | 0 |
| A7 NCF repetidos en facturas (absoluto) | 0 |
| D1 huecos en NCF B de facturas (delta) | 0 |
| D2 CxC mayor menos saldo de facturas (delta) | 0.00 |
| D3 CxP mayor más saldo de compras (delta) | 0.00 |
| D4 ITBIS por pagar mayor más ITBIS ventas netas (delta) | 0.00 |
| D5 ITBIS adelantado mayor menos ITBIS compras (delta) | 0.00 |
| D6 inventario mayor menos cantidad x costo (delta, redondeo) | -97500.0000 |
| I1 facturas ZZTEST | 0 |
| I2 tamaño de la base en MB | 25.7 |
