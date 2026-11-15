# Resultados de las pruebas de carga — 14 nov 2026

Se probaron la carga de datos, varios usuarios a la vez, la velocidad de las
pantallas y que la contabilidad cuadre. Todo se hizo contra la base real con
datos de prueba `ZZTEST-`. La app se midió con build de producción
(`pnpm build` + `pnpm start -p 3005`), no con `next dev` — la medición anterior
quedó descartada porque midió otra app por un puerto ocupado.

## 1. Tabla resumen

| Prueba | Meta | Resultado | ¿Pasa? |
|---|---|---|---|
| 1. Carga de ~32 mil documentos | Sin cortes por cuota; RPC de crear factura p95 < 1 s | 32,097 docs en 850 s (~38 docs/s). RPC p50 ≈ 100–130 ms, p95 ≈ 120–300 ms | **PASA** |
| 1b. Pantallas con datos (28 × 5) | Listados/fichas p95 < 2 s; reportes p95 < 5 s | 6 reportes contables rotos; ventas-cliente ~10.5 s; libros >16 s; varias listas 2–5 s | **NO PASA** |
| 1c. Corte de 1,000 filas (607) | Conteo del reporte = conteo real | 607 muestra 1,033 de 1,733 filas y ~la mitad del dinero | **NO PASA** |
| 2. Concurrencia C1–C8 | Un ganador por operación; nada se cuelga | C1–C8 todas cumplen lo esperado | **PASA** |
| 3. Cuadre contable | A1–A7 = 0; D1–D5 delta = 0; D6 solo centavos | D2–D5 exactos en 0.00; D1 = 0; A2 = 319 (datos de prueba); D6 = −RD$112.8M | **NO PASA** (ver abajo) |

## 2. Lo que se frisó o fue lento (build de producción, :3005)

- **Rotos del todo (error de servidor, >16 s, las 5 mediciones fallan):**
  `libro-diario`, `balance-comprobacion` (marzo y año). Por el mismo código
  también están rotos `balanza-tercero`, `auxiliar-tercero`,
  `movimientos-cuenta` y `movimientos-cuenta-agrupado`.
- **Muy lentos:** `ventas-cliente` ~10.5 s (marzo y año); `catalogo-cuentas`
  5.2 s; `inicio` p95 4.7 s.
- **Sobre la meta de 2 s:** `pagos-recibidos` 2.7 s, `compras` 2.6 s,
  `productos` 2.2 s, `producto-ficha` 2.0 s.
- **Dentro de meta:** facturas 2.0 s, factura-ficha 1.6 s, compra-ficha 2.0 s,
  contactos 1.5 s, estado de cuenta 1.5 s; reportes 606, 607, estado de
  resultados, ventas generales, valor de inventario y CxC (todos < 5 s).
- Con 5 usuarios a la vez 3 minutos (C8): 171 visitas, máximo 4,951 ms, nada
  en blanco ni errores de consola.

## 3. Errores encontrados (por gravedad)

### 1. Las consultas se cortan en 1,000 filas — los reportes fiscales salen incompletos

PostgREST devuelve máximo ~1,000 filas por consulta. **~40 lecturas en
`src/lib` no pagan ni limitan**, así que los datos se cortan en silencio.
Detalle completo con archivo y línea en `resultados/sin-paginar.md`.

Confirmado en vivo con la carga: el **607 de marzo 2023 muestra 1,033
registros** (1,000 facturas + 33 notas de crédito) cuando hay **1,733 filas
reales**. En dinero: muestra **RD$25,994,096** facturado cuando lo real es
**RD$52,658,002.76** — se pierde casi la mitad. El ITBIS facturado muestra
RD$4,542,564.78 de RD$7,838,600.76 real. Ventas generales **sí cuadra**
(1,700 filas y totales exactos) porque ese reporte ya pagina bien.

Afecta, entre otros: 607 (ventas), 606 y libros de compras, devoluciones,
anulados, IT-1, impuestos-retenciones y detallados, exportar para el contador,
IR-17 y cartas de retención, libro diario y balanza por RPC, CxC/CxP por
antigüedad, reporte anual, auxiliar/balanza por tercero, auxiliar de cuenta y
detalle de cuenta banco. También las **listas de Compras y Pagos a
proveedores**, que muestran solo las 1,000 más nuevas.

- **Cómo repetirlo:** abrir `/dashboard/reportes/607?desde=2023-03-01&hasta=2023-03-31`
  y comparar "Registros" con el conteo real de `facturas` del mes.
- **Arreglo propuesto:** paginar con el bucle `.range()` que ya existe en
  `src/lib/reportes/ventas/v1/consultas.ts:34-52` (funciona igual sobre
  `.rpc()`), o mejor, mover los agregados a SQL. Prioridad fiscal: 606/607/608
  e IT-1 antes que nada.

### 2. Seis reportes contables no cargan (error de servidor)

`src/lib/reportes/libros/consultas.ts:33,52,72` y
`src/lib/numeraciones/acciones.ts:30` hacen `const rpc = supabase.rpc as
unknown as RpcSuelta`, lo que **desvincula el método**: `this` queda
`undefined` y explota con `TypeError: Cannot read properties of undefined
(reading 'rest')`. Las RPC en sí funcionan (probado directo); el fallo es solo
del envoltorio en TypeScript.

Pantallas rotas: libro diario, balance de comprobación, balanza por tercero,
auxiliar por tercero, movimientos por cuenta y movimientos agrupado. La acción
de guardar numeraciones también falla.

- **Cómo repetirlo:** abrir `/dashboard/reportes/libro-diario` — sale la página
  de error de Next.
- **Arreglo propuesto:** llamar `supabase.rpc(...)` directo (sin extraer el
  método) o usar `supabase.rpc.bind(supabase)`. Es un cambio de una línea por
  función.

### 3. Listas y fichas lentas con datos

Causas en `resultados/lentitud.md` (archivo:línea de cada una):

- Ninguna lista pagina en servidor y varias ni siquiera tienen `.limit()`:
  compras y pagos a proveedores bajan hasta 1,000 filas y las dibujan todas.
- Las fichas encadenan 3–5 rondas secuenciales de consultas a Supabase que
  podrían ir en paralelo o en una sola RPC.
- Fichas y estado de cuenta traen todo lo relacionado sin límite y luego usan
  `.in()` con miles de ids en la URL.
- Índices: **no son el problema**, ya existen y cubren bien.
- Modelo a copiar: el inicio ya usa una RPC `dashboard_resumen` que agrega en
  SQL + `cache()` (`src/lib/inicio/consultas.ts:51-57`).

### 4. El inventario no cuadra (D6)

El mayor de inventario da **RD$571,449,170.22** pero la suma de
cantidad × costo de los productos da **RD$684,395,797.55** → diferencia de
**−RD$112,846,627** (la línea base antes de las pruebas ya daba −97,500 por
redondeo). La carga usó costos aleatorios y C4 dejó stock negativo, así que
puede ser acumulación del costo promedio — pero el SQL esperaba solo centavos.
**Conviene que Contable revise el costeo y las anulaciones** antes de confiar
en el valor de inventario. Detalle en `linea-base-despues.md` y
`cuadre-despues.json`.

### 5. Menores

- 6 pagos fallaron con "la retención ITBIS 30 % no genera monto" sobre
  facturas con ITBIS 0: es del generador de datos de prueba, no de la app.
- A2 del cuadre = 319: facturas `ZZTEST-L1 SINPAGO` que quedaron
  inconsistentes (datos de prueba, no bug de la app).
- C8: las 5 facturas se crearon por la UI pero el script no capturó el id en
  la URL (limitación del script; los ids reales están en `c8.json`).

## 4. Cifras

- **Documentos creados (carga):** 1,000 contactos, 300 productos, 5,000
  compras, 3,000 pagos a proveedores, 15,000 facturas de venta, ~6,994 pagos
  recibidos, 500 notas de crédito, 300 anulaciones → ~32,097 en 850 s.
- **Concurrencia:** C1 500 facturas; C7 3,932 facturas en 120 s; C8 5
  navegadores 3 min. Total de facturas ZZTEST en la base: **19,468** (la base
  tenía ~8 facturas reales antes).
- **Fallos reales:** 6 pagos (retención ITBIS, ver arriba). Los rechazos de
  C2/C3/C5/C6 son los esperados por diseño del test.
- **Tamaño de la base:** antes 25.7 MB; después **no medible por API** (I2
  requiere `pg_database_size`, solo SQL Editor).
- **Cuadre:** A1, A3–A7 = 0; A2 = 319 (datos de prueba); D1 = 0 (NCF sin
  huecos, incluso con las 500 facturas en paralelo de C1); D2–D5 = 0.00 exacto
  sobre 258,467 líneas de asiento; D6 = −RD$112,846,627 (ver error 4).
- **Archivos:** `resultados/carga.json`, `concurrencia.json` (C1–C8),
  `tiempos-ui.json`, `c8-muestras.json`, `cuadre-despues.json`,
  `linea-base-despues.md`, `lentitud.md`, `sin-paginar.md`, `ui-log.txt`,
  `c8-log.txt`, `concurrencia-log.txt`, `carga-log.txt`; scripts en
  `tests/carga/` (`_comun.ts`, `humo.ts`, `carga.ts`, `concurrencia.ts`,
  `ui.ts`, `c8.ts`, `cuadre.ts`).

## 5. Lo que no se pudo hacer y por qué

- **I2 (tamaño de la base en MB) y la corrida autoritativa de `cuadre.sql`:**
  no hay canal SQL desde aquí (sin `psql`, sin CLI de Supabase y el token de
  acceso del entorno es inválido). El cuadre se calculó replicando el SQL por
  la API de datos (solo lectura); **falta que Waldy corra `docs/pruebas/cuadre.sql`
  en el SQL Editor** y lo compare con `linea-base-antes.md`.
- **Exportaciones de los reportes** (el 607 exporta archivo): solo se midió la
  pantalla, no la descarga.

## Pendientes que necesitan decisión de Waldy

- **Datos `ZZTEST-*` quedan en la base** (~19.5 mil facturas de prueba y sus
  documentos relacionados). Solo se borran con su OK — el sistema no tiene
  borrado físico por diseño.
- **Junio 2020 quedó REABIERTO**: el test C6 lo cerró y lo reabrió al final;
  quedó en estado `abierto` como pedía el plan.
- Los errores 1 y 2 de la sección 3 son para Coder: el 1 es fiscal (606/607/608
  e IT-1 deben ir primero), el 2 es una línea por función.
