# POS sin internet (Punto 11) — plan

Objetivo: el cajero puede seguir cobrando con internet caído y las ventas suben
solas cuando vuelve la conexión, sin duplicar facturas ni romper el cuadre.

Estado actual (revisado en `feat/pos-alegra-exacto` @ `97b91e9`):

- El carrito vive solo en memoria (`carrito-pos-provider.tsx`); recargar pierde
  las pestañas. `beforeunload` ya avisa si hay líneas, nada más.
- Cobrar llama la server action `completarVenta` → RPC `pos_completar_venta`;
  el NCF se consume **en el mismo insert** de `facturas`
  (`v_ncf := prefijo || lpad(siguiente)`; `siguiente + 1` en el motor).
- No hay service worker, PWA ni IndexedDB. El catálogo, contactos, listas,
  numeraciones y turno se cargan en `page.tsx` (Server Component) y por lotes
  en `vender-pos.tsx` (`pos_catalogo_productos`).
- Sin app cargada offline no hay POS: **hace falta service worker** (Fase 2
  decide si es mínimo para `/pos` o PWA completo; aquí se diseña mínimo).

## 1. UX y detección de conexión

- Estado `online | offline | sincronizando | error` en un provider propio
  (`conexion-pos-provider`). Detección: `navigator.onLine` + eventos
  `online`/`offline` + **ping real** (`HEAD` a una ruta ligera `/api/pos/ping`
  cada 15 s mientras offline o con `navigator.onLine === false`).
- Aviso en la barra inferior (`barra-inferior-pos.tsx`), a la izquierda del
  estado del turno: punto de color + texto.
  - offline: «Sin conexión — N ventas pendientes de subir» (punto ámbar).
  - sincronizando: «Subiendo ventas… N restantes» (spinner).
  - error: «Error al subir — reintentar» (rojo, clic reintenta manual).
- `beforeunload`: además del aviso actual por líneas, bloquea si hay ventas
  cobradas sin subir (mensaje «Tienes N ventas sin subir»).
- Cobrar offline se siente igual: confirmación con folio provisional
  `POS-LOCAL-xxxx` y ticket impreso marcado «Comprobante provisional — pendiente
  de NCF» (ver §4).

## 2. IndexedDB (`idb` nativo, sin librería nueva, o `idb` si se justifica)

Base `pos-offline`, versión 1, stores:

| Store | Clave | Contenido |
|---|---|---|
| `carritos` | `pestana.id` | snapshot de cada `PestanaVenta` (persistir al recargar) |
| `ventas` | `client_uuid` (PK) | payload `VentaEntrada` completo + totales + `creado_en` |
| `movimientos` | `client_uuid` | payload de `registrarMovimientoTurno` offline |
| `catalogo` | `producto_id` | último `ProductoPOS` visto (nombre, precio, unidades, itbis) |
| `contactos` | `contacto_id` | contactos clientes |
| `config` | clave | turno abierto, terminal, numeraciones, listas, plantilla, `ultima_sync_catalogo` |

- `carritos` se hidrata al montar `CarritoPosProvider` (sobrevive recarga/cierre).
- `catalogo`/`contactos` se rellenan en cada carga online (fire-and-forget tras
  `getProductosPOS`/lotes); búsqueda offline filtra sobre `catalogo`.
- **Service worker mínimo**: cache-first de assets estáticos + network-first de
  las rutas `/pos*` con fallback a la última respuesta cacheada. Registrado
  solo en `src/app/(pos)/pos/layout.tsx`. Sin SW, recargar con internet caído
  mata la app; con SW, `/pos` abre y lee todo de IndexedDB.

## 3. Cola de sincronización

- Cada venta/movimiento offline lleva `client_uuid` (crypto.randomUUID) como
  clave de idempotencia; se envía en el payload al RPC.
- Worker de cola (módulo `src/lib/pos/cola-offline.ts` + `sync` en el provider):
  procesa en orden `creado_en`, uno a la vez; llamada `completarVenta` con
  `client_uuid`. Éxito → borrar del store y registrar en el log; error de red →
  backoff (5 s, 30 s, 2 min, tope 10 min); error de negocio (RPC rechaza) →
  marcar `estado: "fallida"` con el mensaje, no reintentar solo, visible en un
  panel «Pendientes» desde la barra inferior.
- Idempotencia (doble envío, reintento tras timeout): la migración añade
  `client_uuid text unique` a `facturas` y `pos_turno_movimientos`; la RPC
  devuelve la venta existente si el `client_uuid` ya existe (ON CONFLICT →
  select). Reintentar nunca duplica.
- Log de sync local (`config` + panel): últimas N operaciones con hora, folio
  provisional → número/NCF asignado o error.

## 4. NCF / numeración — decisión a aprobar

El NCF hoy se asigna al insertar la factura, dentro de la RPC. Opciones:

- **(A) Folio provisional, NCF al sincronizar.** Offline la venta se guarda con
  `POS-LOCAL-xxxx`; al subir, `pos_completar_venta` asigna el NCF real como
  hoy. Ticket impreso dice «Comprobante provisional». Riesgo DGII: bajo — el
  comprobante fiscal existe desde que se emite la factura real; la fecha/hora
  de emisión es la de sincronización. Huecos: ninguno (la serie no se salta).
- **(B) Bloque de NCF reservado por terminal.** Antes de irse offline la caja
  reserva N números (mueve `siguiente` de una vez y guarda el rango). Permite
  imprimir NCF real offline. Riesgo: **huecos en la serie** si el turno no usa
  todo el bloque (la DGII exige reportar comprobantes anulados/no usados), dos
  cajas con rangos cruzados si hay errores, y lógica extra de devolución de
  rango. Mucha más complejidad.
- **(C) Solo prefactura offline, sin venta fiscal.** Bloquea el cobro de
  comprobantes fiscales sin internet; solo permite «venta simple»/prefactura
  sin NCF. Riesgo: bajo fiscalmente, pero el cliente con NCF se va sin
  comprobante hasta que vuelva internet — Waldy vende mucho al detalle con
  comprobante; puede frenar la caja.

**Recomendación: (A).** Es la opción estándar en RD, no toca la lógica de
numeraciones, cero huecos, y el cambio es mínimo: la RPC ya asigna NCF al
insert. Lo que NO se puede inventar: un NCF que no venga de la serie
autorizada de `numeraciones` — por eso offline nunca se imprime NCF, solo
folio provisional, y el ticket real se reimprime tras sincronizar si el
cliente lo pide.

Datos/tablas necesarios: solo `client_uuid` (§3); la numeración no cambia.
Pendiente de Waldy: confirmar con su contador que «fecha de emisión = fecha de
sincronización» es aceptable, o exigir (C) para comprobantes fiscales.

## 5. Inventario

- El descuento de existencias ocurre al sincronizar, dentro de
  `pos_completar_venta` (ya lo hace la RPC al crear la factura).
- Si al subir el producto no tiene existencia: la RPC respeta `vende_negativo`
  del producto; si no permite negativos, la venta **ya cobrada no se bloquea**:
  queda `fallida` con mensaje claro y aparece en el panel para que el admin
  decida (habilitar negativo, ajustar stock y reintentar). El log muestra el
  faltante.
- El catálogo cacheado muestra existencia de la última sync con sello
  «existencia de hace X min»; se permite vender aunque el cache diga 0 (la
  decisión real la toma el servidor).

## 6. Cierre de turno

- Regla: **no se cierra un turno con cola pendiente**. En `pos/turnos`, botón
  cerrar deshabilitado si `offline` o `pendientes > 0`, con mensaje
  «Conéctate para subir N ventas antes de cerrar».
- Defensa en servidor: `pos_cerrar_turno` ya cuadra solo con lo insertado; la
  garantía real es la UI + el hecho de que una venta no sincronizada no existe
  en la base, así que el cuadre jamás la incluye. Si Waldy lo quiere más
  duro: RPC `pos_turno_pendientes` no aplica (los pendientes viven en el
  navegador); basta bloquear en cliente.

## 7. Conflictos

- Precio o lista cambiados mientras offline: **la venta conserva lo cobrado**
  (snapshot de líneas, precios e ITBIS en `ventas`); se sube tal cual — el
  dinero cobrado manda.
- Cliente desactivado/borrado: la RPC rechaza; venta `fallida` con error en el
  panel, reasignar contacto de mostrador y reintentar (edición del payload en
  cola).
- Log visible: pestaña/panel «Sincronización» con cada venta subida
  (folio → número/NCF/hora) y cada error con su motivo.

## 8. Base de datos — migración SOLO aditiva (no aplicar aún)

```sql
alter table public.facturas
  add column if not exists client_uuid text;
create unique index if not exists facturas_client_uuid_key
  on public.facturas (client_uuid) where client_uuid is not null;

alter table public.pos_turno_movimientos
  add column if not exists client_uuid text;
create unique index if not exists pos_turno_movimientos_client_uuid_key
  on public.pos_turno_movimientos (client_uuid) where client_uuid is not null;
```

Cambio en RPC (misma migración o siguiente): `pos_completar_venta` y
`pos_registrar_movimiento_turno` aceptan `p->>'client_uuid'`; si existe fila
con ese uuid devuelven el resultado existente (idempotente).
Probar en `BEGIN/ROLLBACK` en `ljfdhrnvlsfaweuvnqxz` (solo inspección, sin
service_role): índice único, insert duplicado → 1 fila, y pgTAP
`pos_offline_client_uuid_test.sql`. Regenerar `pnpm db:types`.

## 9. Pruebas y evidencia

- Unitarios (`src/lib/pos/cola-offline.test.ts`): reintentar no duplica
  (mismo `client_uuid`), orden FIFO, backoff, error de negocio marca `fallida`.
- Playwright `context.setOffline(true)`: vender 3, recargar (pestañas y
  pendientes persisten), reconectar → exactamente 3 ventas en `/pos/historial`
  con 3 NCF distintos y el cuadre del turno correcto; cierre bloqueado
  offline con su mensaje. Capturas de cada estado (regla MSG-11): offline con
  pendientes, sincronizando, error/reintento, panel de sync.
- Datos de prueba: la cuenta ZZTEST del preview; nada se borra sin OK.

## 10. Decisiones que necesitan a Waldy

1. **NCF: confirmar opción (A)** (folio provisional → NCF al subir) o exigir
   (C) para fiscales. Recomiendo (A).
2. ¿Permitir venta en negativo automática al sincronizar o marcar `fallida`
   siempre? (Recomiendo respetar `vende_negativo` y `fallida` si no permite.)
3. ¿Service worker mínimo solo para `/pos` o PWA completo (manifest, icono)?
   Recomiendo mínimo.
4. Ticket offline: ¿imprimir con leyenda «Comprobante provisional» sí o no?
