# Instrucciones: pruebas de carga, concurrencia y cuadre

Eres el agente que **ejecuta** estas pruebas. Sigue los pasos al pie de la letra.
Si algo no está claro o falla de una forma que no está prevista aquí, **para y
escríbelo en el informe**: no inventes atajos ni cambies el plan.

Lee antes `AGENTS.md` (reglas del repo). Este archivo manda sobre cualquier
otra idea que tengas.

## 0. Reglas que no se rompen

1. La base de Supabase es la **real** del sistema (`ljfdhrnvlsfaweuvnqxz`). Hoy
   no tiene datos reales de clientes, pero trátala con cuidado.
2. **Todo dato que crees lleva el prefijo `ZZTEST-`** en el nombre (contactos,
   productos) o en las notas/descripción (documentos).
3. **Nunca borres nada.** Ni con `delete`, ni con `truncate`, ni con SQL. Si un
   documento sobra, se deja. La limpieza la decide Waldy después.
4. **Nunca uses la clave `service_role`** ni la busques. Solo la clave pública
   (`NEXT_PUBLIC_SUPABASE_ANON_KEY` de `.env.local`) y los 5 usuarios de prueba.
5. **Nunca imprimas, copies ni escribas en un archivo** el contenido de
   `.env.local` ni de `.env.pruebas` (contraseñas, claves). Léelos solo desde el
   código.
6. **No cambies código de la app, migraciones, políticas RLS ni la base** (nada
   de `apply_migration`, `db push`, `--linked`). Solo escribes scripts nuevos en
   `tests/carga/` y archivos de resultados en `docs/pruebas/resultados/`.
7. Si encuentras un bug, **anótalo con la evidencia** (mensaje de error, datos de
   entrada, id del documento). **No lo arregles.**
8. **Límite de volumen** (plan gratis de 500 MB): no pases de las cantidades de
   la sección 2. Si una llamada responde algo como `read-only`, `disk`, `quota`
   o `exceeded`, **para todo de inmediato** y repórtalo.
9. No uses el puerto 3000 (es de Waldy). Si levantas la app, usa el **3001**.
10. Trabaja en una rama nueva `test/pruebas-carga` creada desde `origin/prueba`.
    Haz commits chicos de los scripts y resultados. **No hagas push, no fusiones,
    nunca `--no-verify`.**

## 1. Preparación

1. `git fetch origin && git switch -c test/pruebas-carga origin/prueba`
2. Comprueba que existen `.env.local` y `.env.pruebas` en la raíz (solo que
   existan; no los muestres). `.env.pruebas` trae `ZZTEST_USER_1..5` y
   `ZZTEST_PASS_1..5`. Si falta alguno, para y repórtalo.
3. `pnpm install` si hace falta.
4. Los scripts van en `tests/carga/` como **TypeScript ejecutado con `npx tsx`**
   (si `tsx` no está, usa `node` con `.mjs`; no agregues dependencias al
   `package.json`). Usa `@supabase/supabase-js`, que ya está instalado.
   - Un cliente por usuario: `createClient(url, anonKey, { auth: { persistSession: false } })`
     y `signInWithPassword` con cada usuario de `.env.pruebas`.
   - Todas las escrituras van **por las RPC del motor**, nunca con
     `insert`/`update` directo a tablas.
5. **La forma del JSON de cada RPC no la inventes**: cópiala de cómo la llama la
   app y de los tests pgTAP:
   - Contactos: `src/lib/contactos/actions.ts` → `crear_contacto`
   - Productos: `src/lib/productos/actions.ts` → `crear_producto`
   - Factura de venta (crédito y contado con pago dentro): `src/lib/facturacion/acciones.ts` → `crear_factura`
   - Pago recibido de varias facturas: `src/lib/pagos/acciones.ts` → `registrar_pago_recibido_multi(p_encabezado, p_aplicaciones)`
   - Compra: `src/lib/compras/acciones.ts` → `crear_factura_proveedor`; pago: `registrar_pago_proveedor_multi`
   - Nota de crédito de venta: `src/lib/notas-credito/acciones.ts` → `crear_nota_credito_venta`
   - Anular: `anular_documento(p_tipo, p_id)` (mira los tipos válidos en `supabase/tests/motor_anulacion_test.sql`)
   - Periodos: `src/lib/periodos/acciones.ts` → `cerrar_periodo(p_periodo)` / `reabrir_periodo(p_periodo)`
   - Ejemplos completos en `supabase/tests/motor_factura_test.sql`, `motor_pagos_test.sql`, `motor_compras_test.sql`, `pagos_multifactura_test.sql`, `notas_credito_venta_test.sql`.
6. Haz primero una **prueba de humo**: 1 contacto, 1 producto, 1 compra, 1
   factura a crédito, 1 pago, 1 factura de contado. Si alguna falla, arregla tu
   JSON (no la app) hasta que pase. Si no logras que pase en 3 intentos, para y
   repórtalo.

**Línea base:** Waldy ya corrió `docs/pruebas/cuadre.sql` antes de cargar
nada. El resultado está en `docs/pruebas/linea-base-antes.md` (no lo cambies).

## 2. Prueba 1: mucho volumen (¿se frisa con muchos datos?)

### 2.1 Datos a crear (todo con fechas **2021-01-01 a 2023-12-31**)

Usa las fechas viejas para no ensuciar el mes actual. Reparte el trabajo entre
los 5 usuarios en paralelo (un trabajador por usuario).

| Qué | Cantidad | Detalle |
|---|---|---|
| Contactos | 1,000 | `ZZTEST-Cliente-0001`…; 800 clientes y 200 proveedores. RNC falso de 9 dígitos que empiece por `9` |
| Productos | 300 | `ZZTEST-Producto-001`…; 250 inventariables con ITBIS 18 %, 50 servicios (25 exentos). Precio 100–5,000, costo ≈ 60 % del precio |
| Compras (facturas de proveedor) | 5,000 | 1–5 líneas de productos inventariables. Hazlas **antes** que las ventas de su mes para que haya stock. NCF de proveedor falso `B01` + 8 dígitos, únicos |
| Pagos a proveedores | 3,000 | Algunos con varias compras a la vez |
| Facturas de venta | 15,000 | 1–6 líneas. 70 % a crédito B01, 30 % de contado B02 (pago dentro de la factura) |
| **Mes pesado** | incluido en las 15,000 | **Marzo 2023 debe tener 1,500 facturas o más.** Es para ver si los reportes cortan en 1,000 filas |
| Pagos recibidos | 7,000 | 20 % pagan 2–4 facturas a la vez; 10 % con una retención; algunos abonos parciales |
| Notas de crédito de venta | 500 | Aplicadas a facturas con saldo suficiente |
| Anulaciones | 300 facturas | Solo facturas **sin pagos ni notas** |

Guarda en `docs/pruebas/resultados/carga.json`, por tipo de documento:
cuántos se crearon, cuántos fallaron, el error de cada fallo (agrupado por
mensaje) y el tiempo de cada RPC (p50, p95, máximo, en ms).

### 2.2 Medir la app con datos

1. `pnpm build` y luego `pnpm start -p 3001`.
2. Con Playwright (ya instalado; puedes inspirarte en `tests/e2e/smoke.spec.ts`)
   entra con `ZZTEST_USER_1` y abre **5 veces** cada pantalla. Mide el tiempo
   hasta que la tabla o los datos se ven (no solo el esqueleto):
   - Listados: facturas, compras, pagos recibidos, contactos, productos, catálogo de cuentas.
   - Fichas: una factura, un cliente con muchas facturas, un producto con mucho movimiento.
   - Reportes de **marzo 2023** y del **año 2023**: 607, 606, libro diario,
     balanza de comprobación, estado de resultados, CxC (corte 31/12/2023),
     ventas generales, ventas por cliente, valor de inventario.
   - Inicio (dashboard).
3. **Corte de 1,000 filas:** para el 607 y las ventas generales de marzo 2023,
   compara **cuántas facturas muestra o exporta el reporte** con el número real.
   El número real sácalo con
   `supabase.from('facturas').select('id', { count: 'exact', head: true })` con el
   mismo filtro de fechas y `estado <> anulada`. Anota los dos números y su
   total en RD$.
4. Guarda en `docs/pruebas/resultados/tiempos-ui.json` el p50, p95 y máximo de
   cada pantalla.

**Metas (para marcar pasa/no pasa):** listados y fichas p95 < 2 s; reportes p95
< 5 s; RPC de crear factura p95 < 1 s; conteo del reporte = conteo real.

## 3. Prueba 2: varios usuarios a la vez (¿se frisa con concurrencia?)

Cada escenario con los 5 usuarios lanzando **al mismo tiempo** (`Promise.all`).
Usa contactos y productos `ZZTEST-` nuevos para cada escenario y fechas de
**junio 2020**. Anota el resultado real contra el esperado.

| # | Escenario | Resultado esperado |
|---|---|---|
| C1 | Cada usuario crea 100 facturas B01 a crédito (500 en total, en paralelo) | 500 creadas, NCF todos distintos y **seguidos, sin huecos** entre el menor y el mayor |
| C2 | Una factura de RD$10,000. Los 5 usuarios intentan cobrarle RD$3,000 a la vez | Pasan **3** cobros, fallan 2 con error claro; `pagado` = 9,000 |
| C3 | Igual que C2 pero con pagos de varias facturas (`registrar_pago_recibido_multi`) sobre las mismas 2 facturas | Nunca se cobra más que el saldo de cada factura |
| C4 | Un producto con existencia 3. Los 5 usuarios venden 1 unidad a la vez | Anota qué pasa (el sistema hoy puede permitir negativo). La existencia final debe ser exactamente 3 − ventas creadas; `existencias` = `productos.cantidad` |
| C5 | Un usuario anula una factura mientras otro le registra un pago, a la vez (repetir 20 veces) | En cada intento gana uno solo: o queda anulada sin pago activo, o pagada sin anular. Nunca las dos |
| C6 | Un usuario cierra **junio 2020** (`cerrar_periodo('2020-06-01')`) mientras los otros 4 crean facturas con fecha de junio 2020 | Después del cierre no entra ninguna factura de ese mes. **Al final reabre junio 2020** (`reabrir_periodo`) y anota que quedó abierto |
| C7 | 4 usuarios crean facturas sin parar durante 2 minutos mientras el quinto abre los reportes pesados de 2023 una y otra vez | Las facturas siguen tardando p95 < 1 s; nada se cuelga ni da timeout |
| C8 | Con Playwright: 5 navegadores (uno por usuario) usan la app a la vez durante 3 minutos (abrir listados, fichas, crear una factura cada uno) | Ninguna pantalla tarda más de 5 s ni se queda en blanco; anota errores de consola |

Guarda en `docs/pruebas/resultados/concurrencia.json` cada escenario con:
esperado, real, pasa/no pasa, ids de los documentos y errores.

## 4. Prueba 3: que todo cuadre

1. Tú no puedes correr SQL. Al terminar las pruebas 1 y 2, escribe en el
   informe que **falta que Waldy corra otra vez** `docs/pruebas/cuadre.sql` en el
   SQL Editor y lo compare con `docs/pruebas/linea-base-antes.md`.
2. Cómo se lee:
   - Filas **A1–A7 (absoluto)**: deben dar **0**. Si la línea base ya daba
     distinto de 0, anótalo como hallazgo aparte.
   - Filas **D1–D5 (delta)**: `después − antes` debe ser **0.00**.
   - Fila **D6 (inventario)**: `después − antes` puede tener centavos por
     redondeo del costo promedio; anota el número exacto.
   - **I1–I2**: solo información (cuántas facturas `ZZTEST` y cuánto pesa la base).
3. Además, desde tu script, con los datos que tú mismo creaste: suma los totales
   de tus facturas de marzo 2023 y compáralos con el total que muestra el 607 y
   ventas generales de ese mes.

## 5. Informe final

Escribe `docs/pruebas/resultados/RESULTADOS.md`, corto y en español claro:

1. Tabla resumen: prueba, meta, resultado, **PASA / NO PASA**.
2. Lo que se frisó o fue lento (pantalla, tiempo, con cuántos datos).
3. Bugs encontrados: qué pasó, cómo repetirlo, evidencia (ids, mensajes).
4. Cifras: documentos creados, fallos, tamaño de la base antes y después.
5. Lo que no pudiste hacer y por qué.

No escribas contraseñas ni claves en ningún resultado. Haz commit de
`tests/carga/` y `docs/pruebas/resultados/` en tu rama y termina.
