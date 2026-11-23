# POS sin internet (Punto 11)

## Decisiones aprobadas

- NCF opción A: guardar offline sin NCF; asignarlo exclusivamente en servidor al sincronizar.
- Fecha fiscal: día de sincronización en America/Santo_Domingo.
- Ticket offline: **Folio: POS-LOCAL-<UUID>**, título «Venta», sin NCF ni leyenda «Comprobante provisional».
- Inventario: descontar al sincronizar, respetando `vende_negativo`; un rechazo deja la operación pendiente/fallida visible, nunca se descarta.
- Service worker mínimo, no PWA completa.
- No se certifica cumplimiento DGII/e-CF con este trabajo. Firma, envío electrónico y contingencia fiscal siguen fuera de este alcance.

## Estado de la fase 2

Implementados, pendientes de evidencia autenticada:

- IndexedDB, cola FIFO, backoff, snapshots, persistencia de carritos.
- Provider de conexión, panel de operaciones, beforeunload y bloqueo de cierre.
- Cobro y movimientos offline guardados antes de confirmar al cajero.
- Ticket térmico reutilizando `TicketPos` e `ImpresionPos`.
- Caché paginada de catálogo por lista, clientes y configuración.
- Service worker para recargar `/pos` y sus assets después de prepararlo online.

**NO está habilitado el envío real.** `src/lib/pos/transporte-offline.ts` expone
un contrato tipado y devuelve un error explícito de migración/tipos pendientes.
No llama una RPC alternativa ni finge confirmaciones. No desplegar como funcional
hasta conectar la RPC, verificar el flujo completo y entregar capturas.

Pendientes externos: validar SQL, generar tipos y proporcionar ruta concreta de
storageState ZZTEST fuera del repo. Se solicitó el archivo; la respuesta no
incluyó todavía la ruta. No se ejecutó SQL remoto ni se tocó el preview 3010.

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
- No hay botón de borrar pendientes. Limpiar el navegador o perder el equipo puede perderlos: IndexedDB no es un respaldo externo.

## Conexión y cola

`OfflinePosProvider` vive en el layout del POS, aislado por UUID de usuario y terminal.

- `navigator.onLine` y eventos online/offline, más HEAD no cacheable al servidor cada 15 segundos, con timeout de 5 segundos.
- Estados online, offline, sincronizando y error en la barra inferior; abre el panel de sincronización.
- FIFO por secuencia persistida, una operación por vez. Un fallo frena las dependientes.
- Red: backoff exponencial de 5 segundos a 10 minutos. Negocio: fallida, sin bucle automático.
- «Reintentar pendientes» conserva UUID y payload. Sin conexión no se intenta enviar.
- Las confirmaciones se conservan en el log local; no se borran al recibir respuesta.
- beforeunload solicita el aviso nativo con carritos o cobros pendientes. El navegador controla el texto del diálogo.
- El procesador funciona mientras el POS está abierto; no se promete sincronización con el navegador cerrado.

Un timeout de una venta enviada por la RPC online anterior NO se convierte
automáticamente en otra venta offline. Se mantiene el aviso de resultado incierto
y se exige revisar Historial, evitando un segundo cobro por cambio de conexión.

## Catálogo, precios y conflictos

- Se prepara el catálogo completo por lotes, no solo los primeros 50 productos.
- La caché se separa por lista de precios. Offline se filtra localmente por nombre, referencia, categoría y favoritos.
- Se indica si la preparación quedó parcial y la fecha de sus existencias; esas existencias no son actuales.
- Una lista no preparada muestra error en vez de inventar precios.
- Una venta cobrada conserva su snapshot; el reintento no toma nuevos precios del catálogo.
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

- La barra inferior impide navegar al cierre sin conexión o con pendientes y explica «Conéctate para subir N ventas antes de cerrar».
- El diálogo de cierre deshabilita su acción y vuelve a consultar IndexedDB antes de llamar a la RPC.
- La comprobación y el envío del cierre comparten Web Lock con la cola del navegador.
- El cuadre de servidor incluye únicamente documentos ya sincronizados.
- Límite: la RPC actual no puede conocer operaciones que otro dispositivo nunca le envió. No se presenta el control cliente como una garantía servidor entre equipos.

## SQL pendiente, SOLO propuesta

`docs/pruebas/pos-offline-pendiente.sql` permanece en BEGIN/ROLLBACK, sin ejecutar.
Está fuera de migraciones con autorización: el UTC del entorno es anterior a
migraciones existentes; no se inventó una fecha ni se alteró el candado.

- UUID único parcial en facturas y movimientos de turno.
- `pos_sync_operaciones` con RLS y lectura solo del propietario con rol de escritura.
- RPC aditiva `pos_sincronizar_operacion`, transaccional y con advisory lock por UUID.
- Un reintento verifica usuario, terminal, turno, tipo y payload, y devuelve el resultado persistido, incluso si el turno cerró después.
- Un UUID reutilizado con otros datos se rechaza.
- Documento, pagos, inventario, asiento y registro de sincronización se confirman juntos o se revierten juntos.
- Se conserva `vencimiento`: solo se sustituye `fecha`. Si queda anterior a la emisión, la validación existente rechaza; no se extiende silenciosamente.
- `pos-offline-reset.patch` propone clasificar y verificar la tabla transaccional en `reset-base-virgen.sql`. Aplicar ese parche junto con la incorporación de la migración al repo, nunca ejecutar el reset por esta tarea.
- El Orquestador aceptó estáticamente el contrato; Coder/Waldy validarán en su base de prueba y regenerarán tipos. No se usó service_role.

## Pruebas y evidencia pendiente

- Vitest: UUID estable tras perder respuesta, backoff, FIFO, error de negocio, aislamiento y ticket sin NCF ni leyenda.
- Chromium real: persistencia de tres operaciones y carrito al recargar offline; dos pestañas serializan secuencias con Web Locks. Son pruebas del almacenamiento, NO tres facturas reales.
- `tests/e2e/pos-offline-ui.spec.ts`: preparado para una sesión externa (`E2E_POS_STORAGE_STATE`) y producto autorizado `E2E_POS_PRODUCTO` con prefijo ZZTEST. Se omite si faltan. Captura ticket, pendientes, panel y error; bloquea peticiones de escritura al reconectar.
- No hay capturas autenticadas entregadas todavía. T3 preview falló por sandbox root; Playwright local funciona, pero falta la ruta de sesión ZZTEST.
- Tras habilitar RPC: probar tres cobros offline, recargar, reconectar, exactamente tres UUID/documentos, tres NCF y cuadre correcto; reintentar respuesta perdida no duplica.
- Pendientes también captura de sincronizando real, cierre bloqueado, claro/oscuro y móvil. No inventar evidencia con ventas ficticias ni borrar datos sin autorización.
- Mantener PR #115 draft hasta cerrar esas verificaciones.
