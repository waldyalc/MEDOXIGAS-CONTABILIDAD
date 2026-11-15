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
