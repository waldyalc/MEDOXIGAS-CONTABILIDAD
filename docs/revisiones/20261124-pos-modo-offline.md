# Revisión — POS Modo Sin Internet (Offline) estilo Alegra

- **Fecha:** 24-11-2026
- **Rama auditada:** `feat/pos-modo-offline-alegra` (base `main` `a881637`)
- **Revisor independiente:** DeepSeek V4.1 Flash 1017 (`opencode-go/deepseek-v4.1-flash`, `variant: max`)
- **Estado tras correcciones:** **APROBADO** (todos los bloqueantes y medios resueltos y verificados con `typecheck`, `check`, `test`, `build` y E2E Playwright)

## Hallazgos del Revisor y resoluciones aplicadas

| # | Severidad | Hallazgo | Resolución aplicada |
|---|---|---|---|
| 1 | Bloqueante CI | `tests/e2e/pos-offline-alegra.spec.ts` disparaba el candado `sin-capturas-alegra.test.ts` (nombre de archivo con «alegra»). | Renombrado a `tests/e2e/pos-offline-modo-sin-internet.spec.ts`. `pnpm test` 100% verde. |
| 2 | Bloqueante / Alto | `CheckoutPos` abría «Venta pendiente de guardar» («Tu venta no se ha guardado… Editar venta») incluso en timeout/red o error de formato tras un posible commit online, induciendo riesgo de doble cobro/NCF. | Separado en 3 caminos: guardas offline previas → `<Alert>` inline; rechazo definitivo previo a commit o fallo de `encolar` → modal «Venta pendiente de guardar» (Imprimir ticket + Editar venta); timeout/red/formato incierto tras envío remoto → estado `perdido` («No sabemos si la venta se registró. Revisa el Historial» + Ver Historial) con CTA deshabilitado. |
| 3 | Bloqueante / Alto | Bug #1: `prepararWorker()` descartaba silenciosamente si había una preparación en vuelo y `pos-sw.js` no transportaba `turnoId` ni serializaba `preparar()`. | `pos-sw.js` ahora recibe y persiste `turnoId`, serializa `preparar()` con `generacionPreparacion`, devuelve `turnoId` en `POS_CACHE_LISTO`/`ERROR` y aísla `cache.put` en su propio `try/catch` (no descarta respuesta fresca ante fallo de cuota). `OfflinePosProvider` valida `turnoRespuesta === turnoVigente.current` y relanza si `reprepararPendiente` se marcó durante una preparación en curso. |
| 4 | Medio | `aplicarOfflineInmediato()` usaba `estadoTrasSondeo(actual, false)` que conservaba `"sincronizando"`, retrasando el cambio a `Sin conexión` durante una subida. | Añadido `forzar = false` a `estadoTrasSondeo`; `aplicarOfflineInmediato()` y `recargarManual()` sin red fuerzan transición inmediata a `"offline"` incluso desde `"sincronizando"`. |
| 5 | Medio | `/pos/historial` anteponía ventas locales en todas las páginas, sin filtrar por `q`/`desde`/`hasta`/`estado`/`terminal`, y mantenía sincronizadas viejas para siempre si salían de la página 1. | `proyectarVentasLocales` acepta `FiltrosHistorialLocal`, restringe locales a `pagina === 1`, aplica todos los filtros del historial y aplica ventana de gracia (5 min) para sincronizadas locales ausentes en `filas`. |
| 6 | Medio | «Revisar pendientes» enlazaba a `/pos/historial` incluso estando offline (ruta no cacheada por el SW). | Offline, el botón «Revisar pendientes» abre el panel local de sincronización (`offline.abrirPanel()`); online navega a `/pos/historial`. |
| 7 | Medio | `cargarVentaOffline` devolvía `void` y `editarVentaLocal` descartaba la copia fallida aunque el snapshot fuera inválido o no cupiera en `MAXIMO_PESTANAS`. | `cargarVentaOffline` devuelve `boolean` (y no sobrescribe pestañas activas con productos al límite); `editarVentaLocal` solo descarta la operación fallida si `cargarVentaOffline` devolvió `true`. |
| M1–M6 | Menores | Docs de cierre (`pos-offline.md`), textos obsoletos en `pos-offline-ui.spec.ts`, etiqueta `No se pudo actualizar` en caché de productos y `ErrorImpedimentoCierreOffline` si `comprobarCierre()` falla en IndexedDB antes de llamar la RPC. | Todos corregidos en la misma tanda. |
