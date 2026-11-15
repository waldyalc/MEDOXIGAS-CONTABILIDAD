# Investigación P4 — hallazgos de integridad (solo lectura)

Fecha: 2026-11-17. Sin cambios de datos ni migraciones. Conclusiones para Waldy + Contable.

## A2 — 319 facturas con saldo negativo (pagado + crédito + retenido > total)

**La app sí lo permite por una vía.** Resultado de leer las RPC actuales:

- `registrar_pago_recibido` (versión vigente, `20261115100100_pagos_retenciones.sql:161-167`): calcula `saldo = total - pagado - credito - retenido`, rechaza si `<= 0` ("ya está pagada") y si `monto + retenido > saldo`. ✔ Protegido.
- `registrar_pago_recibido_multi` (`20261116200000_pagos_multifactura.sql:274-276,346`): misma protección por factura, incluye `credito` y `retenido`. ✔ Protegido.
- `crear_nota_credito_venta` (vigente, `20261114900000:1445-1447`): solo valida `nuevo_credito > factura.total`. **No compara `pagado + credito + retenido` contra el total** → una NC sobre factura pagada deja `pagado + credito > total` → saldo negativo (la RPC hasta marca la factura 'pagada', 1489-1490).

Conclusión: las 319 pueden venir del generador (inserts directos) **o** de NCs aplicadas a facturas ya pagadas vía RPC. La vía existe en la app hoy. Nota: contablemente una NC sobre factura pagada puede ser legítima (saldo a favor del cliente) — decisión de Contable si se permite y cómo reportarlo; el saldo negativo en sí mismo es el estado a resolver, no necesariamente un bug. Candidato de fix si se decide bloquear: validar `pagado + credito + retenido <= total` o mover el excedente a una cuenta de saldo a favor.

**Cómo lo hace Alegra** (`docs/alegra/ALEGRA.md` §13.1 y 13.5): la nota de crédito no "resta dentro" de la factura — declara qué se hace con el dinero (crédito a facturas del cliente o devolución de efectivo). Con NCF B04 obliga a ligar la nota a la factura por el monto completo; lo que no se aplica queda como "Por aplicar" — saldo a favor visible en la nota, no saldo negativo en la factura. Propuesta equivalente para Medoxigas: validar `pagado + credito + retenido <= total` en `crear_nota_credito_venta` y registrar el excedente como saldo a favor del cliente (aplicable a otra factura o devuelto en efectivo). Requiere OK de Contable y migración.

## D6 — inventario: mayor RD$571.4M vs cantidad×costo RD$684.4M (−RD$112.8M)

`asiento_lineas.producto_id` existe → el cuadre por producto es posible. Script de solo lectura en `docs/pruebas/cuadre-inventario.sql`: (1) kardex reconstruido vs `productos.cantidad`, (2) mayor por producto en cuentas 1130*/costo, (3) total mayor vs `Σ cantidad×costo`.

Hipótesis a confirmar con la corrida: el generador usó costos aleatorios por compra y el costo promedio ponderado de `productos.costo` diverge del mayor; también puede haber drift por anulaciones o stock negativo. **Pendiente**: Waldy corre el SQL; el diagnóstico cierra con Contable. No tocar costeo hasta entonces.

## RNC duplicados (198)

`contactos.rnc_cedula` no tiene unicidad. Decisión pendiente con Contable: pueden ser sucursales legítimas de la misma empresa → NO agregar `unique` hasta confirmar. Los ZZTEST inflan el conteo; recontar excluyéndolos antes de decidir.

## NCF en notas (B03/B04) y unicidad NCF

`actualizar_numeracion` valida `facturas`/`gastos_menores` pero **no mira `notas_credito_venta` ni `notas_debito_venta`** → una numeración B03/B04 puede moverse a un rango que choque con NCF ya emitidos en notas → NCF duplicado posible. Tampoco hay `unique` en `ncf` por serie. Migración candidata (requiere OK): extender la validación a las tablas de notas + unique por `(tipo_comprobante, ncf)` donde aplique. Diseñar con Contable.

## F17/F18 (decisiones de producto, sin acción)

- Remisiones/conduces no mueven inventario hasta facturar — ¿deseable?
- No existe nota de débito de compra.
