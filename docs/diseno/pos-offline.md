# POS sin internet (Punto 11)

## Decisiones aprobadas

- NCF opción A: guardar offline sin NCF; asignarlo exclusivamente en servidor al sincronizar.
- Fecha fiscal: día de sincronización en America/Santo_Domingo.
- Ticket offline: **Folio: POS-LOCAL-<UUID>**, título «Venta», sin NCF ni leyenda «Comprobante provisional».
- Inventario: descontar al sincronizar, respetando `vende_negativo`; un rechazo deja la venta fallida visible para reintentarla o descartarla con confirmación explícita del cajero.
- Service worker mínimo, no PWA completa.
- No se certifica cumplimiento DGII/e-CF con este trabajo. Firma, envío electrónico y contingencia fiscal siguen fuera de este alcance.

## Estado: implementado y probado contra la base de prueba

La cola real está habilitada. `src/lib/pos/transporte-offline.ts` llama
directamente `supabase.rpc("pos_sincronizar_operacion", { ... })` con el
`client_uuid` como idempotencia, sin guardar la RPC en variables ni usar casts.

Migraciones ya aplicadas en `ljfdhrnvlsfaweuvnqxz` (PR #122):

- `20261126120000_pos_offline_client_uuid.sql`: `client_uuid` en facturas y
  movimientos, índices únicos parciales, `pos_sync_operaciones` con RLS,
  y la RPC transaccional `pos_sincronizar_operacion`.
- `20261126121000_empresa_sucursal_regimen.sql`: campos de empresa (POS 10).

La respuesta de la RPC se valida con `esquemasRpcPOS`; el log muestra el
número y NCF confirmados por el servidor. Un error de red o 5xx se reintenta
con el mismo UUID; un rechazo de negocio (existencia, `vende_negativo`,
período, crédito) queda **fallido** y visible en la bandeja de «Ventas con
problema», con la venta completa conservada para reintentarla o descartarla.

## Persistencia y recuperación

Base `medoxigas-pos-offline`, versión 1:

| Store | Clave / contenido |
|---|---|
| `carritos` | usuario/terminal; pestañas, líneas y pestaña activa |
| `operaciones` | usuario/terminal/UUID; payload, snapshot, secuencia y estado |
| `catalogo` | usuario/terminal/lista; productos, unidades, precios y fecha |
| `contactos` | usuario/terminal; contactos cargados |
| `config` | configuración de venta y contador de secuencias |

- Los importes se conservan como textos decimales; no se inventan totales fiscales locales.
- El snapshot de venta incluye carrito, cliente, líneas, precios, tasas, empresa y plantilla del ticket.
- El guardado de una operación espera el COMMIT de IndexedDB antes de limpiar el carrito y confirmar.
- Al restaurar, un carrito que coincide con el snapshot de una operación ya guardada se limpia para no cobrarlo otra vez tras una interrupción.
- Web Locks serializa secuencias y sincronización. Un segundo editor del mismo usuario/terminal se bloquea para no sobrescribir carritos.
- Sin IndexedDB o Web Locks se muestra un error; no se confirma un cobro sin persistencia.
- Las ventas pendientes no se pueden borrar; solo una venta rechazada por el
  servidor se puede descartar, con diálogo de confirmación y sin dejar rastro
  contable. Limpiar el navegador o perder el equipo puede perder la cola:
  IndexedDB no es un respaldo externo.

## Conexión y cola

`OfflinePosProvider` vive en el layout del POS, aislado por UUID de usuario y terminal.

- `navigator.onLine` y eventos online/offline, más HEAD no cacheable al servidor cada 15 segundos, con timeout de 5 segundos.
- Estados online, offline, sincronizando y error en la barra inferior; abre el panel de sincronización.
- FIFO por secuencia persistida, una operación por vez. Un fallo de red frena
  las dependientes para no perder el orden; un rechazo de negocio marca la
  venta como fallida y la cola sigue con las demás.
- Red: backoff exponencial de 5 segundos a 10 minutos. Negocio: fallida, sin bucle automático.
- «Reintentar todo» y el reintento individual conservan UUID y payload. Sin
  conexión no se intenta enviar. Descartar una fallida pide confirmación.
- Las confirmaciones se conservan en el log local; no se borran al recibir respuesta.
- beforeunload solicita el aviso nativo con cobros pendientes. El navegador controla el texto del diálogo.
- El procesador funciona mientras el POS está abierto; no se promete sincronización con el navegador cerrado.

Un timeout de una venta enviada por la RPC online anterior NO se convierte
automáticamente en otra venta offline. Se mantiene el aviso de resultado incierto
y se exige revisar Historial, evitando un segundo cobro por cambio de conexión.

## Catálogo, precios y conflictos

- Se prepara el catálogo completo por lotes, no solo los primeros 50 productos.
- La caché se separa por lista de precios. Offline se filtra localmente por nombre, referencia, categoría y favoritos.
- Se indica si la preparación quedó parcial y la fecha de sus existencias; esas existencias no son actuales.
- Una lista no preparada muestra error en vez de inventar precios.
- Una venta cobrada conserva su snapshot; el reintento no toma nuevos precios del catálogo. El panel muestra «Cobrado: cliente · RD$total».
- Contacto/producto desactivado, período cerrado o falta de existencia: error visible, operación guardada para intervención administrativa.
- No se sustituyen clientes ni se fuerza inventario negativo automáticamente.
- Crédito y conversión de cotizaciones exigen conexión en esta implementación: no se valida crédito ni se convierte dos veces una cotización sin coordinación del servidor.
- El escáner y las consultas no cacheadas no se anuncian como disponibles offline.

## Service worker y privacidad

`public/pos-sw.js`, registrado desde el POS:

- Solo responde a GET de navegación exacta `/pos` y assets `/_next/static/`.
- No cachea POST, Server Actions, respuestas RPC, dashboard, historial ni turnos.
- Prepara HTML y recursos online antes de marcar la recarga como disponible.
- Caché separada por usuario/terminal, expira en 8 horas; un cambio de ámbito invalida la anterior.
- Cerrar sesión limpia la caché de páginas del POS, también desde el menú de Contabilidad, pero no borra los cobros de IndexedDB.
- No guarda claves en la cola. El contenido comercial local no está cifrado: usar solo equipos confiables.
- No habilita un login nuevo offline. Otras rutas del POS siguen requiriendo servidor.

## Cierre

- La barra inferior impide navegar al cierre sin conexión o con ventas por
  subir y explica «Conéctate para subir N ventas antes de cerrar».
- Las ventas con problema **no bloquean** el cierre: el diálogo de cierre muestra
  el aviso ámbar «N ventas con problema no subirán» y el cierre se completa; el
  cuadre solo incluye lo sincronizado.
- El panel de sincronización separa «por subir» de «con problema» y permite
  reintentar o descartar cada fallida.
- El diálogo de cierre vuelve a consultar IndexedDB antes de llamar a la RPC y comparte Web Lock con la cola.
- El cuadre de servidor incluye únicamente documentos ya sincronizados.
- Límite: la RPC actual no puede conocer operaciones que otro dispositivo nunca le envió. No se presenta el control cliente como una garantía servidor entre equipos.

## Pruebas y evidencia

- Vitest: idempotencia con el mismo UUID tras perder respuesta, backoff, FIFO,
  error de negocio sin trancar la cola, reintento y descarte de fallidas,
  cierre sin bloqueo con aviso, snapshot estable, transporte directo de la RPC
  tipada y ticket sin NCF ni leyenda.
- Checklist de caja real en `docs/pruebas/checklist-offline-caja.md` (3 ventas
  offline, 1 rechazada, reintento/descarte y cierre con aviso).
- `tests/e2e/pos-offline-almacen.spec.ts`: IndexedDB real conserva operaciones y
  carritos tras recargar offline; dos pestañas serializan secuencias con Web Locks.
- `tests/e2e/pos-offline-ui.spec.ts` (**corrida real verde**, 22-11-2026): abre
  el POS con sesión ZZTEST, prepara la recarga, vende 3 con `context.setOffline(true)`,
  recarga offline, fuerza un fallo de red para ver el error/reintento, reconecta,
  sincroniza y comprueba:
  - exactamente 3 operaciones `sincronizada` en IndexedDB;
  - 3 NCF distintos: **B0200000020, B0200000021 y B0200000022**;
  - las 3 facturas en `/pos/historial`;
  - el cuadre del turno sube 3 ventas y RD$336.30 (3 × RD$112.10).
- Las corridas de depuración anteriores dejaron en la base de prueba las
  facturas ZZTEST NCF 8–19; no se borraron datos sin autorización.
- Capturas en `docs/diseno/capturas/pos-11/`: offline pendientes, sincronizando,
  error/reintento, panel de sync, ticket con folio, cierre bloqueado, historial
  y cuadre. `panel-sync.png` y `cierre-bloqueado.png` se regeneraron con 3 ventas
  locales que no se sincronizaron, para no escribir ventas adicionales.
- Capturas de la bandeja de fallidas en
  `docs/diseno/capturas/pos-offline-fallidas/`: venta con problema, confirmación
  de descarte, modo oscuro y aviso de cierre con el botón habilitado (sembradas
  en IndexedDB, sin crear facturas).

## Limitaciones conocidas

- La sincronización corre solo con el POS abierto; no hay Background Sync.
- Si el navegador pierde IndexedDB o el equipo se daña, los pendientes se pierden: no es un respaldo.
- La primera recarga offline exige haber abierto el POS online y esperar «Recarga offline preparada». Si se corta la conexión durante esa preparación, se avisa.
- No se puede iniciar sesión offline ni abrir historial/turnos sin conexión (solo `/pos` está cacheado, por decisión de alcance mínimo).
- El cuadre entre dispositivos no puede ver operaciones que nunca llegaron al servidor.
