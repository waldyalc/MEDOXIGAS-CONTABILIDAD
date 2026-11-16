# Por qué tardan las listas — diagnóstico de lentitud (solo lectura de código)

Investigación del subagente «Por qué tardan las listas». No se cambió ningún archivo de la app.

## Antes de leer los números (importante)

La medición de `ui-log.txt` se hizo contra un **`next dev` de otra rama** (el worktree `feat-inicio-diseno-alegra` que tenía ocupado el puerto 3001; ver `docs/pruebas/ESTADO-DEVIN.md`). En modo desarrollo Next.js es bastante más lento que en producción: compila rutas sobre la marcha y renderiza React sin optimizar. Los **tiempos absolutos están inflados**; lo que sí es válido es el **orden** de lentitud y las causas de código, porque el código de consultas es **idéntico** en ambas ramas (verificado con `git diff HEAD feat/inicio-diseno-alegra` sobre `src/lib/**` y las páginas: solo difieren los componentes del inicio y el menú). Pendiente del plan: repetir la medición en el puerto **3005** con `pnpm build && pnpm start` para tener números de producción.

Volumen de datos de la prueba (`docs/pruebas/resultados/carga-log.txt`): ~15,000 facturas, 5,000 compras, ~7,000 pagos a proveedor, ~7,000 pagos recibidos, 500 notas de crédito, 1,000 contactos ZZTEST + ~300 reales, 300 productos ZZTEST. Además Supabase/PostgREST **corta toda consulta sin paginar en 1,000 filas** (confirmado en `carga.json` → `cuadreMarzo2023.filasLecturaSinPaginar: 1000`).

## Tabla resumen

| Pantalla | Tiempo medido | Causa probable | Evidencia (archivo:línea) | Arreglo propuesto |
|---|---|---|---|---|
| `/dashboard/compras` | 26–38 s | **Sin límite**: trae hasta 1,000 compras (tope de Supabase) y las dibuja todas en el servidor; es la tabla más grande de la app | `src/lib/compras/consultas.ts:29-42` (`listarFacturasProveedor`, sin `.limit()`) | `.limit(300)` ya (igual que facturas); después paginación real en servidor |
| `/dashboard/facturacion` | 8.7–13.6 s | Consulta rápida (límite 300 + índice único en `numero`), pero renderiza 300 filas y hace 2 viajes a Supabase | `src/lib/facturacion/consultas.ts:122-141` | Paginación/búsqueda en servidor; índice ya existe |
| `/dashboard/pagos-recibidos` | 8–10 s | 300 pagos + **3 consultas extra** en una segunda ronda | `src/lib/pagos/consultas.ts:68-139` | Un solo `select` con relaciones embebidas (patrón `src/lib/pagos/detalle.ts:66`) |
| Ficha de factura (1.ª vez ~11 s, luego ~2–3 s) | ~11 s → ~2–3 s | ~3 rondas de consultas a Supabase en serie; la 1.ª incluye compilación en dev | `src/lib/facturacion/consultas.ts:189-316`; `src/app/(main)/dashboard/facturacion/[id]/page.tsx:11-15` | Lanzar en paralelo las consultas que no dependen de la factura (impuestos, empresa, plantilla) |
| Ficha de compra (1.ª vez ~12 s, luego ~2 s) | ~12 s → ~2 s | **~5 rondas secuenciales** — la ficha con más viajes | `src/lib/compras/consultas.ts:44-149`; `src/app/(main)/dashboard/compras/[id]/page.tsx:47-51,76-79` | Unir asiento + líneas en una consulta; paralelizar opciones de pago |
| Ficha de cliente (`/contactos/[id]`) | sin medir (log truncado) | **12 consultas sin límite** por contacto; `asientos.in(...)` puede llevar miles de ids en la URL; todo se serializa a un componente cliente | `src/lib/contactos/ficha-consultas.ts:160-330`; `src/app/(main)/dashboard/contactos/[id]/_components/ficha-contacto.tsx:1` | Cargar por pestaña o con límite; consulta de asientos con join en vez de `.in()` gigante |
| Estado de cuenta (`/contactos/[id]/estado-cuenta`) | sin medir | Facturas + pagos + aplicaciones **sin límite**; el filtro de fecha se aplica en JS después de traer todo; ~4 rondas | `src/lib/contactos/estado-cuenta-consultas.ts:17-83`; `src/lib/contactos/estado-cuenta.ts:122-163`; `page.tsx:47-51` | Filtrar por fecha en SQL; paginar; paralelizar rol y datos |
| Ficha de producto | sin medir | 4 consultas de líneas **sin límite** + `.in("id", …)` con todos los documentos del producto (×4) | `src/lib/productos/ficha-consultas.ts:253-375` | Límites por pestaña; traer documentos con join `!inner` en vez de `.in()` |
| `/dashboard/contactos` | sin medir | Hasta 1,000 contactos (de ~1,300) serializados al navegador; búsqueda y filtro **en el cliente** | `src/lib/contactos/consultas.ts:8-13`; `contactos-cliente.tsx:206` (`filtrarContactos`) | Búsqueda y paginación en servidor |
| `/dashboard/productos` | sin medir | Todos los productos + una 2.ª consulta de precios; filtro en cliente | `src/lib/productos/consultas.ts:9-35`; `productos-cliente.tsx:409` | Ídem; precios como relación embebida en el mismo `select` |
| `/dashboard` (inicio) | 1.5–2.5 s | **Ya es el patrón bueno**: 1 RPC que agrega todo en SQL + `cache()` por request | `src/lib/inicio/consultas.ts:47-57`; `supabase/migrations/20261116100000_dashboard_resumen.sql` | Nada que cambiar; **copiar este patrón** en las demás pantallas |
| `/dashboard/contabilidad` | sin medir | Balance de comprobación de **toda la historia** (desde 1900) en cada visita: recorre todas las `asiento_lineas` | `src/lib/reportes/consultas.ts:69-99`; RPC en `supabase/migrations/20261113140000_motor_contable.sql:1978-2009` | RPC liviana de saldos del catálogo o cachear el resultado |

## Las 4 causas de fondo

### 1. Ninguna lista pagina en el servidor: todas traen "todo lo que quepa" (hasta 1,000 filas)

PostgREST corta en 1,000 filas cualquier consulta sin paginar (evidencia: `carga.json` → `filasLecturaSinPaginar: 1000`). Varias listas **ni siquiera ponen `.limit()`**, así que devuelven el máximo posible y la página las dibuja todas:

- `listarFacturasProveedor` — `src/lib/compras/consultas.ts:29-42`: sin `.limit()`. Con 5,000 compras devuelve 1,000 filas con join a `contactos`. Es la causa principal de que compras sea ~3× más lenta que facturas (1,000 vs 300 filas renderizadas).
- `listarPagosProveedor` — `src/lib/compras/consultas.ts:151-183`: sin `.limit()` + consulta extra de aplicaciones con `.in()` de hasta 1,000 ids (líneas 164-173). Alimenta `/dashboard/compras/pagos`.
- `listarContactos` — `src/lib/contactos/consultas.ts:8-13`: sin `.limit()`; hay ~1,300 contactos → se trunca en 1,000 y se manda **todo** a un componente cliente que filtra en el navegador (`contactos-cliente.tsx:206`).
- `listarProductos` — `src/lib/productos/consultas.ts:9-35`: sin `.limit()` + 2.ª consulta `producto_precios.in(...)` con todos los ids.
- En cambio facturas (`consultas.ts:132`), pagos recibidos (`src/lib/pagos/consultas.ts:74`) y la mayoría de listados nuevos sí tienen `.limit(300)` — pero **ninguna lista pagina de verdad**: no hay búsqueda ni "página 2" en el servidor en ninguna pantalla (el registro `src/lib/data-table-features.ts` de TanStack Table existe pero **no se usa en ninguna página**).

**Arreglo:** (a) inmediato — poner `.limit(300)` en las 4 consultas de arriba; (b) real — paginación en servidor con `?page=`/`?buscar=` y `.range()`/`ilike`, o botón "cargar más". Para leer datasets completos por lotes ya existe el patrón `.range(inicio, inicio+LOTE-1)` en `src/lib/reportes/ventas/v1/consultas.ts:34-52` (y v2 en `src/lib/reportes/ventas/v2/consultas.ts:46-65`), pero eso sirve para **leer todo**, no para paginar la tabla; la paginación de UI hay que construirla (o usar el registro TanStack que ya está preparado).

### 2. Cada pantalla encadena varios "viajes" a Supabase en serie

Cada `await createClient()` + `.from()/.rpc()` es **un request HTTPS** a Supabase (nube, ca-central-1). Las páginas encadenan rondas: mientras una consulta no vuelve, la siguiente no sale. Con latencia de red de ~100–400 ms por viaje, cada ronda extra se nota.

Rondas aproximadas por pantalla (cada `Promise.all` = 1 ronda):

- **Inicio**: ~2 rondas (perfil + `dashboard_resumen`/`saldos_caja_banco` en paralelo) → 1.5–2.5 s. ✅ el mejor.
- **Listas**: ~2–3 rondas. Facturas: perfil + 1 consulta. Pagos: perfil + pagos + 3 consultas de apoyo.
- **Ficha de factura**: ~3 rondas — primero la factura sola (`consultas.ts:193-200`), luego 10 consultas en `Promise.all` (`consultas.ts:205-265`), de las cuales `getAsiento` hace 2 más (`consultas.ts:152-187`).
- **Ficha de compra**: **~5 rondas** — factura (`compras/consultas.ts:46-55`) → 3 en paralelo (líneas/pagos/aplicaciones, `:57-91`) → asiento (`:121-125`) → líneas del asiento (`:133-138`, espera al asiento) → opciones de pago (`page.tsx:76-79` → `consultas.ts:241-254` + `configuracion/consultas.ts:26`). La peor ficha.
- **Ficha de contacto**: ~3 rondas — 12 consultas en paralelo (`ficha-consultas.ts:164-252`) → cuentas + asientos en paralelo (`:283-296`).
- **Estado de cuenta**: ~4 rondas y **en serie**: `getRol()` primero y solo después `obtenerEstadoCuentaContacto` (`page.tsx:47-51`), que internamente hace contacto → facturas+pagos → aplicaciones (`estado-cuenta-consultas.ts:20-51`). Rol y datos no dependen entre sí: podrían ir en `Promise.all`.
- **Ficha de producto**: ~5 rondas — producto → 5 en paralelo (`ficha-consultas.ts:269-293`) → `cargarConfiguracionFicha` **espera a que terminen** (`:313`, podría ir en el primer `Promise.all`) → 5 en paralelo (`:321-327`).

**Arreglo:** (a) embeber relaciones en el `select` principal en vez de consultas de apoyo — el repo ya lo hace bien en `src/lib/pagos/detalle.ts:66` (`contactos(...)`, `cuentas(...)`, `facturas(...)` en un solo viaje); (b) paralelizar todo lo que no depende del documento (impuestos, empresa, plantilla, configuración, rol); (c) unir `asientos` + `asiento_lineas` en una consulta con relación embebida; (d) a mediano plazo, mover las agregaciones a RPC — el inicio ya demuestra que es lo más rápido (`dashboard_resumen`).

### 3. Las fichas traen TODO lo relacionado sin límite, a veces con `.in()` de miles de ids

- **Ficha de contacto** (`ficha-consultas.ts:160-330`): 12 consultas, todas sin `.limit()` — facturas, compras, cotizaciones, remisiones, 3 tablas de notas, pagos recibidos, pagos a proveedor, **todas las `asiento_lineas` del contacto** (`:242-246`, filtra por `contacto_id` — hay índice `asiento_lineas_contacto_id_idx`, motor_contable.sql:357) y config. Después junta los `asiento_id` y pide `asientos.in(id, …)` (`:287-295`): para un cliente con muchos documentos eso son **miles de UUIDs en la URL** de una sola consulta (PostgREST tiene límite de largo de URL → puede fallar o ir muy lento). Además `FichaContacto` es `"use client"` (`ficha-contacto.tsx:1`): **todo** eso se serializa al navegador.
- **Ficha de producto** (`ficha-consultas.ts:253-375`): trae TODAS las líneas de venta/compra/cotización/remisión del producto (`:269-293`, sin límite) y luego 4 consultas `.in("id", ids)` con todos los documentos que lo contienen (`:94-166`, `:321-327`). Un producto vendido en miles de facturas = miles de ids por URL + payload grande + `construirKardex` en JS sobre todo.
- **Estado de cuenta** (`estado-cuenta-consultas.ts:17-83`): facturas y pagos del contacto sin límite; `pago_recibido_aplicaciones.in(pago_id, …)` con todos los pagos del contacto (`:44-51`). El filtro por fecha de corte y tramo de antigüedad se aplica **en JavaScript después** de traer todo (`estado-cuenta.ts:131-152`), y `cobradoAlCorte` es O(facturas × pagos) aunque con caché por factura (`estado-cuenta.ts:103-120`) — mejorable agrupando pagos por factura una sola vez.
- **Ficha de factura** (`facturacion/consultas.ts:189-316`): ya está razonable — todo por `factura_id`/`id` con índices y en paralelo; las consultas son chicas. Solo le falta paralelizar lo independiente (ver causa 2).
- **Ficha de compra** (`compras/consultas.ts:44-149`): igual, todo por id — el problema son las rondas, no el volumen.

**Arreglo:** (a) en fichas de contacto/producto, cargar cada pestaña bajo demanda o con `.limit()` + "ver todas"; (b) reemplazar `asientos.in(miles de ids)` por un join: `asientos.select("..., asiento_lineas!inner(contacto_id)").eq("asiento_lineas.contacto_id", id)` — una consulta, sin `.in()`; (c) en estado de cuenta, filtrar `fecha <= corte` y saldo en la consulta SQL, no en JS; (d) si el volumen lo justifica, una RPC `ficha_contacto`/`ficha_producto` que devuelva solo lo necesario (patrón `dashboard_resumen`).

### 4. Índices: ya están bien — no es el problema principal

Verificado en migraciones: `facturas.numero`, `pagos_recibidos.numero`, `facturas_proveedor.numero` son `int unique` (motor_contable.sql:208, 249, 269) → los `ORDER BY numero` de las listas usan índice. La migración `20261115900000_indices_rendimiento.sql` ya cubre `contacto_id+fecha`, `fecha+numero`, `estado+vencimiento`, `nombre` en contactos/productos y `asiento_lineas(asiento_id, cuenta_id)`. Las consultas de ficha filtran por columnas indexadas. **Los índices no explican la lentitud**; lo que falta es traer menos filas y hacer menos viajes.

Lo que sí conviene revisar como índice menor: `facturas(estado, vencimiento)` para `getFacturasAbiertas` (`src/lib/pagos/consultas.ts:9-22`, hoy usa `estado` + orden por `vencimiento,numero` con índices parciales) y `facturas_proveedor(estado, vencimiento)` ya existe (`indices_rendimiento.sql:40-41`).

## Detalle por pantalla

### `/dashboard/facturacion` (lista) — 8.7–13.6 s

- Datos: `getFacturasLista` (`src/lib/facturacion/consultas.ts:122-141`) — un solo `select` con `contactos(nombre)` embebido, `ORDER BY numero DESC LIMIT 300`. `numero` es único indexado → la consulta en sí es de milisegundos.
- Viajes: `getPerfil` (claims + `perfiles`, `src/lib/auth/rol.ts:17-31`, con `cache()`) + la consulta de facturas ≈ 2 rondas. La página además llama `getRol()` dos veces pero `cache()` lo deduplica (`facturacion/page.tsx:17,30`).
- Render: `FacturasTabla` es Server Component puro (`facturas-tabla.tsx`) — sin JavaScript de cliente por fila; ~300 filas × 9 celdas con `Enlace` (que es solo un `Link` de servidor, `src/components/enlace.tsx`).
- Conclusión: la consulta está bien; el tiempo es mayormente **render SSR de 300 filas + 2 viajes** en dev. En producción debería bajar bastante; para la meta p95 < 2 s hace falta **paginación/búsqueda en servidor** (hoy no hay forma de ver la factura 301 en adelante).

### `/dashboard/compras` — 26–38 s (la peor)

- Datos: `listarFacturasProveedor` (`src/lib/compras/consultas.ts:29-42`) — **sin `.limit()`** → hasta 1,000 filas (PostgREST corta) de las 5,000+ compras, con `contactos(nombre)` embebido. Orden `fecha desc, numero desc` cubierto por `facturas_proveedor_fecha_numero_idx` (`indices_rendimiento.sql:28-29`).
- Render: tabla de ~9 columnas con 2–3 `Enlace` por fila → ~1,000 filas ≈ 3× el trabajo de facturas. La proporción de tiempos (compras ≈ 3× facturas) cuadra con el volumen de filas.
- La misma función sin límite alimenta también el selector de "facturas abiertas" del formulario de pagos (`consultas.ts:278-285`, `.eq("estado","abierta")` sin límite → hasta 1,000).
- **Arreglo:** `.limit(300)` ya (una línea) — es el cambio con más impacto de todo el informe. Después paginación real.

### `/dashboard/pagos-recibidos` — 8–10 s

- Datos: `getPagosLista` (`src/lib/pagos/consultas.ts:68-139`) — `pagos_recibidos` con `.limit(300)` y `ORDER BY numero` (único indexado) ✅; pero luego **3 consultas de apoyo**: contactos `.in()`, facturas `.in()`, aplicaciones `.in()` (`:90-116`) → 2 rondas en total.
- **Arreglo:** traer `contactos(nombre)` y `facturas(numero, ncf)` como relaciones embebidas en el `select` principal (mismo patrón que `obtenerPagoRecibido`, `src/lib/pagos/detalle.ts:66`) y resolver el conteo de aplicaciones con un join o RPC → baja a 1 ronda.

### `/dashboard/contactos` — sin medir (log truncado)

- `listarContactos` (`src/lib/contactos/consultas.ts:8-13`) sin límite → ~1,000 de 1,300 contactos; `ContactosCliente` es `"use client"` → serializa todo y filtra en el navegador (`contactos-cliente.tsx:206`, `filtrarContactos` en `src/lib/contactos/contactos.ts`).
- **Arreglo:** búsqueda con `?buscar=` → `.ilite("nombre", …)`/`.or()` en servidor + paginación; el índice `contactos_nombre_idx` ya existe (`indices_rendimiento.sql:52`).

### `/dashboard/productos` — sin medir

- `listarProductos` (`src/lib/productos/consultas.ts:9-35`) sin límite + 2.ª consulta `producto_precios.in(producto_id, …)` con todos los ids (`:17-23`) → 2 rondas y una URL larga; filtro en cliente (`productos-cliente.tsx:409`).
- **Arreglo:** embeber `producto_precios(lista_id, precio)` en el `select` de productos (1 viaje) + búsqueda/paginación en servidor.

### Ficha de factura `/dashboard/facturacion/[id]` — ~11 s la 1.ª, ~2–3 s después

- `getFacturaVista` (`src/lib/facturacion/consultas.ts:189-316`): 1 consulta de la factura → `Promise.all` de 10 (líneas, contacto, empresa, impuestos, asiento+sus líneas, numeraciones, pagos, aplicaciones, notas NC y ND). ~3 rondas; todo por id con índices — el volumen es chico.
- La página además pide `getPlantillaImpresion` en paralelo (`facturacion/[id]/page.tsx:11-15`) ✅.
- **Arreglo:** `getImpuestosActivos()`, `getEmpresa()` y la plantilla **no dependen de la factura** — hoy esperan dentro del segundo `Promise.all`; lanzarlas junto con la consulta de la factura ahorra ~1 ronda (~300–800 ms). `getImpuestosActivos` (`src/lib/impuestos/consultas.ts:17-28`) no usa `cache()` y se pide en varias pantallas — envolverla en `cache()` como ya hacen `getEmpresa` (`consultas.ts:35`) y `getPlantillasImpresion` (`plantillas-impresion/consultas.ts:9`).

### Ficha de compra `/dashboard/compras/[id]` — ~12 s la 1.ª, ~2 s después

- `obtenerFacturaProveedor` (`src/lib/compras/consultas.ts:44-149`): factura → 3 en paralelo → asiento → líneas del asiento (espera al anterior) = **4 rondas**; la página suma `cargarCuentasCajaBanco` + `getRetencionesActivas` en una 5.ª (`compras/[id]/page.tsx:47-51,76-79`).
- **Arreglo:** (a) traer `asientos(..., asiento_lineas(...))` en una sola consulta cuando `asiento_id` existe — ahorra 1 ronda; (b) las cuentas de caja/banco y retenciones son catálogos chicos e independientes del detalle — pedirlas en el primer `Promise.all` de la página o cachearlas con `cache()`.

### Ficha de cliente `/dashboard/contactos/[id]` — sin medir

- `obtenerFichaContacto` (`src/lib/contactos/ficha-consultas.ts:160-330`): ver causa 3 — es la pantalla con más consultas (14) y las únicas sin límite por completo; el riesgo real aparece con clientes de muchos documentos (`.in()` gigante + serialización total a cliente).
- **Arreglo:** prioridad alta por escala aunque no se haya medido lenta con el cliente de prueba (~19 facturas): paginar por pestaña, join para asientos, y evaluar RPC.

### Estado de cuenta `/dashboard/contactos/[id]/estado-cuenta` — sin medir

- `obtenerEstadoCuentaContacto` (`src/lib/contactos/estado-cuenta-consultas.ts:17-83`): ~4 rondas en serie y todo sin límite; el cálculo del estado de cuenta (`estado-cuenta.ts:122-163`) filtra por fecha **después** de traer todas las facturas.
- **Arreglo:** `Promise.all([getRol(), obtenerEstadoCuentaContacto(id)])` en `page.tsx:47-51`; meter `fecha <= corte` en el `select` de facturas; traer solo columnas necesarias; paginar la tabla resultante.

### Ficha de producto `/dashboard/productos/[id]` — sin medir

- `obtenerFichaProducto` (`src/lib/productos/ficha-consultas.ts:253-375`): ~5 rondas; `cargarConfiguracionFicha` (`:83-92`) es independiente y hoy espera al primer `Promise.all` (`:313`) — moverla ahí ahorra 1 ronda; los `.in("id", …)` con todos los documentos del producto escalan mal.
- **Arreglo:** paralelizar configuración; límites por pestaña; a mediano plazo RPC o joins `!inner`.

### `/dashboard` (inicio) — 1.5–2.5 s ✅

- `obtenerResumenNegocio` (`src/lib/inicio/consultas.ts:51-57`) llama **una sola RPC** `dashboard_resumen` que hace toda la agregación en SQL (`supabase/migrations/20261116100000_dashboard_resumen.sql`) y `cache()` la comparte entre los 3 bloques Suspense; `AvisoSaldoNegativo` usa otra RPC chica (`src/lib/reportes/saldos.ts` → `saldos_caja_banco`). ~2 rondas totales.
- **Es el patrón a copiar**: una función SQL/RPC que devuelva el resumen ya calculado, en vez de traer filas y sumar en JS.

### `/dashboard/contabilidad` — sin medir (está en la lista del script)

- `obtenerCatalogoContable` (`src/lib/reportes/consultas.ts:69-99`) pide en paralelo cuentas + config + **`reporte_balance_comprobacion` con `p_desde: "1900-01-01"`** (`:77`) → la RPC recorre `asientos ⋈ asiento_lineas ⋈ cuentas` de **toda la historia** (~30k asientos, >100k líneas) en cada visita (`motor_contable.sql:1978-2009`).
- **Arreglo:** RPC dedicada y más liviana para saldos del catálogo (solo cuentas que aceptan movimientos, o saldos precalculados/cacheados por request), o quitar el balance de esta pantalla y pedirlo solo donde se usa.

## Otros puntos menores

- `getFacturasAbiertas` (`src/lib/pagos/consultas.ts:9-22`) y `cargarOpcionesPago` (`src/lib/compras/consultas.ts:278-285`) cargan "facturas abiertas" con `.limit(300)`/sin límite para formularios — revisar el mismo tratamiento al tocar esas pantallas.
- `obtenerVentas` fiscal (`src/lib/reportes/fiscales/consultas.ts:225-261`) ya es hallazgo conocido (corta en 1,000 filas — lo cubre otro subagente); desde el punto de vista de lentitud además hace `.in("factura_id", ids)` con hasta 1,000 ids **dos veces** (`:249-261`) — mismas recomendaciones: paginar en servidor y, si se queda leyendo por lotes, hacer los `.in()` por tandas.
- `getImpuestosActivos`, `getRetencionesActivas`, `getCentrosCostoActivos` no usan `cache()` de React; se llaman desde varias pantelas/cadenas — envolverlas en `cache()` evita viajes repetidos dentro de la misma request.
- Cada página paga `getPerfil` (1–2 viajes: claims + `perfiles`) — ya está bien con `cache()` (`src/lib/auth/rol.ts:17-31`); el layout solo lee cookies para preferencias (`dashboard/layout.tsx:16-22`), no es cuello de botella.

## Ranking: mayor impacto primero

1. **Compras: `.limit(300)` en `listarFacturasProveedor`** (`src/lib/compras/consultas.ts:29-38`) — una línea; la pantalla más lenta (26–38 s) baja ~3× al instante. Ídem `listarPagosProveedor` (`:151-183`) y `listarContactos`/`listarProductos`.
2. **Reducir rondas en las fichas** — ficha de compra (~5 rondas → ~3): unir asiento+líneas y paralelizar opciones (`compras/consultas.ts:121-148`, `compras/[id]/page.tsx:76-79`); ficha de producto: mover `cargarConfiguracionFicha` al primer `Promise.all` (`productos/ficha-consultas.ts:269-293,313`); estado de cuenta: `Promise.all` rol+datos y filtro de fecha en SQL (`estado-cuenta/page.tsx:47-51`, `estado-cuenta-consultas.ts:24-51`); ficha de factura: lanzar impuestos/empresa/plantilla en paralelo con la factura (`facturacion/consultas.ts:205-265`).
3. **Fichas de contacto/producto y estado de cuenta: límites + fin del `.in()` gigante** — hoy escalan mal con clientes/productos de muchos documentos; join `!inner` para asientos y cargar por pestaña (`contactos/ficha-consultas.ts:160-330`, `productos/ficha-consultas.ts:253-375`, `contactos/estado-cuenta-consultas.ts:17-83`).
4. **Paginación y búsqueda en servidor en las listas** — ninguna lista puede pasar de la fila 300/1,000 hoy; es requisito de la meta p95 < 2 s con datos reales. Patrón de lectura por lotes: `reportes/ventas/v1/consultas.ts:34-52`.
5. **Mover agregaciones a RPC** (patrón `dashboard_resumen` → `src/lib/inicio/consultas.ts:51-57` + migración `20261116100000`) para lo que siga pesado: catálogo contable (`reportes/consultas.ts:77`), y evaluar RPC para fichas si el volumen lo pide.
6. **Re-medir en producción** (`pnpm build` + `pnpm start -p 3005`, `UI_BASE=http://localhost:3005 npx tsx tests/carga/ui.ts`) antes y después de los arreglos — los números de `ui-log.txt` vienen de un `next dev` ajeno y están inflados.
