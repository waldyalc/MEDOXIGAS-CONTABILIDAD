# Sonda de fallos — segunda pasada (14 nov 2026, solo lectura)

Hallazgos **nuevos** que no estaban en `RESULTADOS.md`. Todo medido en vivo
contra la base real con los datos ZZTEST cargados (~32k documentos).
Scripts: `tests/carga/sonda-fallos.ts`, `tests/carga/sonda-ui.ts`
(logs: `sonda-ui-log.txt`). No se modificó ni borró nada.

## F1. El formulario "Nuevo pago" solo puede cobrar 300 de 9,317 facturas

`getFacturasAbiertas` (`src/lib/pagos/consultas.ts:9-22`) trae
`.eq("estado","abierta").order("vencimiento").limit(300)` y luego filtra
saldo>0 **en memoria**.

- En vivo: **9,317 facturas abiertas** reales; el formulario carga 300 (3%).
- Consecuencia: **~9,000 facturas pendientes no se pueden cobrar desde la UI**
  porque ni siquiera aparecen en el selector de facturas del pago.
- Agravante: ordena por `vencimiento`, así que las que ofrece son las 300 más
  viejas con saldo; una factura reciente de un cliente con mucha deuda no sale.
- Cómo repetirlo: `/dashboard/pagos/nuevo` → elegir un cliente → la lista de
  facturas a aplicar nunca pasa de las primeras 300 abiertas por vencimiento.

## F2. Los listados no tienen paginación ni búsqueda: documentos inalcanzables

Medido en vivo (filas que dibuja la tabla vs filas reales):

| Lista | Muestra | Reales | Inalcanzables | Buscador | Paginación |
|---|---|---|---|---|---|
| Facturación | 300 (`limit`) | 19,481 | **19,181** | no | no |
| Compras | 1,000 (corte PostgREST, sin `limit`) | 5,002 | **4,002** | no | no |
| Pagos recibidos | 300 (`limit`) | 11,251 | **10,951** | no | no |
| Pagos a proveedores | 300 (`limit`) | 3,002 | **2,702** | no | no |
| Notas de crédito | 300 (`limit`) | 501 | **201** | no | no |
| Contactos | 1,000 (sin `limit`) | 1,023 | **23** | sí (ver F3) | no |
| Asientos | 300 (`limit`) | ~39,540 | **~39,240** | no | no |

La única vía para abrir un documento viejo es adivinar la URL o entrar por la
ficha del contacto/estado de cuenta. En Compras además se dibujan las 1,000
filas completas en el DOM → **5.3 s** de carga medidos.

## F3. Buscador de contactos/productos filtra en cliente → falsos negativos

`contactos-cliente.tsx:206` hace `filtrarContactos(contactos, pestana, busqueda)`
sobre el array que ya vino cortado a 1,000. Resultado:

- Buscar **"ZZTEST-Proveedor-0200"** (existe) devuelve *"No se encontraron
  contactos con esa búsqueda."* — falso negativo.
- Los 23 contactos invisibles (los últimos alfabéticamente:
  `ZZTEST-Proveedor-0178` … `0200`) no se encuentran ni scrolleando ni buscando.
- En producción: cualquier cliente/proveedor cuyo nombre quede después del
  corte de 1,000 desaparece del listado y del buscador.

## F4. El combobox de cliente en "Nueva factura" pierde los mismos 23 contactos

`getContactosClientes` (`src/lib/facturacion/consultas.ts:51-55`) hace
`.from("contactos").order("nombre")` **sin `.limit()`** → PostgREST corta en
1,000. Medido: cargados 1,000 de 1,023 → **23 contactos no se pueden elegir
para facturar ni para registrar pagos** (mismo helper en `getDatosFormularioPago`).

## F5. `reporte_cxc` (RPC) también se corta en 1,000 filas

`supabase.rpc("reporte_cxc", {p_fecha:"2023-12-31"})` devuelve **1,000 filas**
aunque hay **~7,002 facturas con saldo** hasta esa fecha (**RD$121,191,930.16**
de saldo real). El cap de 1,000 de PostgREST también aplica a resultados de
funciones → el reporte CxC a fecha muestra una fracción de la cartera real.
(Aplica igual a cualquier RPC que devuelva `setof`/`table` grande.)

## F6. El .txt exportable del 607 hereda el corte (verificado por código)

`reportes/607/page.tsx` arma `texto = libroTexto(...)` desde el mismo array
`documentos` que ya viene cortado por `obtenerVentas` (sin paginación).
El archivo para la DGII saldría con **1,033 detalles de 1,733** (mismo faltante
que la pantalla). En UI el botón no descarga archivo: copia/renderiza el texto
(`textoPlano`), así que no hay descarga que medir; el corte es idéntico.

## F7. React error #441 = pantalla de error de Next (libro-diario y balance)

La sonda UI capturó `pageerror: Minified React error #441` **solo** en
`/dashboard/reportes/libro-diario` y `/dashboard/reportes/balance-comprobacion`
(texto vacío, `posiblePaginaError=true`). Es el error-boundary de Next
mostrando la página de error por el `TypeError: Cannot read properties of
undefined (reading 'rest')` del envoltorio RPC desvinculado (error 2 de
RESULTADOS.md). Confirma que el fallo es crasheo total de la pantalla, no
lentitud. Misma causa probable en `balanza-tercero`, `auxiliar-tercero`,
`movimientos-cuenta`, `movimientos-cuenta-agrupado` y guardar numeraciones
(`src/lib/numeraciones/acciones.ts:30` usa el mismo patrón `rpc as unknown`).

## F8. Datos preexistentes raros (no ZZTEST)

- **"Cemento compra 2758": stock = −1** — producto real con inventario
  negativo antes de las pruebas (el único otro negativo es `ZZTEST-C4` en −2,
  esperado por el test).
- **198 RNC/cédulas duplicados** entre clientes y proveedores — artefacto del
  generador de pruebas (rango solapado), pero confirma que **`rnc_cedula` no
  tiene restricción de unicidad** en la base: la app permite registrar dos
  contactos con el mismo RNC (riesgo fiscal real, no solo de prueba).

## F9. Inicio lento: 9.0 s en esta corrida

`/dashboard` tardó 9,034 ms tras login (build prod, :3001). La RPC
`dashboard_resumen` agrega sobre ~258k líneas de asiento; coincide con el
p95 4.7 s ya reportado y sugiere degradación progresiva con el volumen.

## Lo que NO falló (verificado)

- `pagado > total` o `pagado < 0`: **0** facturas y **0** compras inconsistentes.
- Facturas sin `asiento_id`: **0**.
- `existencias` vs `productos.cantidad`: sin descuadres adicionales al de C4.
- Pagina­ción interna de CxC/CxP en pantalla: existe control (única lista con
  paginado encontrada).

## Pendiente por decisión

Como el resto de los hallazgos: **solo detección**, nada se corrigió ni se
tocó la base. Prioridad sugerida para Coder: F1 (bloquea cobros) y F5/F6
(reportes fiscales/cobranza incompletos) antes que los de lentitud.

---

# Sonda de fallos — tercera pasada (14 nov 2026, solo lectura)

Módulos que la segunda pasada no cubrió: bancos, remisiones/conduces, activos
fijos, notas de débito/crédito de compra, estado de cuenta de contactos con
muchos documentos y numeraciones. Script: `tests/carga/sonda-fallos-2.ts`
(crudo: `sonda-fallos-2-raw.json`). Todo medido en vivo; nada se escribió.

## F10. El detalle de cuenta de banco no solo corta: **se rompe del todo**

`cargarLineasCuenta` (`src/lib/bancos/consultas.ts:280-285`) trae **todas** las
`asiento_lineas` de la cuenta sin límite → PostgREST corta en 1,000 y luego
`asientos .in("id", ids)` con ~1,000 UUIDs → **Bad Request** (la URL revienta,
ver F11). En vivo:

| Cuenta | Líneas reales | La app trae | Resultado |
|---|---|---|---|
| 1101 Caja general | 8,423 | 1,000 | **crash** (Bad Request en la 2da ronda) |
| 1102 Banco principal | 5,830 | 1,000 | **crash** |
| 1106 Caja chica | 1 | 1 | funciona |
| 1109 Banco popular | 1 | 1 | funciona |

Consecuencia: `/dashboard/bancos/[id]` de las dos cuentas principales **lanza
error de servidor**, no muestra ni las primeras 1,000. El mismo loader lo usan
`getDetalleConciliacion` y `getInicioConciliacion`
(`src/lib/bancos/conciliaciones.ts:159,251`) → **tampoco se puede conciliar
ninguna de las dos cuentas con movimiento**. Aun sin el crash, el saldo
acumulado y los totales del período se calcularían sobre 1,000 líneas de
8,423 (el saldo del encabezado sí viene correcto de la RPC `saldos_caja_banco`
→ la tabla no cuadraría con el encabezado). Las 4 RPC de escritura de bancos
responden y validan bien.

## F11. El límite real de `.in()` en la URL es **~350 ids** (medido)

Consultas `.in("id", ids)` con UUIDs, probado en vivo:

| ids | ~KB de URL | Resultado |
|---|---|---|
| 100 | 3.7 | ok |
| 200 | 7.4 | ok |
| 300 | 11.1 | ok |
| 400 | 14.8 | `TypeError: fetch failed` |
| 1,000 (reales) | ~37 | `Bad Request` del servidor |

Umbral práctico: **entre 301 y 399 ids**. Pasarlo no corta resultados: **cae
la petición entera**. Sitios que ya superan el umbral en vivo: detalle de
banco (1,000 ids), reporte estado-cuenta-cliente del contacto con 3,932 y con
500 facturas (`.in` de pagos y aplicaciones con 1,000/500 ids), ficha de
contacto del mismo par (`.in` de asientos con ~500–1,000 ids). Otros sitios
con `.in(ids)` sin acotar que heredan el riesgo:
`contactos/estado-cuenta-consultas.ts:50` (aplicaciones por pago, cliente con
~350+ pagos) y `bancos/consultas.ts:301` (contactos por línea).

## F12. Estado de cuenta de un cliente con muchos documentos: falla doble

Cliente con **3,932 facturas** (contacto de C7, id `a42152ba…`):

- `obtenerEstadoCuentaCliente` (`reportes/ventas/v3/consultas.ts:155-189`):
  facturas sin límite → trae **1,000 de 3,932** (corte silencioso) y luego
  `.in("factura_id", ids)` con 1,000 ids → **Bad Request** en pagos y en
  aplicaciones (medido). El reporte `/reportes/estado-cuenta-cliente`
  **falla entero** para ese cliente.
- Cliente con 500 facturas (contacto de C1): `.in` con 500 > umbral → **el
  reporte también le cae** hoy.
- Ficha `contactos/[id]`: 11 consultas `.eq("contacto_id")` sin límite +
  `.in("id", asientoIds)` (`ficha-consultas.ts:288-294`) → **también crashea**
  para los 2 contactos anteriores.
- `contactos/[id]/estado-cuenta` aguanta por casualidad: el campeón tiene **0
  pagos** (todo a crédito) y el `.in` de aplicaciones se salta con lista
  vacía; caerá con cualquier cliente de ~350+ pagos recibidos.
- Regla práctica: **un contacto con ≳350 documentos de un tipo ya tiene
  alguna pantalla rota hoy**; el del top tiene las tres.

## F13. "Nueva nota de débito" solo puede elegir 500 de 19,175 facturas

`getDatosFormularioNotaDebito` (`src/lib/notas-debito/consultas.ts:126-132`):
`limit(500)` → **18,675 facturas (97 %) no se pueden elegir** para nota de
débito (solo las 500 más nuevas por número). Mismo patrón que F1.

## F14. "Nuevo pago a proveedor" deja 522 compras sin poder pagar

`cargarOpcionesPago` (`src/lib/compras/consultas.ts:278-285`): compras
`abierta` ordenadas por vencimiento **sin límite** → corte 1,000. En vivo:
**1,522 abiertas reales; el formulario carga 1,000 → 522 invisibles**.
Hermano de F1 en el lado de compras (F1 era pagos recibidos: 300 de 9,317).

## F15. Guardar numeraciones siempre falla (misma causa que F7)

`actualizarNumeracion` (`src/lib/numeraciones/acciones.ts:30`) usa
`supabase.rpc as unknown as RpcSuelta` → el TypeError desvinculado de F7 →
`/dashboard/contabilidad/numeraciones` **no guarda nada**. La RPC
`actualizar_numeracion` sí responde por API (probado con payload vacío →
"la numeración es obligatoria"): el fallo es solo el envoltorio.

## F16. `actualizar_numeracion` no vigila las series de notas (B03/B04)

El RPC valida `siguiente > último emitido` mirando solo `facturas` (por
`tipo_comprobante`) y `gastos_menores`. Las series **03 (notas de débito, B03)
y 04 (notas de crédito, B04) no están en esas tablas** → `v_ultimo = 0` → la
validación nunca se aplica ahí: se podría poner `siguiente` por debajo del
último B04 emitido y la próxima nota saldría con **NCF duplicado** (no hay
constraint de unicidad). Series B01/B02/B13/B14/B15/B16 sí quedan cubiertas.
Hoy está enmascarado porque la pantalla ni siquiera guarda (F15).

Deriva medida en vivo (`siguiente − último emitido`): **0 en las 8 series** —
B01 sig. 15,236 = últ. 15,235 + 1; B02 4,247 = 4,246 + 1; B04 502 = 501 + 1;
B13 2 = 1 + 1; B03/B14/B15/B16 sin uso en 1. El generador cuadró perfecto
tras ~32k docs y 300 anulaciones (anular no devuelve el NCF — correcto).

## F17. Remisiones/conduces no mueven inventario ni asiento (diseño)

La migración lo dice explícito: "documentos comerciales **sin asiento
contable y sin movimiento de inventario**". En Alegra el conduce sí descarga
la mercancía; aquí el stock solo baja al facturar. Si se entrega con conduce
antes de facturar, el inventario queda inflado hasta la factura.
**Confirmar con Contable/Waldy si es lo deseado.** Datos: 1 remisión y 1
cotización preexistentes; las listas comparten el `limit(300)` de
`getDocumentosLista` (patrón F2, aún sin invisibles). RPCs `crear_remision`,
`editar_remision` y `convertir_a_factura` responden y validan bien.

## F18. Nota de débito de compra no existe

Sí hay `notas_credito_compra` (tabla, RPC `crear_nota_credito_compra`,
pantallas en `compras/notas-credito/`), pero **no hay nota de débito de
compra**: ni tabla, ni RPC, ni menú. Si un proveedor emite cargo extra (nota
de débito), no hay dónde registrarla. Decidir si hace falta.

## Activos fijos (sin cortes activos; riesgo latente)

- 0 activos / 0 depreciaciones; módulo completo (`contabilidad/activos`),
  RPCs `crear_activo_fijo`/`depreciar_activo` alcanzables y validando.
- Lista con `limit(500)`; formulario trae 203 proveedores < 1,000 → ok hoy.
- **Latente:** `getActivosLista` (`activos-fijos/consultas.ts:49`) baja TODAS
  las `activo_depreciaciones` sin límite y suma en memoria → con ~50 mil
  depreciaciones también cortaría en 1,000 y la columna "depreciado" saldría
  mal en silencio.

## Lo que verifiqué que está bien (3ª pasada)

- Las 13 RPC de escritura de los módulos sondeados responden con validación
  limpia ante payload inválido (nada de crashes ni `sin permiso` raros).
- `saldos_caja_banco` devuelve las 4 cuentas caja/banco.
- Deriva de numeraciones = 0 en las 8 series (ver F16).
- `conciliacion_movimientos` existe (0 filas; el primer conteo falló porque
  la tabla no tiene columna `id`, error de la sonda, no de la app).

## Prioridad sugerida actualizada

1. **F10/F11/F12** — bancos, estado de cuenta y fichas crashean hoy con datos
   reales de volumen (no es truncado: es error de servidor).
2. **F15/F16** — numeraciones: no se puede guardar (F15) y cuando se pueda,
   el recálculo deja B03/B04 sin protección contra NCF duplicados (F16).
3. **F13/F14 + F1** — formularios que no dejan elegir la mayoría de los
   documentos (débito 97 %, pago proveedor 34 %, pago cliente 97 %).
4. **F17/F18** — decisiones de producto, no bugs de código.
