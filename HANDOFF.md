# Handoff — Medoxigas Contabilidad

## POS 18: la estrella marcada se ve rellena (rama `fix/pos-favoritos-estrella-rellena`, MSG-31)

Corrección de Waldy sobre el PR #128: en las capturas la estrella marcada se veía igual que la vacía.

- **Causa:** `@/components/icons` exporta `StarIcon` de Phosphor, que pinta un único path con `currentColor`. La clase `fill-white` solo repintaba el path del contorno, que ya era blanco por `text-white`; nunca aparecía la forma sólida. La variante rellena es `weight="fill"`.
- **Tarjeta (`tarjeta-producto-pos.tsx`):** `<Star weight={favorito ? "fill" : "regular"} />`. El cuadro teal de 32 px, `stopPropagation()` y `aria-pressed` quedan igual. El mismo defecto estaba en la estrella del botón «Favoritos» de `catalogo-pos.tsx` (`fill-current`), corregido igual.
- **Candado:** `tarjeta-producto-pos.test.tsx` renderiza la tarjeta marcada y la vacía con `renderToStaticMarkup` y compara el `d` del path de la estrella contra las variantes `fill` y `regular` de Phosphor (falla si vuelven a verse iguales), más `aria-pressed`; `favoritos.test.ts` prohíbe `fill-white`/`fill-current` en la tarjeta y exige el `weight`.
- **Evidencia:** `docs/diseno/capturas/pos-favoritos/`: regeneradas 02–05 (el cuadro teal ya sale siempre, como el código actual) y nuevas `06-zoom-marcada.png` y `07-zoom-no-marcada.png` (4×, la misma tarjeta marcada y sin marcar para comparar a simple vista).
- **Verificado:** `pnpm typecheck`, `pnpm check`, `pnpm test` (1637) y `pnpm build` en verde. Capturas desde `pnpm start -p 3037` tras el build: con el VPS a load 17 el dev server tardaba más de 150 s en hidratar; la app y el puerto son los mismos.

## POS 17: la cola offline no se tranca con una venta fallida (rama `fix/pos-offline-cola-fallidas`)

Auditoría del Punto 2. **Hallazgo confirmado:** `sincronizarColaOffline` hacía
`return` al encontrar la primera operación `fallida` (y también al guardar un
rechazo de negocio), así que una sola venta rechazada detenía para siempre todas
las siguientes; además `comprobarCierre()` contaba las fallidas como pendientes y
bloqueaba el cierre.

- **Cola:** las `fallida` se saltan con `continue`; un rechazo de negocio se
  guarda como fallido y la pasada sigue con las demás ventas. Un fallo de red
  conserva el `return` para no adelantar dependientes y respetar el orden.
- **Bandeja:** el panel de Sincronización muestra «Ventas con problema» con
  folio, resumen cobrado, error e intentos. Cada una tiene **Reintentar**
  (mismo UUID, vuelve a `pendiente`) y **Descartar** con confirmación
  («¿Descartar esta venta?», no se puede recuperar). Solo se descartan fallidas;
  las pendientes no se pueden borrar. El badge de la barra inferior cuenta las
  fallidas y abre la bandeja.
- **Cierre:** `revisionCierreOffline` bloquea solo con ventas `pendiente`; las
  fallidas no bloquean, pero el diálogo de cierre y el resumen posterior muestran
  «N ventas con problema no subirán. Quedan guardadas…». `conCierreSeguro` usa el
  impedimento nuevo.
- **Archivos:** `src/lib/pos/{cola-offline,almacen-offline}.ts`,
  `src/app/(pos)/pos/_components/offline-pos-provider.tsx`,
  `.../turnos/{dialogo-cerrar-turno,turnos-pos}.tsx`,
  `.../vender/barra-inferior-pos.tsx`; tests en `cola-offline.test.ts`,
  `offline-fallidas.test.ts`, `offline-integracion.test.ts` y ajuste del candado
  de `reglas.test.ts` para permitir el borrado local de IndexedDB sin abrir la
  puerta a escrituras directas en Supabase.
- **Candados:** 1 fallida + 9 válidas suben las 9; reintentar la reencola con su
  UUID; el descarte exige confirmación; el cierre no se bloquea y el aviso
  aparece; test de fuente del panel/diálogo.
- **Checklist de caja real:** `docs/pruebas/checklist-offline-caja.md` (3 ventas
  offline con 1 rechazada por existencia, reintento/descarte, cierre avisado y
  verificación de NCF, asientos e inventario).
- **Evidencia:** `docs/diseno/capturas/pos-offline-fallidas/` (bandeja clara y
  oscura, confirmación de descarte y aviso de cierre con el botón habilitado),
  tomadas a 1440 px en el dev server 3036 sembrando la cola en IndexedDB; no se
  creó ninguna venta real.
- **Verificación:** `pnpm typecheck`, `pnpm check`, `pnpm test`, `pnpm build` en
  verde. Sin merge a `main`; PR contra `feat/pos-alegra-exacto`.

## POS 16: panel «Más opciones» del carrito (rama `feat/pos-mas-opciones`)

Waldy (MSG-34): el ⋯ de la barra de cobro deja de abrir una listita y abre un
panel grande que tapa todo el carrito.

- `mas-opciones-pos.tsx` (nuevo): overlay `absolute inset-0` dentro del `aside`
  del carrito (mismo tamaño), encabezado «Más opciones» con X «Volver al
  carrito», Esc para cerrar y cuadrícula 2/3 columnas de cuadros de 116 px con
  ícono teal encima y nombre debajo. Al cerrar devuelve el foco al botón ⋯.
- `panel-factura.tsx`: el `DropdownMenu` del ⋯ se reemplazó por ese panel. Las
  opciones salen de `opcionesMas` (`etiqueta`, `Icono`, `accion`/`href`):
  «Guardar cotización», «Cargar cotización» e «Historial de ventas» (enlace a
  `/pos/historial`), con las mismas condiciones de habilitado. Abrir/cerrar no
  toca el carrito: solo cambia `masOpciones`.
- **Candados:** `src/lib/pos/mas-opciones.test.ts` (Vitest) exige el arreglo con
  las tres etiquetas/íconos, el overlay que cubre el aside, los tokens `--pos-*`
  y que cerrar no mute la venta; `tests/e2e/pos-mas-opciones.spec.ts` abre el
  panel a 1440 px, comprueba los tres cuadros y que X y Esc dejan el carrito
  idéntico (requiere la sesión ZZTEST externa; el candado de fuente corre
  siempre).
- **Evidencia:** `docs/diseno/capturas/pos-mas-opciones/` (antes con la listita;
  panel abierto en claro y oscuro; móvil a 390 px). Sin migraciones ni datos.

## Auditoría Punto 1: capturas de Alegra fuera del repo (rama `fix/pos-audit-capturas-alegra`)

- **Hallazgo confirmado:** el PR #107 commiteó 16 PNG de referencia y comparación de Alegra bajo `docs/diseno/alegra-pos/` en el repo público (1.18 MB de blobs; siguen en el historial de git). Se borraron del árbol y las imágenes quedaron fuera del repo, en `/root/referencias/alegra-pos/diseno-pos/` del VPS.
- Se conservan las guías `.md` (`README`, `MEDIDAS`, `GUIA-POS`, `COMPARACION`), actualizadas para decir que las capturas viven fuera del repo.
- **Candado:** `src/lib/sin-capturas-alegra.test.ts` prohíbe binarios bajo `docs/diseno/alegra-pos/` y cualquier archivo rastreado nuevo con «alegra» en el nombre. La lista `LEGADO` (17 archivos que ya estaban en `main` en `docs/alegra/`, `docs/planes/` y `supabase/`) solo puede encoger.
- **Nota:** `docs/alegra/` ya existía en `main` antes del PR #107 (553 archivos, 514 binarios/exports). No se toca en esta tarea; queda reportado para decisión aparte del Orquestador.

## Chore: `pnpm test` sin navegador (rama `chore/ci-pnpm-test-sin-browser`)

Auditoría punto 5: el test del ticket 80 mm (`src/lib/pos/ticket-pdf.test.tsx`)
lanzaba Chromium y usaba Poppler dentro de `pnpm test`, así que el job `ci`
instalaba navegador y herramientas PDF en cada corrida.

- El test **no cambió**: sigue comprobando los cuatro PDFs, fuentes, medidas y
  logo. Solo cambió de carril: nuevo `vitest.pdf.config.mts` y script
  `pnpm test:pdf`. `vitest.config.mts` lo excluye de `pnpm test`.
- `ci.yml`: el job `ci` ya no instala Chromium/Poppler/Liberation; un job
  `pdf` (sin secretos) instala esas herramientas y corre `pnpm test:pdf`.
  El job `e2e` conserva su Chromium porque necesita navegador de verdad.
- Verificación local: `pnpm test` (sin el PDF), `pnpm test:pdf`,
  `pnpm typecheck` y `pnpm check` en verde.

## POS 15: venta nueva con Consumidor final (rama `feat/pos-consumidor-final`, MSG-33)

Decisión de Waldy (23-11-2026): como Alegra, cada venta nueva del POS arranca
con el cliente «Consumidor final» ya elegido.

- **Sin migración ni datos nuevos:** el contacto ya existe (`rnc_cedula =
  22222222222`). `getConsumidorFinalId()` lo busca por RNC normalizado con el
  usuario de la sesión (solo lectura, `cache` por petición) y el layout lo pasa
  como contacto inicial del carrito; si no aparece, usa el
  `contacto_defecto_id` de la terminal. `crearPestana`, «Nueva venta»,
  «Cancelar» y «Nueva venta» tras cobrar ya usan esos defaults.
- **Pestañas y recargas:** una pestaña restaurada sin líneas ni cotización
  vuelve al contacto inicial (`contactoDePestanaRestaurada`), para que una
  venta nueva no herede el cliente que se quitó antes.
- **Selector como Alegra:** el input muestra «Consumidor final
  (22222222222)»; a la izquierda de la flecha aparecen el lápiz (abre la ficha
  del contacto en otra pestaña) y la X (quita el cliente). Se agregó el
  render prop `acciones` a `SelectorContacto` sin cambiar los demás usos.
- **Aviso de Crédito fiscal:** con la numeración `01` y Consumidor final, el
  panel muestra «El Crédito fiscal (01) necesita un cliente con RNC. Elige un
  cliente o cambia la numeración.». El cobro a crédito sigue bloqueado por el
  toast existente, ahora comparando contra el mismo id resuelto por RNC.
- **Candado:** `src/lib/pos/consumidor-final.test.ts` prueba la normalización
  del RNC, el cliente inicial, el respaldo de la terminal, la pestaña
  restaurada, el comprobante 01, el aviso y que el layout/panel/checkout usen
  el mismo Consumidor final. `docs/dominio-pos.md` actualizado.
- **Evidencia:** `docs/diseno/capturas/pos-consumidor-final/` con el antes
  (`PRUEBA CAPTURA ER`), el después («Consumidor final (22222222222)» con
  lápiz/X), el aviso de Crédito fiscal, oscuro y móvil. Playwright en
  `localhost:3034`, 1440 px, sesión ZZTEST; el «antes» se tomó con el código
  base y el resto con la rama. No se modificó ningún dato.
- **Pendiente de datos (no bloquea):** `pos_terminales.contacto_defecto_id`
  de ZZTEST sigue apuntando a un contacto de prueba. El POS ya no lo usa salvo
  como respaldo, pero la RPC `pos_completar_venta` todavía bloquea el crédito
  según esa columna; cuando Waldy apunte la terminal al Consumidor final real,
  base y UI quedarán alineadas.

## POS 14: logo de Medoxigas en el ticket (rama `feat/pos-ticket-logo`, MSG-35)

El código ya pintaba el logo (arriba, centrado, 69.8 × 20.9 mm con
`object-contain`), pero `empresa.logo_url` era NULL y el bucket `logos` estaba
vacío, así que nunca salía.

- Subido `public/marca/logo-medoxigas.png` (500 × 260, PNG con transparencia) al
  bucket público `logos` del proyecto `ljfdhrnvlsfaweuvnqxz` y actualizado
  `empresa.logo_url` a su URL pública. Sin migración ni cambio de código de
  producción; si la empresa no tiene logo, `Logo` devuelve `null` y no deja hueco.
- Comprobado con Playwright (1440 px) sobre una venta ZZTEST existente: factura
  80 mm con el logo sobre «MEDOXIGAS ALC, SRL» y cierre 57 mm igual que Alegra
  (sin encabezado de empresa). Capturas en `docs/diseno/capturas/pos-logo/`.
- **Candado:** `src/lib/pos/ticket-pdf.test.tsx` ahora exige además que el `<img>`
  exista una sola vez, quede arriba del nombre de la empresa y centrado con él,
  manteniendo las medidas 69.8 × 20.9 mm de los cuatro PDFs.

## POS 13: favoritos con la estrella teal (rama `feat/pos-favoritos-estrella`, MSG-31)

Decisión de Waldy (23-11-2026): el catálogo copia la estrella de Alegra.
Cada tarjeta lleva arriba a la derecha un cuadro teal de 32 px con una estrella
blanca: vacía si no es favorito, rellena si lo es.

- **Tarjeta (`tarjeta-producto-pos.tsx`):** el cuadro usa `bg-pos-primario` y `hover:bg-pos-primario-hover` (tokens `--pos-*`, sin `--primary` ni hex sueltos). La tarjeta pasa de `<button>` a `<article>` con un botón invisible que cubre la superficie para agregar al carrito y un `<button aria-pressed>` encima para la estrella; el clic de la estrella hace `stopPropagation()` y **no** agrega al carrito. La cantidad del carrito se movió arriba a la izquierda para no chocar con la estrella.
- **Persistencia:** `src/lib/pos/favoritos.ts` guarda `pos:favoritos:v1` en `localStorage` (clave versionada, lectura segura que descarta JSON inválido o valores que no sean booleanos). La marca local manda sobre `productos.favorito_pos` (favorito global de Inventario): `true` marca y `false` desmarca. No se escribe en la base ni hace falta migración.
- **Filtro «Favoritos»:** `vender-pos.tsx` filtra en el cliente con `filtrarFavoritosPOS` sobre lo cargado, así incluye tanto los favoritos locales como los globales; «Ver más» sigue trayendo el resto. Se quitó `solo_favoritos` de la llamada del POS (la RPC y la columna siguen intactas).
- **Candados:** `src/lib/pos/favoritos.test.ts` prueba lectura/escritura segura, la precedencia local/global y el filtro; `tests/e2e/pos-favoritos.spec.ts` (sesión ZZTEST, 1440 px) marca la estrella, comprueba que el carrito sigue en 0, activa el filtro, verifica que no queda ninguna tarjeta sin marcar y recarga para confirmar la persistencia.
- **Evidencia:** `docs/diseno/capturas/pos-favoritos/` (`01-antes-estrella-gris.png`, `02-despues-estrella-teal-marcada.png`, `03-despues-filtro-favoritos.png`, `04-despues-oscuro.png`, `05-despues-movil.png`).
## INFRA mejoras VPS y agentes (rama `infra/mejoras-agentes`, 23 nov 2026)

Encargo de Waldy (22-11-2026) al agente de infraestructura: aplicar la
auditoría del VPS srv2187989. Sin cambios al código del POS.

- **Memoria:** swap total 12 GB (`/swapfile2` de 8 GB ya existía y quedó verificado en fstab) y `vm.swappiness=80` persistente en `/etc/sysctl.d/90-medoxigas-ram.conf`. Nueva regla del orquestador: `free -m` antes de delegar, ~1 hijo pesado por cada 3–4 GB libres.
- **pgTAP sin Docker:** `postgresql-18` + `postgresql-18-pgtap` vía apt (clúster del sistema parado y deshabilitado; solo binarios). `scripts/pgtap-local.sh` re-ejecuta como `postgres` al correr como root (escenifica en /tmp) y su stub gana el esquema `storage`. Suite completa en verde (~1,300 asserts).
- **Capturas únicas:** `pnpm captura --ruta <ruta> --salida <carpeta>` (`src/scripts/captura.ts`): ZZTEST con storageState fuera del repo (`/root/.medoxigas/storage-zztest.json`, 600, se renueva solo); claro/oscuro 1440 px y móvil 390 px; falla ante errores de consola u HTTP 5xx.
- **Worktrees:** `t3.json` + `scripts/t3-worktree-setup.sh` enlazan `.env.local`/`.env.pruebas` del checkout principal y corren `pnpm install --prefer-offline` al crear el hilo.
- **Candados:** `src/lib/binarios-grandes.test.ts` + `binarios-permitidos.txt` (binarios nuevos >200 KB e imágenes «alegra»/`docs/diseno/alegra-pos/`); job `db` de CI exige test en `supabase/tests/` cuando el PR agrega migraciones.
- **Docs:** `docs/infra/base-staging.md` (staging aparte — pendiente Waldy), `docs/infra/usuario-agente.md` (sacar agentes de root — pendiente), `docs/infra/navegador-depuracion.md` (Playwright MCP `@0.0.85` en `opencode.json`). `docs/revisiones/` recibe los informes del REVISOR antes de `main`.
- **Disco:** `scripts/limpieza-disco.sh` (solo listar): ~20 GB en worktrees mergeados + `/root/preview-antes-carrito` y `/tmp/opencode` como candidatos; cron de borrado apagado hasta el OK de Waldy.


## POS 12: menú lateral plano (rama `t3/pos-flat-sidebar-menu`)

Decisión de Waldy (23-11-2026, 9:30 PM): el menú del POS deja de agrupar y
queda todo al mismo nivel, sin títulos de grupo, submenús ni flechitas.

- `menu-pos.tsx`: `ITEMS_PRINCIPALES` es una lista plana de cinco enlaces —Facturar (`/pos`), Ventas (`/pos/historial`), Pagos (`/pos/pagos`), Turnos (`/pos/turnos`) y Devoluciones (`/pos/devoluciones`)—; se eliminaron `ItemSeccionPOS`, `esSeccion`, `ItemSeccion`, el tipo `ItemPOS` y los imports de `HandCoins`/`Wallet`. `menu-pos-estilos.ts` ya no exporta `itemMenuSeccion`.
- Títulos visibles: «Historial de ventas del POS» → **Ventas** y «Registro de pagos» → **Pagos**; Turnos ya se llamaba así. Las rutas y el contenido de las páginas no cambian. `docs/dominio-pos.md` (pantallas y descripción del menú) se alineó.
- **Candados:** `src/lib/pos/diseno-pos.test.ts` exige los cinco enlaces planos en orden y prohíbe «Ingresos», «Historial de turnos», `ItemSeccion`, `sub:`, `Collapsible`, `ChevronDown` e `itemMenuSeccion`. `tests/e2e/pos-menu-plano.spec.ts` repite el candado de fuente sin credenciales y, con la sesión ZZTEST externa, navega Ventas/Pagos/Turnos/Devoluciones a 1440 px verificando títulos.
- **Evidencia:** `docs/diseno/capturas/pos-menu-plano/` (menú expandido en claro y oscuro, antes/después contra `menu-pos-actual.png`, y cajón móvil). Sin migraciones ni datos nuevos.

## POS 11: modo sin internet cerrado (rama `feat/pos-offline`, PR #115)

Waldy aprobó opción A: offline sin NCF, ticket «Folio: POS-LOCAL-<UUID>»,
fecha fiscal al sincronizar y stock según `vende_negativo`.

- Cobros y movimientos se guardan en IndexedDB antes de confirmar; carritos por pestaña, catálogo por lista, contactos y configuración sobreviven recarga/cierre. Worker mínimo para recargar `/pos`; no borra IndexedDB.
- `transporte-offline.ts` usa directamente la RPC tipada `pos_sincronizar_operacion` con `client_uuid`; FIFO con backoff de 5 s a 10 min. Un fallo de red conserva el UUID; un rechazo de negocio (existencia/`vende_negativo`) queda `fallida` visible, sin perder la venta.
- La barra distingue sin conexión, sincronizando, error/reintentar y pendientes; el panel muestra folio, snapshot «Cobrado» y NCF confirmado. `beforeunload` avisa con pendientes. El cierre y el cuadre solo usan lo sincronizado; el panel explica «Conéctate para subir N ventas antes de cerrar el turno».
- Migraciones ya aplicadas en la base de prueba (PR #122): `20261126120000_pos_offline_client_uuid.sql` y `20261126121000_empresa_sucursal_regimen.sql`. Tipos regenerados; `pos_sync_operaciones` clasificada en el reset a base virgen.
- **Prueba real verde** (`tests/e2e/pos-offline-ui.spec.ts`, 3031, 1440 px, sesión ZZTEST): 3 ventas con `setOffline(true)`, recarga offline, fallo de red forzado con reintento, reconexión y sync. Resultado: 3 NCF distintos (**B0200000020, B0200000021, B0200000022**), cola vacía, 3 facturas en `/pos/historial` y cuadre del turno +3 ventas / RD$336.30. Las corridas de depuración previas dejaron NCF 8–19 como datos ZZTEST; no se borró nada.
- Capturas en `docs/diseno/capturas/pos-11/` (offline pendientes, sincronizando, error/reintento, panel de sync, ticket, cierre bloqueado, historial y cuadre). `panel-sync.png` y `cierre-bloqueado.png` se regeneraron con ventas locales sin sincronizar para no crear facturas extra.
- Límites: sync solo con el POS abierto (sin Background Sync), sin login offline y solo `/pos` cacheado; IndexedDB no es respaldo externo. Crédito y conversión de cotizaciones requieren conexión. Diseño y límites en `docs/diseno/pos-offline.md`; listo para revisión e integración, sin merge a `main`.

## POS 10 medidas exactas y migraciones aplicadas (23 nov 2026)

- **Plantilla única 80 mm:** `TicketPos` + `impresion.ts` cubren factura, prefactura y cotización; el cierre usa su variante de 57 mm. Se eliminó `em`/`system-ui`: Arial/Liberation Sans con la tabla exacta de `medidas-alegra.txt` (fuera del repo; copiada en `.opencode/skills/ticket-80mm/SKILL.md`): empresa/cliente/Total 13.5 bold, cuerpo/título/subtotales/pie 9, tabla 8.1 bold, ítem 7.29, detalle 6.55; logo 69.8×20.9 mm. El título del cierre queda en 26.25 pt normal, una línea, con 4 mm de margen lateral autorizados por Waldy (la tabla dice 5.6 mm; se documentó la desviación). PR #121.
- **Candado:** `.opencode/skills/ticket-80mm/SKILL.md` y `src/lib/pos/ticket-pdf.test.tsx` generan los cuatro PDFs reales y verifican fuentes/tamaños ±0.3 pt, página única de 80/57×250 mm y pesos con `pdffonts`/`pdftotext -bbox`. El job `pdf` de CI instala Chromium, Poppler y Liberation y corre `pnpm test:pdf`.
- **Migraciones aplicadas (solo `ljfdhrnvlsfaweuvnqxz`):** `20261126120000_pos_offline_client_uuid.sql` (client_uuid + índices únicos parciales, `pos_sync_operaciones`, RPC idempotente `pos_sincronizar_operacion`) y `20261126121000_empresa_sucursal_regimen.sql` (`empresa.sucursal/regimen`, `actualizar_empresa` extendida). Antes de escribir se corrió cada SQL en `BEGIN/ROLLBACK` y se comprobó el ref; el historial remoto de migraciones registra ambas. Tipos regenerados con `pnpm db:types`; `pos_sync_operaciones` clasificada en el reset a base virgen. PR #122.
- **Regla permanente de base de datos:** toda operación (migraciones, consultas, tipos) se hace con **Supabase CLI desde el VPS**. El token vive en `/root/.supabase.env` (chmod 600, cargado por el shell): nunca se imprime, se pega en el chat/logs ni se commitea. Proyecto de prueba `ljfdhrnvlsfaweuvnqxz`; la base de OPP y producción no se tocan sin el OK de Waldy en el chat.
- **Modelo de los subagentes:** decisión de Waldy del 23-11-2026 8:59 PM: **DeepSeek V4.1 Flash 1017 para todos los hijos**. Devin, SWE-2 Max y Adaptive quedan cancelados (MSG-26 y MSG-27). Si un hijo agota cuota, se avisa a Waldy y no se cambia de modelo sin preguntar. PR #124.
- **Pendiente de datos reales:** la fila `empresa` ya tiene las columnas nuevas, pero dirección, teléfono, correo, sucursal, régimen y `logo_url` siguen vacíos. No se inventan: Waldy/Contable deben cargarlos en Configuración → Empresa.
- **Evidencia:** `/root/referencias/capturas-terminadas/2026-11-23-pos10-exacto-*` (factura, prefactura, cotización, cierres, comparaciones a 150 dpi) y `2026-11-23-pos10-config-empresa-campos.png` (campos nuevos en el preview 3010). Preview reconstruido y en 200 tras #121/#122.

## POS 7–8: más funciones con cotizaciones y cerrar cobro directo (rama `feat/pos-cotizaciones-mas-funciones`)

Trabajo de subagente ejecutor sobre `feat/pos-alegra-exacto` (PLAN POS 2, puntos 7 y 8). Sin migraciones ni datos nuevos: solo lectura + carrito en memoria.

- **Botón «más funciones» (`panel-factura.tsx`):** el cuadro oscuro de la barra de cobro deja de ser un enlace a `/pos/historial` y abre un `DropdownMenu` anclado con «Guardar como cotización», «Cargar cotización» e «Historial de ventas» (el antiguo acceso del botón, ahora dentro del menú; icono `MoreHorizontal`). Conserva tamaño (44×45 px), radio de 10 px, fondo `--pos-oscuro` y el punto gris. El menú de sliders de arriba conserva «Venta simple» (F4); las cotizaciones ya no están duplicadas allí.
- **Guardar:** el payload sale de `src/lib/pos/cotizaciones.ts` (`payloadCotizacionPOS`: cliente, lista, vendedor, líneas, cantidades, precios, descuentos e impuestos) y el `toast` muestra `Cotización No N guardada` con enlace a `/dashboard/cotizaciones/<id>`. Se mantiene el diálogo de confirmación/impresión.
- **Cargar:** `DialogoCargarCotizacion` recibe el cliente del carrito y filtra por `contacto_id` (nuevo campo opcional en `esquemaCotizacionesAbiertas`; lectura, sin migración). El diálogo avisa «Solo las cotizaciones abiertas de <cliente>» y muestra un estado vacío acorde. Las líneas se mapean con `lineasDeCotizacionPOS`.
- **Enlace inverso factura → cotización:** `getFacturaVista` incluye `cotizacionOrigen` (consulta `cotizaciones.factura_id`, ya indexada) y el detalle de factura suma la pestaña «Cotización origen» solo cuando existe, reutilizando la tabla de documentos relacionados con enlace al detalle de la cotización.
- **Cerrar cobro directo (`checkout-pos.tsx`):** se eliminó `confirmarCierre` y el diálogo «La venta no se ha cobrado. ¿Cerrar el cobro?». La X y «Cancelar» cierran el modal de inmediato, conservan el carrito y respetan el bloqueo mientras `enviando`. Se conserva el toast de campos obligatorios que trajo el PR #111.
- **Tests:** `src/lib/pos/cotizaciones-pos.test.ts` (9 pruebas) y `src/lib/pos/checkout-pos.test.ts` (2): payload de guardado, mapeo de carga, filtro por contacto, `cotizacion_id` en la venta, `getCotizacionOrigen` por `factura_id`, pestaña de la factura y candados que prohíben volver a enlazar el botón a `/pos/historial` o mostrar «¿Cerrar el cobro?».
- **Evidencia:** `docs/diseno/capturas/pos-7/` con `menu-mas-funciones.png`, `cargar-cotizacion-cliente.png`, `cerrar-cobro-directo.png` y `medidas.md`, tomadas con Playwright en el puerto 3027 (el preview 3010 se actualiza al integrar). Solo lectura: no se guardó ninguna cotización ni venta. No existe en la base una factura creada desde cotización, así que la pestaña «Cotización origen» se validó con las pruebas y no con captura (crear ese dato estaba prohibido).
- **Coordinación con POS 10:** no se agregó «Imprimir cotización» ni se tocó el icono de impresora del header; el acceso al historial quedó como opción del menú.
- **Verificación:** `pnpm typecheck`, `pnpm check`, `pnpm test` y `pnpm build` en verde. Pendiente revisión visual e integración del Orquestador; sin merge a `main`.

## POS 10: prefactura, cotización y cierre sobre la plantilla 80 mm (rama `feat/pos-prefactura-cotizacion-pdf`)

Subagente ejecutor sobre `feat/pos-alegra-exacto`. Una sola plantilla
(`TicketPos` + `impresion.ts`) cubre factura, prefactura y cotización; el
cierre sigue siendo su variante de 57 mm.

- **Prefactura (solo presentación):** el icono de impresora del panel abre
  «Imprimir vista previa» del carrito en memoria: título «Prefactura» +
  «Sin valor fiscal», sin NCF, sin venta ni escritura en base. El menú
  «más funciones» ofrece «Imprimir cotización» (habilitado solo con
  cotización cargada).
- **Cotización 80 mm:** «Cotización No. N», fecha, «Vence», «Sin valor
  fiscal», totales compartidos `(A) ITBIS`/`Total ITBIS`. Desde el POS y
  desde `/dashboard/cotizaciones/[id]` (acción nueva junto a la Carta).
- **Encabezado orden Alegra:** nombre → `Sucursal` (opcional) → `RNC:` →
  dirección → `Teléfono:` → correo → `Régimen` (opcional); se omite lo
  que no exista. La tabla `empresa` **no tiene** `sucursal`/`regimen`
  (verificado en los tipos generados): quedaron como campos opcionales
  en `Empresa`/`EmpresaPOS`; la migración aditiva + campos de
  Configuración quedan pendientes del OK de Waldy.
- **Cierre:** `Cierre No N` en una sola línea (17.25 pt negrita, nowrap),
  sin marco; filas como Alegra.
- **Bug real corregido:** el portal de impresión vivía dentro de
  `PanelFactura`, que `vender-pos` desmonta cuando
  `matchMedia("(min-width:1024px)")` es falso. Al imprimir, Chromium
  evalúa esa media query con el ancho del papel (80 mm) → panel desmontado
  a mitad del `window.print()` → hoja en blanco. El estado `impresionDoc`
  y `ImpresionPos` ahora viven en `vender-pos` (el panel delega con
  `onImprimir`); candado en `prefactura-cotizacion.test.ts`.
- **Candados:** `prefactura-cotizacion.test.ts` (acciones del panel,
  portal en `vender-pos`, prohibidos «Generado en Alegra POS», OXYMAT y
  Fiel Ferreteria) + `impresion.test.ts` (payloads).
- **Verificación:** typecheck/check/test (1,582 passed) /build verdes;
  PDFs en `docs/diseno/capturas/pos-10/`: factura, prefactura y
  cotización a **1 página, 227.04 × 708.96 pt** y cierre a 162 × 708.96;
  `comparacion.png` y `medidas.md` con el análisis por partes.

## POS 10 fix: encabezado configurable + tamaños (rama `fix/pos-10-encabezado-config`)

MSG-15 de Waldy/Coder sobre la plantilla única:

- **Empresa `sucursal`/`regimen`:** campos nuevos en
  `esquemaEmpresa`, `datosEmpresa`, el formulario de Configuración >
  Empresa (refactor `CamposDatos` por el candado de complejidad) y el
  mapeador `empresaPOS`. `getEmpresa` lee `select("*")`: las columnas
  llegan solas cuando existan. La migración aditiva propuesta
  (`alter table empresa` + `actualizar_empresa` extendida) quedó en
  `docs/pruebas/migracion-empresa-sucursal-regimen.sql` dentro de
  BEGIN/ROLLBACK — **no aplicada, espera OK de Waldy**. Hasta entonces
  el RPC viejo ignora las claves nuevas sin error y el ticket omite
  las líneas.
- **Tamaños:** empresa pequeña en negrita, `Cliente:` y título del
  documento al tamaño del cuerpo, `Total` a `1.2em` (se quitó el
  `1.5em` de Alegra que se veía grande). Los dos cierres reales
  (`cierre-3`, `cierre-4`) salen con el título en una línea.
- **Tests:** `impresion.test.ts` suma el bloque «encabezado de empresa
  completo» (orden Alegra, omisión sin datos, prefactura sin
  `Vence`, cotización con `Vence`/`Vendedor`) y
  `validacion.test.ts` cubre `sucursal`/`regimen`.
- **Capturas nuevas:** `config-empresa.png`, `cierre-3.*`,
  `cierre-4.*`, `comparacion-cierres.png` y los recortes
  `comparacion-{encabezado,cliente-doc,items-totales,pie}.png`.

## POS 10 MSG-22: medidas exactas y candado PDF (`fix/pos-10-medidas-exactas`)

- Skill solicitada: `.opencode/skills/ticket-80mm/SKILL.md`, enlazada desde AGENTS.md, con tabla completa de tamaños/posiciones de Coder, encabezado configurable, reglas de plantilla única y verificación Poppler. Sustituye los tamaños provisionales en em del MSG-15.
- `TicketPos`: Arial/Liberation Sans 9 pt; empresa/cliente/Total 13.5 pt bold; título 9; tabla 8.1 bold; ítem 7.29; detalle 6.55; logo configurable 69.8×20.9 mm. No se cargó logo ni datos.
- Cierre: 26.25 pt normal en una línea. Tras medir ~48 mm de texto contra ~45.8 mm útiles, se consultó y se autorizó reducir SOLO los márgenes laterales del título a 4 mm. Filas 7.5 pt, dinero 9 pt. Débito/crédito cero se muestran separados cuando el total de tarjetas es cero; con importes históricos sin atribución se conserva la fila combinada, sin inventar desglose.
- Prueba `src/lib/pos/ticket-pdf.test.tsx`: genera los cuatro PDFs con componentes reales, Tailwind real y Chromium sin servidor/base; comprueba fuentes incrustadas con pdffonts, tamaños ±0.3 pt con pdftotext -bbox (alto de caja convertido usando métrica Arial/LiberationSans 1.1171875), dimensiones, una página, caja del logo y pesos. Corre con `pnpm test:pdf`; el job `pdf` de CI instala Chromium, Poppler y Liberation, y `pnpm test` ya no los necesita.
- Evidencia real regenerada en `docs/diseno/capturas/pos-10/`: factura/prefactura/cotización y ambos cierres No 3/4. Comparaciones y recortes a 150 dpi en ambos lados, sin redimensionar, con datos sensibles de referencia ocultos. Preview oficial bloqueado por sandbox de Chrome al ejecutar T3 como root; se usó Playwright local 3029 tras dos fallos, sin tocar 3010.
- SQL: se preguntó por el timestamp futuro `20261126121000` y se eligió **Conservar propuesta**. Sigue en `docs/pruebas/migracion-empresa-sucursal-regimen.sql`, sin aplicar ni promover a migrations, sin modificar el candado. Se mantiene íntegro el trabajo de configuración de #120.
- Verificación: typecheck/check/test/build aprobados. Sin escrituras de negocio, sin migraciones aplicadas ni datos inventados.

## POS 9 — pestañas de venta con ⋮, renombrar y eliminar (`feat/pos-pestanas-venta`)

Base `feat/pos-alegra-exacto`. Solo presentación y estado en memoria: sin base, migraciones ni ventas nuevas.

- **Reglas puras** en `src/lib/pos/pestanas-venta.ts` (`renombrarPestanaEn`, `eliminarPestanaDe`, `esPestanaPrincipal`) usadas por el provider: la principal (primera) nunca se elimina, el carrito nunca queda sin pestaña y al borrar la activa se activa su vecina anterior. Nombre vacío conserva el anterior; máximo 30 caracteres.
- **UI:** ⋮ visible siempre en la activa y al hover/foco en las demás; Renombrar/Eliminar en las extra y solo Renombrar en la principal; input inline con Enter/blur que guarda y Escape que cancela; la extra vacía se borra al instante y con productos pide la confirmación corta. La tira hace scroll a la pestaña activa en móvil.
- **Hidratación:** el id de la primera pestaña es fijo (`ID_PESTANA_PRINCIPAL`) para que SSR y cliente coincidan; se eliminó el warning de hidratación del POS.
- **Tests:** `src/lib/pos/pestanas-venta.test.ts` (9 casos de comportamiento) + candado en `diseno-pos.test.ts` (⋮, Renombrar/Eliminar, principal sin Eliminar, confirmación solo con productos, 160 px/Basket/teal/dark).
- **Capturas:** `docs/diseno/capturas/pos-9/` con menú, renombrar y confirmación (claro), detalles, oscuro y móvil + `medidas.md` (pestaña 160 px, barra 44, menú ⋮ 24, input 128×32, diálogo 384).
- **Verificado:** `pnpm typecheck`, `pnpm check`, `pnpm test` (1,584 aprobados, 3 omitidos) y `pnpm build` en verde; Playwright con 0 errores de consola y sin crear ni editar ventas. Integrado con `origin/feat/pos-alegra-exacto` (PR #113 y POS 5) sin conflictos en código.

## Regla de capturas al terminar (rama `docs/regla-capturas-preview`)

Solo documentación. `AGENTS.md` gana la sección «Preview y capturas al terminar»
(22-11-2026): todo agente entrega capturas desde el preview oficial
`http://127.0.0.1:3010` (ZZTEST, 1440 px, una por punto) guardadas en
`/root/referencias/capturas-terminadas/`; el Orquestador actualiza el preview al
juntar (`git pull` de `feat/pos-alegra-exacto`, `pnpm build`,
`systemctl restart medoxigas-preview`, 200) y reporta cada ruta con una línea.

## POS 2: hojas móviles, carrito táctil y totales largos (rama `fix/pos-2-movil`, PR #113)

Trabajo de subagente ejecutor sobre los puntos 1–5 del ajuste móvil del POS 2, base `feat/pos-alegra-exacto` (merge `cb8eb13` del PR #108). Solo presentación: precios, cantidades, impuestos y el motor del carrito intactos.

- **Hojas móviles:** `w-[271px]!` en `menu-pos.tsx` y `w-full!` en `vender-pos.tsx` / `pagos-pos.tsx` vencen al `data-[side=*]:w-3/4` de `sheet.tsx` (que no se tocó). Menú 292.5 → **271 px**; factura 292.5 → **390 px** (420 en `sm`); detalle de pagos con la misma corrección (480 en `sm`; la terminal no tiene pagos para abrirlo en vivo).
- **Carrito táctil:** las acciones lápiz/papelera llevan `[@media(hover:none)]:hidden`, así que un tap sobre el total no toca nada; quitar sigue en «Quitar línea» del editor. Verificado con `hasTouch`: 1 línea antes y después del tap.
- **Cantidad y total:** input de cantidad 40 → **60 px** (muestra `1234.56` completo); la columna del total pasa de `w-[112px]` a `min-w-[112px]` (`min-w-[152px]` en xl) con `whitespace-nowrap`: `RD$12,980.00` deja 16 px al `+` a 1024 y 56 px a 1280/1440, sin solape. Fila de 76 px, tipografías y stepper de 36/18 de #108 intactos.
- **Candado:** `src/lib/pos/diseno-pos.test.ts` exige los anchos con `!`, el input de 60 px, el `min-w` del total y las acciones ocultas en `hover: none`.
- **Evidencia:** `docs/diseno/capturas/pos-2-movil/` (antes/después de menú y factura, cantidad 1234.56, total largo a 1024/1280 y táctil) + `medidas.md`.
- **Verificación:** `pnpm typecheck`, `pnpm check`, `pnpm test` (1566) y `pnpm build` en verde; capturas con Playwright en el puerto 3026.
## POS 5: «Nuevo pago» como Alegra (rama `feat/pos-nuevo-pago-alegra`)

Rediseño del modal de registrar movimiento del POS sobre la base del PR #107
(`feat/pos-alegra-exacto`, eae6704). Solo diseño y mapeo a la lógica existente:
no hay migraciones, RPC nuevas ni tablas nuevas.

- **Paso 1 (`dialogo-movimiento.tsx`):** tarjeta «Nuevo pago» con el texto de
  Alegra y dos tarjetas grandes: **Ingreso en verde** y **Egreso en rojo** (decisión de
  Waldy; en Alegra son blancas), con foco visible. En móvil se apilan.
- **Paso 2:** header de 80 px con flecha atrás y X; Egreso lleva segmented
  control «Gastos generales / Pago a factura de proveedor». Formulario de dos
  columnas: Proveedor/Cliente opcional (`SelectorContacto` existente),
  Método de pago como estado «Efectivo · Solo efectivo», Cuenta contable
  obligatoria, Total a pagar (> 0) y Observaciones con contador 0/300.
- **Mapeo:** Ingreso → `motivo: "otro"`, `cuenta_contrapartida_id`, contacto y
  notas. Egreso/Gastos generales → `motivo: "gasto_menor"`,
  `cuenta_gasto_id`, `subtotal = monto`, `itbis_tasa: "0"` (el formulario de
  Alegra no muestra ITBIS) y `descripcion` = Observaciones o «Gasto de caja del
  POS». El retiro prellenado por «Inverso» sigue abriendo directo el formulario
  con `motivo: "otro"` y deja elegir la cuenta. Validación local: CTA
  deshabilitado sin cuenta/total y el egreso no puede dejar la caja en negativo
  (usa `ResumenTurno.efectivo`).
- **Capturas y medidas:** `docs/diseno/capturas/pos-nuevo-pago/` (antes, tipo,
  egreso, factura de proveedor, ingreso, oscuro y móvil) + `medidas.md` con la
  comparación px por px contra las capturas 09/10 de Alegra (modal 800 px,
  tarjetas 375×250, segmented 48/40, inputs 48, textarea 106, footer 80).
- **Candado:** `src/lib/pos/diseno-pos.test.ts` exige los textos del diseño,
  Ingreso/Egreso en verde/rojo, el estado de proveedor y el camino prellenado;
  falla si vuelve «Registrar movimiento» o el selector de «Motivo».
- **Pendientes anotados (no se tocó backend):** «Pago a factura de proveedor»
  no tiene puente al POS (pestaña visible con estado «No disponible en el POS
  todavía»). Decisión de Waldy: se dejan solo las dos tarjetas de Alegra; el
  «Cobro de factura» y los motivos `fondo_caja`/`retiro_caja`/`deposito_banco`
  quedan como pérdida funcional documentada para una tarea aparte (el ingreso y
  el retiro genérico usan `otro`).
- **Verificación:** `pnpm typecheck`, `pnpm check`, `pnpm test` (1570 passed, 3 skipped)
  y `pnpm build` en verde. Capturas con la sesión ZZTEST, sin registrar ningún
  movimiento real (solo se llenaron formularios).

## POS 2 Punto 3 — modal «Pagar factura» como Alegra (`feat/pos-2-pago-alegra`)

Diseño del checkout del POS, sin tocar cobro, payload ni base. Base: PR #107 (`eae6704`).

- **Fuera el bloque viejo de crédito:** se eliminaron «Aplicado a la venta» (efectivo y tarjeta/transferencia), «Queda a crédito» con su explicación, el aviso rojo de Consumidor Final, el selector «Cliente para el crédito» y el resumen duplicado del modo combinado. La regla de negocio sigue en el servidor.
- **«Por cobrar» como Alegra:** una sola línea de 16 px bajo el TOTAL, monto en `#E11D48`, cuando el pago es menor; «Cambio» en rojo si sobra; nada si es exacto. Aplica a efectivo, tarjeta/transferencia, combinado y crédito.
- **CTA clicable y toast local:** se quitó `(hayCredito && esConsumidorFinal)` de `ctaDeshabilitado`; `cobrar()` intercepta antes de `completarVenta`, muestra un toast arriba a la derecha (`role="alert"`, fondo `#FFE4E6`, icono rojo, título «Algunos campos necesitan tu atención», texto «Revisa los campos marcados antes de guardar.» y cierre) y retorna sin escribir. Verificado con Playwright: 0 POST al pulsar Cobrar y el modal sigue abierto.
- **Medidas de Alegra:** modal 640 px (antes 720), título 24 px/600, total 24 px/600, inputs 48 px radio 5, textarea 100 px radio 5, botones 40 px radio 8 y footer blanco sin banda. Los montos del modal usan `formatoMonedaPOS` (`RD$112.10` sin espacio). Se migró el archivo a tokens `--pos-*` (sale de `PENDIENTES`).
- **Vendedor:** el selector de `CamposCobro` se conserva (label «Vendedor», placeholder «Seleccionar», mismo ancho que Observaciones), pero no se ve en las capturas porque la base no tiene vendedores activos; no se crearon datos.
- **Candado:** `src/lib/pos/diseno-pos.test.ts` falla si vuelven «Queda a crédito», «Aplicado a la venta», «Cliente para el crédito», el aviso rojo de Consumidor Final o el azul; exige una sola línea «Por cobrar», el toast y que la validación del cliente ocurra antes de `completarVenta`.
- **Capturas:** `docs/diseno/capturas/pos-3/` (`antes-pago-credito.png`, `despues-pago-credito.png`, `despues-pago-toast.png`, `despues-pago-exacto.png`, `despues-pago-oscuro.png`, `despues-pago-movil.png`) y `medidas.md`. No hay `despues-pago-combinado.png`: la terminal no tiene cuentas de tarjeta/transferencia configuradas.
- **Verificado:** `pnpm typecheck`, `pnpm check`, `pnpm test` (1,565) y `pnpm build` en verde; capturas claro/oscuro/móvil tomadas en el puerto 3014.
## Ticket POS 80 mm igual a Alegra (rama `feat/pos-ticket-80mm-alegra`, PLAN POS 2 Punto 4)

Trabajo de subagente ejecutor sobre `feat/pos-alegra-exacto` (PR #107). Solo diseño de impresión del ticket térmico.

- **Papel 80×250 mm real:** Chrome ignora `size: 80mm auto` en `@page` y cae a Letter. En `ticket-pos.tsx` los `@page` nombrados `pos-ticket-80/57` ahora usan alto fijo (`size: 80mm 250mm` / `57mm 250mm`, margin 0). Verificado con Playwright + pdfinfo: el PDF del ticket sale **1 página de 227.04 × 708.96 pt**, idéntico al PDF real de Alegra (`/root/referencias/plan-pos-2/alegra-ticket-80mm.pdf`). El `@page` letter global de reportes no se tocó.
- **Orden de Alegra en `impresion.ts`:** empresa → `Cliente: <nombre>` → comprobante (NCF, `Fecha: dd/mm/aaaa h:mm am/pm`, `Tipo de pago`, nuevo `Método de pago` — «Combinado» si hubo varios, se omite sin pagos — `Vendedor`, `Vencimiento`, `Vence NCF`) → ítems → totales → `Total recibido`/`Cambio` a la izquierda → conteos → pie. Quitados `Terminal:`/`Turno No`/`Cajero:` de la factura (cierre/recibos los conservan), el bloque «Pagos» separado, la nota «ITBIS incluido» y la numeración de ítems.
- **Montos como Alegra:** `RD$` sin espacio en totales/cobro (`moneda()`), totales de ítem y «cant x precio» sin moneda (`numero()`); detalle «2 x 112.10» con `x` simple.
- **Medidas (`ticket-pos.tsx`):** base mediana 10 pt e interlineado normal 1.35 (paso 13.5 pt, igual a Alegra); empresa y «Cliente:» a 1.5em, ítems 0.8em, detalle 0.72em, encabezado Item/Total 0.9em, Total 1.5em; etiquetas `Etiqueta:` en negrita con valor normal (`LineaDato`); padding 6mm/5mm. 57 mm conserva su escala y columnas apiladas.
- **Sin datos para Sucursal/Régimen:** se omiten (no existen en la app); pie vacío no imprime nada.
- **Candado nuevo** en `src/lib/pos/diseno-pos.test.ts`: exige `size: 80mm 250mm`/`57mm 250mm`, prohíbe el alto `auto`, «Generado en Alegra POS», «OXYMAT», y `Terminal:`/`Turno`/`Cajero:` en `armarTicketFactura`; exige `Total recibido` y `Método de pago:`.
- **Evidencia:** `docs/diseno/capturas/pos-ticket/` — `antes-ticket-80mm.pdf` (612×792 Letter), `despues-ticket-80mm.pdf` (227.04×708.96, 1 pág.), PNGs, `comparacion-80mm.png` (referencia de Alegra con los datos de OXYMAT tapados; el original queda en `/root/referencias/plan-pos-2/` y NO se commitea) y `medidas.md` con la tabla de medidas. Capturado desde `/pos/historial` con la venta B0200000007, sin crear ni tocar datos.

## POS 6 — cierre de turno como Alegra (`feat/pos-cierre-turno-alegra`)

- Formulario de cierre con efectivo contado vacío, label «Dinero en efectivo del cierre» y esperado solo como referencia; no presenta diferencias ni switch hasta escribir un monto válido. Validación y payload de cierre intactos.
- Ticket y payload presentacional aislados en `ticket-cierre-pos.tsx` / `impresion-cierre.ts`; cierre fijo 57 × 250 mm, independiente de la plantilla de ventas de 80 mm. Sin cabecera empresarial ni pie. No se tocaron `ticket-pos.tsx`, `impresion.ts`, RPC ni datos.
- Tarjetas por cuenta de la terminal del turno (incluidas las demás terminales): separa débito/crédito solo con cuentas distintas y suma conciliable. En el cierre No 3 los datos no permiten separar: fallback «Ventas con tarjeta» confirmado por pregunta. Contado null usa esperado; observaciones vacías «-».
- Evidencia real en `docs/diseno/capturas/pos-cierre/`: formulario claro/oscuro/móvil, PDFs antes/después, comparativo Alegra y tabla de medidas. Playwright solo leyó turnos, abrió/canceló formulario y validó el monto vacío, sin ejecutar cierres. PDF antes Letter 612 × 792 pt; después 1 página de 162 × 708.96 pt. Linux usa Liberation Sans, métricamente equivalente a Arial; la fila única de tarjetas acorta 22.5 pt el bloque inferior respecto a la referencia.
- Verificación: typecheck, check (sin errores), 1567 tests aprobados / 3 omitidos, build y 4 candados nuevos. Pendiente revisión visual e integración por Orquestador, sin merge a main.

## POS 2: menú sin toggle y línea de carrito como Alegra (rama `feat/pos-2-menu-carrito`)

Trabajo de subagente ejecutor sobre el PLAN POS 2 (puntos 1 y 2), base `feat/pos-alegra-exacto` (`eae6704`). Solo presentación: no se tocaron precios, cantidades, impuestos ni el motor del carrito.

- **Menú (`menu-pos.tsx`, `menu-pos-estilos.ts`):** fuera el `Collapsible` y las flechitas de «Ingresos» y «Turnos». Los títulos pasan a `itemMenuSeccion` (mismo alto, tipografía y padding, sin hover de enlace) y sus subitems —Historial de ventas, Registro de pagos e Historial de turnos— quedan siempre visibles al expandir, con la misma línea vertical; en el riel de 52 px sigue solo el icono de la sección. Pin, cajón móvil, `aria-current` y `title` intactos.
- **Línea del carrito (`linea-carrito-pos.tsx`):** fila única de 76 px con nombre 14 px bold y precio unitario 12 px gris a la izquierda; stepper `− 1 +` de botones 36 px con iconos de 18 px en el centro (57 % del ancho, como Alegra) y total 15 px bold aislado a la derecha; lápiz y papelera dejan de apilarse bajo el total y aparecen flotando sobre él solo al hover/foco, sin cambiar la altura. El editor expandible conserva todo y suma «Quitar línea» para móvil/touch.
- **Candado (`src/lib/pos/diseno-pos.test.ts`):** prohíbe `Collapsible`/`ChevronDown` en el menú, exige los 3 subitems, la fila de 76 px, la tipografía, el stepper de 36 px y las acciones `absolute` + hover/foco (sin el bloque apilado anterior).
- **Medidas y capturas:** `docs/diseno/capturas/pos-2/` con los pares antes/después del menú y la fila, panel, oscuro y móvil; `medidas.md` compara Alegra (captura 04, escala ~1.25×) contra el antes y el después parte por parte.
- **Verificación:** `pnpm typecheck`, `pnpm check`, `pnpm test`, `pnpm build` y capturas con Playwright en el puerto 3013.

## Carrito POS como copia visual exacta de Alegra (rama `feat/pos-carrito-alegra`)

Rehace el carrito/panel de factura del POS para que se vea como Alegra, por decisión de Waldy (22-11-2026): el POS copia el diseño exactamente, incluido el teal `#00b19d`; el resto del sistema mantiene los tokens Medoxigas y sigue prohibido copiar código fuente de Alegra. Se repitió el trabajo de una sesión perdida en un VPS.

- **`src/app/globals.css`:** paleta POS `--pos-*` en claro y oscuro (`--pos-primario` #00b19d, `--pos-primario-hover` #008e79, `--pos-oscuro` #1e293b, `--pos-linea` #e2e8f0, `--pos-panel` #f8fafc, textos/iconos de Alegra) + aliases Tailwind `--color-pos-*`. Preset Medoxigas intacto.
- **`panel-factura.tsx`:** encabezado 64 px «Factura de venta» + rayo en círculo + 3 iconos grises (`%` → venta simple, impresora → `/pos/historial`, sliders → menú Guardar/Cargar cotización + Venta simple F4); selects Lista de precio / Numeración (`Consumo (02)` sin la B del prefijo); Cliente + «Nuevo» agua; fuera el bloque Subtotal/ITBIS del cuerpo y el aviso «sin turno» (ahora vive una línea «Turno No N abierto · Cerrar turno» / «Turno cerrado · Abrir turno» sobre el catálogo, como en Alegra); pie fijo con «Vender» teal a lo ancho (total a la derecha), botón oscuro de ticket con punto gris, caja «N Producto(s) / Cancelar» y las pestañas al pie.
- **`linea-carrito-pos.tsx`:** nombre en mayúsculas + precio unitario, stepper `− N +` sin bordes, total arriba a la derecha, lápiz/papelera solo en hover/foco; editor expandible intacto.
- **`pestanas-venta-pos.tsx`:** barra al pie estilo Alegra — cesta + «Venta principal», borde teal en la activa, `+` y menú ⋮ (Renombrar/Eliminar). La primera pestaña pasa a llamarse «Venta principal»; en móvil sigue dentro del `Sheet`.
- **`formato-pos.ts`:** `formatoMonedaPOS` → `RD$10.00` sin espacio; aplicado en el panel, las líneas, la tarjeta de producto y la barra móvil.
- **Tokens POS aplicados** también en `catalogo-pos.tsx` («Nuevo producto» agua), `tarjeta-producto-pos.tsx` (borde/badge/`Inv. N` teal), `tarjeta-venta-simple-pos.tsx`, el «Ver factura» móvil y el shell con fuente Inter (`layout.tsx`).
- **Candado nuevo `src/lib/pos/diseno-pos.test.ts`:** prohíbe `--primary`/`#1e56c7` en `src/app/(pos)/pos/` con una lista de 10 pendientes que solo puede encoger (checkout, confirmación, venta simple, menú, historial, devoluciones, pagos…) y exige la paleta en `globals.css`.
- **Docs:** se quitó la regla «inspiración, no copia» y la prohibición del teal de `docs/alegra/pos/alegra-pos.md`, `design-alegra-pos.md`, `css-pos/GUIA-POS.md`, `docs/diseno/pos-ui.md`, `AGENTS.md` y la skill `diseno-ui`, sustituidas por la regla de copia exacta en el POS.
- **Capturas:** `docs/diseno/capturas/pos-carrito-alegra/` con `antes.png` (referencia), `despues.png` + `despues-panel.png` + `despues-oscuro.png` + `despues-movil.png` y `comparacion.png` (Alegra vs implementado, lado a lado). Diferencias residuales con Alegra: la cantidad se muestra con decimales («2.00», el POS admite fracciones) y en la captura el botón Vender sale deshabilitado por «Turno cerrado».

## Cierre Fase 3 rediseño Alegra (rama feat/fase3-cierre)

Trabajo de subagente ejecutor sobre `docs/PLAN-FASE-3-REDISENO-ALEGRA.md` (S10), pendiente de revisión/integración del Orquestador. Cierra la deuda técnica anotada en este archivo: exponer `nomina_agregar_empleados`, sumar las pantallas del rediseño POS a los candados y dejar los docs al día.

- **Botón «Agregar empleados» habilitado** (detalle del periodo de nómina):
  - `src/lib/nomina/esquemas.ts`: nuevo `agregarEmpleadosPeriodoSchema` (`periodo_id` uuid + `empleado_ids` uuid[] de 1 a 500).
  - `src/lib/nomina/acciones.ts`: nueva acción `agregarEmpleadosPeriodo` — llama `supabase.rpc("nomina_agregar_empleados", { p_periodo_id, p_empleado_ids })` directo (ya está en `types.ts`, no necesita el puente `clienteNominaPendiente`), devuelve `{ agregados }` y revalida el periodo. 4 tests nuevos en `acciones.test.ts` (RPC con el payload, mínimo 1 empleado, error de estado en español, lector bloqueado).
  - `src/app/(main)/dashboard/contabilidad/nomina/periodos/[id]/_components/acciones-periodo.ts` (nuevo, `"use server"`): `leerEmpleadosAgregables` carga perezosa del diálogo — empleados elegibles con el mismo filtro de la RPC (activos, misma frecuencia, contrato vigente en el rango del periodo) + el estado de su recibo en el periodo.
  - `src/app/(main)/dashboard/contabilidad/nomina/periodos/[id]/_components/dialogo-agregar-empleados.tsx` (nuevo): diálogo según `docs/diseno/nomina-ui.md` §713-717 — búsqueda por nombre, `TablaLista` compacta con checkboxes, pill de situación «Se agregará» / «Ya tiene recibo» (deshabilitado) / «Se reactivará» (recibo anulado), contador «N seleccionados», botón «Agregar N empleados», toast con el conteo y nota cuando la RPC salta a alguien. El botón del `EncabezadoPagina` y el CTA del estado vacío abren el diálogo; se muestra cuando el periodo no está `contabilizado` ni `pagado` (la RPC también acepta `anulado` y revivir recibos es la vía documentada para desbloquearlo).
- **Candados POS:**
  - `src/lib/tablas-listas.test.ts`: `tabla-movimientos-turno.tsx` entra a `LISTAS_MIGRADAS` (única `TablaLista` del POS); nueva lista `LISTAS_POS` con las 9 piezas maestro-detalle del rediseño — verifican que usan el kit compartido (`TarjetaLista`/`BarraLista`/`PillEstado`) y no definen pills locales. `/pos` (vender) queda fuera a propósito: es la terminal a pantalla completa.
  - `src/lib/diseno-paginas.test.ts`: nueva lista `PAGINAS_POS` — los `*-pos.tsx` de `/pos/pagos`, `/pos/turnos`, `/pos/historial` y `/pos/devoluciones` usan `EncabezadoPagina` sin `<h1>` suelto ni `text-3xl` (sin migas: la navegación es el riel lateral; las `page.tsx` del POS son server components chicos).
- **Docs:** `docs/dominio-pos.md` §1.2 ahora describe las 5 pantallas (`/pos`, `/pos/pagos`, `/pos/turnos`, `/pos/historial`, `/pos/devoluciones`) y el riel lateral `menu-pos.tsx` (56 px → 271 px hover/pin, cajón móvil); `AGENTS.md` menciona el punto de venta en «Módulos» y resume los dos candados extendidos.
- **Iconos:** `src/components/icons.tsx` sigue siendo el punto único; no queda ningún import de `lucide-react` en `src/` (solo un comentario del propio adapter).
- **Verificación:** `pnpm typecheck` ✅, `pnpm check` ✅ (0 errores; warnings de complejidad preexistentes, el nuevo diálogo tiene 21 como los 24 del diálogo de colillas y 24→25 de `DetallePeriodoCliente`) y `pnpm test` ✅ (todos los archivos, incluidos los 4 tests nuevos). Este worktree no tiene `.env.local` ni credenciales: la evidencia visual del diálogo (claro/oscuro) la debe generar el Orquestador.

## Rediseño POS estilo Alegra: carrito «Factura de venta» C4 (rama `feat/pos-carrito-factura-venta`)

Trabajo de subagente ejecutor sobre `docs/planes/rediseno-alegra/PLAN.md` (parte C4), pendiente de revisión/integración del Orquestador. Parte de `feat/pos-shell-rail-alegra` (872f545); solo UI/UX del panel derecho, lógica del carrito y `CarritoPosProvider` intactos.

- **`panel-factura.tsx`:** encabezado «Factura de venta» a 16 px semibold; fila Cliente en línea (etiqueta + `SelectorContacto` + botón «Nuevo» en primario suave `bg-primary/10 text-primary` que abre el `DialogoNuevoContacto` ya existente — el mismo que usa «Crear nuevo cliente» del combobox — y selecciona el contacto creado con `carrito.setContacto`); bloque de totales igual (Subtotal/Descuento/ITBIS por tasa en gris + Total grande); botón «Vender» h-12 justify-between con el total a la derecha y `F8` como kbd al extremo; debajo «N artículos» y «Cancelar venta» en rojo; las acciones secundarias (Guardar/Cargar cotización, Venta simple F4) pasaron a una fila compacta de iconos ghost `text-xs` que no compite con Vender; pestañas al pie sin cambios.
- **`linea-carrito-pos.tsx`:** una fila con la jerarquía de Alegra — nombre (line-clamp-2) + meta gris con precio unitario a la izquierda, stepper `− N +` de 36 px centrado, total semibold a la derecha; editar/quitar como iconos ghost de 28 px bajo el total; sección expandible (unidad, precio, descuento, ITBIS) intacta con px-3.
- **`vender-pos.tsx`:** panel fijo a 400 px en escritorio (se quitó `xl:w-[420px]`); el `Sheet` móvil sigue en `sm:max-w-[420px]`.
- **Sin capturas:** este worktree no tiene `.env.local` ni credenciales E2E ni Playwright; la evidencia visual (claro/oscuro, 1024/1280/1440 y comparación con `img/02-alegra-pos-carrito.png`) la debe generar el Orquestador en su entorno.
- **Verificación:** `pnpm typecheck` y `pnpm check` (0 errores; solo las 6 advertencias de complejidad preexistentes en los archivos tocados) verdes; `pnpm test` 1497/1498 con el mismo fallo ambiental de `src/lib/pos/impresion.test.ts` («hora de recepción», ICU de Node 22 con `p.\u00A0m.` no rompible; archivo no tocado).
- **Pendiente de la 2.ª pasada de C4 (otra tarea):** alinear visualmente el checkout (modal de pago, métodos, confirmación) con este mismo lenguaje.

## Rediseño POS estilo Alegra: catálogo en tarjetas C5 (rama `feat/pos-catalogo-tarjetas`)

Trabajo de subagente ejecutor sobre `docs/planes/rediseno-alegra/PLAN.md` (parte C5), pendiente de revisión/integración del Orquestador. Base: `feat/pos-shell-rail-alegra` (shell C1+C3).

- **Fila superior estilo Alegra** (`catalogo-pos.tsx`): buscador ancho con lupa y hint F2, botón icono de escáner (`ScanBarcode`, enfoca el buscador para leer/escribir el código) y «Nuevo producto» en primario suave (`bg-primary/10`) que abre `/dashboard/productos/nuevo` en pestaña nueva. El Select de categoría, el toggle «Favoritos» y el conteo de productos pasan a una fila discreta debajo — funciones conservadas.
- **Tarjeta de producto** (`tarjeta-producto-pos.tsx`): blanca, borde fino, radio 10 px; imagen o icono `Tag` centrado (zona 64 px), `Inv. N` en primario (o «⚠ Agotado» ámbar / «Servicio» / «Combo»), nombre en 2 líneas y precio semibold; estrella de favorito en chip primario dentro de la esquina y badge circular con la cantidad solapando el borde; borde primario cuando está en el carrito (`ring-1` sin salto de layout) o resaltada por teclado.
- **Tarjeta «Venta simple»** (`tarjeta-venta-simple-pos.tsx`, nueva): primera del grid, icono `Zap` en círculo gris; abre el `DialogoVentaSimple` existente (misma acción que F4 y que el botón del panel).
- **Imágenes** (`imagenes-catalogo-pos.ts`, nueva): hook que firma en lote las URLs del bucket privado `productos` con el cliente del navegador (1 llamada por carga, 1 h de vigencia); sin imagen o con error → icono `Tag`. No se tocaron RPC ni consultas.
- **Grid**: `repeat(auto-fill, minmax(170px,1fr))` con gap 16 px → ~4 columnas a 1280, ~7 a 1920 (medida real de Alegra ≈ 200 px por tarjeta). Esqueletos a 196 px.
- **Sin capturas:** este worktree no tiene `.env.local`, credenciales ni cache de Playwright; la evidencia visual (claro/oscuro/móvil + comparación con `img/02`) la debe generar el Orquestador.
- **Verificación:** `pnpm typecheck` y `pnpm check` (0 errores) verdes; `pnpm test` 1497/1498 con el mismo fallo ambiental ya conocido en `src/lib/pos/impresion.test.ts` (ICU de Node 22 con `p.\u00A0m.`; archivo no tocado).

## Rediseño POS estilo Alegra: shell con riel lateral C1+C3 (rama `feat/pos-shell-rail-alegra`)

Trabajo de subagente ejecutor sobre `docs/planes/rediseno-alegra/PLAN.md` (partes C1 y C3), pendiente de revisión/integración del Orquestador:

- **Shell nuevo:** `EncabezadoPos` + `NavegacionPos` (barra superior con tabs) eliminados; la navegación vive en `src/app/(pos)/pos/_components/menu-pos.tsx`: riel de 56 px que expande un panel de 271 px al hover/foco (con pin), cajón móvil de 271 px con velo bajo 1024 px y barra mínima `lg:hidden`. Estructura del menú: Facturar → `/pos`; acordeón Ingresos → Historial de ventas `/pos/historial` + Registro de pagos `/pos/pagos`; acordeón Turnos → `/pos/turnos`; Devoluciones `/pos/devoluciones`; separador; Contactos/Inventario/Configuraciones → `/dashboard/...` en pestaña nueva; pie con selector de terminal, insignia de turno (punto + pill ABIERTO/CERRADO), usuario, «Volver a Contabilidad» (con confirmación si el carrito tiene líneas) y «Salir».
- **Medidas compartidas en `menu-pos-estilos.ts`:** ítem 32 px, radio 6 px, activo = acento + barra primaria 3×16 px. Clases auxiliares reutilizadas por los componentes del pie (`colapsado`).
- **C1:** el shell mide `h-dvh` con `overflow-hidden`; `main` es `min-w-0 min-h-0 flex-1 overflow-y-auto`; `vender-pos.tsx` solo suma `overflow-hidden` a su marco → el panel Factura de venta queda pegado al borde derecho del viewport en todos los anchos.
- **Nueva ruta placeholder:** `src/app/(pos)/pos/pagos/page.tsx` (EncabezadoPagina + ContenedorLista) para que el enlace «Registro de pagos» no caiga en 404; la pantalla completa es C6 del plan.
- **Sin capturas:** este worktree no tiene `.env.local` ni credenciales E2E ni cache de Playwright; la evidencia visual (claro/oscuro/móvil + medición del borde derecho del panel) la debe generar el Orquestador en su entorno.
- **Verificación:** `pnpm typecheck` y `pnpm check` (0 errores) verdes; `pnpm test` 1497/1498 con un solo fallo ambiental en `src/lib/pos/impresion.test.ts` («hora de recepción»: el ICU de Node 22.21.1 emite `p.\u00A0m.` con espacio no rompible y el literal del test usa espacio normal; archivo no tocado por esta tarea).

## C9-A: Checkout, Confirmación y Venta simple estilo Alegra (rama `feat/pos-checkout-confirmacion-simple`)

- **Checkout «Pagar factura»** (`checkout-pos.tsx`): TOTAL centrado grande, flujo en dos pasos — primero tiles 3+3 con icono (Efectivo, Tarjeta crédito, Transferencia / Tarjeta débito, Combinado, Crédito) con divisor «Otros métodos», luego detalle con «Cambiar método». En efectivo: pills de opciones rápidas (Exacto + redondeos), campo recibido, «Cambio» destacado, observaciones a la derecha. Conservados combinado, pago parcial, crédito y toda la lógica de `completarVenta`.
- **Confirmación** (`confirmacion-venta.tsx`): círculo primario con check, «¡Venta completada!», chip Total + Cambio, acciones Imprimir ticket / PDF Carta / Nueva venta.
- **Venta simple F4** (`dialogo-venta-simple.tsx`): layout calculadora (nombre, display grande, grid dígitos/operadores ce/C/%, CTA full-width «Aplicar a la venta»). Sin cambios en `dialogo-cargar-cotizacion.tsx` ni `panel-factura.tsx`.
- **Verificación:** `pnpm typecheck` ✅, `pnpm check` ✅ (0 errores), `pnpm test` ✅ salvo 1 fallo preexistente/ambiental en `src/lib/pos/impresion.test.ts` (formato ICU de Node 22: `20 nov 2026, 3:10 p. m.` vs esperado `20/11/2026 03:10 p. m.`; no toca los archivos de la tarea).
- **Capturas** en `/tmp/pos-shots/` (8 PNGs, claro/oscuro): venta simple, tiles de métodos, detalle efectivo con cambio y confirmación. Venta real de prueba cobrada end-to-end (B0200000005, RD$250, contacto PRUEBA CAPTURA ER); el turno 3 de `ZZCAPTURA Caja 1` se abrió y cerró cuadrado (Cierre No 3).
- **Pendiente:** `git push -u origin HEAD` — el entorno no tiene credenciales GitHub (`gh` no instalado, HTTPS sin token). Commits locales: `bd6ad5f`, `283df63`, `63d2c30`.

## Inicio rediseñado como "Resumen del negocio" (rama `feat/inicio-alegra-resumen`, pendiente de revisión)

El `/dashboard` replica la estructura del Resumen del negocio de Alegra con código propio (guía del ZIP `inicio-resumen-negocio-design`, referencia solo local en `/tmp/inicio-design`). Todo lee datos reales de Supabase; los widgets sin datos muestran el estado vacío "Sin … registrados" (ícono de gráfica gris + texto), nunca números inventados.

- **Datos (`src/lib/inicio/`):** `calculos.ts` (agregaciones puras + tests) y dos lecturas nuevas en `consultas.ts`: `obtenerMovimientoCuentas` (asientos por índice de fecha → líneas por lotes, el patrón de `getIngresosGastosMensual` que evita el join que agotaba `statement_timeout`) para el Flujo de transacciones y la Distribución de gastos; `obtenerTopVentas` para Productos más vendidos y Mejores clientes (desde `factura_lineas`/`facturas` no anuladas). La RPC `dashboard_resumen` existente sigue alimentando CxC/CxP, métricas y ventas — sin tocar backend ni migraciones.
- **Widgets (`dashboard/_components/inicio/`):** `widget-marco.tsx` (expandir/eliminar), `agregar-grafica.tsx` (menú que reactiva widgets ocultos), `widgets.tsx` (visibilidad en `localStorage["inicio.widgets.visibles"]`), `grafico-gastos.tsx` (donut top-5), `grafico-flujo.tsx` (barras ingresos/egresos), `tabla-top.tsx` (tablas con avatar de iniciales), `bancos-cajas.tsx` (saldos reales, opcional), `estado-vacio.tsx`, `titulo-widget.tsx`.
- **Layout:** fila KPI = CxC + CxP grandes + 4 métricas en 2×2; luego Ventas, Gastos y Flujo a ancho completo; Productos/Clientes en dos columnas. En móvil todo apila. Tokens Medoxigas (`--chart-1` azul, emerald solo para "año anterior"/ingresos como en el repo); sin teal.
- **Verificación:** `typecheck`/`check`/`test` en verde excepto `src/lib/pos/impresion.test.ts` que **ya fallaba antes** (formato de fecha dependiente del entorno, ajeno a este cambio). Capturas con sesión ZZTEST en `/tmp/capturas/` (claro, oscuro, móvil) — datos reales: CxP RD$708 vencida, ventas RD$958, flujo 1,958/1,000, top productos/clientes y bancos.
- **Pendiente:** revisión del Orquestador e integración a `main`.

> ## ESTADO PARA LA PRÓXIMA SESIÓN (21 nov 2026)
>
> **Fase 2 (Inventario ferretería + POS + Nómina RD) implementada y desplegada.** `main` en `df08712`; Vercel producción: https://medoxigas-contabilidad.vercel.app. Migraciones `20261125100000`–`20261125150000` **aplicadas al remoto**.
>
> **Waldy revisó la UI y tiene observaciones que dará en la próxima sesión.** No dar la fase por cerrada ni abrir la Fase 3 hasta recibirlas y corregirlas.
>
> **Pendientes técnicos ya documentados abajo:** exponer `nomina_agregar_empleados` en `src/lib/nomina/acciones.ts`, sumar las listas nuevas a `LISTAS_MIGRADAS`/`PAGINAS_MIGRADAS`, mover a `src/lib/pos/` las lecturas locales de #87, y propagar `unidad_id` en `crear_cotizacion`.
>
> **Evidencia visual:** 72 capturas en `C:\Users\wardy\AppData\Local\Temp\opencode\capturas-ui` (claro/oscuro/móvil) y sidebar en `...\capturas-sidebar`.
>
> **Para arrancar:** leer este archivo, `docs/PLAN-FASE-2-ORQUESTADOR.md` y `docs/ORQUESTADOR.md`.

## C8 cédula del empleado: máscara con cursor, dígito verificador y autocompletar DGII (21 nov 2026)

Subagente en `feat/nomina-cedula-autocompletar` (worktree `feat-nomina-cedula-auto-1c42038fb9541774`). El campo «Número de identificación» del wizard de empleado (`/dashboard/contabilidad/nomina/empleados/nuevo`, paso 1) ya no pelea con el cursor y trae el botón **Autocompletar** de la DGII, solo para tipo Cédula.

- **Máscara `000-0000000-0` con cursor estable** (`formato-nomina.ts`): `editarCedula` sanea el texto del input a dígitos **antes** de cortar (pegar `402-3772118-4` o con espacios no trunca), `borrarSobreGuion` hace que Backspace/Delete sobre un guion borre el dígito vecino, y el cursor se mide en dígitos (`digitosAntesDeCursor`/`posicionDespuesDeDigitos`) para restaurarlo con `useLayoutEffect` sin saltos al editar en medio. En `campos` solo se guardan dígitos.
- **Dígito verificador en cliente** (`src/lib/validacion/cedula.ts`): espejo exacto de `_rnc_digito_valido` (migración `20261124120000`) para RNC (9) y cédula (11). Se valida en `wizard-validacion.ts` al avanzar del paso 1 («La cédula no es válida: revisa el dígito verificador.»). **No se agregó al `empleadoSchema`** a propósito: `acciones.test.ts` usa la ficticia `00112345678` y la RPC sigue siendo la autoridad; su error («dígito verificador … errónea») se mapea inline al campo vía `camposConMensaje`/`pasoDeError` (movidos a `wizard-validacion.ts` para testearlos).
- **Autocompletar DGII**: reutiliza `useConsultaDgii`/`BotonAutocompletarDgii`/`MensajeDgii` y `buscarContribuyenteDgii` (ya aceptaba `cedula`; no se duplicó acción). `repartirNombreDgii` divide el nombre del registro (formato `NOMBRES APELLIDOS` en mayúsculas; también lee `APELLIDOS, NOMBRES`) en los 4 campos. `completarEmpleadoConDgii` **solo rellena campos vacíos o los que puso una consulta anterior** (`rellenosDgii` en un ref): nunca pisa lo escrito a mano y lo avisa. Al cambiar `identificacion`/`tipo` se limpia la consulta y el error de la cédula; los campos que la DGII rellena pierden su «obligatorio».
- **Verificado en navegador real** (Playwright + login `zztest1`, solo lectura): tipeo con guiones automáticos, error inline en rojo con `402-3772118-5`, y con la cédula real inscrita `008-0023549-1` el portal devolvió `JUAN CARLOS HERNANDEZ MARIANO` → Juan / Carlos / Hernandez / Mariano + mensaje verde. Capturas claro/oscuro/móvil en `/tmp/capturas-cedula` del subagente.
- **Ojo (dato para Waldy):** los RNC reales `130893489` y `131488791` **no pasan** `_rnc_digito_valido` — el algoritmo de la migración los rechaza; si la DGII devuelve RNC así habría que revisar el algoritmo del servidor. No se tocó backend/RPC/migraciones ni `esquemas.ts`.
- Tests nuevos: 5 (helper) + 29 (máscara/cursor/reparto/completar) + 14 (validación/mapeo) + 5 (flujo autocompletar con mock de la acción). `typecheck` verde; `test` falla solo `pos/impresion.test.ts` por la ICU del Node local (`20 nov 2026` vs `20/11/2026`), ambiental y ajeno al cambio.

## Fase 2 cerrada: UI de Inventario, POS y Nómina + auditoría (21 nov 2026)

Ocho PRs de UI integrados a `main` (#77 stock bajo, #79 conteo físico, #80 producto ferretería, #83 configuración Nómina, #84 empleados/inicio, #85 operación/pagos/envíos/TSS, #86 configuración POS, #87 pestaña `/pos`). `ci`, `scan`, `e2e` y `db` verdes en cada `headSha`; `typecheck`, `check`, `test` y `build` en verde tras integrar.

- **Migraciones aplicadas al remoto** (aprobadas por Waldy, `supabase db push --remote=ljfdhrnvlsfaweuvnqxz`): `20261125100000`, `101000`, `120000`, `121000`, `130000`, `131000`, `140000`. Verificado con PostgREST: las tablas nuevas responden (401 por RLS, no 404).
- **Capturas reales con sesión** (contador `zztest1`): 72 PNGs en `C:\Users\wardy\AppData\Local\Temp\opencode\capturas-ui` (23 rutas × claro/oscuro/móvil) y sidebar en `...\capturas-sidebar`. Se creó `ZZCAPTURA Caja 1` con un turno abierto (base RD$500) para poder capturar `/pos`; queda pendiente cerrarlo/desactivarlo.
- **Bug de 2D corregido en la integración:** `SelectorTerminal` usaba el carrito fuera del provider y `/pos` daba 500 cuando existía una terminal; el `CarritoPosProvider` ahora envuelve el encabezado.
- **Bug de 2B corregido:** el ticket y la carta imprimían el subtotal neto y además la fila Descuento; ahora el subtotal es el bruto (`subtotal + descuento`) con test.
- **Auditoría (PRs #88, #89, #90):**
  - `20261125150000_nomina_catalogos_rls.sql`: revoca INSERT/UPDATE/DELETE de `authenticated` en los 4 catálogos de Nómina y elimina las políticas `*_admin_escritura`; pgTAP de 23 asserts (admin/contador/lector, `42501`, RPC siguen funcionando). **Aplicada al remoto el 21 nov** con `supabase db push`; verificado con PostgREST: `SELECT` responde y el `UPDATE` directo devuelve 403.
  - Etiquetas de `origen_tipo` para POS y Nómina en Libro Diario/Asientos + candado que exige etiqueta para **todos** los valores del CHECK.
  - Nómina pasó a **grupo desplegable propio** en el sidebar (Inicio, Empleados, Cálculo, Pagos, Envíos, Reportes TSS), con test y capturas claro/oscuro.
- **Pendiente:** exponer `nomina_agregar_empleados` en `src/lib/nomina/acciones.ts` (el botón está deshabilitado); sumar las listas nuevas a `LISTAS_MIGRADAS`/`PAGINAS_MIGRADAS`; mover a `src/lib/pos/` las lecturas locales de #87; propagar `unidad_id` en `crear_cotizacion`. La terminal de captura `ZZCAPTURA Caja 1` quedó cerrada (turno 1, efectivo real 500, diferencia 0) e inactiva.

## Fase 2A POS + Fase 3 Nómina (backend) + 1B inventario y especificaciones de UI (20 nov 2026)

Sesión del Orquestador con 10 subagentes DeepSeek V4.1 Flash Max en paralelo (todos con worktree propio). 10/10 terminaron.

- **Contratos primero:** `docs/dominio-nomina.md` (PR #69) y `docs/dominio-pos.md` (PR #70) entraron a `main` antes de escribir SQL, y dos revisiones independientes dejaron `docs/revision-nomina.md` y `docs/revision-pos.md`. Hallazgos aplicados: lock `FOR UPDATE` del recibo, doble conteo del límite de crédito, submayor de la devolución en efectivo, proyección de ISR en periodo parcial, RLS de las tablas del motor.
- **1A Inventario ferretería (PR #68):** `docs/dominio-inventario-ferreteria.md`, migraciones `20261125100000`/`20261125101000` (códigos de barra, unidades con factor, combos reales, conteos, índices trigrama, RPCs `pos_*` de lectura) + pgTAP de 48 asserts.
- **1B Capa TS (PR #73):** `src/lib/inventario/ferreteria/` (Zod, consultas paginadas, 8 server actions, 80 tests). Sin UI.
- **2A POS (PR #75):** `20261125120000_pos_tablas` + `20261125121000_pos_rpc` (17 funciones): terminales, turnos con un solo abierto por terminal, movimientos de caja, `pos_completar_venta` en un round-trip, cotización rápida, devolución B04 con reembolso crédito/efectivo/combinado y cierre con sobrante/faltante. pgTAP de 40 + 91 asserts. Correcciones: constraint de `motivo` sin colisión, `facturas.credito` baja la parte reembolsada en efectivo.
- **3A Nómina catálogos (PR #71):** `20261125130000_nomina_catalogos` (parámetros RD 2026 sembrados, 40 conceptos, mapeo contable 40×3, 26 cuentas, contactos TSS/INFOTEP/DGII, `empleados` y novedades) + 53 asserts.
- **3B Nómina motor (PR #72):** `20261125131000_nomina_motor` (periodos, recibos, líneas, cálculo SFS/AFP/ISR/SRL/INFOTEP/provisiones, asientos `NO-*` por empleado, pagos con candado y anulaciones) + 92 asserts. Correcciones: `FOR UPDATE` sobre el recibo antes de validar estado, reversa que copia `asiento_lineas` con centro de costo, RLS/grants de las 3 tablas, ISR que anualiza al empleado con historia y proyecta periodos reales al ingresado en el año.
- **Diseño:** `docs/diseno/nomina-ui.md` (PR #74, 18 pantallas) y `docs/diseno/pos-ui.md` (PR #76, 1,420 líneas).
- **Verificación:** `ci`, `db`, `scan` y `e2e` verdes sobre el `headSha` de cada PR; `pnpm typecheck`, `pnpm check` y `pnpm test` en verde en `main`. Los pgTAP nuevos corrieron en el job `db`.
- **Pendiente de Waldy:** las migraciones `20261125100000`–`20261125131000` **no están aplicadas al remoto**. Aplicarlas (`supabase db push` con su login) antes de que la UI llame esas RPC. También sigue pendiente borrar el comentario del bot en el PR #59.
- **Siguiente:** 1C UI inventario (sobre 1B), 2B TS POS + 2C/2D UI POS (sobre 2A), 3C TS Nómina + 3D/3E UI Nómina (sobre 3A/3B).

## Fase 0 — estudios POS y Nómina depurados + plan maestro en repo (20 nov 2026)

- **PR #67** (rama `feat/docs-pos-nomina`, merge `bfad1e0`): estudios de Alegra POS (`docs/alegra/pos/`: `alegra-pos.md`, `design-alegra-pos.md`, 62 capturas `22-*`, `css-pos/GUIA-POS.md` + 2 copias locales) y Nómina (`docs/alegra/nomina/`: `ALEGRA-NOMINA.md`, `DESIGN-ALEGRA-NOMINA.md`, 69 capturas + 18 renders de diseño) entraron **sin HTML/CSS crudos en la historia** (rama nueva desde `main`; nada del PR #59), sin `.procesar.py`, sin `NOTA.md` rota y sin `NOTAS-CRUDAS.md`. También quedó versionado `docs/PLAN-FASE-2-ORQUESTADOR.md` (plan maestro: Inventario Ferretería + POS + Nómina RD).
- **Encabezados anti-confusión en los 5 .md**: solo tokens Medoxigas (`--primary` azul de `docs/plantilla-diseno.md`, nunca el teal `#00b19d`); POS = Vender/Turnos/Historial/Devoluciones (Inventario y Configuración viven en Contabilidad); Nómina = grupo desplegable dentro de Contabilidad con su configuración en `/dashboard/configuracion`, sin Suscripciones ni Bandeja.
- **Captura `22-ticket-imprimir.png` censurada** (rectángulos blancos sobre el teléfono y el correo del titular; 0 píxeles distintos fuera de las cajas, verificación por OCR de Windows y visto bueno visual de Waldy; blob git ≠ original del PR #59). PR **#59 cerrado** (su historia contenía HTML/CSS crudos en `1ea896c`) y PR #62 ya estaba cerrado; **pendiente de Waldy: borrar el comentario del bot en #59** (enlace presigned a `alegra-pos-completo.zip`).
- Verificación: revisión del Orquestador archivo por archivo (159 archivos solo en las 3 rutas nuevas, 0 `.html/.css/.py`, hashes del ticket censurado y del plan idénticos a los aprobados), `typecheck/check/test/build` verde y CI del PR 5/5 success sobre `e1cef2b` (el job `db` no corre por filtro de rutas: PR sin cambios de BD).
- **En curso (paralelo):** 1A — BD inventario ferretería (worktree `feat/inventario-ferreteria-bd`) + redacción de `docs/dominio-pos.md` y `docs/dominio-nomina.md` como contratos previos a las Fases 2 y 3.

## Plan de brechas Alegra completo: motor, tema, reportes DGII y anulación real (20 nov 2026)

Sesión del Orquestador comparando el reporte de investigación real de Alegra
(`docs/alegra/reporte-investigacion-inventario-fiscal/`) contra el código.
**F1+F2 completos, 8 PRs mergeados, 4 migraciones NUEVAS aplicadas al remoto vía
Supabase CLI (login+link de Waldy, `migration repair` del historial desfasado
43+43 y `db push`; "up to date")**:

- **F1-A (PR #61)** `20261124100000_inventario_inicial_asiento` +
  `20261124100100_costeo_salida_nc`: asiento `II` vivo al crear/editar producto
  (mutación en el lugar, `asientos.producto_id`, cuentas "Ajustes iniciales en
  inventario" ~3402 y "Devoluciones en ventas" ~4104), salidas de ajuste al
  costo promedio, NC de venta al costo vigente.
- **F1-B (PR #57)** `20261124110000_anulacion_fecha_motivo`: tabla
  `motivos_anulacion` (10 motivos DGII oficiales, Devolución=06) +
  `fecha_anulacion`/`motivo_anulacion_id` en facturas/gastos/notas; wrapper
  `anular_documento(p_info opcional)`.
- **F1-C (PR #60)** `20261124120000_config_dgii_rnc`: `cuentas.categoria_dgii`
  / `tipo_compra` / `tipo_ingreso` con semilla por nombre, RPC
  `actualizar_clasificacion_dgii`, `_rnc_digito_valido` (casos reales
  132000013/402123455 ✓, 132000015 ✗) en wrappers de contactos, retenciones
  faltantes de Alegra.
- **Tema (PR #63)**: paleta EXACTA del dashboard de Alegra (medida por Waldy:
  fondo `#F4F7F9`, menú blanco, activo `#EFF4F6`, topbar blanco hairline
  `#E2E8F0`, búsqueda `#F1F5F9`/texto `#94A3B8`), campos de formulario
  blancos (`bg-card`), azul `#1E56C7` intacto, oscuro sin cambios.
- **Estado de resultados (PR #58)**: diseño Alegra (grupos expandibles con
  chevron, buscador+rótulo en la card, Descargar/Actualizar). Por decisión de
  Waldy: **montos con texto plano** (candado en `tabla-comparativa.test.tsx`
  prohíbe `text-emerald|text-destructive`) y fix del `-RD$0.00`
  (`formatearRd` normaliza el cero).
- **F2-E (PR #64)**: diálogo de anulación con `DatePickerCampo` + 10 motivos
  (probado end-to-end: factura real B0200000003 anulada con motivo) y **608
  con el tipo real** (código sin cero inicial, legado→`4`).
- **F2-D (PR #65)**: "Cantidad inicial" en edición con nota del asiento
  automático; costo de salida bloqueado al promedio (UI readOnly + payload +
  SQL).
- **F2-F (PR #66)**: página Configuración → Reportes DGII (por cuenta), 606 y
  607 **fieles al TXT real de Alegra** (encabezados 4 campos, tipoBienes por
  cuenta, NC positivas, regla 30 días, NC→"Venta a crédito", forma de pago
  derivada, exclusiones con motivos literales + "Documentos no incluidos"),
  exportación directa (modal Periodo+Tipo → descarga sin ZIP; Excel con hoja
  de excluidos; sin RNC bloquea). El TXT del 606 verificado campo por campo
  contra el renglón real de la investigación.
- **Reglas de Waldy candadas**: capturas SIEMPRE (el subagente que implementa
  las toma; el Orquestador revisa código; **Waldy verifica visual y decide**) —
  en `AGENTS.md` (rol Ejecutor + candados) y `docs/ORQUESTADOR.md` (plantilla
  de briefs + procedimiento). Credenciales a subagentes por archivo temporal,
  nunca en briefs.
- **Datos de verificación en la base** (para limpiar con
  `docs/pruebas/reset-base-virgen.sql` cuando Waldy quiera la base 100 %
  virgen): contacto "PRUEBA CAPTURA ER" (RNC 402123455), producto "Producto
  captura ER" (11 und × RD$145.45), facturas B0200000001/2/3 anuladas, gasto
  B1300000001/2 anulados, compra B0100000051 abierta (RD$708, renglón del
  606). NCF consumidos de las series B02/B13/B01.
- `docs/motor-contable.md` actualizado (20 claves de `config_contable`).

## Feature — Anulación con fecha y motivo + 608 real (20 nov 2026)

- Rama `feat/anulacion-motivo-608` (desde `main` 31821b1). El diálogo «Anular» de la vista de factura pide **Fecha de anulación** (`DatePickerCampo`, por defecto hoy en RD, sin fechas futuras) y **Motivo de anulación** (`SelectCampo` con los 10 motivos de `public.motivos_anulacion`), con el texto de Alegra «Esta información es necesaria para generar tus reportes correctamente.». Ambos son obligatorios en la app (el RPC sigue aceptando sin `p_info` por compatibilidad): `anularFactura(id, { fecha, motivo })` valida con Zod en español y llama `supabase.rpc("anular_documento", { p_tipo, p_id, p_info })` directo.
- El catálogo se lee con `obtenerMotivosAnulacion()` en `src/lib/facturacion/acciones.ts` (solo admin/contador, `motivos_anulacion` activos ordenados por código DGII), no dentro del componente.
- **608 real:** `obtenerAnulados` lee `fecha_anulacion` y el JOIN `motivos_anulacion(codigo_dgii)`, y lista las anulaciones del mes por **fecha de anulación** (las anulaciones viejas sin esa fecha siguen entrando por la fecha del comprobante). `fila608` exporta `NCF | fecha del comprobante | tipo de anulación` con el código del motivo **sin cero inicial** (Alegra: Devolución `06` → `6`); las anulaciones viejas sin motivo usan `4` y la página lo avisa. Encabezado y detalle del TXT no cambian.
- Candados: `src/lib/reportes/fiscales/formatos/608.test.ts` (motivo dinámico, código sin padding, fecha del comprobante, legado 4) y `src/lib/facturacion/acciones.test.ts` (`p_info` directo, fecha/motivo obligatorios, no futura, errores y permisos).
- Verificado con `pnpm typecheck`, `pnpm check`, `pnpm test` (1003) y capturas reales en claro/oscuro: factura `B0200000003` al contacto «PRUEBA CAPTURA ER» anulada con «Devolución de productos»; el 608 muestra `B0200000003 | 20261120 | 6` y la base guarda `fecha_anulacion = 2026-11-20`. Capturas en `C:\Users\wardy\AppData\Local\Temp\opencode\capturas-f2-anulacion-fecha-motivo\`.

## Diseño al 100 %, cero datos falsos, Next 16.4.6 y script de base virgen (19 nov 2026)

Integración de 8 subagentes en paralelo (`DeepSeek V4.1 Flash 1017`, archivos disjuntos):

- **A1 — Cero datos falsos y seguridad:** eliminado `PERSONAS_EJEMPLO` de `ficha-contacto.tsx`, quitados los botones/ítems muertos «Próximamente» en `dashboard/page.tsx` y `rail-categorias.tsx`, actualizado `next` de `16.4.3` a `16.4.6` (`GHSA-mfr8-8qww-v76h` / `GHSA-vc7v-qv4w-wrv8`), y agregado candado `src/lib/fichas-sin-datos-ejemplo.test.ts`.
- **A2 — Cero `<input type="date">` nativos:** nuevo `DatePickerCampo` en `src/components/date-picker.tsx` y migración de los últimos 9 archivos al calendario Alegra (`acciones-factura`, `asiento-form`, `asientos`, `numeraciones-cliente`, `saldos-iniciales-dialogo`, `estado-cuenta`, `gasto-form`, `nota-credito-form` y `cuentas/[id]` vía `FiltroFechasCuenta`), más candado `src/lib/fechas-nativas.test.ts` (0 excepciones).
- **A3 — Reportes unificados:** `EncabezadoReporte` genera migas por defecto (`Inicio / Reportes / <título>`) y soporta `mostrarImprimir`; migrados los 9 reportes sueltos + `reporte-dgii.tsx` (606/607/608) sin tocar cálculos ni descargas fiscales, más candado `src/lib/reportes-encabezado.test.ts`. Confirmado que «Flujo de caja» ya enlaza a `/dashboard/reportes/flujo-efectivo`.
- **A4 + A5 — Todos los detalles `[id]` en `DocumentoDetalle`:** migradas las 13 pantallas restantes (pagos recibidos, notas de débito, NC de compras, gastos menores, órdenes de compra, facturas/pagos recurrentes, asientos con `AsientoPapel`, activos fijos, transferencias de banco, ajustes/transferencias de inventario y ficha de cuenta contable), conservando acciones, roles e invariants E2E.
- **A6 — Fin de `text-3xl` y encabezados unificados:** migrados `EncabezadoConfiguracion` (10 pantallas), `EsqueletoEncabezado`, Contactos, Inventario y listas de Compras/Órdenes/Pagos recurrentes a `EncabezadoPagina` (20 px) + migas (0 `text-3xl` en dashboard/esqueletos).
- **A7 — 18 formularios a `ContenedorFormulario` (`1040 px`):** unificados todos los `page.tsx` de `nueva`/`nuevo`/`editar` a `1040 px` + `EncabezadoPagina` + migas sin duplicar `h1`.
- **A8 — Script de base 100 % virgen:** creados `docs/pruebas/reset-base-virgen.sql` (audita las 64 tablas `public.*`: 51 truncadas con `RESTART IDENTITY CASCADE`, 13 semillas/config preservadas, reinicio de secuencias no-owned y verificación transaccional) + `docs/pruebas/RESET-VIRGEN.md` (incluye paso previo de quitar `E2E_EMAIL`/`E2E_PASSWORD` en GitHub Secrets antes de usar el mismo Supabase en producción) + candado `src/lib/supabase/reset-virgen.test.ts`.

## Estabilidad E2E y limpieza de PRs (19 nov 2026)

- **Cabecera 48 px en listas y esqueleto sin salto (`src/components/listas/tabla-lista.tsx`, `src/components/carga/esqueletos.tsx`, `tests/e2e/tablas.spec.ts`):** los `<TableHead>` de `TablaLista` llevaban implícito `h-10` (40 px) desde `ui/table.tsx` y `EsqueletoTabla` tampoco tenía `h-12`/`h-14`; durante el streaming de `<Suspense>` en `/dashboard/facturacion`, `tablas.spec.ts:34` medía 40 px. Se fijó `h-12` en los 3 `<TableHead>` de `TablaLista`, `h-12`/`h-14` en `EsqueletoTabla`, se filtró la cabecera real (`Número de factura`) en el spec E2E y se sumaron 2 candados en `src/lib/tablas-listas.test.ts`.
- **Timeout en `/dashboard/bancos` (`src/lib/bancos/consultas.ts`):** `getIngresosGastosMensual` hacía `.from("asiento_lineas")` con `asientos!inner`, `.gte("asientos.fecha", desde)` y `.order("id")`, lo que forzaba un escaneo de `asiento_lineas_pkey` (~258k filas históricas) hasta agotar el `statement_timeout` de Supabase. Se reescribió en dos pasos indexados (`asientos` por `asientos_fecha_idx` con `paginarConsulta` y luego `asiento_lineas` por `asiento_lineas_asiento_cuenta_idx` con `consultarEnLotes` + `paginarConsulta`), sin migración SQL, más 6 pruebas y candado estático en `src/lib/bancos/consultas.test.ts`.
- **Limpieza de PRs viejos:** se cerraron `#1` (Actions 530 commits atrás y roto en `db`), `#3` (`typescript` 7.0 mayor), `#4` (`@hookform/resolvers` 7.0 mayor), `#5` (`@types/node` 26 desalineado con Node 22) y `#31` (`feat/ncf-manual-orq`, 138 commits atrás con conflictos y prefijo de migración obsoleto; la spec `docs/dominio-ncf-manual.md` y el commit `8749309` quedan de referencia). En `#16` (parches menores, incluye `next 16.4.6`) se pidió `@dependabot rebase`.

## Unificación en main, limpieza de repo y modo Orquestador (19 nov 2026)

- **Una sola rama principal (`main`):** se integró `origin/prueba` en `main` por fast-forward (`bdbe32d..fa3fa6e`, incluyendo PRs #41–#50) y se retiró la rama `prueba` y el remoto viejo `diseno-local`. El repo en GitHub se mantiene público temporalmente durante las pruebas.
- **Limpieza operativa:** se podaron ~78 worktrees muertos de T3, se borraron ramas viejas ya mergeadas, se cerró PR #6 (`diseno/rediseno`) y se movió PR #31 (`feat/ncf-manual-orq`, marcado "NO MERGEAR aún") a base `main`.
- **Gobierno y CI:** `AGENTS.md` limpio sin el bloque de "rediseño completo", con separación explícita Orquestador (`docs/ORQUESTADOR.md`) vs Subagente (DeepSeek V4.1 Flash 1017 por defecto). Workflows de GitHub Actions limitados a `push`/`pull_request` sobre `main` (+ `workflow_dispatch`): `ci.yml` y `gitleaks.yml` ya no corren en cada rama, y `supabase.yml` conserva sus `paths`.
- **Migraciones:** las 58 migraciones de `supabase/migrations/` están aplicadas en el proyecto remoto (`ljfdhrnvlsfaweuvnqxz`); se alinearon 4 prefijos con el remoto sin tocar SQL, se documentó el mapa completo en `docs/migraciones-estado.md` y se agregó el candado de formato/orden en `src/lib/supabase/migraciones.test.ts`.
- **Bugs y pendientes para la próxima sesión de Orquestador** (identificados en el CI real de PR #50, dejados explícitamente para atacar en sesión nueva):
    1. `tests/e2e/tablas.spec.ts:34` — cabecera de la tabla de Facturas mide `40 px` en vez de `48 px` (`>= 47` esperado).
    2. `src/lib/bancos/consultas.ts` — `Error: canceling statement due to statement timeout` al cargar `/dashboard/bancos` (causa timeout/flaky en `tests/e2e/flujo-banco.spec.ts`).
    3. Revisar/decidir PR #31 (`feat/ncf-manual-orq`) y PRs de Dependabot (#1, #3, #4, #5, #16).

## Specs E2E actualizados a la UI actual (rama `fix/e2e-specs-prueba`)

- Tras la integración de los 8 PRs, el job e2e de CI corrió por primera vez con secrets reales: 15/20 pasaban y 5 fallaban por specs desactualizados (no por bugs de la app). Se actualizaron los 5 specs que fallaban.
- **`tests/e2e/ayudantes.ts` (nuevo):** helpers compartidos — `entrar`, `escucharErrores`, `pesos`, `textoCelda`, `valorJuntoA`, `filaDeLista`, `elegirEnSelect` y `elegirEnCombo`. La clave: los `Select`/`Combobox` de Base UI dejan los popups cerrados montados en el portal (opciones ocultas pero presentes en el DOM), así que buscar `getByRole("option")` a secas puede resolver una opción de un popup viejo. Los helpers leen `aria-controls` del trigger/input recién abierto y scopian la opción al listbox exacto.
- **`smoke.spec.ts`:** el dashboard ya no titula «Medoxigas Contabilidad»/«Resumen del mes»; ahora se aserta el heading real «Resumen del negocio» y el control «Cambiar periodo». Los asserts de `/login` se conservan (sí dice Medoxigas Contabilidad).
- **`flujo-venta.spec.ts` / `flujo-compra.spec.ts`:** las filas clicables (`FilaNavegable`, PR #47) exponen `role="link"` y ya no matchean `getByRole("row")` → `filaDeLista` (`tbody tr` + `hasText`). Alta de producto: ya no es diálogo, es página `/dashboard/productos/nuevo` con «Nuevo producto» renderizado como `role="button"` (`Button nativeButton={false}`). El select «Impuesto» viene en «Ninguno» por defecto → se elige la opción `/(18.00%)/` para que el producto lleve ITBIS 18 %. En compra, la tabla de facturas pendientes del pago usa «Por cobrar» (componente compartido con pagos recibidos); la lista de compras sí dice «Por pagar».
- **`flujo-contable.spec.ts`:** cuentas vía `elegirEnCombo` en `#cuenta-l1`/`#cuenta-l2` (Combobox Base UI con búsqueda). El detalle titula «Asiento contable AC-…» cuando hay `codigo` (la migración `tipos_entrada_diario` ya está aplicada en staging), con `#<número>` solo de fallback → assert `/Asiento contable/`.
- **`flujo-banco.spec.ts`:** el fallo de CI («option resuelve pero no visible») era la opción del popup de origen que queda montado y en fade-out; `elegirEnSelect` con `aria-controls` lo resuelve determinista.
- **Verificado local (build de producción + Supabase de prueba, puerto 3003):** cada spec tocado pasa aislado — smoke 3/3, venta, compra, contable y banco 1/1. La suite completa con `fullyParallel` flaquea por contención contra la base compartida (timeouts de login, saldos movidos por tests paralelos); en serie los 6 que fallaron en paralelo pasan. `tsc --noEmit` ✅, `biome check tests/e2e` ✅.
- **Nota ambiental:** el error `column asientos.codigo does not exist` del primer run de CI ya no aparece — la migración `20261123000000_tipos_entrada_diario` ya está aplicada en la base de prueba.

## Integración — merge de 8 PRs a `prueba` en serie (24 nov 2026)

- Waldy ordenó fusionar #41–#48 a `prueba` con merge commits (sin squash). Los 8 entraron en orden: #41 `64e23e4`, #42 `565c04f`, #43 `d3a6683`, #44 `2810cfd`, #45 `0d498e9`, #46 `f467a15`, #47 `c05b201`, #48 `b579a25`.
- **Conflictos resueltos en las ramas del PR** (merge del estado de `prueba` hacia cada rama, unión de ambos lados): `types.ts` siempre como unión de firmas en el formato generado; `HANDOFF.md` unión de entradas; en #47 se conservó `EncabezadoPagina`/`migas` de prueba + `FilaNavegable`/`filaHref` del PR en 9 fichas y `vista-documento-venta`; en #48 se conservó la ficha Alegra pero migrada al marco `EncabezadoPagina`+`migas` (el candado `diseno-paginas` lo exigió: `PENDIENTES_TEXT_3XL` ya estaba vacío, `text-3xl` suelto rechazado) y se portó `filaHref` a `PanelMovimientos` (`documento.href`, fallback `?asiento=` en-página); en reportes `EncabezadoReporte` quedó con `BotonImprimir`+`migas`+`acciones`, CxC/CxP sin `BotonImprimir` muerto.
- **Verificación de `origin/prueba` merged:** `tsc --noEmit` ✅, `pnpm check` ✅ (0 errores, 59 warnings, 6 infos), `pnpm test` ✅ (939 passed, 3 skipped), `pnpm build` ✅ (106 rutas).
- **e2e rojo en #46–#48 por causas ambientales, no por los merges** (Waldy autorizó mergear igual): la suite Playwright corrió por primera vez (los secrets de staging recién existen) y falla en 5/20 — `column asientos.codigo does not exist` (staging sin `20261123000000_tipos_entrada_diario`; el query ya estaba en `prueba` vía #44, crash server-side en `contabilidad/asientos`), `smoke.spec.ts` espera headings viejos («Medoxigas Contabilidad»/«Resumen del mes»; el Inicio dice «Resumen del negocio» — fallaría igual sobre `prueba` pura, donde `Humo e2e` se salta por falta de secrets) y `flujo-*` no abren el popup del `Select` (`option` resuelve pero no visible; spec desincronizado con la UI). Pendiente: aplicar migraciones a staging y actualizar los specs para que el check e2e vuelva a verde.
- **Migraciones pendientes en el remoto** (diff `supabase/migrations/` vs proyecto `ljfdhrnvlsfaweuvnqxz`): `20261117100000_perf_inicio_catalogo`, `20261117200000_anular_ajuste_costo`, `20261117300000_numeraciones_notas`, `20261118000000_saldos_iniciales`, `20261120120000_limite_credito` (columna; su RPC hermana sí está), `20261121120000_adjuntos`, `20261122000000_busqueda_desplazamiento`, `20261122100000_numeracion_crear`, `20261123000000_tipos_entrada_diario`.

## Feature — Ficha de cuenta bancaria con diseño Alegra (17 nov 2026)

- Rama `feat/bancos-ficha-alegra` (desde `prueba` 2a87266). `/dashboard/bancos/[id]` deja de ser una tabla plana y pasa al layout de la ficha de cuenta de `docs/alegra/ALEGRA.md` (~línea 431) y `docs/alegra/capturas/10-bancos-*.png`: enlace «← Bancos y cajas», título = nombre de la cuenta (con pastilla «Inactiva» si aplica), subtítulo descriptivo y acciones a la derecha — menú ⋮ (Crear pago recibido, Crear nuevo pago, Transferir, Ver conciliaciones, Desactivar), papelera y botón «Conciliar».
- **Tres tarjetas de resumen:** información de la cuenta (nombre, tipo Banco/Efectivo/Tarjeta, número enmascarado `**** * 6789` con `numeroEnmascarado` en `src/lib/bancos/formato.ts` y lápiz que abre la edición), saldo grande en verde (rojo si es negativo) y descripción.
- **Barra Filtrar/Actualizar:** los filtros Desde/Hasta pasan a un `Collapsible` estilo dropdown (como movimientos de inventario) y «Actualizar datos» hace `router.refresh()`. La tabla conserva Fecha/Documento/Tercero/Entrada/Salida/Saldo y gana estado vacío Alegra (icono banco, «¡Crea tu primer movimiento!», botones Crear nuevo pago / Crear pago recibido) y `PaginadorLocal` con «Items por pagina».
- **Sección «Asiento contable»** bajo la tabla: muestra el asiento del movimiento seleccionado (enlace por fila con `?asiento=` + `#seccion-asiento`) o el último, con número, fecha, origen y botón «Imprimir» (portal `data-print-root`/`data-print-paper` + `window.print()`, el patrón de reportes). Tabla: Tercero, Código, Cuenta contable, Centro de costo, Débito, Crédito.
- **Lista de bancos:** cabecera con gráfica «Ingresos y gastos» de 6 meses (barras verde/rojo, Recharts ya usado en inicio; excluye `origen_tipo='transferencia'`) y tarjeta «Resumen» (bancos y efectivo / tarjetas de crédito / total, en centavos). La página migra a `EncabezadoPagina` y sale de `PENDIENTES_TEXT_3XL`.
- **Datos nuevos en `src/lib/bancos/consultas.ts`:** `getDetalleCuentaBanco` (solo cuentas `es_caja_banco`, UUID validado, totales en centavos), `getAsientoBanco` (cabecera + líneas con cuenta, contacto y centro de costo), `resolverAsientoCuenta` (asiento por URL solo si toca la cuenta; si no, el del último movimiento) y `getIngresosGastosMensual` (6 meses en centavos). Dinero siempre en centavos enteros; `supabase.rpc` directo.
- **Reutilizado:** `EditarCuenta`/`cuenta-formulario.tsx` se movió a `src/components/contabilidad/` y `boton-imprimir.tsx` a `src/components/` (antes duplicado en reportes y estado-cuenta); `TablaLista`/`TarjetaLista`/`PaginadorLocal`/`usePagina` de listas; `actualizarCuenta` con `activa:false` para Desactivar; diálogos de transferencia/depósito/conciliación se extrajeron a `_components/acciones-bancos.tsx` compartidos entre lista y ficha; `DialogoTransferencia` acepta `origenInicial` y control externo.
- **Acciones cableadas:** Crear pago recibido → `/dashboard/pagos-recibidos/nuevo?cuenta=<id>`, Crear nuevo pago → `/dashboard/compras/pagos/nuevo?cuenta=<id>` (ambas páginas aceptan `?cuenta=` validado UUID y `PagoForm` preselecciona la cuenta si existe), Transferir (deshabilitado con <2 cuentas caja/banco), Ver conciliaciones → lista filtrable, Conciliar → `bancos/conciliaciones/nueva?cuenta=<id>`, Desactivar con `AlertDialog`. Todas ya existían; ninguna quedó sin cablear.
- Verificado: `pnpm exec tsc --noEmit` ✅, `pnpm exec biome check` de lo tocado ✅ (solo avisos preexistentes en reportes/panel-conciliacion), `pnpm test` ✅ (818 passed, 3 skipped) y `pnpm build` ✅. Sin migraciones ni datos nuevos; sin capturas (no se pidió preview).
- **Pendiente/fuera:** «Saldo en Medoxigas» como título de la tarjeta de saldo (no «Saldo en Alegra» — es el nombre del sistema); los filtros de conciliación por cuenta se pasan por URL pero la lista muestra todas si no soporta el parámetro; no hay asientos «manuales» enlazables si un movimiento no generó asiento.

## Feature — Fila clicable en todas las listas (17 nov 2026)

- Rama `feat/fila-clicable-tablas` (desde `origin/prueba`). Hacer click en cualquier parte de una fila de tabla navega a la ficha/detalle de esa entidad, a la misma URL del enlace azul de la primera columna. Enter en la fila enfocada navega igual (role="link", tabIndex=0), Ctrl/Cmd+click y botón medio abren pestaña nueva, y los elementos interactivos dentro de la fila (links, botones, menú ⋯, checkboxes, inputs) ganan el click.
- Sí había componente compartido: `TablaLista` (`src/components/listas/tabla-lista.tsx`, 43 callsites). Ganó la prop opcional `filaHref?: (fila) => string | null | undefined`; sigue sin `"use client"` (candado `tablas-listas.test.ts`): delega cada fila con destino a `FilaNavegable` (`src/components/listas/fila-navegable.tsx`, cliente) pasándole las celdas ya renderizadas.
- `dentroDeInteractivo` es estructural (pregunta `closest`), no `instanceof HTMLElement`: un click sobre el ícono SVG dentro de un link/botón también cuenta como interactivo. Cubre `a, button, input, select, textarea, summary`, roles interactivos (`menuitem`, `checkbox`, `switch`, `tab`, `combobox`…), `contenteditable` y `[data-no-row-click]`. No navega si hay texto seleccionado.
- Convertidas con `filaHref`: las 27 listas de `TablaLista` con ficha (facturación, compras, pagos, notas, cotizaciones, contactos, productos, gastos, órdenes, asientos, contabilidad, activos, bancos, conciliaciones, ajustes, transferencias, recurrentes y las tablas dentro de las fichas de contacto/producto).
- Convertidas a mano con `FilaNavegable`: ~30 tablas que el usuario ya veía con links — reportes (ventas generales, compras, CxC/CxP, fiscales 606/607/IR-17, libro diario/mayor, movimientos de cuenta, transacciones, auxiliar/balanza de tercero, balance de comprobación, estado de cuenta cliente, valor de inventario, rentabilidad por producto, ventas por producto/cliente, cartas de retención, ingresos-compras, estados comparativos, ranking anual) y las tablas dentro de las fichas (líneas→producto, pagos, notas, doc relacionado, asiento→cuenta, movimientos→asiento, aplicaciones de pagos, generaciones recurrentes).
- **Sin destino claro (reportar, no clicables):** catálogo de cuentas (el click ya selecciona y abre panel), panel de conciliación y pago-form (workbenches de selección con checkboxes), almacenes/categorías/listas de precios/existencias por almacén (no hay ficha `[id]`), configuración (usuarios, impuestos, vendedores, centros de costo, monedas, retenciones, términos, numeraciones, periodos), IT-1 e impuestos-retenciones/ventas-vendedor (agregados por casilla/tarifa/vendedor), formularios de líneas editables, preview de importación, `dashboardblocks` (template sin uso).
- Test nuevo `src/components/listas/fila-navegable.test.tsx` (5 pruebas, patrón `renderToStaticMarkup` + `vi.mock("next/navigation")`): fila con href lleva `role="link"`/`tabIndex`/`data-href`/`cursor-pointer`, sin href queda fila normal, `dentroDeInteractivo` gana para links/botones/SVG, `TablaLista` pasa el destino por `filaHref` y `null` deja la fila normal.
- Verificado: `pnpm exec tsc --noEmit` ✅, `pnpm exec biome check` de lo tocado ✅ (solo avisos nursery preexistentes en `_components/inicio`), `pnpm test` ✅ (**823**, 3 skipped; 5 nuevas).

## Adjuntos en fichas y factura (21 nov 2026)

- Rama `feat/adjuntos-documentos` (desde `origin/feat/producto-campos-alegra-orq` 852c38e, porque toca las mismas fichas del PR #41). Se reemplazan los `TODO backend` de adjuntos con la funcionalidad real en la ficha de **contacto** (pestaña Documentos), la ficha de **producto** (panel «Archivos adjuntos») y la **vista de factura** (pestaña «Adjuntos» en el panel inferior).
- **Migración `20261121120000_adjuntos.sql`** (nueva, aditiva): tabla `public.adjuntos` (`entidad_tipo` check contacto/producto/factura/factura_proveedor/pago, `entidad_id`, `path` único, `nombre`, `mime`, `bytes`, `creado_por`, `creado_por_nombre`, `creado_en`, índice por entidad). `creado_por_nombre` se guarda desnormalizado (mismo criterio que `auditoria.usuario_nombre`): `perfiles` solo deja leer la fila propia y el «Subido por» no se puede resolver con join.
- **RLS:** lectura a cualquier `authenticated` con perfil (`rol_actual() is not null`); sin políticas de insert/update/delete — las escrituras van solo por RPC. **RPC** (`security definer`, `search_path=''`, español): `subir_adjunto` (solo admin/contador; valida tipo de entidad, que la entidad exista, prefijo de ruta `<tipo>/<entidad_id>/`, mime PNG/JPG/PDF y ≤ 10 MB, y devuelve el id), `borrar_adjunto` (admin/contador; borra el objeto de `storage.objects` y la fila en la misma transacción) y `descargar_adjunto` (cualquier rol con perfil; devuelve path/nombre/mime para firmar). `grant execute` solo a `authenticated`.
- **Bucket privado `documentos`** (10 MB, PNG/JPG/PDF), mismo patrón que `productos`: policy de lectura para autenticados (la app genera URLs firmadas) y de subida solo admin/contador. Sin policies de update/delete: el objeto lo borra `borrar_adjunto` como definer.
- **Frontend:** `src/lib/adjuntos/` (constantes, validación en español, `rutaAdjunto` uuid, mapeo de errores del bucket, `listarAdjuntos` paginado por lotes de 1.000 y server actions `registrarAdjunto`/`borrarAdjunto`/`descargarAdjunto` — la firma de la URL se hace server-side). `src/components/adjuntos/seccion-adjuntos.tsx` compartido: subida al bucket desde el cliente + registro por RPC, tabla `TablaLista` (Nombre/Tipo/Tamaño/Subido por/Fecha), descarga en pestaña nueva con `window.open` y borrado con `AlertDialog`. Se eligió `TablaLista` sobre `attachment.tsx` para que la sección se vea igual que el resto de las fichas (el diseño de contactos ya era tabla). El `attachment.tsx` del repo queda sin uso por ahora.
- **Contacto:** las filas de ejemplo (`ADJUNTOS_EJEMPLO`, tipos Contrato/Hoja de cálculo/Legal…) y los botones muertos se quitaron; el filtro de «tipo» ahora se calcula de los adjuntos reales (PDF/Imagen) y las tarjetas de conteo usan el total real. **Producto:** el `Empty` con el botón deshabilitado se reemplazó por la sección real (`puedeEscribir` se propaga desde la ficha). **Factura:** pestaña «Adjuntos» nueva en `PanelFactura`; solo facturas (cotización/conduce no ganan adjuntos).
- **`types.ts` editado a mano** (tabla `adjuntos` + `subir_adjunto`/`borrar_adjunto`/`descargar_adjunto`) replicando el formato del generador: sin la CLI local no se puede `pnpm db:types` y el código no compila sin los tipos. Mismo criterio ya usado con `_anular_documento_base`/`catalogo_saldos` para que el job `supabase.yml` (que regenera y compara) cuadre. Si el CLI genera distinto, el diff lo dirá.
- pgTAP `supabase/tests/adjuntos_test.sql` (17 asserts): alta, validaciones, lector lee/descarga pero no escribe, insert directo negado, borrado, bucket privado de 10 MB con 2 policies y grants. **No se corrió local** (Supabase CLI no instalada); queda para CI/local con `supabase test db`. La migración **no está aplicada** en el proyecto de prueba.
- Verificado: `pnpm exec tsc --noEmit` ✅, `pnpm exec biome check` de lo tocado ✅ (0 errores; solo avisos de complejidad preexistentes en `getFacturaVista`/`obtenerFichaProducto`), `pnpm test` ✅ (**916** passed, 3 skipped) y `pnpm build` ✅. `pnpm install` necesario en el worktree (no tenía `node_modules`).

## Feature — Saldos iniciales en el catálogo de cuentas (17 nov 2026)

- Rama `feat/saldos-iniciales-catalogo` (desde `origin/prueba`; el nombre pedido `feat/saldos-iniciales` estaba tomado por otro worktree con un intento previo sin commitear — este trabajo lo adoptó y corrigió). Botón **Saldos iniciales** en `/dashboard/contabilidad` (ALEGRA.md §11.1): diálogo con tabla editable (cuenta, débito, crédito), totales y diferencia; solo guarda con diferencia 0.
- Migración `20261118000000_saldos_iniciales.sql`: suma `origen_tipo = 'saldo_inicial'` (equivale al tipo SI de Alegra), crea la cuenta de patrimonio **«Ajustes iniciales»** bajo Capital (reutiliza si ya existe, código libre tras el mayor de sus hermanas, ej. 3301) y la registra en `config_contable.ajustes_iniciales`. RPC `registrar_saldos_iniciales(p jsonb)`: `security definer`, rol admin/contador, crea **un** asiento `saldo_inicial` balanceado con una línea por cuenta (el usuario mismo agrega la contrapartida «Ajustes iniciales» en la tabla, como en Alegra). Idempotente por cuenta: una cuenta con línea en un asiento `saldo_inicial` no admite otra carga (excepto la de ajustes, que repite como contrapartida). Rechaza caja/banco (su saldo se carga en Bancos), agrupación, inactivas, montos negativos, línea con ambos lados y registros descuadrados; mensajes en español.
- Frontend `_components/saldos-iniciales-dialogo.tsx` + action `registrarSaldosIniciales` (`src/lib/contabilidad/acciones.ts`, RPC directa, montos en centavos) + esquema `esquemaSaldosIniciales` (cuenta única por línea y cuadre en centavos). Etiquetas «Saldos iniciales» en libro diario, asientos y parámetros de reportes. `ajustes_iniciales` agregada a `CONFIGURACION_CONTABLE`.
- **Limitación:** sin Supabase CLI en este entorno no se corrió `supabase test db` ni `pnpm db:types`; `types.ts` lleva solo la firma mínima de la RPC añadida a mano (patrón del repo con migraciones sin aplicar), hay que regenerarlo al aplicar la migración. pgTAP nuevo `saldos_iniciales_test.sql` con 24 asserts.
- Verificado: `pnpm exec tsc --noEmit` ✅, `biome check` de lo tocado ✅ (solo aviso preexistente en `libros/parametros.ts` fuera del diff), `pnpm test` ✅ (818 passed), `pnpm build` ✅.

## Feature — Tipos de entrada de diario configurables (18 nov 2026)

- Rama `t3/tipos-entrada-diario-configurables` (desde `prueba` 2a87266). ALEGRA.md §11.2: los asientos manuales se numeran con el prefijo del tipo elegido y un consecutivo independiente por tipo (AC-1, DTB-1…), en vez del número entero global.
- Migración `20261123000000_tipos_entrada_diario.sql` (renombrada en el merge: `20261118100000` ya lo usa `busqueda_global` y está aplicada en remoto): tabla `public.tipos_entrada_diario` (`nombre`, `prefijo` único, `siguiente`, `activo`) con la semilla idempotente de los 13 tipos de Alegra; `asientos` gana `tipo_entrada_id` y `codigo` (único cuando no es NULL; los asientos automáticos quedan en NULL). RPCs `crear_tipo_entrada_diario` / `actualizar_tipo_entrada_diario` (admin/contador, prefijo en mayúsculas `[A-Z][A-Z0-9]{0,9}`, sin cambio de prefijo si el tipo ya tiene asientos). `crear_asiento_manual` conserva su firma `(p jsonb)`: con `tipo_entrada_id` valida y numera por ese tipo; sin él cae al tipo activo `AC` (default de Alegra); el `UPDATE` del consecutivo va en la misma transacción, así que no hay códigos repetidos bajo concurrencia. RLS: `authenticated` lee, escritura solo por RPC, `anon` nada.
- Frontend: el formulario de asiento manual trae el `Select` de «Tipo de entrada de diario» (default Ajuste contable) con la vista previa del código read-only; lista y detalle muestran `codigo` (con `#numero` de respaldo para asientos viejos) y el detalle muestra el tipo. Nueva página Configuración > Contabilidad > «Tipos de entrada de diario» (lista + diálogo nuevo/editar con nombre, prefijo y activo), misma piel que Centros de costo.
- Candados: `supabase/tests/tipos_entrada_diario_test.sql` (16 asserts: semilla, normalización, duplicados, prefijos inválidos, numeración AC/DTB independiente, tipo inactivo, candado de prefijo con asientos, lector y anon); `src/lib/tipos-entrada-diario/acciones.test.ts` (RPC directo, errores en español, roles); caso `tipo_entrada_id` opcional en `asientos/validacion.test.ts`.
- `types.ts` editado a mano (Supabase CLI no instalado en esta máquina): mismas adiciones que generaría `pnpm db:types`; CI compara el esquema contra las migraciones. pgTAP no corrió en local (sin Postgres/Docker ni CLI): queda para el job Supabase de CI.
- Verificado: `pnpm exec tsc --noEmit` ✅, `pnpm exec biome check` en lo tocado ✅, `pnpm test` ✅ (826) y `pnpm build` ✅.

## Crear numeraciones desde la UI (18 nov 2026)

- Rama `feat/numeracion-crear-f3` (desde `origin/prueba` 2a87266 ; le nom `feat/numeracion-crear` est pris par un autre worktree). Hasta aquí las series solo se sembraban por migración y solo se podían editar; ahora se crean desde Contabilidad → Numeraciones.
- **Migración `20261122100000_numeracion_crear.sql`** (NO aplicada al remoto; la revisa Coder): RPC `crear_numeracion(p jsonb)` `security definer`, `set search_path=''`, rol `admin`/`contador`. Validaciones en español: tipo dentro de la lista del sistema (`01`,`02`,`03`,`04`,`13`,`14`,`15`,`16`) o `00` («Sin NCF», consecutivo libre), nombre obligatorio, `siguiente >= 1`, `hasta >= siguiente`, prefijo fijo `B`+tipo en las fiscales (la DGII fija el prefijo por tipo) y libre en `00` (letras/números ≤10, sin reservados `B##`/`E##`), y una sola serie por `(tipo_comprobante, prefijo)`: las RPC consumen la activa de id más bajo, así que una segunda fila del mismo tipo nunca se usaría — para ampliar un rango se edita la serie. `preferida` no existe en la tabla: no aplica (ver `docs/dominio-ncf-manual.md`).
- **pgTAP `supabase/tests/numeracion_crear_test.sql`** (12 asserts): alta fiscal (libera la 15 en la transacción y verifica prefijo `B15` forzado, `siguiente` y `activa`), alta sin NCF (`00` guarda el prefijo en mayúsculas), duplicados por tipo+prefijo y por prefijo libre, tipo inválido, prefijo obligatorio/reservado, `siguiente < 1` y lector sin permiso. **No se pudo correr aquí** (sin Supabase CLI); lo corre CI.
- **`types.ts`: solo se agregó a mano la firma de `crear_numeracion`** (mismo criterio que `_anular_documento_base` y `catalogo_saldos`): sin ella `tsc` no compila la llamada RPC y el job `supabase.yml` (que genera tipos desde las migraciones locales) falla. La regeneración completa con `pnpm db:types` queda pendiente del CLI.
- **Frontend:** botón «Nueva numeración» en la `BarraLista` (y en el estado vacío) con diálogo propio: Select `Tipo de documento` (B01…B16 + «Sin NCF»), prefijo libre solo para «Sin NCF» (en fiscales se muestra el `B`+tipo fijo), nombre, siguiente, hasta, vence (DatePicker) y activa. La server action `crearNumeracion` sigue el patrón de `actualizarNumeracion` (Zod → `supabase.rpc` directo → `revalidatePath`) y `acciones.test.ts` suma 7 pruebas del mismo estilo. `crear_numeracion` rejoint la liste des RPC dans `supabase/AGENTS.md`.
- Vérifié sur cette branche : `pnpm typecheck`, `pnpm exec biome check` des fichiers touchés et `pnpm exec vitest run src/lib/numeraciones` en vert (voir le rapport du PR pour le build).

## Verificación — PDF de cotización y conduce ya estaba hecho (18 nov 2026)

- Rama `feat/pdf-cotizacion-conduce` (desde `prueba` 2a87266). ALEGRA.md §5 marcaba «pendiente: cotización y conduce»; al revisar, la impresión de ambos ya existe en `prueba`: `DocumentoPapel` (`src/components/documento-venta/documento-papel.tsx`) tiene variantes `cotizacion` y `conduce`, y `cotizaciones/[id]` y `conduces/[id]` la montan con `VistaDocumentoVenta` + `getPlantillaImpresion`. «Imprimir»/«Descargar PDF» llaman `window.print()` y `PortalImpresion` saca el papel al `@media print` de `globals.css`.
- Contrastado con las capturas `07-cotizacion-impresion.png` y `07-remision-impresion.png`: cotización lleva logo+empresa a la izquierda, correo/teléfono a la derecha, «Cotización No. N» con fechas, columnas Concepto/Precio/Unidad/Cantidad/Descuento/Impuesto/Subtotal, totales al pie con monto en letras y «Página 1 de 1». El conduce lleva logo+empresa+«Conduce No. N», la grilla SEÑOR(ES)/DIRECCIÓN/CIUDAD/TELÉFONO/RNC con fechas de expedición y vencimiento, columnas Ítem/Precio/Cantidad/Descuento/Impuesto/Subtotal, totales y el pie «ELABORADO POR» / «ACEPTADA, FIRMA Y/O SELLO Y FECHA».
- `plantillas_impresion` ya siembra filas `cotizacion` y `conduce` y `getPlantillaImpresion` hereda notas/términos/logo de la factura cuando están vacías. Sin cambios de código: solo se actualizó ALEGRA.md (quitado el «pendiente»).
- Candado nuevo en `documento-papel.test.tsx` (3 pruebas): el papel del conduce queda congelado con su grilla SEÑOR(ES)/DIRECCIÓN/CIUDAD/TELÉFONO/RNC, sus columnas Ítem/Precio/Cantidad/Descuento/Impuesto/Subtotal, los totales con «ITBIS (18.00%)» y las firmas «ELABORADO POR» / «ACEPTADA, FIRMA Y/O SELLO Y FECHA»; el de la cotización congela título «Cotización No. N», fechas, columnas Concepto…Subtotal, monto en letras y «Página 1 de 1» (el papel del conduce no tenía ninguna prueba).
- Verificado en el worktree: `pnpm exec tsc --noEmit`, `biome check` de `documento-venta/`, `cotizaciones/`, `conduces/` y `plantillas-impresion/` (32 archivos, 0 errores), `pnpm test` (**821** passed, 3 skipped) y `pnpm build` (103 páginas).

## Merge de main + tipos regenerados + specs e2e (18 nov 2026)

- Rama `feat/producto-campos-alegra-orq`: merge `fcbb424` de `main` sin conflictos de código (trajo búsqueda global Ctrl+K, auditoría, límite de crédito, `vende_negativo` motor, fases de diseño). `vende_negativo` quedó sin duplicados en `src/`: la columna vive una sola vez en `productos` y el bloqueo de venta es de la RPC remota (`vende_negativo_motor`).
- **`types.ts` regenerado desde el remoto** (formato nuevo del CLI). El remoto ya tiene aplicadas `busqueda_global` (+`rapida`), `auditoria`, `vende_negativo_motor`, `limite_credito`(+rpc), `auditoria_limite_credito` y `producto_campos_alegra`: las firmas `buscar_global`, `obtener_auditoria`, `normalizar`, `_crear_factura_sin_control_stock` y la tabla `auditoria` aparecen ahora en los tipos (los `as`/casts que decían «todavía no figura en los tipos» quedan obsoletos pero válidos).
- **3 migraciones locales NO aplicadas al remoto** (verificado contra `pg_proc`): `20261117100000_perf_inicio_catalogo` (`catalogo_saldos` + `saldos_caja_banco` nueva + índice), `20261117200000_anular_ajuste_costo` (`_anular_documento_base` + wrapper) y `20261117300000_numeraciones_notas` (`actualizar_numeracion` que cuenta notas B03/B04). El MCP de Supabase es de solo lectura en esta máquina (`execute_sql` corre en transacción read-only): no se pudieron aplicar y quedan **pendientes para Coder**, igual que estaban documentadas en main. Hasta entonces `catalogo_saldos` responde error y el catálogo muestra saldos en cero (degradación controlada), y anular ajustes/mover numeraciones usa la lógica vieja. `types.ts` lleva a mano las firmas de `_anular_documento_base` y `catalogo_saldos` para que el chequeo de esquema del job `supabase.yml` (que genera desde las migraciones locales) cuadre — mismo criterio con el que se agregó `catalogo_saldos` en main.
- **Specs e2e nuevos** (`6a6c8b5`): `flujo-venta`, `flujo-compra`, `flujo-contable`, `flujo-banco` + guía `docs/e2e-flujos-completos.md`. Se saltan sin `E2E_EMAIL`/`E2E_PASSWORD` como el resto.
- **`biome.json`**: `docs/reportes` excluido (`220583c`) — el reporte HTML del vaporizador usa `class="data"` y `data` es un token reservado del parser de candidatos CSS de Biome 2.6 (error de parseo, no ignorable por comentario). Es artefacto generado, no código de la app.
- Verificado: `pnpm typecheck`, `pnpm check` (0 errores; avisos preexistentes), `pnpm test` (**909** passed, 3 skipped), `pnpm build` con env placeholder.
- **CI sigue bloqueado por billing (18 nov):** tras el push (`ab9a033`), los jobs `ci`, `e2e`, `db` y `scan` vuelven a fallar en 2-4 s sin arrancar: «recent account payments have failed or your spending limit needs to be increased». No es del código — falta que Waldy revise GitHub Billing & plans y re-corra los workflows (`gh run rerun` o un push nuevo).

## Producto — campos de Alegra en edición y alta a pantalla completa (17 nov 2026)

- Rama `feat/producto-campos-alegra-orq` (desde `prueba` ceb939d; actualizada con `origin/prueba` 2a87266, EncabezadoPagina + contenedores, merge sin conflictos por `ort`). Consume la migración `20261117210938_producto_campos_alegra.sql`: `productos.unidad_medida`, `almacen_id`, `vende_negativo`, `imagen_path` y `tipo = combo`; `existencias.cantidad_inicial`, `minimo`, `maximo`.
- **Editar producto** (`/dashboard/productos/[id]/editar`) se rehace con el orden de Alegra: Información general (Tipo segmentado Producto/Servicio/Combo, Nombre, Almacén, Categoría, Unidad de medida, Referencia, Estado, Descripción), columna derecha con imagen + resumen + interruptores Inventariable y Venta en negativo, tarjeta Inventario y precio (Cantidad actual en edición / inicial en alta, Costo, Precio base, Impuesto, Precio total) y Opciones avanzadas (almacenes con Cant. inicial/actual/Mín/Máx/En conduces, listas de precios, contabilidad). Usa `EncabezadoPagina`, `ContenedorFormulario`, `FormCard`, `CampoFormulario`, `SelectCampo`, `SelectorImpuesto`, `Switch`, `TablaLista` y `Collapsible`. Los mín/máx solo se editan cuando el producto controla inventario.
- **Imagen:** subida real al bucket privado `productos` desde el cliente (`supabase.storage.upload`), validación PNG/JPG/WebP ≤ 5 MB y vista previa con `createSignedUrl`; la ficha y la edición reciben la URL firmada del servidor. Si se quita, el objeto queda en el bucket hasta una limpieza futura (anotado en `docs/diseno/notas-backend.md`).
- **Action:** `datosDesdeFormulario` agrega `unidad_medida`, `almacen_id`, `vende_negativo`, `imagen_path`, `minimo`, `maximo` y `existencias[{almacen_id,minimo,maximo}]` **solo si el formulario manda el campo**, como las cuentas; el alta vieja, la importación y la edición masiva no los tocan. Candados nuevos: `actions.test.ts` (payload completo, ausencia de campos, máximo vacío → `null`, unidad en blanco) y `navegacion.test.ts` (la lista y el vacío enlazan `rutaNuevoProducto()`, no queda `ProductoDialogo` ni `text-3xl`). `productos.test.ts` suma combo, unidad obligatoria y campos opcionales.
- **Nuevo producto** (`/dashboard/productos/nuevo`, con `loading.tsx`) reutiliza el mismo formulario con «Guardar» y «Guardar y crear otro»; el reinicio limpia también los precios por lista (estado controlado, `preciosIniciales` con Vitest). La intención de «crear otro» se lee del `submitter` del evento nativo (`esAccionCrearOtro`, con Vitest): `new FormData(form)` no incluye el botón que envió. Se eliminó el diálogo viejo `producto-dialogo.tsx`, que solo usaba la lista; sigue existiendo el alta rápida `src/components/productos/dialogo-nuevo-producto.tsx` que usa facturación, sin los campos nuevos. La lista ahora usa `EncabezadoPagina` dentro de `ContenedorLista`.
- **Ficha:** muestra la imagen en el encabezado, la unidad, «Venta en negativo», mín/máx por almacén y el valor del inventario; se quitaron los TODO de unidad, venta negativa y mín/máx. Sigue pendiente en conduces y archivos adjuntos.
- **Tipos:** `src/lib/supabase/types.ts` regenerado con el CLI actual (formato nuevo, claves entre comillas). `scripts/extract-db-schema.mjs` ahora tolera ese formato y normaliza comas/comillas/`ComputedFields` para que el job `supabase.yml` compare solo el esquema.
- **Revisión del PR:** los precios por lista son controlados y se limpian al reiniciar (helper `preciosIniciales` con Vitest), la etiqueta de cantidad dice «Cantidad actual» en edición y «Cantidad inicial» en alta, los mín/máx solo se editan si el producto controla inventario, y la acción de «Guardar y crear otro» se lee del `submitter` del evento (helper `esAccionCrearOtro` con Vitest). Se corrigieron `noUnnecessaryConditions` y el ternario anidado de la ficha: el formulario queda sin avisos de Biome (el único aviso restante es el de complejidad preexistente de `obtenerFichaProducto`).
- **Revisión independiente (17 nov, PC local):** sin bloqueantes de código. Se corrigieron los montos con separador de miles en la action (`1,500` ya no se guarda como `1.5`), la cantidad negativa en `actualizar_producto`, el invariante de que combo/servicio nunca controlan inventario y la defensa de rol dentro de `_producto_guardar_minimos`. El bucket `productos` queda solo con lectura y subida (sin policies de update/delete) y los botones no guardan mientras la imagen se está subiendo. La venta en negativo queda como **preferencia**: `crear_factura` todavía no bloquea la venta sin existencia; el texto de la pantalla ya no promete lo contrario.
- Verificado: `pnpm typecheck`, `pnpm check`, Biome de lo tocado sin avisos en el formulario, `pnpm test` (**841** passed, 3 skipped) y `CI=1 pnpm build` ✅ (el primer build sale exit 1 por el nudge de seguridad de Next 16.4.3; el reintento continúa, como quedó anotado en la entrada del encabezado). `producto_campos_alegra_test.sql` sube a 26 asserts (bucket privado de 5 MB, solo lectura/subida y función interna sin permiso para `authenticated`); el pgTAP se corre en CI. Sin tocar `prueba`/`main`, sin force-push.
- **Aplicada en el Supabase de prueba (17 nov, MCP):** registrada como `20261117210938_producto_campos_alegra`; se renombró el archivo local para que la versión coincida. Verificado en remoto: 4 columnas en `productos` y 3 en `existencias`, check de `tipo` con `combo`, bucket `productos` privado de 5 MB con PNG/JPG/WebP y solo dos policies (lectura y subida), `_producto_guardar_minimos` sin permiso para `authenticated`, `cantidad_inicial` sin negativos, 0 productos sin almacén, 0 combos inventariables y 0 tipos inválidos. La existencia actual conserva sus 2 filas negativas preexistentes (no las toca la migración). El backfill usa `greatest(cantidad, 0)` para no dejar una cantidad inicial negativa. Smoke con el build local contra la base remota: login, lista, ficha, nuevo producto y edición cargan sin errores de consola ni `pageerror`.
- **PR #41** abierto a `prueba`; Vercel preview `Ready` (protegido por SSO de Vercel, no se pudo smoke sin sesión de Vercel). Los jobs `ci`, `e2e`, `db` y `scan` no arrancaron: GitHub Actions responde «recent account payments have failed or your spending limit needs to be increased». Es billing de la cuenta, no un fallo del código; falta que Waldy revise GitHub Billing & plans y vuelva a correr los workflows. No se fusionó.

## Diseño — Encabezado de página de 20 px y contenedores (17 nov 2026)

- Rama `diseno/pagina-encabezado-orq` (desde `prueba` ceb939d). `EncabezadoPagina` (título 20 px/600, subtítulo 14, migas opcionales, slot de acciones) y `ContenedorFormulario`/`ContenedorDetalle` (1040 px); `ContenedorLista` se reexporta desde `listas/tabla-lista.tsx` (1289 px).
- Piloto migrado: Facturas (lista), Compras (lista) y Nueva factura, con migas.
- Candado `src/lib/diseno-paginas.test.ts` (4 pruebas): prohíbe `text-3xl` nuevo en `page.tsx`, exige `EncabezadoPagina` + migas en las migradas y congela la deuda de 20 pantallas pendientes (la lista solo puede encoger).
- Verificado: `pnpm typecheck` ✅, `pnpm check` ✅ (solo avisos preexistentes), `pnpm test` ✅ (818 passed, 3 skipped), `CI=1 pnpm build` ✅ (103 páginas). El primer build de un agente puede salir exit 1 por el nudge de seguridad de Next 16.4.3; el reintento continúa y con CI sin env de agente no aparece. Deuda aparte: subir Next a 16.4.6 (advisories moderate GHSA-mfr8-8qww-v76h y GHSA-vc7v-qv4w-wrv8).
- Pendiente Fase 1b: migrar una por una las 20 pantallas de `PENDIENTES_TEXT_3XL` (bancos, conduces, configuración, contabilidad, cotizaciones, gastos, notas, pagos, reportes). No se tocó lógica, datos ni migraciones.

## Diseño — Editar producto en pantalla completa (17 nov 2026)

- Rama `diseno/producto-editar-full-orq` (desde `prueba` 6e5f8db). Nueva ruta `/dashboard/productos/[id]/editar`: el lápiz de la lista y el botón «Editar producto» de la ficha navegan a una pantalla completa con el shell de la ficha (`CLASE_PANEL_FICHA`, `GrillaKpis`, `Pildora`, `MetaItem`, `ItemDato`). Ya no se edita producto en diálogo; el diálogo queda solo para «Nuevo producto».
- Secciones en el orden de Alegra: **Datos del producto** (Tipo Producto/Servicio, Categoría, Nombre, Referencia, Estado, Descripción), tarjeta lateral con Precio total / sin impuesto / impuesto / costo, **Inventario y precio** (Controlar inventario, Existencia actual, Costo por unidad, Precio base, Impuesto, Precio total calculado), **Almacenes** (cantidades actuales por almacén, solo lectura), **Listas de precios**, **Archivos adjuntos** (vacío) y **Contabilidad** (cuentas de ventas, inventario y costo). Guardar aparece arriba y abajo; Cancelar vuelve a la ficha.
- Se usan `CampoFormulario`, `FORM_*`, `SelectCampo`, `SelectorImpuesto`, `Switch`, `TablaLista`/`PillEstado`, `Empty`, `ValidacionFormulario` y `actualizarProducto`. La ficha ahora muestra la categoría, el estado y todas las listas de precios activas (antes salían «—» y solo General), leyendo `productos.categoria_id`, `productos.activo`, `producto_precios` y `listas_precios` con consultas de solo lectura.
- Las cuentas contables ya existían en `productos` y las acepta `actualizar_producto`, pero la action las descartaba. Se agregaron al esquema y al payload **solo cuando el formulario envía el campo**, para que alta, importación, edición masiva y el diálogo no borren cuentas personalizadas. Candado en `productos.test.ts`: sin campos de cuenta las claves no viajan; con el campo vacío se envía `null` explícito.
- **Pendiente de backend (no se inventó ni se muestra en pantalla):** tipo Combo (el check solo acepta producto/servicio), almacén obligatorio del producto (no hay `productos.almacen_id`; el stock vive en `existencias`), unidad de medida y tipo de referencia, existencia inicial / mínimo / máximo / en conduces por almacén, variantes, campos extra, imagen y archivos adjuntos. Está documentado en `docs/diseno/notas-backend.md`.
- Verificado: `pnpm typecheck`, `pnpm check` (exit 0; solo avisos preexistentes), `pnpm test` (**795**, incluida la prueba nueva) y Biome de lo tocado sin errores. Sin build, dev server ni capturas; sin migraciones, sin tocar `src/components/ui`, sin push ni merge.

## Fix — La DGII decía «No se encontró ese RNC» a un RNC inscrito (17 nov 2026)

- Rama `feat/dgii-fix-orq` (desde `prueba` 6e5f8db). Reporte de Waldy: con el RNC **131488791** (OXYMAT SRL, ACTIVO) el diálogo «Nuevo contacto» mostraba «No se encontró ese RNC en la DGII», y el autocompletado tampoco se veía en el perfil del cliente.
- **Causa exacta (reproducida con el código real contra el portal):** la DGII falla de forma intermitente. Con el mismo flujo oficial (GET del formulario + viewstate/cookie + POST) y el UA `MedoxigasContabilidad/1.0`, ~1 de cada 4 consultas del 131488791 devolvió la tabla `cphMain_dvDatosContribuyentes` **vacía** con el aviso «Ocurrió un error al intentar realizar la búsqueda. Capture esta pantalla y remítala a la Oficina Virtual»; otra devolvió el aviso **«no se encuentra inscrito»** al mismo RNC inscrito; la siguiente devolvió OXYMAT SRL / OXYMAT / ACTIVO. El mismo fallo apareció con el 130893489, así que no es de Vercel ni del RNC. `parsearRespuestaDgii` trataba «tabla sin nombre» como `no_encontrado` y `consultarDgii` lo cacheaba 2 minutos: un fallo del portal se mostraba como «No se encontró ese RNC» y se repetía desde la caché.
- **Fix (`src/lib/dgii/consulta.ts`):** el parser ahora distingue `encontrado`, `no_encontrado` (solo el aviso explícito de la DGII), `tabla_vacia`, `portal_error` (lee `cphMain_lblInformacion`) y `sin_respuesta`, y los datos siempre ganan a un aviso escondido. El flujo hace hasta 3 intentos con **sesión nueva** (nuevo viewstate y cookie) y pausa corta dentro de un plazo total de 8 s; un «no encontrado» exige **dos avisos seguidos** en sesiones distintas. Solo se cachea el acierto (10 min) y el no encontrado confirmado (2 min); la tabla vacía, el error del portal, el timeout y la red nunca se cachean. El 403 mantiene el bloqueo de 5 min y ahora tiene su propio código y mensaje (`bloqueado`).
- **Mensajes (`src/lib/dgii/acciones.ts`):** nuevo código `sin_datos` → «La DGII no devolvió los datos de ese RNC: su portal falló en la consulta. Espera un momento y vuelve a intentar, o escríbelo a mano»; `bloqueado` → «La DGII está bloqueando las consultas en este momento…». «No se encontró ese RNC en la DGII» queda solo para el no inscrito confirmado.
- **Botón «Autocompletar»:** en el diálogo «Nuevo contacto» (`dialogo-nuevo-contacto.tsx`) ya estaba visible bajo «Número». En `formulario-contacto.tsx` (Nuevo/Editar contacto de la lista y «Editar perfil» de la ficha del cliente) el campo RNC/Cédula y su botón estaban dentro de «Más opciones», cerrado al crear: ahora RNC/Cédula + «Autocompletar» + mensaje están en la grilla visible, junto a «Tipo», y «Más opciones» conserva teléfono, correo, lista de precios y dirección.
- **Pruebas:** `src/lib/dgii/consulta.test.ts` (22) suma tabla vacía ≠ no encontrado, error del portal, aviso escondido y los casos de reintento/caché/403/red con `fetch` simulado; `src/lib/dgii/acciones.test.ts` (7) cubre los mensajes nuevos; `src/lib/dgii/consulta.live.test.ts` es la prueba real opcional (`DGII_LIVE=1 pnpm exec vitest run src/lib/dgii/consulta.live.test.ts`), ejecutada hoy: 131488791 → OXYMAT SRL ACTIVO, 130893489 → MEDOXIGAS ALC SRL ACTIVO, 131488792 → no encontrado.
- Verificado: `pnpm typecheck`, Biome de lo tocado, `pnpm exec vitest run src/lib/dgii` (33 + 3 live) y `pnpm test` en verde. Sin migraciones, sin datos, sin tocar `src/components/ui` ni `package.json` (solo `pnpm install` en el worktree). Doc actualizada: `docs/dgii-consulta.md`.

## Diseño — Nueva factura de proveedor con el formulario de venta (17 nov 2026)

- Rama `diseno/factura-proveedor-orq` (desde `prueba` 9ad5813). Solo frontend de `compras/nueva`: la factura de proveedor usa el mismo ritmo de `DocumentoVentaForm`: encabezado de la tarjeta (logo, empresa + RNC/dirección y NCF del proveedor a la derecha), `FormDivider` + «Información de la factura» (Proveedor, Fecha, Vencimiento en `FormGrid` de 3 columnas), `FormDivider` + «Líneas» en una sola tabla-grid de 8 columnas (N.º, Tipo, Producto o cuenta, Cantidad, Costo, Impuesto, Subtotal, quitar), totales con `FormTotal` (Subtotal, Impuestos, Total 20 px) y «Más opciones» con `Collapsible` (Almacén, Notas, Centro de costo). Los botones Cancelar/Guardar van fuera de la tarjeta en `FormActions`, con `Loader2` mientras guarda. El título y el botón «Pagos» pasaron al encabezado de `page.tsx`, como en `facturacion/nueva`.
- Se reutilizaron `FormCard`, `FormGrid`, `FormField`, `FormDivider`, `FormSectionTitle`, `FormTotal`, `FormActions`, `FORM_*`, `DatePicker`, `SelectorContacto`, `SelectorProducto`, `SelectorImpuesto`, `SelectCampo`, `ComboboxCampo` y `useValidacionFormulario`. `FormularioFactura` recibe `empresa: Empresa | null` (la carga `getEmpresa()` en la página) solo para el encabezado; `ComboboxCampo` ganó `aria-label`/`aria-invalid`/`aria-describedby` opcionales para el error inline.
- **Sin cambios de lógica ni validación de compras:** se conservan el selector Tipo (Producto/Gasto), la cuenta de gasto, el costo, el impuesto y su tasa, el NCF del proveedor (opcional, máx. 20), proveedor, fechas y vencimiento con su regla `vencimiento >= fecha`, almacén, notas, centro de costo, líneas desde orden de compra, esquema Zod y `crearFacturaProveedor`. Los campos y sus ids de validación (`proveedor`, `fecha`, `vencimiento`, `linea-<id>-producto|cuenta|cantidad|costo`) quedan iguales, por lo que el foco del primer error sigue funcionando. Las fechas cambiaron el `<input type="date">` por el `DatePicker` de venta con el mismo valor `yyyy-MM-dd`.
- Verificado: `pnpm typecheck`, Biome de los 3 archivos tocados y `pnpm test` (**788**) en verde. Sin build, dev server ni capturas; sin push ni merge.
- **Actualización con `origin/prueba` 1a84c56 (menú Alegra, spec de búsqueda global y número de cotización/conduce):** el único conflicto fue `HANDOFF.md`; se conservaron las dos entradas nuevas. Esos cambios no tocan archivos del formulario de compras, así que el rediseño queda igual. Tras el merge: `pnpm typecheck`, Biome de los 3 archivos tocados y `pnpm test` (**794**) en verde. Sin push ni merge.

## Número de cotización y conduce antes de guardar (17 nov 2026)

- Rama `feat/documentos-numero-preview-orq` (desde `prueba` 9ad5813). En el formulario compartido de documentos de venta, **Nueva cotización** y **Nuevo conduce** muestran el próximo número en la misma caja compacta de 215 × 56 px del NCF, read-only y sin engranaje. El número ya no dice «Se asigna al guardar». Factura, cotización y conduce comparten el cambio.
- **De dónde sale:** `previsualizarNumero` (`src/lib/cotizaciones/numero.ts`) replica la regla de `_crear_documento_no_contable` (`20261113230000_cotizaciones_remisiones.sql`): `cotizaciones.numero` y `remisiones.numero` son `int` con `default nextval('…_numero_seq')`. La secuencia no es legible por `authenticated`, así que `getProximoNumero(tipo)` lee `max(numero)` y suma uno. No escribe, no llama a `nextval` y no consume la secuencia. Si la consulta falla, la caja muestra `—` y el motivo. Si otro usuario guarda antes, el número definitivo es el que asigna la secuencia al guardar (misma salvedad que la preview del NCF).
- Aplica en `cotizaciones/nueva`, `conduces/nueva` y también al clonar o partir de una cotización; las pantallas de edición siguen mostrando el número real (`numeroActual`).
- **NCF automático:** la caja de 215 × 56 px de factura perdió el borde (`border`, `border-slate-300` y `border-destructive`); conserva el texto NCF + número y el engranaje fuera. El borde condicional del NCF manual queda para el otro agente, como pedía el brief.
- Candado nuevo `src/lib/cotizaciones/numero.test.ts` (4 pruebas): empieza en 1 sin documentos, último + 1, no consume ni modifica y avisa al llegar al máximo de `int`.
- Verificado: `pnpm typecheck`, Biome de los 6 archivos tocados, `pnpm test` (**792**, 4 nuevas) y `pnpm check` (exit 0; solo avisos e infos preexistentes). Sin build ni dev server, sin migraciones, sin tocar `components/ui`, sin push ni merge.

## Validación visual de formularios: campo rojo, mensaje y toast (17 nov 2026)

- Rama `feat/validacion-formularios-orq` (desde `prueba` 38d7473). Antes de guardar, cada formulario revisa sus campos obligatorios: pinta la etiqueta y el control en rojo, muestra el mensaje debajo («El cliente es requerido.»), lanza el toast «Revise los campos obligatorios / Asegúrese de completar todos los campos marcados en rojo.» y enfoca/desplaza al primer campo inválido. Los formularios usan `noValidate` para que el navegador no bloquee el submit con su globo nativo.
- Piezas: `src/lib/formularios/validacion.ts` (reglas puras `requerido`/`erroresDe`/`mapaErrores`, con Vitest), `src/components/formularios/validacion.ts` (`useValidacionFormulario`, toast y foco) y `src/components/formularios/campo-formulario.tsx` (`CampoFormulario`, el `FormField` con `error` inline y borde rojo). En esta rama no se editaron `formulario.tsx` ni los selectores/date-picker; al integrar `origin/prueba` entran sus props de NCF/DGII y el error inline se conserva en el componente local.
- Candado nuevo `src/lib/formularios/formularios-validados.test.ts`: falla si un formulario que usa `CampoFormulario` no lleva `noValidate`.
- Cubiertos: **Configuración** (empresa, vendedores, centros de costo, términos de pago, monedas/tasas, retenciones); **Inventario** (almacenes, categorías, listas de precios, ajustes y transferencias con errores por línea); **Contabilidad** (asiento manual, activos fijos, cuenta contable); **Bancos** (nueva cuenta, transferencia, depósito, nueva conciliación); **Productos** (alta/edición, producto rápido, edición masiva); **Compras** (factura de proveedor y orden de compra con proveedor/fechas/líneas); **Gastos**; **Notas de crédito de compra y venta** (fecha y cantidades, incluida la que excede lo pendiente); **Nota de débito**; **Facturas recurrentes**; **Pagos recurrentes**; **Pagos recibidos y a proveedores** (contacto, cuenta, fecha, montos por factura y otros ingresos/egresos).
- Pendientes/ Fuera: `documento-venta-form.tsx` (factura, cotización, conduce) y `facturacion/**`, `contactos/**` y `contabilidad/numeraciones/**`, que están en manos de otros agentes; plantillas de impresión e importación de productos no tienen campos obligatorios propios (el archivo es opcional); conciliación existente solo marca movimientos; login y filtros GET de reportes quedan fuera del patrón.
- Verificado: `pnpm typecheck`, `pnpm build`, `pnpm test` (**749**, 7 nuevas de validación) y Biome sin diagnósticos en los archivos tocados (solo quedan avisos preexistentes de otras carpetas). Sin cambios en validaciones de servidor, datos, RLS ni migraciones. Sin push ni merge.
- **Actualización con `origin/prueba` f90b110 (#23 DGII, #24 NCF/validación de factura, #25 tablas, #26 NCF en caja):** conflictos solo en `HANDOFF.md`, `panel-bancos` y 9 clientes de configuración/inventario, todos por imports (`FormField` vs `CampoFormulario` + `TablaLista`). Se conservaron la validación inline/toast y las tablas nuevas; se revisaron los formularios de configuración, contabilidad, inventario y bancos contra la migración de tablas (siguen abriendo sus diálogos y validando, con `TarjetaLista`/`TablaLista` y `noValidate`). `pnpm typecheck`, `pnpm test` (**788**), `pnpm build` y Biome de lo tocado en verde.

## Diseño — Tablas restantes unificadas al patrón Facturas (17 nov 2026)

- Rama `diseno/tablas-restantes-orq` (desde `prueba` 0524709; actualizada con `origin/prueba` c437f01, que trae búsqueda global, facturas sin número interno, reporte Compras, Numeraciones, NCF/validación y la consulta DGII en contactos). Solo frontend: todas las listas y fichas usan `ContenedorLista`, `TarjetaLista`, `BarraLista`, `TablaLista` y `PillEstado` de `src/components/listas/tabla-lista.tsx`, con los colores y el espaciado ya definidos en `docs/diseno/tablas-unificadas.md`. No se tocó `tabla-lista.tsx`, `src/components/ui`, impresión, matrices fiscales, líneas editables ni layout/topbar.
- **Producto:** lista con buscador dentro de la tarjeta, selección múltiple, «Editar seleccionados» a la derecha, lápiz de 32 px, pills de estado, montos a la derecha y vacío con «Nuevo producto». Ficha: facturas de venta/compra, comerciales y kárdex con búsqueda local, `PaginadorLocal`, pills y enlaces por número; existencias por almacén con pie de total.
- **Cliente:** contactos con avatar de inicial, tabs fuera de la tarjeta, búsqueda y paginación dentro, lápiz y vacío con CTA. Se conserva el `FormularioContacto` compartido que usa la consulta DGII (no se reintrodujo la copia local). Ficha: transacciones, facturas, comerciales, notas, pagos, asientos, personas y documentos con `BarraLista` sin borde, `TablaLista` y `PaginadorLocal`; estado de cuenta con pie de totales.
- **Pagos y notas:** pagos recibidos, pagos a proveedores, notas de crédito/débito, notas de crédito de compras y pagos recurrentes (con la acción «Generar» intacta). Se conservan buscador, filtros de servidor, paginación y roles; los CTA del vacío solo aparecen si el rol puede crear. Se conservan el NCF de vista previa y la validación de campos obligatorios de #24.
- **Configuración y contabilidad:** usuarios, impuestos, vendedores, centros de costo, monedas (monedas + historial de tasas), retenciones y términos de pago; catálogo de cuentas (árbol, búsqueda local, expansión, panel lateral y ayuda del «uso de cuenta»), configuración contable, asientos, activos y periodos (Cerrar/Reabrir por fila).
- **Resto de listas:** compras, gastos, facturas recurrentes, órdenes de compra, cotizaciones/conduces, ajustes y transferencias de inventario, almacenes, categorías, listas de precios y bancos (cuentas, movimientos con totales, conciliaciones y panel de conciliación con selección múltiple).
- No se inventaron features ni datos: no se agregaron buscadores donde la consulta no los tiene (ajustes, transferencias, recurrentes, bancos, configuración), ni «Filtrar» donde no hay filtro real. Los `colSpan` y `TableFooter` se conservan; ahora el vacío calcula su colSpan.
- Candado `src/lib/tablas-listas.test.ts`: `LISTAS_MIGRADAS` pasó de 1 a 40 archivos (38 de esta rama + Numeraciones y Reporte Compras que trajo `prueba`); exige que cada uno importe `TablaLista` y no defina `EstadoPill`/`EstadoBadge` local. Los badges compartidos de compras y órdenes ahora son `PillEstado`.
- Actualización con `origin/prueba` (c437f01): conflictos en `HANDOFF.md`, `src/lib/tablas-listas.test.ts`, `productos/[id]/_components/tablas-producto.tsx` y los cuatro archivos de contactos (`contactos-cliente`, `ficha-contacto`, `pestanas-documentos`, `tabla-estado-cuenta`). Se conservó la migración de tablas y, de `prueba`, el formulario DGII compartido, la búsqueda global, el NCF de vista previa y la validación; además, las tablas migradas muestran el NCF como identificador de la factura de venta (ficha, estado de cuenta, facturas del producto y kárdex), como en #20. `LISTAS_MIGRADAS` quedó con 40 entradas: las 38 de esta rama más Numeraciones y Reporte Compras.
- Verificado tras el merge: `pnpm typecheck`, `pnpm check` (exit 0; solo avisos preexistentes) y `pnpm test` (**781**). Sin build ni dev server, sin push ni merge.
- **Pendiente / fuera:** reportes con filtros y descarga propia, matrices fiscales (606/607/608, balance de comprobación, balanza, libro diario, IT-1), detalles P3 de documentos, líneas editables y la vista previa de importación de productos (modal) no se migraron al componente: `docs/diseno/tablas-unificadas.md` §1.10/§6 los deja solo con tipografía o fuera. Numeraciones y Facturación ya vienen migradas desde `prueba`.

## Feature — Autocompletar el nombre del contacto con la DGII (17 nov 2026)

- Rama `feat/rnc-dgii-orq` (desde `prueba` 0524709; actualizada con `origin/prueba` c099339, que trae búsqueda global, facturas sin número interno, reporte Compras, Numeraciones y NCF). En el diálogo «Nuevo contacto» y en el formulario de contacto, al escribir el RNC (9) o la cédula (11) aparece el botón **Autocompletar**; al salir del campo con la longitud exacta también consulta solo. Llena únicamente **Nombre o Razón social**, y solo si está vacío o si lo puso una consulta anterior: nunca sobrescribe lo que escribió el usuario y nunca guarda. Municipio y Dirección quedan manuales.
- La DGII no tiene API pública: el SOAP `wsMovilDGII` está retirado (301/403) y `api.digital.gob.do` da 500. Se usa la consulta pública oficial `https://dgii.gov.do/app/WebApps/ConsultasWeb2/ConsultasWeb/consultas/rnc.aspx`: GET para el viewstate + POST con el número, y se parsea la tabla `cphMain_dvDatosContribuyentes`. Detalle y límites en `docs/dgii-consulta.md`.
- `src/lib/dgii/consulta.ts`: validación 9/11, extracción de campos ASP.NET, parser (entidades HTML, prioriza la razón social sobre el nombre comercial), timeout 8 s, caché 10 min/2 min, deduplicación de solicitudes simultáneas y pausa de 5 min si la DGII responde 403, User-Agent propio. `acciones.ts` devuelve `{ ok, datos | error }` serializable con mensajes en español. `completar.ts` decide el llenado. UI: `consulta-dgii.tsx` (hook, botón y mensaje), `dialogo-nuevo-contacto.tsx` y `formulario-contacto.tsx`.
- Se eliminó la copia local de `FormularioContacto` en `contactos-cliente.tsx` (era idéntica a la compartida) para que el botón funcione también al crear/editar desde la lista.
- La página oficial no devuelve municipio ni dirección, y el listado `DGII_RNC.zip` tampoco (se verificó: RNC, nombre, nombre comercial, actividad, fecha, estado y régimen). No se inventan datos: solo se autocompleta el nombre. El ZIP se descartó por peso y porque Waldy no quiere cargar la base; Alegra no publica su método.
- Prueba real: RNC `130893489` → `MEDOXIGAS ALC SRL` (ACTIVO, «VENTA AL POR MAYOR DE GASES INDUSTRIALES, METANOL»), ~0.3–0.9 s; `000000000` → no encontrado. `pnpm typecheck` y Biome de lo tocado en verde; `pnpm test` **781** tras el merge (17 nuevas de DGII, sin red). Sin build ni dev server, sin migraciones, sin tocar `components/ui`, sin push ni merge a `prueba`/`main`.
- Actualización con `origin/prueba`: conflicto solo en `HANDOFF.md`; se conservan las entradas de DGII, Numeraciones y Reporte Compras. Los cambios de `ficha-contacto.tsx`, `pestanas-documentos.tsx` y `selector-contacto.tsx` entraron sin conflicto y no tocan la consulta DGII.
- Riesgo: si la DGII cambia el HTML o bloquea la IP, el botón muestra el error y el nombre se escribe a mano. Si el volumen crece, la alternativa es importar el listado diario (tabla + cron), que no trae dirección.

## Diseño — Numeraciones con la tabla unificada (17 nov 2026)

- Rama `diseno/numeraciones-orq` (desde `prueba` 0524709; actualizada con `origin/prueba` 38d7473, que trae menú, búsqueda global, `TablaLista`, facturas sin número interno y reporte Compras). La página `/dashboard/contabilidad/numeraciones` usa el patrón de Facturas: `ContenedorLista`, `TarjetaLista`, `BarraLista`, `TablaLista`, `PillEstado` y `PaginadorLocal` (25 por página, sin tocar consultas ni URL).
- Se agregó el filtro visible «Tipo de documento» y la columna del mismo nombre. Las opciones salen de las numeraciones existentes (sin inventar tipos): `01 Crédito fiscal`, `02 Consumo`, `03 Nota de débito`, `04 Nota de crédito`, `13 Gastos menores`, `14 Régimen especial`, `15 Gubernamental` y `16 Exportaciones`. El filtro es local; también se corrigieron las etiquetas 03/04/13 que antes salían como código pelado.
- Se conserva el diálogo de edición (mismos campos y server action). **No se agregó «Nueva numeración»**: el sistema no tiene RPC ni server action para crear; queda fuera y no se inventó backend. Tampoco se agregaron «Preferida», «Electrónica» ni borrado, porque no existen en `numeraciones`.
- Candado: `numeraciones-cliente.tsx` agregado a `LISTAS_MIGRADAS` en `src/lib/tablas-listas.test.ts`.
- Actualización con `origin/prueba`: conflictos solo en `HANDOFF.md` y `src/lib/tablas-listas.test.ts`; se conservan las secciones de Numeraciones y Reporte Compras y las tres entradas de `LISTAS_MIGRADAS` (facturas, numeraciones, compras).
- Verificado tras el merge: `pnpm typecheck`, Biome de lo tocado y `pnpm test` (742) en verde. Sin build, dev server ni capturas; sin push ni merge.

## Diseño — Reporte Compras y migas de pan (17 nov 2026)

- Rama `diseno/reportes-compras-orq` (desde `prueba` 0524709). Nuevo `src/components/migas-de-pan.tsx` con los `Breadcrumb` de shadcn tal cual: API `items: {etiqueta, href?}[]`, texto de 14 px slate-500, separador `ChevronRight` y la miga actual en slate-900 medium, sin enlace. En Compras: `Reportes > Administrativos > Compras`.
- `reportes/compras`: encabezado, fechas, totales y tarjeta dentro de `ContenedorLista` (`mx-auto max-w-[1289px]`). El filtro de proveedor pasó a la `BarraLista` de la `TarjetaLista` como buscador de 267×32 (`h-14`, `px-4`) con su form GET, `desde`/`hasta` ocultos y botón «Aplicar»; las fechas siguen arriba. El `Paginador` va dentro de un pie `border-t px-4 py-3`, sin cambios de lógica.
- `tabla-compras.tsx` usa `TablaLista`: cabecera de 48 px, filas de 56 px, padding 20/24, montos a la derecha y vacío «No hay compras en el período seleccionado.» sin CTA. Se conservan los enlaces a la compra y al contacto.
- Candado: `tabla-compras.tsx` agregado a `LISTAS_MIGRADAS` en `src/lib/tablas-listas.test.ts`.
- Verificado: `pnpm typecheck`, Biome de lo tocado y `pnpm test` (742, incluido `tablas-listas`) en verde. Sin build, dev server ni capturas; sin push ni merge.

## Fix — Reportes de libros: RPC directo y paginación completa (16 nov 2026)

- Rama `fix/reportes-libros-rpc` (desde `origin/prueba` b1f3f27). El `TypeError (reading 'rest')` de los 6 reportes de libros y de Guardar numeraciones **ya estaba corregido en `prueba`** (`cdfea68`, llamar `supabase.rpc` directo) y los libros pesados ya paginaban (`8cc75cf`). Esta rama no reintroduce el patrón; cierra el hueco que quedaba y lo blinda.
- `src/lib/rpc-sin-extraer.test.ts`: además de `const rpc = supabase.rpc`, ahora detecta `RpcSuelta`, el cast `.rpc as`, la asignación y la desestructuración `{ rpc } = …`. El propio test comprueba que reconoce el código histórico (`as unknown as RpcSuelta`) y que no marca llamadas directas; el mensaje explica el `this` perdido y cómo arreglarlo.
- `src/lib/reportes/libros/consultas.ts`: `obtenerSaldosCuentas` (balance de comprobación y agrupado) era la única RPC de libros sin paginar; ahora usa `paginarConsulta` con `range` de 1,000 y orden determinístico `cuenta_codigo, cuenta_id`. Movimientos y saldos por tercero ya lo hacían. Sin cambios de firmas, cálculos ni diseño.
- Regresión nueva `src/lib/reportes/libros/consultas.test.ts` (2 pruebas): simula 2,500 movimientos en 3 lotes y comprueba que `calcularAgrupado` suma los 2,500 (débito 2,500,000 centavos y 2,500 detalles); simula 1,250 cuentas en 2 lotes. No toca Postgres; la verificación con datos reales queda para Coder.
- Verificado: `pnpm typecheck`; `pnpm check` exit 0 (23 warnings y 4 infos preexistentes, ninguno en lo tocado); `pnpm test` **719** (3 nuevas); `pnpm build` en verde. No se pudo abrir las rutas autenticadas (sin credenciales y sin tocar `.env*`); no se usó la base remota. Sin migraciones ni cambios en el motor contable.
- Guardar numeraciones ya estaba arreglado y con sus tests (`acciones.test.ts`, `tests/e2e/numeraciones.spec.ts`); no requirió cambios.
- Fuera: los pgTAP/verificación visual y el período real de más de 1,000 líneas (lo verifica Coder con la base).

## Fix — Numeraciones vigilan las notas B03/B04 (F16) (17 nov 2026)

- Rama `fix/numeraciones-notas-rnc` (desde `origin/prueba`). F15 ya estaba corregido; esto cierra **F16**: `actualizar_numeracion` solo miraba `facturas` y `gastos_menores`, así que una serie B03/B04 podía moverse a un rango con NCF ya emitidos en notas.
- Migración **aditiva** `20261117300000_numeraciones_notas.sql` (NO aplicada al remoto; la revisa Coder): redefine `actualizar_numeracion` con la misma firma y el mismo mensaje de error. Ahora el último NCF es el máximo de: facturas (por `tipo_comprobante`), gastos menores, `notas_debito_venta` (03/B03), `notas_credito_venta` (04/B04) y, solo para la serie 03, las filas viejas con B03 de `notas_credito_compra`. Los B04/E34 de proveedor de las notas de crédito de compra **no** entran en la serie B04 propia (si no, un NCF del proveedor bloquearía la numeración). B01/B02/B13/B14/B15/B16 conservan su comportamiento.
- **No se agregó un `unique` nuevo.** Cada tabla ya tiene `unique(ncf)` por separado; falta unicidad *entre* tablas, que un índice `(tipo_comprobante, ncf)` no puede dar (las notas no tienen `tipo_comprobante` y un índice global chocaría con NCF de proveedores). La evidencia y la decisión quedan en `docs/pruebas/ncf-unicidad.sql`; si Contable quiere una segunda capa, sería un trigger entre tablas, no un índice.
- pgTAP `supabase/tests/numeraciones_notas_test.sql` (16 asserts, datos propios): B04/B03 viejos y nuevos no bajan por debajo del último NCF, un valor válido pasa, un B03 viejo de compras bloquea la serie 03, un B04 de proveedor no bloquea la 04, y B02/B13 siguen validando como antes. **No se pudo correr aquí** (sin Docker/Supabase CLI); lo corre el integrador.
- RNC: `docs/pruebas/rnc-duplicados.sql` (solo lectura) cuenta duplicados excluyendo ZZTEST, lista ejemplos y deja la decisión con Contable (sucursales legítimas, normalización, activos, qué hacer con los 198). **No se agregó unicidad**.
- ZZTEST: `docs/pruebas/limpieza-zztest.sql` (solo lectura) cuenta documentos por tabla y deja el borrado **comentado**; no se borró nada. Incluye el estado de **junio 2020**, que sigue **abierto** tras el test C6, y qué hace falta para cerrarlo (revisión de Contable + OK de Waldy + `cerrar_periodo`).
- Verificado: `pnpm typecheck`, `pnpm check` (solo avisos preexistentes de Biome), `pnpm test` (716) y `pnpm build` en verde. Sin cambios en `types.ts` (la firma no cambia), sin datos tocados y sin migración aplicada.
- Pendiente de decisión: unique/trigger entre tablas para NCF, regla de RNC único, borrado de ~19.5k ZZTEST y cierre de junio 2020.

## Fix — Últimas listas y selectores de contactos en servidor (15 nov 2026)

- Rama `fix/listas-finales` (desde `prueba` 18a0f01). Ahora paginan en el servidor, con `pagina`/`tamano`/`q`, el total real y navegación hasta la última página: **Cotizaciones**, **Conduces**, **Gastos menores**, **Órdenes de compra**, **Facturas recurrentes**, **Activos fijos** y **Notas de crédito de compras**. Se reutilizaron `leerOpcionesLista`, `rangoPagina`, `resumirPagina`, `BuscadorLista`, `PaginadorLista`, `contactosQueCoinciden` y `condicionesDocumento`; no hay patrón nuevo.
- Búsqueda en servidor: cotizaciones/conduces, órdenes y recurrentes por número o cliente/proveedor; gastos por número, NCF, proveedor o descripción; activos por nombre o referencia; notas de crédito de compras por número, NCF o proveedor. Un término numérico de hasta 6 dígitos es número exacto. Si el término no coincide con ningún contacto, la lista muestra «No se encontraron…» en vez de devolver todo.
- Los nombres de cliente/proveedor ahora vienen en el mismo join (`contactos(nombre)`) en todas esas listas; en gastos y notas de crédito de compras solo se resuelven las cuentas/facturas de la página (máximo 25 ids), no de toda la tabla. Activos fijos solo suma las depreciaciones de los activos visibles.
- **Selectores:** el tercero del asiento manual y el cliente de facturas recurrentes usan `SelectorContacto` con búsqueda en servidor (25 por página). La carga inicial de ambos formularios baja de 1,000 a 25 contactos; el contacto seleccionado se resuelve por id. `buscarContactos` acepta `tipo: "todos"` para el asiento (cualquier contacto activo) y `SelectorContacto` oculta «Crear nuevo» en ese caso; en facturas recurrentes se conserva «Crear nuevo cliente».
- Piezas nuevas: `condicionesTexto` en `src/lib/listas/busqueda.ts` (búsqueda en varias columnas), `tiposContacto` en `src/lib/contactos/seleccion.ts`, y `CamposDocumento.texto` acepta varias columnas. `condicionesDocumento` devuelve `numero.eq.-1` cuando hay término pero no hay dónde buscar (antes devolvía todo).
- Verificado con la base llena y build de producción local (`next start`, sesión ZZTEST): 19,481 facturas, 1,023 contactos, 1 cotización (#8), 1 conduce (#1) y 1 gasto (#8, NCF B1300000001). Se encontraron el documento viejo de cada lista no vacía, la factura vieja del `ZZTEST-Cliente-0800` (14 resultados, más allá del contacto 1,000) y las búsquedas por nombre (`Ferretería Prueba 1695/4493`), NCF y descripción. Facturación sigue mostrando 19,481 y llega a «Página 780 de 780». Los cuatro listados vacíos en esta base (órdenes de compra, recurrentes, activos fijos y notas de crédito de compras) cargan con total 0 y búsqueda sin resultados; no se pudo ejercitar su última página por falta de datos.
- p95 en build de producción local: listas 308–1,237 ms y búsquedas 333–722 ms (facturación por cliente 786 ms). Selector de tercero del asiento 951 ms; selector de cliente recurrente 927 ms. Todo bajo 2 s y sin errores de consola.
- Pruebas: `pnpm test` **716** (12 nuevas: `condicionesTexto`, `texto` multi-columna, `tiposContacto`/`unirContactos` y el candado `src/lib/listas/topes.test.ts` que falla si vuelve un `.limit(300/500)` en esas consultas). Nuevo `tests/e2e/listas.spec.ts` (7, se salta sin `E2E_EMAIL`/`E2E_PASSWORD`): en cada lista una búsqueda sin coincidencias no muestra todo. `typecheck`, Biome de lo tocado y `build` en verde.
- `rg "\.limit\("` final: solo quedan `.limit(1)` de búsquedas puntuales, `LIMITE_IDS_BUSQUEDA` (200) y la carga inicial de 25 contactos de los selectores; ninguna lista corta filas.
- Fuera: reportes y RPC de reportes (otra sesión), migraciones, cálculos/validaciones/motor contable y verificación visual (la hace Coder). Sin push ni merge.

## Fix — Listas restantes y selectores de contactos/facturas en servidor (15 nov 2026)

- Rama `fix/listas-restantes` (desde `prueba` 3e1a9e6, que ya traía la paginación de Compras, Pagos a proveedores, Contactos y Productos). Ahora también paginan en el servidor, con `pagina`/`tamano`/`q`, el total real y navegación hasta la última página: **Facturación**, **Pagos recibidos**, **Notas de crédito**, **Notas de débito** y **Asientos**.
- Búsqueda en servidor: facturas por número, NCF o cliente (nombre/RNC); pagos por número, cliente o factura (número/NCF), incluidas las aplicaciones de pagos multifactura; notas por número, NCF, factura o cliente; asientos por número o descripción (conservando los filtros Desde/Hasta). Un término numérico de hasta 6 dígitos es número exacto de documento.
- **F4:** `SelectorContacto` (factura, cotización, conduce, nota de débito, pago recibido, compra, gasto, orden de compra) ya no depende del tope de 1,000: pide al servidor con debounce de 350 ms (25 por página), resuelve el contacto seleccionado aunque no esté en la primera página y conserva «Crear nuevo cliente/proveedor» con el diálogo de siempre. La acción `buscarContactos` filtra por cliente/proveedor/ambos, activo, nombre/RNC/teléfono/correo.
- **F13:** el selector de factura de «Nueva nota de débito» busca en el servidor por cliente (número/NCF, 25 por página) y ya no se limita a las 500 facturas más nuevas. La nota de crédito no tiene selector: toma la factura por URL.
- Piezas nuevas: `src/lib/listas/documento.ts` (condiciones `.or()` puras, con Vitest) y `src/lib/listas/coincidencias.ts` (ids de contactos/facturas/pagos); `src/lib/contactos/{busqueda,seleccion}.ts`; `src/lib/notas-debito/busqueda.ts`. Se reutilizaron `parametros.ts`, `buscador-lista`, `paginador-lista` y el patrón de `pagos/busqueda.ts`.
- Verificado con la base llena (19,481 facturas, 11,251 pagos recibidos, 501 notas de crédito, 39,545 asientos, 1,023 contactos): se encuentran la factura #8, el pago #38, la nota #7, el asiento #19 por «B0200000001», el cliente `ZZTEST-Cliente-0800` (facturas y F13, con la vieja #1912) y el proveedor `ZZTEST-Proveedor-0200` (más allá del 1,000). Todas las listas llegan a su última página (facturas 780, pagos 451, notas 21, asientos 1,582) con el total real.
- p95 medido en build de producción local (`next start`, sesión ZZTEST): listas y búsquedas entre 273 y 1,205 ms; selectores 221–449 ms. Todo por debajo de 2 s. Sin errores de consola.
- `pnpm typecheck`, `pnpm test` (704, 10 nuevas), Biome de lo tocado y `pnpm build` en verde. Sin migraciones ni cambios en cálculos, validaciones, reportes o motor contable.
- Quedó fuera (anotado con `rg`): las listas de cotizaciones, conduces, gastos, órdenes de compra, facturas recurrentes, activos fijos y notas de crédito de compras siguen con tope de 300/500; el selector de contactos del asiento manual (`getDatosFormularioAsiento`, tope 1,000); el selector de clientes de facturas recurrentes; y los reportes/RPC que aún cortan (F5/F6, otra sesión). Sin verificación visual (la hace Coder).

## Fix — Listas completas: paginación y búsqueda en servidor (15 nov 2026)

- Rama `fix/listas-completas` (desde `origin/prueba`). Compras, Pagos a proveedores, Contactos y Productos ahora paginan en el servidor con `searchParams` (`pagina`, `tamano`, `q`), muestran el total real y navegan hasta la última página. Se acabaron los cortes silenciosos de 300/1,000 filas.
- Búsqueda en servidor: Compras por número, NCF o proveedor (nombre/RNC); Pagos por número, proveedor o factura (NCF); Contactos por nombre, RNC, teléfono o correo; Productos por nombre o referencia. Un término numérico de hasta 6 dígitos se trata como número exacto de documento; los RNC (9/11) y los dígitos de un NCF siguen buscándose como texto.
- «Nuevo pago» y «Nuevo pago a proveedor» ya no cargan todas las facturas/compras abiertas: el selector pide al servidor por contacto con debounce de 350 ms (8 por página) y busca cualquier número o NCF. Los montos y retenciones ya escritos se conservan al cambiar de página o búsqueda.
- Piezas nuevas: `src/lib/listas/{parametros,busqueda}.ts` (puros, con Vitest), `src/components/listas/{buscador,paginador}-lista.tsx` y la server action `src/lib/pagos/busqueda.ts`. `getFacturasAbiertas` y la carga masiva de `facturasAbiertas` se eliminaron; el pago inicial se resuelve con `getFacturaPago(id, tipo)`.
- Verificado con la base llena (5,002 compras, 3,002 pagos a proveedores, 1,023 contactos, 322 productos, 3,932 facturas abiertas de un cliente): se encuentran por número/nombre el pago #66, la compra #66, el contacto `ZZTEST-Proveedor-0200`, el producto `ZZTEST-Producto-289` y la factura vieja #15696. p95 medido en rutas de producción local: Compras 640–983 ms, Pagos 544–701 ms, Contactos 473–544 ms, Productos 616–1,647 ms; búsquedas y selectores 839–1,501 ms. Todo por debajo de 2 s.
- `pnpm typecheck`, `pnpm test` (690), Biome de lo tocado y `pnpm build` en verde. Sin migraciones ni cambios en cálculos, validaciones o motor contable.
- Quedó fuera (otras tareas): paginar Facturación, Pagos recibidos, Notas, Asientos y demás listas con tope; el combobox de contactos de los formularios (F4, sigue cortando en 1,000); el selector de «Nueva nota de débito» (F13); y los reportes/RPC que aún cortan (F5/F6).

## Fix — Guardar numeraciones (F15): funciona y queda comprobado (15 nov 2026)

- **Qué era F15:** `actualizarNumeracion` (`src/lib/numeraciones/acciones.ts`) hacía `const rpc = supabase.rpc as unknown as RpcSuelta`; al perder el `this`, la RPC tiraba `TypeError (reading 'rest')`. La server action rechazaba antes de devolver `{ ok: false }`, así que el diálogo seguía abierto, sin mensaje en pantalla y sin error de consola (la promesa de la transición se rechazaba en el servidor).
- **Estado:** ya está corregido en `origin/prueba` (`cdfea68`, «llamar supabase.rpc directo»), que también agregó `src/lib/rpc-sin-extraer.test.ts`. La acción hoy llama `supabase.rpc("actualizar_numeracion", { p })` directo.
- **Por qué la sonda anterior no lo vio:** `tests/carga/sonda-ui.ts` apuntaba a `/dashboard/configuracion/numeraciones` (ruta que no existe; la real es `/dashboard/contabilidad/numeraciones`) y solo hacía GET + `networkidle`, sin pulsar Guardar. La comprobación en vivo de 2.5 s tampoco esperaba a la acción ni miraba la respuesta: el fallo ocurría dentro de la transición en el servidor y no se pintaba. F15 se detectó leyendo el código, no con la sonda de UI.
- **Verificación:** build de producción (`pnpm build` + `next start -p 3005`) y Playwright con los usuarios de `.env.pruebas`: se abrió «Editar numeración» de B16 (Exportaciones), se pulsó Guardar con los mismos valores y el diálogo cerró; la fila quedó igual. Con Nombre en espacios sale «El nombre es obligatorio» y no guarda.
- **Candados nuevos:** `tests/e2e/numeraciones.spec.ts` (2 pruebas; se salta sin `E2E_EMAIL`/`E2E_PASSWORD`, como el humo) y `src/lib/numeraciones/acciones.test.ts` (4 pruebas: RPC directa con payload validado, error de validación en español, error de RPC y permiso de lector). El candado estático `rpc-sin-extraer.test.ts` ya cubría este archivo.
- `pnpm typecheck`, `pnpm test`, Biome sobre lo tocado y `pnpm build` en verde. Sin migraciones, sin push ni merge.

## Unificación del rediseño en `diseno/rediseno` (16 nov 2026)

- Se auditaron todas las ramas de diseño (t3/\*, diseno/\*, feat/\*-alegra):
  el menú lateral Alegra, el data grid con KPIs, la ficha de contacto (6
  tarjetas + pestañas), la ficha de producto, el hub de reportes y el inicio
  con tarjetas KPI ya estaban fusionados en `diseno/rediseno` por las
  sesiones t3 (commits `df6cd2c`…`9c2734e`).
- Faltaban solo las guías de estilo medidas en vivo; se trajeron con
  cherry-pick: `css-tablas/` (bffb88e + 302e3e7), `css-menu/` (1e3ab05) y
  `css-inicio/` (395f94d, incluye la sección en `ALEGRA.md`).
- Omitido a propósito: `feat/sidebar-alegra-style`, `feat/facturas-tabla-alegra`
  e `feat/inicio-diseno-alegra` (versiones viejas ya superadas por rediseno),
  `diseno/ficha-tarjetas-pestanas` (parche ya aplicado como `df6cd2c`) y las
  ramas `feat/`, `fix/`, `perf/` de contabilidad (backend: no se mezclan aquí).
- Verificado: `pnpm exec tsc --noEmit` y `pnpm exec biome check` en verde.

## Ficha de contacto: 6 tarjetas de Alegra y pestañas por documento (15 nov 2026)

- **Tarjetas** (siempre las 6, como `docs/alegra/capturas/09-ficha-cliente.png`):
  Cuentas por cobrar, Anticipos recibidos, Anticipos entregados, Por pagar,
  Notas crédito por aplicar y Notas débito por aplicar. Se quitaron «Total
  facturado», «Total cobrado», «Total comprado» y «Total pagado».
- Notas por aplicar = 0: hoy toda nota de crédito/débito nace ligada a una
  factura (`factura_id not null`). Si se permiten notas sueltas, calcular aquí.
- **Pestañas**: Resumen, Transacciones, Facturas de venta, Cotizaciones,
  Conduces, Notas de crédito y débito, Pagos recibidos (cliente); Facturas de
  proveedor, Notas crédito de compra, Pagos a proveedor (proveedor); Asientos,
  Contactos y Documentos. Tablas en `_components/pestanas-documentos.tsx`
  con búsqueda y paginación de 10.
- Transacciones: el monto del asiento usa débito o crédito (antes salía 0.00
  cuando el contacto estaba en el crédito).

## Rediseño de la ficha de contacto estilo Alegra/Everest (15 nov 2026)

- `ficha-contacto.tsx` reescrito como **un solo panel blanco** con todo dentro:
  encabezado + fila de KPIs + barra de pestañas + contenido, con Inter
  (`var(--font-inter)`). Solo frontend; no se tocó `obtenerFichaContacto` ni
  `src/lib`.
- **Encabezado**: caja primaria con `Building2`, nombre + pill verde «Activo»,
  meta con iconos (RNC, teléfono, correo, dirección). A la derecha: botón
  primario **«Editar perfil»** (abre diálogo con el formulario de contacto) y
  menú ⋮ con «Nueva factura» / «Nueva compra» / «Estado de cuenta». El lector
  ve «Estado de cuenta» como botón primario sin menú.
- **KPIs fijos** entre el encabezado y las pestañas (siempre visibles): Por
  cobrar (rojo), Anticipos, Total facturado y Total cobrado (verde) para
  clientes; Por pagar, Total comprado y Total pagado para proveedores.
- **Pestañas** (texto + icono, activa en azul con subrayado, sin «Activity»):
  Resumen → Transacciones → **Facturas** → Contactos → Documentos. La acción
  de cada pestaña vive a la derecha de la barra (Filtrar, + Agregar contacto,
  Subir documento).
- **Transacciones**: UNA tabla unificada con todas las fuentes de `datos`
  (facturas venta/proveedor, cotizaciones, conduces, notas de crédito/débito,
  pagos recibidos/proveedor, asientos) con badge de tipo, ID azul enlazable
  (`FAC-1045`, `PAG-0007`…), buscador, filtro por tipo, montos de pago en
  verde con `-` y pie «Mostrando X de Y» + Anterior/Siguiente.
- **Facturas**: misma tabla pero solo con facturas de venta y de proveedor.
- **Contactos** y **Documentos**: solo diseño con constantes de ejemplo
  marcadas `// TODO backend` (no hay backend de personas ni adjuntos). Los
  botones «Agregar contacto» y «Subir documento» son visuales.
- `FormularioContacto` se extrajo a `src/components/contactos/
  formulario-contacto.tsx` y lo reusan el listado de contactos y el diálogo
  «Editar perfil» de la ficha (misma `actualizarContacto`/`crearContacto`, sin
  tocar actions). `page.tsx` ahora también carga el `Contacto` completo y las
  listas de precios activas para ese diálogo.
- Verificado: `pnpm exec tsc --noEmit` y `pnpm exec biome check` en verde.
  Sin verificación visual (el local pide login; la hace Coder). Commits en
  `diseno/rediseno`: `0231d7c`, `26c81d6` y el de esta entrada.

## Fix — Títulos largos del menú ya no se parten en dos líneas (14 nov 2026)

- «Notas de crédito en compras» (Compras) se veía en dos líneas en el menú lateral. Causa: `SidebarMenuButton`/`SidebarMenuSubButton` truncan con `[&>span:last-child]:truncate`, pero `IndicadorEnlace` renderiza un `<span>` después del título, así que el truncate caía sobre el puntito indicador y el título envolvía.
- Fix: `className="truncate"` explícito en los `<span>` de título de `nav-main.tsx` (enlace principal, trigger colapsable, subítem colapsable, trigger del dropdown colapsado e ítem del dropdown). Así no depende del selector `last-child`. `overflow:hidden` del truncate también deja el min-width del flex item en 0, así que sale la elipsis.
- Solo clases en `src/app/(main)/dashboard/_components/sidebar/nav-main.tsx`; sin cambios en `sidebar-items.ts` ni en `components/ui`. Verificado: `pnpm typecheck` y Biome del archivo en verde. Sin verificación visual (la hace Coder).

## S28 — Formularios con el diseño de Alegra (13 nov 2026)

- Todos los formularios de alta/edición pasaron a `FormCard`/`FormGrid`/`FormField`/`FormSectionTitle`/`FormDivider`/`FormTotal` (`src/components/formularios/formulario.tsx`) con las medidas de `GUIA-FORMULARIOS.md` (rama `docs/alegra-pagos`): campos de 40 px radio 10 borde slate-300, foco de 2 px con el primario, etiquetas 14/500 slate-700 con asterisco primario, rejilla `gap-x-8 gap-y-4`, tarjeta radio 12 borde slate-200 sin sombra, total a la derecha y botones de 44 px (`h-11 rounded-[12px]`) con Cancelar al lado. Los diálogos usan la misma rejilla y campos; la tarjeta es el propio `DialogContent`.
- Se amplió `formulario.tsx` con `FormActions` (fila de botones) y `FORM_BUTTON`, y `FormDivider` acepta `className`. `ComboboxCampo` de compras acepta `className`.
- Solo diseño: no cambiaron validaciones, nombres de campos, server actions, consultas ni cálculos. Sin migraciones ni base de datos. No se tocaron los formularios de pago recibido y pago a proveedor (S25), que ya siguen la guía. Se mantienen los selectores, «+ Crear nuevo cliente/producto/contacto» y ningún `<select>` nativo (`selects-nativos.test.ts` en verde).
- Inventario y estado (todos **hechos** salvo los marcados fuera):
  - **Ventas**: factura (nueva/clonar), cotización (nueva/editar/clonar) y conduce (nueva/editar/clonar) por `DocumentoVentaForm`; nota de crédito de venta; nota de débito; factura recurrente. Pagos recibidos ya venía de S25.
  - **Compras**: factura de proveedor; nota de crédito de compra; orden de compra; gasto menor; pago recurrente. Pago a proveedor ya venía de S25.
  - **Contactos/productos**: contacto (alta/edición), contacto rápido de los selectores, producto (alta/edición), producto rápido, edición masiva e importación de productos (solo el campo de archivo).
  - **Contabilidad/bancos**: asiento manual, cuenta contable (alta/edición), activo fijo, numeraciones, cuenta de banco, depósito, transferencia y nueva conciliación.
  - **Resto**: empresa, términos de pago, vendedores, centros de costo, monedas/tasas, plantillas de impresión, retenciones, ajuste de inventario, transferencia de inventario, almacenes, categorías y listas de precios.
- Fuera del inventario (no son alta/edición): login; diálogo «Convertir en factura» de la vista de cotización/conduce (un solo selector); cierre de periodos (solo confirmación); conciliación existente (marcas y guardar, sin campos); impuestos y usuarios (solo lectura); filtros GET de reportes y listados.
- Verificado: `pnpm typecheck`, `pnpm test` (662), `pnpm check` (solo avisos preexistentes) y `pnpm build` en verde. Sin verificación visual en navegador (la hace Coder; el local bloquea por login).

## S25 — Pagos multifactura con el diseño nuevo de Alegra (16 nov 2026)

- «Nuevo pago recibido» y «Nuevo pago a proveedor» se rehicieron con el diseño nuevo de Alegra: una tarjeta blanca (radio 12, borde slate-200, sin sombra), encabezado con empresa/RNC/dirección a la izquierda y «No. N» + «Recibo de caja» o «Comprobante de egreso» a la derecha, rejilla de 3 columnas, pestañas «Pago a factura de …» / «Otros ingresos|egresos», tabla de facturas con buscador, paginación de 8, retenciones por factura en modal «Retenciones aplicadas» y total + observaciones. Sirve igual para cobros y pagos.
- Componentes reutilizables en `src/components/formularios/formulario.tsx`: `FormCard`, `FormGrid`, `FormField`, `FormSectionTitle`, `FormDivider`, `FormTotal` y las clases de campo (40 px, radio 10, foco de 2 px). Son la base para la revisión de formularios de la otra sesión.
- «Nuevo pago a proveedor» pasó de formulario incrustado en el listado a página propia `/dashboard/compras/pagos/nuevo`; el listado conserva el botón «Nuevo pago» y muestra «Varias facturas (N)» cuando aplica.
- Migración **aditiva** `20261116200000_pagos_multifactura.sql` (NO aplicada; la revisa Coder): tablas `pago_recibido_aplicaciones`, `pago_proveedor_aplicaciones` y sus retenciones por aplicación; RPC nuevas `registrar_pago_recibido_multi(p_encabezado, p_aplicaciones)` y `registrar_pago_proveedor_multi(...)`. El servidor recalcula retenciones e ITBIS, valida saldos y arma **un solo asiento** para todas las facturas. «Otros ingresos» acredita la cuenta de ingreso (+ ITBIS por pagar); «Otros egresos» debita gasto/costo (+ ITBIS adelantado). `anular_documento` revierte las aplicaciones nuevas y conserva los pagos viejos. `pagos_proveedor.factura_proveedor_id` admite null para egresos sin factura.
- Pagos viejos de una sola factura siguen usando `registrar_pago_recibido` / `registrar_pago_proveedor` sin cambios; además se guarda su detalle en las tablas históricas de retenciones. Las vistas de pago, la ficha de factura/compra, el estado de cuenta, el 607, ventas por cliente y las cartas/IR-17 leen también las aplicaciones nuevas.
- pgTAP `supabase/tests/pagos_multifactura_test.sql` (39 asserts, datos propios): pago a 2 facturas + retención cuadra, ambos saldos bajan, no se paga de más, no se repite la retención, otros ingresos con ITBIS, pago a 2 compras y anulación. Vitest `src/lib/pagos/multifactura.test.ts` (14) para saldos, retenciones, validación, totales y paginación.
- Verificado tras integrar `prueba` (`dd4f71f`): `pnpm typecheck`, `pnpm test` (662), Biome de lo tocado y `pnpm build` en verde. Sin verificación visual (la hace Coder). pgTAP no se pudo correr aquí (sin Docker/Supabase CLI). `types.ts` se actualizó a mano solo con las tablas/RPC nuevas.
- Quedó fuera: el lápiz de «Cambiar numeración» (no existe numeración configurable de recibos); editar el «Valor retenido» del modal (el motor lo calcula por porcentaje); y la revisión de estilos del resto de formularios (otra sesión).

## Catálogo completo de impuestos (15 nov 2026)

- Nuevo catálogo `impuestos` con Ninguno, ITBIS 18 %, ITBIS 16 %, ITBIS 0 %,
  CDT 2 %, Propina 10 % y Exento 0 %, agrupado como en Alegra. Configuración >
  Impuestos ahora lee el catálogo (grupo, tarifa, cuenta y estado).
- Cuentas nuevas: **2105 CDT por pagar** y **2106 Propina legal por pagar**
  (subcuentas de Pasivos corrientes). ITBIS sigue en **2102 ITBIS por pagar**;
  Exento y Ninguno no tienen cuenta.
- Los selectores de factura, cotización, conduce, notas de crédito/débito,
  factura de proveedor, gasto menor, orden de compra y productos usan
  `SelectorImpuesto` (shadcn, encabezados de grupo; sin «Crear nuevo impuesto»).
  La línea guarda `impuesto_id` y `itbis_tasa`.
- Motor: `crear_factura`, `crear_factura_proveedor`, notas de crédito/débito,
  gasto menor, cotización/conduce, orden de compra y productos conservan su
  firma y ahora separan cada impuesto en su cuenta. Propina y CDT quedan en
  `propina` y `otros_impuestos`, nunca dentro de `itbis`. Los documentos viejos
  con `itbis_tasa` 18/16/0 se mapean al catálogo (0 → ITBIS 0 %). Exento se
  conserva distinto de ITBIS 0 % para el reporte detallado.
- Reportes: 606/607 usan `otros impuestos` y `propina`; el IT-1 solo toma
  ITBIS; el reporte detallado agrega Propina y CDT y distingue Exento.
  El PDF/vista muestra una fila por impuesto con su nombre.
- Migraciones **aditivas** (NO aplicadas al remoto; las revisa Coder):
  `20261115700000_impuestos_catalogo.sql` (tabla, cuentas, columnas, helpers,
  triggers y RLS) y `20261115701000_motor_impuestos.sql` (wrappers del motor).
  pgTAP `supabase/tests/impuestos_catalogo_test.sql` (25 asserts, aislado).
- Funciones envueltas y base exacta de la que parten (rename + wrapper, sin
  reescribir el cuerpo): `crear_factura` y `crear_factura_proveedor`
  (`20261115500000`), `crear_nota_credito_venta` y `crear_nota_credito_compra`
  (`20261115500000`), `crear_nota_debito_venta` (`20261114100000`),
  `crear_gasto_menor` (`20261113160000`), `_crear_documento_no_contable`
  (`20261115201000`), `_editar_documento_no_contable` (`20261115400000`),
  `crear_orden_compra` (`20261114201000`), `crear_producto` y
  `actualizar_producto` (`20261114900000`). `convertir_a_factura`
  (`20261115201000`) se reescribe solo para pasar `impuesto_id` de la línea.
  `crear_cotizacion`, `crear_remision`, `editar_cotizacion`,
  `editar_remision` y `crear_remision_desde_cotizacion` (`20261115400000`) se
  conservan y llaman a los wrappers.
- Corrección: `_impuestos_preparar_fuente` usaba `FOUND` después de un
  `EXECUTE ... INTO` (que no lo actualiza); ahora usa `GET DIAGNOSTICS ROW_COUNT`.
  `_impuestos_dividir_asiento` valida que el reparto sume el monto original.
  El pgTAP cubre también la nota de crédito de compra.
- Verificado: `pnpm typecheck`, Biome sobre lo tocado, `pnpm test` y
  `pnpm build`. Los pgTAP no se pudieron correr aquí (sin Docker/Supabase CLI).
- Pendiente: regenerar `src/lib/supabase/types.ts` con `pnpm db:types` después
  de aplicar las migraciones. Quedaron fuera los selectores de facturas
  recurrentes y pagos recurrentes (siguen con 0/16/18) y «Crear nuevo impuesto».
- Merge con `origin/prueba` (S15/S16/S17/S19/S22): se conservaron el catálogo y
  el selector de impuestos junto con los selectores de contacto/producto,
  edición/clonado, importación masiva y Suspense. El motor no reescribe cuerpos:
  renombra la última definición de cada función a `*_sin_impuestos` y la envuelve
  para repartir impuestos; también envuelve `_editar_documento_no_contable` para
  que editar cotización/conduce conserve `impuesto_id` y totales.
- Otras sesiones: no se tocaron los archivos de `2026111550*` ni las pantallas de
  importar productos/clonar cotización; solo se integraron sus cambios.

## S26 — Listas desplegables con shadcn (13 nov 2026)

- Nuevo `src/components/select-campo.tsx`: `SelectCampo` envuelve `Select` o el
  `Combobox` con búsqueda de `components/ui`; acepta `name` (input oculto),
  `valorInicial`/`valor` + `onCambio`, `requerido`, `deshabilitado` y usa el
  centinela `__ninguno` para «Todos/Elige…», que se guarda como cadena vacía.
- Primera parte: **18** selects nativos (`NativeSelect`/`<select>`) en 13
  archivos: diálogo Nueva cuenta (Tipo y Naturaleza), filtros de reportes
  (libros, estados, ventas, vendedores, transacciones, anual, inventario, estado
  de cuenta) y paginación. Las listas largas (cuentas, contactos, centros y
  vendedores) usan el combobox con búsqueda.
- Segunda parte (con S20 ya en `prueba`): convertidos los 2 que quedaban, ambos
  en `compras/formulario-factura` (Almacén y Tipo de línea). Los ITBIS de compras
  y gastos ya venían con `SelectorImpuesto` (Select de shadcn) desde S20, así que
  no se tocó su lógica ni `impuesto_id`; gastos no tenía NativeSelect.
- Regla nueva: `src/lib/selects-nativos.test.ts` falla si aparece `<select>` o
  `NativeSelect` fuera de `components/ui`, sin lista de pendientes. Anotada en
  `AGENTS.md`.
- No se tocaron los formularios de pago ni el catálogo de cuentas. Sin
  migraciones. `typecheck`, `test` (639), Biome de lo tocado y `build` en verde.

## S27 — Catálogo de cuentas en árbol (13 nov 2026)

- El catálogo de `/dashboard/contabilidad` ya no es una tabla plana: nuevo
  `CatalogoCuentas` cliente que arma el árbol con `padre_id` desde las cuentas
  que carga el servidor. Cada padre tiene chevron; las hijas van sangradas con
  líneas guía. Las raíces llevan badge de color por tipo y separador. Al cargar,
  Activos y su primer nivel quedan abiertos; el resto cerrado. Botones «Expandir
  todo» y «Contraer todo».
- Columnas: Nombre de la cuenta, Código, Uso de cuenta (con ícono de info y
  tooltip), Descripción (truncada con tooltip) y Saldo (rojo si es negativo).
  El uso se deriva de `config_contable` y, para cajas/bancos, de
  `es_caja_banco`/`tipo_banco`; no hay columna nueva en la base.
- Buscador por nombre o código, insensible a mayúsculas y acentos: conserva a
  los ancestros de cada coincidencia y abre las ramas donde hay resultados.
- Al pasar el mouse salen las acciones: crear subcuenta (el diálogo abre con el
  padre y el tipo preseleccionados), editar y ver movimientos (`rutaCuenta`).
  No se agregó papelera porque hoy no existe acción de borrar.
- Clic en una fila la resalta y abre «Información de la cuenta» (código, nombre,
  tipo, naturaleza, uso, descripción, saldo y enlace a movimientos): panel fijo
  a la derecha en escritorio y `Sheet` en móvil.
- Lógica pura en `src/lib/contabilidad/catalogo.ts` (árbol, filtro, expansión,
  aplanado, índice y uso) con Vitest en `catalogo.test.ts` (9 tests).
  `obtenerCatalogoContable` ahora selecciona `descripcion`, `es_caja_banco` y
  `tipo_banco`; `CuentaContable` los tiene opcionales.
- `cuenta-formulario.tsx` se tocó lo mínimo: `trigger`, `padreIdInicial` y
  `tipoInicial` en `NuevaCuenta`/`EditarCuenta` para las acciones de fila. La
  sesión S26 (`fix/select-shadcn`) también edita ese archivo, pero en los
  `NativeSelect` del formulario; el conflicto debería ser chico.
- Sin migraciones. `typecheck`, `test` (632), Biome sobre lo tocado y `build` en
  verde. Sin verificación visual (la hace Coder).
- Quedó fuera: editar Descripción y Uso desde el catálogo (el formulario de
  cuenta no tiene esos campos) y la acción de borrar. El `loading.tsx` existente
  se mantiene.

## S24 — Papel impreso/PDF de factura, cotización y conduce (13 nov 2026)

- `DocumentoPapel`: las columnas de montos (Precio, Descuento, Impuesto y
  Valor/Subtotal) tienen ancho mínimo en pt y `whitespace-nowrap` para
  `RD$9,999,999.99`; la descripción absorbe el resto y puede partir.
- Bloque del cliente: RNC y Teléfono solo se muestran si tienen dato. Se oculta
  «Vencimiento NCF» sin fecha y «Vencimiento de la factura» lleva dos puntos.
- Tests de render con `renderToStaticMarkup` en `documento-papel.test.tsx` (7).
  Sin migraciones. `typecheck`, `test` (623), Biome de lo tocado y `build` en
  verde; sin verificación visual.

## S23 — Inicio como «Resumen del negocio» de Alegra (16 nov 2026)

- Inicio (`/dashboard`) ahora es el «Resumen del negocio»: encabezado y filtro
  de periodo a la derecha (`?periodo=mes|3m|6m`, con el rango dd/mm/aaaa debajo
  de cada opción). Se conserva arriba el aviso de saldo negativo en caja/banco.
  «Mes actual» va del día 1 a hoy; 3 m y 6 m cuentan meses calendario hacia
  atrás, incluido el actual.
- **Una sola función SQL de solo lectura**:
  `dashboard_resumen(p_desde, p_hasta)` (`20261116100000_dashboard_resumen.sql`,
  aditiva, no aplicada al remoto). Es `stable`, `security invoker` y respeta RLS;
  devuelve un JSON con las tarjetas y la serie. `obtenerResumenNegocio` usa
  `cache()` para que los tres bloques compartan una sola llamada.
- Tarjetas grandes: **Cuentas por cobrar** y **Cuentas por pagar**, con total y
  filas proporcionales verde «Vigentes» y roja «Vencidas» (monto y N documentos).
  Saldo = `total - pagado - crédito - retenido`; vencidas = vencimiento < hasta
  (= hoy) y saldo > 0. Solo facturas del periodo con saldo pendiente. El título
  enlaza a CxC (`?hasta=&creacion_desde=&creacion_hasta=`) / CxP
  (`?desde=&hasta=`).
- Tarjetas chicas 2×2: **Impuestos en venta** (suma de `facturas.itbis` del
  periodo), **Productos vendidos** (unidades de `factura_lineas` de facturas no
  anuladas), **Devoluciones de clientes** (notas de crédito de venta activas,
  «Incluye impuestos») y **Clientes con ventas** (contactos distintos, enlaza a
  Ventas por cliente con fechas).
- **Total de ventas**: facturas no anuladas, `total` con impuestos; el título
  enlaza a Ventas generales con fechas. Con un solo mes, líneas diarias (serie
  sólida del periodo y punteada del mismo rango del año anterior, tooltip con
  ambas); con 3/6 meses, barras por mes. Total y variación % contra el mismo
  rango del año anterior; botón para abrir la gráfica en un Dialog grande.
  Todo con Chart de shadcn/recharts.
- Cada bloque va en su `<Suspense>` con esqueletos que imitan su forma
  (`_components/inicio/esqueletos.tsx`) y `loading.tsx` actualizado.
- pgTAP `dashboard_resumen_test.sql` (27 asserts) con datos propios en fechas
  2099/2098; cubre CxC/CxP, tarjetas, ventas, variación y series diaria/mensual.
  Vitest `src/lib/inicio/periodo.test.ts` (9) para el periodo y los rangos.
  El pgTAP no se pudo correr aquí (sin Docker/Supabase CLI).
- `types.ts` actualizado a mano solo con `dashboard_resumen` (la migración no
  está aplicada). `typecheck`, `test` (625), Biome de lo tocado y `build` en
  verde. Sin verificación visual.
- Quedó fuera: «Funciones sugeridas», «Agregar gráfica» y eliminar tarjetas
  (futuro). Las devoluciones no restan de ventas, ITBIS ni unidades (van
  aparte, como pide el brief); las barras mensuales solo pintan el periodo
  actual (la variación total sí compara contra el año anterior).

## S21 — Todo conectado: enlaces de entidades (13 nov 2026)

- `src/lib/enlaces.ts`: `rutaAjusteInventario`, `rutaTransferenciaInventario` y
  `rutaOrigenAsiento` (documento de origen de un asiento, incluidas
  transferencias/depósitos y conciliaciones).
- Vistas: el asiento de factura y compra enlaza a su asiento; en compras la
  cuenta de cada línea enlaza a la ficha; en órdenes de compra enlazan producto y
  cuenta; en pagos recurrentes enlazan las cuentas y el asiento del gasto
  generado; en notas de crédito/débito (venta y compra) el producto de cada línea
  enlaza; la factura de los pagos en la ficha del contacto enlaza.
- Ficha de contacto: nuevas pestañas «Notas de crédito y débito» y «Notas de
  crédito de compra» (número/NCF, tipo, fecha, total y estado). Ya tenía facturas,
  facturas de proveedor, cotizaciones, conduces, pagos y asientos con estado y
  saldo. La ficha de producto ya muestra ventas, compras y kardex, y la de cuenta
  sus movimientos/asientos.
- Listados: el NCF de facturas, compras y notas enlaza a su documento; el origen
  de los asientos enlaza; cotizaciones/conduces usan los helpers de ruta; el
  código del banco enlaza a la cuenta contable.
- Reportes: libro diario, movimientos por cuenta, agrupado, balance, auxiliar y
  balanza por tercero enlazan asiento, cuenta y tercero; transacciones enlaza la
  cuenta; estados financieros y estado de resultados enlazan la cuenta;
  impuestos/retenciones, IR-17 y cartas enlazan el contacto; 606/607/608 enlazan
  NCF y RNC sin tocar Excel/PDF/TXT (las rutas van en campos `__ruta`/
  `__contactoId` que no forman columnas del formato).
- Sin migraciones. `typecheck`, `test` (577), Biome de lo tocado y `build` en
  verde. Sin verificación visual (la hace Coder).
- Quedó fuera: almacén, vendedor y centro de costo no tienen ficha propia (se
  editan en Configuración), así que siguen como texto; los conceptos agregados
  del flujo de efectivo no se enlazan; el documento de una retención en IR-17 y
  cartas no tiene `factura_id` para enlazar.

## Crear contacto y producto rápido desde los selectores (15 nov 2026)

- Nuevos componentes reutilizables: `src/components/contactos/selector-contacto.tsx` y `dialogo-nuevo-contacto.tsx`; `src/components/productos/selector-producto.tsx` y `dialogo-nuevo-producto.tsx`. El combobox muestra la identificación en gris bajo el nombre, fija arriba «Crear nuevo cliente/proveedor» (o producto) y, si hay búsqueda, la usa para prellenar el nombre del diálogo. El modal de contacto tiene toggles Cliente/Proveedor, tipo y número de identificación, nombre, municipio/provincia, dirección, correo, teléfono, «Formulario avanzado» (abre `/dashboard/contactos#nuevo` en otra pestaña) y «Crear contacto».
- Al crear se usa la acción existente (`crearContacto` / `crearProducto`), ahora devuelve el id para dejar el registro seleccionado sin tocar lo ya llenado. El formulario de contactos abre el diálogo con `#nuevo` y conserva el tipo de identificación al editar.
- Selectores cambiados en: factura, cotización y conduce (plantilla `documento-venta-form`), nota de débito, pago recibido, factura de proveedor, pago a proveedor, gasto menor y orden de compra. En líneas se agregó «Crear nuevo producto» en factura/cotización/conduce, nota de débito, factura de proveedor y orden de compra.
- Validación pura en `src/lib/contactos/contacto-rapido.ts` con Vitest (RNC 9 dígitos, cédula 11, pasaporte alfanumérico y tipo cliente/proveedor/ambos).
- Migración **aditiva** `20261115600000_contacto_rapido_identificacion.sql` (NO aplicada al remoto; la revisa Coder): agrega `tipo_identificacion` y `municipio_provincia` a `contactos` y actualiza `crear_contacto`/`actualizar_contacto`. `types.ts` actualizado a mano solo en esas columnas.
- Verificado: `pnpm typecheck`, `pnpm test` (616), Biome sobre lo tocado y `pnpm build`. Sin verificación visual.
- Quedó fuera: facturas/pagos recurrentes (no estaban en la lista) y las notas de crédito, que no tienen selector propio porque toman el contacto de la factura.

## Productos: importar CSV/Excel y edición masiva (13 nov 2026)

- Lista de productos: botón «Importar» con diálogo shadcn. Descarga la
  plantilla CSV (nombre, referencia, tipo, precio, ITBIS, costo inicial,
  unidad, categoría, descripción), lee `.csv` o `.xlsx` (ExcelJS, ya instalado;
  sin dependencias nuevas), muestra vista previa con las filas listas y los
  errores por fila en español, y crea solo las filas válidas reutilizando
  `crearProducto` (RPC `crear_producto`). La columna «unidad» se acepta y se
  valida, pero no se guarda: `productos` no tiene ese campo y la app muestra
  «Unidad» fijo (decisión de Coder).
- Los productos importados de tipo «Producto» quedan inventariables con
  cantidad 0 y el costo inicial del archivo; «Servicio» queda sin inventario.
- Selección con casillas (incluye «seleccionar visibles») y «Editar
  seleccionados»: precio fijo o ajuste porcentual con signo, ITBIS, categoría
  y activo/inactivo. Usa `actualizarProducto` (RPC `actualizar_producto`) con
  los datos completos del producto; la UI muestra la columna «Estado».
- Lógica pura en `src/lib/productos/importar.ts` con Vitest (CSV con comas,
  punto y coma, comillas y BOM; validación por fila; cálculo del ajuste).
  `Producto` incluye `activo` y conserva `precios` (listas de precios).
- Merge con `origin/prueba` (inventario 2): importación y edición masiva no
  envían campos `precio_lista_*`; `actualizarProducto` omite la clave `precios`
  cuando el formulario no trae listas, así que no borra ni cambia los precios
  de listas (el formulario normal sí los manda y puede vaciarlos). Cubierto en
  `precios-formulario.test.ts`.
- Sin migración ni cambios de datos. `typecheck`, `test` (609), Biome de lo
  tocado y `build` en verde.
- Aparte: corregido solo el valor esperado del pgTAP de periodos (`3202`
  débito−crédito = resultado, sin negarlo). La función no se tocó.

## Higiene de migraciones: orden S15, notas de crédito y pgTAP aislados (15 nov 2026)

- `20261114900000_inventario_existencias_precios.sql` vuelve a la versión de
  inventario 2, sin referencias a `vendedores` ni `centros_costo`: una base
  limpia ya puede correrla antes de `2026111520*`.
- Migración aditiva `20261115500000_funciones_fusionadas_s15.sql` (NO aplicada;
  la revisa Coder): vuelve a definir con `CREATE OR REPLACE` las mismas firmas
  con todo junto: stock por almacén + vendedor/centro en `crear_factura` y
  `crear_factura_proveedor`; anulación con almacén, centro de costo y retenido;
  y NCF B04/E34 en notas de crédito de compra. El resultado de las funciones
  coincide con la base actual (definiciones comparadas contra `2026111490*`,
  `2026111510*` y `2026111520*`). No cambia datos ni permisos.
- Notas de crédito de venta: el estado de la factura ahora se recalcula con
  `pagado + retenido + crédito >= total`, el mismo criterio de pagos y CxC.
- pgTAP aislados: `configuracion_extra_test.sql` captura los ids de la factura,
  cotización y factura convertida, usa nombres únicos y busca las cuentas por
  `config_contable` (ya no asume 4101/6101). `inventario_test.sql` captura sus
  propios almacenes, productos, ajustes y asientos, y también busca las cuentas
  por `config_contable` (1104/5102 ya no están fijos).
- `pnpm typecheck`, `pnpm test`, Biome sobre lo tocado y `pnpm build` en verde.
  pgTAP no se pudo correr aquí (sin Docker/Supabase CLI); lo corre el integrador.
- Quedó fuera: anular notas de crédito de venta y revertir el costo promedio al
  anular ajustes (pendientes ya conocidos). Nada se aplicó a Supabase.

## Clonar, editar y convertir documentos de venta (15 nov 2026)

- La ficha de factura, cotización y conduce tiene «Clonar»: abre el formulario
  del mismo tipo con cliente, líneas, notas y términos prellenados, fecha de
  hoy y numeración/NCF nuevos al guardar (no guarda nada hasta confirmar).
  También se prellena el tipo de comprobante al clonar una factura.
- Cotización y conduce tienen «Editar» solo mientras están abiertos (no
  convertidos/facturados ni anulados). Reusan `DocumentoVentaForm` y la acción
  `editar_cotizacion`/`editar_remision` reemplaza las líneas y recalcula totales
  sin asiento ni inventario. Las tablas ganaron `terminos`, que ya se guarda y
  se imprime.
- «Convertir» en cotización ofrece conduce y factura. Convertir en conduce
  abre `/dashboard/conduces/nueva?cotizacion=<id>` prellenado; al guardar,
  `crear_remision_desde_cotizacion` crea el conduce (sin inventario), marca la
  cotización como convertida y deja `cotizaciones.remision_id` /
  `remisiones.cotizacion_id`; las dos fichas muestran la pestaña enlazada.
  Cotización → factura se conserva igual.
- Lógica pura en `src/components/documento-venta/prellenado.ts` con Vitest (7).
  Permisos de la vista (`editar`, `clonar`, `convertirEnConduce`) en `vista.ts`.
- Migración aditiva `20261115400000_documentos_venta_editar_clonar.sql` (NO
  aplicada; la revisa Coder) y pgTAP aislado
  `supabase/tests/documentos_venta_editar_clonar_test.sql` (31 asserts). Tipos
  de las columnas nuevas puestos a mano en `types.ts`.
- `typecheck`, `test` (556), Biome y `build` en verde. pgTAP no se pudo correr
  aquí (sin Docker/Supabase CLI).
- Fuera: clonar desde la lista (solo desde la ficha), editar facturas y
  anulación de cotizaciones/conduces.

- Integración en `prueba`: la migración ya está aplicada en el remoto. `_editar_documento_no_contable` y `crear_remision_desde_cotizacion` conservan `vendedor_id` y `centro_costo_id`. El pgTAP no reinicia secuencias compartidas. `types.ts` se regeneró con el generador.

## Navegación rápida: esqueletos, streaming y menos viajes (15 nov 2026)

- **Causa principal**: cada navegación hacía `auth.getUser()` en el proxy y otra vez en `getPerfil` (dos llamadas de red a Supabase Auth), más consultas en serie y ningún `loading.tsx`. Con Supabase a ~151 ms de RTT desde RD, una ficha de factura sumaba 6 rondas secuenciales (~900 ms) antes de pintar nada.
- **Auth**: `src/lib/supabase/proxy.ts` y `getPerfil` ahora usan `auth.getClaims()` (verifica el JWT contra el JWKS en caché; con HS256 cae a `getUser()`). Se eliminó una llamada de red por request. La verificación de sesión y los redirects siguen igual.
- **Consultas**: la lista de facturas trae el nombre del cliente en el mismo join (`contactos(nombre)`) en vez de una segunda consulta; Ventas generales hace lo mismo; el asiento de la factura trae sus cuentas en el join (una ronda menos); rol y datos de fichas van en `Promise.all`; `getEmpresa` y `getPlantillasImpresion` usan `cache()` de React para deduplicar dentro del request.
- **Streaming**: `Inicio`, Facturas de venta, Compras y Ventas generales renderizan encabezado y filtros al instante; tarjetas, gráfico y tabla van en `<Suspense>` con esqueletos. `Ventas generales` comparte una sola consulta/cálculo con `cache()` entre las cuatro partes.
- **Esqueletos**: `loading.tsx` en **todas** las rutas del dashboard (incluidos cada reporte, fichas y formularios) con `src/components/carga/esqueletos.tsx` (encabezado real + tarjetas/filtros/tabla grises). El índice de Reportes muestra «Ya vienen tus reportes…».
- **Sidebar**: se quitó `prefetch={false}` del menú y de `Enlace` (las rutas dinámicas prefetchean su `loading.tsx`); al hacer clic el ítem se marca al instante con estado optimista y un punto de progreso (`useLinkStatus`).
- **Índices**: migración **aditiva** `20261115900000_indices_rendimiento.sql` (`CREATE INDEX IF NOT EXISTS`): contacto+fecha en facturas/compras/cotizaciones/remisiones/pagos, fecha+número en listados, facturas abiertas de proveedor, notas por factura+fecha, nombre de contactos/productos y asientos por fecha+número. **No aplicada** al remoto.
- **Medición local** (`pnpm build && pnpm start`, sin sesión): shell liviano por el proxy p50 59–81 ms; RTT a Supabase p50 151 ms (n=15). No se pudieron medir las rutas autenticadas: no hay credenciales de prueba en este worktree (la solicitud de credencial expiró). Rondas de red secuenciales antes → después: Inicio 4→2, Facturas 5→2, Ficha de factura 6→3, Compras 4→2, Ficha de compra 5→3, Contactos 4→2, Productos 4→2, Ficha de contacto 5→3, Ficha de producto 7→5, Ventas generales 3→1.
- Verificado: `pnpm typecheck`, `pnpm test` (577), Biome sobre lo tocado y `pnpm build` en verde. Sin cambios de lógica contable ni de apariencia (los esqueletos son nuevos estados de carga).

## CxP con créditos y NCF del proveedor en notas de crédito (14 nov 2026)

- El saldo por pagar ahora es `total - pagado - credito` en el reporte Cuentas
  por pagar, la ficha de contacto y la ficha de producto (`facturas_proveedor.credito`).
- La nota de crédito de compra pide el NCF del proveedor (opcional, B04 + 8
  dígitos o E34 + 10 dígitos) y ya no consume la numeración 03/B03. Migración
  aditiva `20261114700000_notas_credito_compra_ncf_proveedor.sql` (NO aplicada;
  la revisa Coder). `types.ts` actualizado a mano solo en la nulabilidad de
  `notas_credito_compra.ncf`.
- pgTAP aislados de los datos reales: órdenes de compra cuenta asientos
  antes/después, pagos recurrentes usa la RPC, periodos compara contra los
  saldos previos al cierre y configuración valida solo los datos del test.
- `typecheck`, Vitest, Biome y `build` en verde. pgTAP no se pudo correr aquí
  (sin Docker/Supabase CLI).

## Rango de fechas único en reportes (14 nov 2026)

- Nuevo `reportes/_components/selector-fechas.tsx`: `SelectorRangoFechas` (botón con el rango, Popover con atajos Hoy…Personalizado y Calendar de shadcn en rango con dos meses), `SelectorFechaCorte` (Hoy, Fin de mes anterior, Fin de año anterior) y `SelectorFechaFormulario` para fechas opcionales dentro de un formulario GET.
- Atajos y etiquetas en `src/lib/fechas/rangos.ts`, puros y con Vitest (cambio de año, trimestres, febrero). La semana empieza el lunes y las fechas van en `America/Santo_Domingo`; `hoyRd` de reportes ahora reexporta `hoyEnRd`.
- Las fechas siguen en la URL (`?desde=&hasta=`; `hasta`/`corte` en los reportes de corte). Migrados todos los reportes con fechas: se borraron `filtro-fechas.tsx`, `libros/campos-fecha.tsx` y todos los `input type="date"` de `reportes/**`. Reporte anual conserva su selector de año (no es un rango).
- Sin migración ni cambios de datos. `typecheck`, `test` (501), Biome y `build` en verde.

## Bancos: fichas, transferencias y conciliaciones (14 nov 2026)

- Lista de bancos con Nombre, Tipo, Número, Saldo y Conciliación (última
  conciliación o borrador). Ficha `/dashboard/bancos/[id]` con saldo actual,
  movimientos enlazados (documento, asiento y tercero) y filtro Desde/Hasta.
- Transferencia con `Select` y `DatePicker`, observaciones en «Más opciones»; al
  guardar abre `/dashboard/bancos/transferencias/[id]` con las cuentas y su
  asiento. El diálogo de depósito se conservó con los mismos componentes.
- Conciliaciones: lista, nueva (cuenta, fecha de corte y saldo del extracto; el
  desde sale del último corte) y detalle editable con movimientos marcables,
  diferencia en vivo, ajustes bancarios, guardar borrador y conciliar. Usa las
  RPC `guardar_borrador_conciliacion` y `conciliar_cuenta` ya existentes.
- Enlaces nuevos en `src/lib/enlaces.ts` (`rutaBanco`, `rutaTransferencia`,
  `rutaConciliacion`); el origen del asiento reconoce transferencias, depósitos,
  conciliaciones y notas. Menú lateral: Bancos → Cuentas y Conciliaciones.
- Lógica pura en `src/lib/bancos/movimientos.ts` y `conciliacion.ts` con
  Vitest. Sin migración nueva. `typecheck`, `test` (506), Biome y `build` en verde.

## Configuración extra: vendedores, centros de costo, monedas y plantillas (15 nov 2026)

- **Vendedores**: `/dashboard/configuracion/vendedores` (lista, crear y editar; nombre, identificación, observación y activo). Campo opcional «Vendedor» en «Más opciones» de factura, cotización y conduce; se guarda en `facturas.vendedor_id`, `cotizaciones.vendedor_id` y `remisiones.vendedor_id`, y se conserva al convertir cotización/conduce a factura. El reporte **Ventas por vendedor** ya consulta estas facturas y agrupa por el nombre del vendedor, con filtro por vendedor.
- **Centros de costo**: `/dashboard/configuracion/centros-costo` (código, nombre, descripción y activo). Campo opcional en «Más opciones» de factura, cotización, conduce y compra. El centro del documento se copia a todas las líneas de su asiento; en asientos manuales se elige por línea. El **estado de resultados** tiene filtro por centro (RPC `reporte_estado_resultados_centro`). Las anulaciones conservan el centro en el asiento de reversión.
- **Monedas**: `/dashboard/configuracion/monedas` con DOP (base), USD y EUR y tasas de cambio editables por fecha (upsert por moneda + fecha). Por decisión con Coder en esta sesión **no** se agregó selector de moneda a los documentos ni se tocó el motor: los comprobantes siguen en DOP.
- **Plantillas de impresión**: `/dashboard/configuracion/plantillas-impresion` con notas al pie, términos por defecto y «mostrar logo» para factura, cotización y conduce. La factura es la base: si cotización o conduce no tienen textos propios, se usan los de factura. Los formularios nuevos precargan notas/términos y el logo se oculta en el formulario y en la impresión según la plantilla.
- Migraciones **aditivas** (no aplicadas al remoto; las revisa Coder): `20261115200000_vendedores.sql`, `20261115201000_centros_costo.sql`, `20261115202000_monedas.sql` y `20261115203000_plantillas_impresion.sql`. pgTAP `supabase/tests/configuracion_extra_test.sql` (36 asserts). Tipos de tablas y RPC nuevos añadidos a mano en `src/lib/supabase/types.ts`.
- Verificado: `pnpm typecheck`, Biome sobre lo tocado, `pnpm test` (503) y `pnpm build`. Los pgTAP no se pudieron correr aquí (sin Docker/Supabase CLI).
- Quedó fuera: conversión real de documentos a moneda extranjera, ficha propia para vendedores/centros/monedas (se editan en diálogo) y rediseño del PDF (sesión de `feat/pdf-documentos`).

## Inventario 2: stock por almacén, transferencias y listas de precios (14 nov 2026)

- Nuevas tablas `existencias` (producto + almacén), `listas_precios`, `producto_precios` y `transferencias_inventario` + líneas. La semilla copia la existencia global actual al almacén Principal; `productos.cantidad` sigue siendo el total.
- Ventas, compras, notas de crédito y ajustes guardan `almacen_id` y mueven la existencia de ese almacén (Principal por defecto). Los documentos viejos sin almacén se tratan como Principal. Los conduces siguen sin mover stock, como en Alegra.
- Ajustes: nueva columna `estado`; se anulan con `anular_documento('ajuste_inventario', id)`, revirtiendo existencia y asiento.
- Transferencias: lista, nueva y detalle en `/dashboard/inventario/transferencias`; sin asiento y con anulación que devuelve las cantidades. No permite origen = destino, producto repetido ni stock insuficiente en origen.
- Listas de precios: `/dashboard/inventario/listas-precios` (Nombre, Principal, Tipo). Precio por lista en «Más opciones» del producto, lista por defecto opcional en el contacto y selector en «Más opciones» de la factura que cambia los precios sugeridos. En porcentaje, 10 = +10 % y -10 = descuento.
- Ficha de producto: tabla de existencia por almacén.
- Migraciones aditivas `20261114900000_inventario_existencias_precios.sql` y `20261114901000_transferencias_inventario.sql` (NO aplicadas al remoto). pgTAP `supabase/tests/inventario_almacenes_test.sql` (36 asserts, aislado). Tipos de las tablas nuevas a mano en `types.ts`.
- `typecheck`, `test` (503), Biome y `build` en verde. pgTAP no se pudo correr aquí (sin Docker/Supabase CLI).
- Pendiente/fuera: conduces no mueven stock; anular una nota de crédito de venta sigue sin soporte; la anulación de ajustes no revierte el costo promedio.

## Retenciones de ITBIS e ISR (15 nov 2026)

- Configuración > Retenciones: catálogo con nombre, tipo (ITBIS/ISR), porcentaje,
  cuenta cuando retenemos (pasivo), cuenta cuando nos retienen (activo) y activa.
  Lista, crear y editar. Semilla con ITBIS 30 %, ITBIS 100 %, ISR 10 %
  honorarios, ISR 2 % servicios e ISR 5 % alquileres (`ON CONFLICT DO NOTHING`).
- Pagos recibidos y pagos a proveedores: «Más opciones» > Retenciones. El
  servidor recalcula la base (ITBIS sobre el ITBIS de la factura, ISR sobre el
  subtotal) y arma el asiento. Lo retenido por un cliente va a activo/anticipo;
  lo retenido a un proveedor, a pasivo por pagar. El saldo de la factura resta
  `pagado + credito + retenido`; «Valor retenido» de la factura ya es real y la
  anulación del pago revierte ambos.
- Reportes IR-17 (retenciones a proveedores por tipo y totales) y Cartas de
  retención (lista por proveedor y período con carta imprimible). Son de solo
  lectura: no crean ni envían nada hasta que el usuario guarde un documento.
- Migraciones aditivas `20261115100000_retenciones.sql`,
  `20261115100100_pagos_retenciones.sql` y
  `20261115100200_reporte_cxc_retenciones.sql` (NO aplicadas al remoto).
  Reemplazan `registrar_pago_recibido`, `registrar_pago_proveedor`,
  `anular_documento` y `reporte_cxc` manteniendo su firma. Tipos de las tablas y
  RPC nuevas agregados a mano en `types.ts`.
- pgTAP `supabase/tests/retenciones_test.sql` (27 asserts, aislados). No se pudo
  correr en local (sin Docker/Supabase CLI).
- VERIFICAR con DGII: tasas y cuentas sembradas (1107/1108/2103/2104). Ver los
  comentarios `VERIFICAR` en la migración.
- Pendiente menor: las RPC de notas de crédito aún recalculan el estado de la
  factura sin `retenido`; el saldo de los reportes sí lo resta. Los pgTAP no se
  corrieron en local.

- Integración en `prueba`: la migración de pagos no se aplicó cruda. `anular_documento` conserva movimiento de existencias por almacén, centro de costo y anulación de ajustes, y suma el recálculo de `retenido`. Las tres migraciones ya están aplicadas en el remoto compartido; `types.ts` se regeneró con el generador.

## Inventario: ajustes, almacenes y categorías (14 nov 2026)

- Nuevo módulo `/dashboard/inventario`: Ajustes de inventario (lista, nuevo y
  detalle), Almacenes (con «Principal» sembrado) y Categorías de productos.
- Ajustes: entrada o salida por producto con su costo. La entrada recalcula el
  costo promedio ponderado y la salida usa el costo indicado. Asiento automático
  `ajuste_inventario`: entrada Dr 1104 Inventario / Cr 5102 Ajustes de
  inventario; salida al revés. Cuenta 5102 y `config_contable.ajuste_inventario`
  se siembran con `ON CONFLICT DO NOTHING`.
- Producto: campo opcional «Categoría» en «Más opciones». `crear_producto` y
  `actualizar_producto` aceptan `categoria_id`.
- Migración `20261114500000_inventario.sql` (NO aplicada al remoto; la revisa
  Coder). pgTAP `supabase/tests/inventario_test.sql` (26 asserts). Tipos de las
  tablas nuevas a mano en `types.ts`. No se pudieron correr los pgTAP en local
  (no hay Supabase CLI ni Docker en este equipo).
- Pendiente: transferencias entre almacenes, anulación de ajustes y stock por
  almacén (hoy la existencia sigue global en `productos`).
- Limpieza: se borró `cotizaciones/_components/documento-form.tsx` (sin uso).

## Configuración (13 nov 2026)

- Nuevo módulo `/dashboard/configuracion` con portada por grupos (Empresa, Facturación, Impuestos, Contabilidad) y menú lateral propio: Empresa (nombre, RNC, dirección, teléfono, correo y logo), Términos de pago (lista y crear), Impuestos (ITBIS 18/16/0/exento, solo lectura), Usuarios (solo admin, solo lectura) y enlaces a Numeraciones y Configuraciones contables.
- Migraciones `20261114600000_configuracion.sql` (empresa nullable, `terminos_pago` con semilla Contado/8/15/30/60, RPC `actualizar_empresa`, `crear_termino_pago`, consulta `listar_terminos_pago` y `listar_perfiles`) y `20261114600100_configuracion_logos_storage.sql` (bucket público `logos`, solo admin sube/actualiza/borra). No aplicadas al proyecto remoto.
- El logo se sube desde el navegador a Storage y el PDF/encabezado ya usan `empresa.logo_url`, RNC, dirección, teléfono y correo con campos vacíos ocultos.
- pgTAP en `supabase/tests/configuracion_test.sql`; tipos añadidos a mano en `src/lib/supabase/types.ts`. `typecheck`, Biome y Vitest en verde.

## PDF de factura, cotización y conduce con el diseño de Alegra (13 nov 2026)

- Nuevo `src/components/documento-venta/documento-papel.tsx`: un solo papel para los tres documentos, tomado de `docs/alegra/capturas/05-factura-B01.pdf`, `05-factura-B02.pdf`, `07-cotizacion.pdf` y `07-remision.pdf`. Carta, márgenes de 16 pt (28 pt arriba), Inter y logo a 50 pt; encabezado con logo, empresa, RNC, dirección, teléfono y correo (oculta lo vacío), título/NCF a la derecha, cliente, tabla con las mismas columnas, monto en letras, totales y pie. Cotización y conduce conservan su orden, totales y firmas.
- El menú ⋮ agrega «Descargar PDF» (abre la impresión con el nombre sugerido `factura-<NCF>`, `cotizacion-<n>` o `conduce-<n>`) e «Imprimir». Se usa el mismo papel HTML/CSS, no `@react-pdf`; el `@page documento-venta` de `src/app/globals.css` aísla tamaño y márgenes.
- Se borraron `facturacion/[id]/_components/factura-papel.tsx` y `cotizaciones/_components/documento-papel.tsx`. Formato puro en `papel.ts` con `papel.test.ts` (6). `typecheck`, Biome, `test` (474) y `build` en verde.

## Vista de documento de venta compartida (13 nov 2026)

- Nuevo `src/components/documento-venta/vista-documento-venta.tsx` + `vista.ts`: factura, cotización y conduce comparten la vista de tarjetas (máx. 1040 px, fondo gris, 24 px entre tarjetas), con el orden de la guía de Alegra. Solo cambia la pantalla: la impresión/PDF usa el `DocumentoPapel` compartido en el portal `data-print-root`.
- Factura: resumen de 4 cifras, acciones en íconos de 40×40 y menú ⋮ (notas de crédito/débito, imprimir copia y anular en rojo), tabla de productos y pestañas Pagos / Notas crédito / Notas débito / Contabilidad. `getFacturaVista` ahora trae las notas de crédito y débito de la factura.
- Cotización y conduce: «Editar» queda deshabilitado porque todavía no existe pantalla de edición; «Convertir» abre el diálogo existente para factura. La pestaña Facturas muestra la factura relacionada o el vacío con «Convertir en factura». No hay relación cotización↔conduce en la base, así que esa pestaña no se muestra; clonar y descargar PDF no existen y quedaron fuera.
- Se eliminaron `vista-factura.tsx`, `vista-documento.tsx` (cotizaciones) y el `asiento-contable.tsx` de la ruta; el asiento vive ahora en la pestaña Contabilidad. Tests nuevos en `vista.test.ts` (14). `typecheck`, Biome, `test` (468) y `build` en verde.

## Plantilla única de documento de venta (13 nov 2026)

- Nuevo `src/components/documento-venta/` (`documento-venta-form.tsx` + `calculo.ts`): la tarjeta del formulario de factura (logo, empresa, ajustes, cliente/fechas, líneas, totales y «Más opciones») ahora es compartida. Por props define título, comprobante/NCF o numeración simple, vencimiento, pago recibido, notas/términos/pie, textos de botones, rutas y la server action.
- Factura, cotización y conduce nuevas usan la misma plantilla; se conservaron cálculos, validaciones y acciones. La factura mantiene Ajustes con pago; cotización y conduce muestran solo información, líneas, totales y notas.
- Tests del cálculo/armado compartido en `src/components/documento-venta/calculo.test.ts` (11). `typecheck`, Biome y Vitest en verde. `cotizaciones/_components/documento-form.tsx` quedó sin uso (no se borró por ser archivo de otra sesión).

## Ingresos: notas de débito y facturas recurrentes (13 nov 2026)

- Notas de débito de venta (B03): lista, nueva y detalle en `/dashboard/notas-debito`, enlazadas a la factura y al cliente. RPC `crear_nota_debito_venta` con el asiento de una factura (Dr 1103 CxC / Cr ventas / Cr 2102 ITBIS); no mueve inventario ni cambia el saldo de la factura, suma al saldo del cliente. Numeración 03/B03 y tablas `notas_debito_venta` + `nota_debito_venta_lineas` con RLS (`20261114100000_notas_debito_venta.sql`).
- Facturas recurrentes: lista, nueva y detalle en `/dashboard/facturas-recurrentes`; plantilla con cliente, comprobante, inicio, vigencia, frecuencia en meses, plazo y líneas. `generar_factura_recurrente` es idempotente por periodo (bloquea la plantilla y registra el periodo en `factura_recurrente_generaciones`) y genera con el motor (`crear_factura`); botón «Generar ahora», sin cron (`20261114101000_facturas_recurrentes.sql`).
- pgTAP nuevos: `notas_debito_venta_test.sql` (18 asserts) y `facturas_recurrentes_test.sql` (22). No se pudieron correr en esta máquina (sin Docker/Supabase CLI). `typecheck`, Biome de los archivos tocados y los Vitest de validación en verde.
- Nota al aplicar: `asientos.origen_tipo` ya admite `nota_debito`; la migración vuelve a declarar el CHECK completo. Aplicada al proyecto remoto el 13 nov 2026 tras dry run (pgTAP 40/40 en verde dentro de BEGIN/ROLLBACK).

## Reportes fiscales y «Para trabajar» (14 nov 2026)

- Nuevas pantallas de solo lectura: 606, 607 y 608 (`/dashboard/reportes/606|607|608`) con período mensual, Excel/PDF compartido y TXT separado por pipes con encabezado DGII; el 606 incluye los gastos menores B13. Las columnas oficiales viven en `src/lib/reportes/fiscales/formatos/` con su fuente y las marcas `// VERIFICAR con instructivo DGII`.
- Reporte detallado de impuestos (4 tablas por tasa y detalle con NCF enlazado al documento), Impuestos y retenciones (pestañas Ventas/Compras con «Ver detalles») e IT-1 de solo lectura (Anexo A y casillas principales; no crea borradores ni envía nada).
- «Exportar para el contador» con rango de fechas (mes por defecto): facturas de venta, compras y libro diario en Excel/PDF.
- Cálculos y consultas en `src/lib/reportes/fiscales/`, con 23 tests Vitest. Sin migración. En la portada de Reportes solo se agregaron los enlaces de las tarjetas Fiscales y Para trabajar.
- `typecheck`, Biome, `test` (410) y `build` en verde.

## Compras completas: notas, órdenes y recurrentes (13 nov 2026)

- Notas de crédito en compras (`/dashboard/compras/notas-credito`): NCF B03 ligado a la factura de proveedor; asiento Dr CxP / Cr inventario o cuenta de gasto / Cr ITBIS adelantado; devuelve inventario, recalcula el costo promedio y baja el saldo por pagar con `facturas_proveedor.credito`. La anulación revierte asiento, inventario y crédito.
- Órdenes de compra (`/dashboard/ordenes-compra`): documento de control sin asiento ni movimiento de inventario. «Convertir en factura de proveedor» abre `compras/nueva?orden=<id>` y la orden queda enlazada a la factura creada.
- Pagos recurrentes (`/dashboard/pagos-recurrentes`): plantilla + `generar_pago_recurrente` idempotente por periodo; el botón «Generar ahora» crea el gasto menor B13 del último periodo vencido, sin cron.
- Migraciones aditivas `20261114200000_notas_credito_compra.sql`, `20261114201000_ordenes_compra.sql` y `20261114202000_pagos_recurrentes.sql`. pgTAP nuevos: 24 + 11 + 21 asserts. Tipos de las tablas nuevas a mano en `types.ts` y `facturas_proveedor.credito` agregado.
- Pendiente: aplicar la migración y regenerar `types.ts`; el reporte Cuentas por pagar debe restar `facturas_proveedor.credito` (no se tocó por ser de otra sesión). pgTAP no se pudo correr localmente (sin Docker/Supabase CLI en esta máquina).

## Ajustes de diseño del formulario de factura (13 nov 2026)

- Logo a 96 px en escritorio y 72 px en móvil; RD$ y % van dentro del campo con `InputGroup`; los `NativeSelect` (NCF, cuenta, método e ITBIS) pasan al `Select` de shadcn.
- Nuevo `src/components/date-picker.tsx` con las medidas de la guía (un mes de 306 px, celda 40×40 radio 10, paso 40×45, semana LU…DO, elegido en primario, hover slate-100 y botón Hoy) para las dos fechas; cabecera de una línea «Nov 2026» con flechas, sin selects nativos. Las listas `Select` del formulario abren debajo del campo.
- Sin cambios de cálculo. `typecheck`, `check`, `test` (387) y `build` en verde. Vista previa local bloqueada por el login; capturas pendientes de Waldy.

## Skills para agentes y motor de código (13 nov 2026)

- Skills de OpenCode en `.opencode/skills/`: `localhost`, `probar-cambios`, `flujo-git`, `diseno-ui`, `motor-contable` y `supabase-migraciones`. `AGENTS.md` tiene la lista y un checklist de arranque.
- El motor de código pasó a **T3 Code en la PC de Waldy** (Windows, MSI), modelo `opencode-go/deepseek-v4.1-flash` variante `max`. Ya no se programa con OpenCode en el box. Waldy habla solo con Coder; Coder lanza y revisa las sesiones.
- Hecho: rama `feat/fac-ajustes` (logo más grande, `RD$`/`%` dentro del input, `Select` en vez de lista nativa, calendario al estilo de las medidas de `docs/alegra/css-factura/GUIA-CALENDARIO.md`). Ya está en `prueba`.
- Se agregó a `docs/alegra/` la guía de calendario y las capturas `calendario-*.png` (sin el HTML/CSS original de Alegra).

## Diseño del formulario de factura (13 nov 2026)

- `factura-form.tsx` ahora es una sola tarjeta (máx. 1040 px) con el logo de
  Medoxigas, encabezado en 3 tercios, Ajustes en 5 columnas, Información en 3
  columnas (gap 32), tabla de productos en un solo grid con scroll horizontal,
  totales en texto plano y botones fuera de la tarjeta.
- Notas, Términos y Pie siguen ocultos en «Más opciones». La lógica de cálculo,
  validación, NCF, server actions y tipos no cambió.

## Beta 1 (13 nov 2026)

**Hecho**

- Motor contable de doble partida: migración `20261113140000_motor_contable.sql`
  aplicada en el proyecto de prueba. Incluye catálogo de 24 cuentas,
  `config_contable`, contactos, productos, numeraciones NCF, facturas, compras,
  pagos, gastos menores, anulación y reportes. Resumen para no leer todo el SQL:
  `docs/motor-contable.md`; contrato: `docs/contrato-db.md`.
- Pantallas: Inicio con KPIs, Contactos, Productos, Facturación (lista, nueva y
  detalle imprimible con asiento), Pagos recibidos, Compras (facturas de
  proveedor, pagos a proveedores y detalle), Gastos menores, Contabilidad
  (catálogo y configuración) y Reportes (libro diario, balance de comprobación,
  estado de resultados, CxC).
- Reportes de Ventas: `ventas-producto` (período + búsqueda, paginado 20) y
  `rentabilidad-producto` (período, paginado 10), con producto enlazado a su
  ficha, totales en tarjetas y exportación Excel/PDF compartida. Cálculos puros
  en `src/lib/reportes/ventas/v2/` con Vitest (cifras de la ferretería).
- pgTAP: 103 asserts en 7 archivos `motor_*` (+5 de perfiles); corre en CI, job
  `Supabase`. `types.ts` regenerado.

**Pendiente**

- Datos de la empresa editables: RNC, dirección, teléfono, correo y logo. Hoy
  `empresa` solo tiene el nombre semilla.
- Numeraciones B14, B15 y B16 además de B01/B02, con pantalla de administración.
- e-CF / DGII y reportes 606/607.
- Bancos (cuentas, movimientos y conciliación).
- Notas de crédito.
- Google login: activar proveedor en Supabase Auth y redirects de producción y
  prueba.
- e2e de los flujos de la beta (hoy se salta sin `E2E_EMAIL`/`E2E_PASSWORD`).
- Anulación de compras: devuelve cantidad pero no recalcula costo promedio.

## Reportes administrativos (13 nov 2026)

- Cuentas por cobrar ampliado con filtro Hasta, filtros NCF/Número, Cliente,
  Creación y Vencimiento, 5 vistas por antigüedad y paginado de 20.
- Nuevos reportes: Cuentas por pagar (`/reportes/cxp`), Compras
  (`/reportes/compras`) y Valor de inventario (`/reportes/valor-inventario`),
  con columnas, totales y filtros de Alegra. Exportan Excel/PDF con el
  componente compartido.
- Cálculos puros y URL de fichas en `src/lib/reportes/administrativos/d/`;
  pruebas Vitest. Sin migración: todo son consultas de solo lectura. El valor
  de inventario histórico reconstruye la existencia con movimientos posteriores
  de ventas y compras no anuladas.
- Pendiente: la otra sesión agrega los enlaces de cxp, compras y valor de
  inventario al índice de reportes.

## Arranque del proyecto (13 nov 2026)
- Repo `waldyalc/MEDOXIGAS-CONTABILIDAD` (privado), ramas `main` (producción) y `prueba`.
- Base tomada de Medoxigas-OPP (misma configuración: Next 16, pnpm, Biome, Vitest, Playwright, husky, CI, gitleaks, flujo Supabase local) **sin** sus módulos de negocio.
- Supabase `MEDOXIGAS-CONTABILIDAD` (`ljfdhrnvlsfaweuvnqxz`, ca-central-1, gratis). Migración `20261113132637_perfiles.sql` aplicada; `types.ts` generado desde el proyecto.
- Vercel `medoxigas-contabilidad` (mismo equipo que OPP): producción desde `main`, alias fijo de `prueba` en medoxigas-contabilidad-prueba.vercel.app. Variables `NEXT_PUBLIC_SUPABASE_URL` y `NEXT_PUBLIC_SUPABASE_ANON_KEY` (clave publicable).
- App: login (correo + contraseña y botón Google) y dashboard vacío con menú; módulos futuros como "Próximamente".

## Pendiente de infraestructura
- Crear el usuario de Waldy en Supabase Auth y su fila en `perfiles` con rol `admin` (SQL con OK de Waldy).
- Google: activar el proveedor Google en Supabase Auth (Client ID/secret de Google Cloud) y agregar las URL de redirección de producción y prueba. Hasta entonces el botón Google da error y se entra con correo y contraseña.
- Supabase Auth → URL Configuration: Site URL = producción y Redirect URLs de prueba.
- Estudio de Alegra con la cuenta de prueba que da Waldy → `docs/alegra/`.
- Secrets de GitHub para el humo e2e (opcional): `E2E_EMAIL`, `E2E_PASSWORD`, `E2E_SUPABASE_URL`, `E2E_SUPABASE_ANON_KEY`.

## Activos fijos, depreciación y periodos (13 nov 2026)

- Activos fijos en `/dashboard/contabilidad/activos` (lista, nuevo y detalle). Depreciación en línea recta mensual con cálculo puro en `src/lib/activos-fijos/calculo.ts` y Vitest. El botón «Depreciar periodo» crea Dr 6109 / Cr 1211 al cierre del mes y no duplica el mismo mes. La creación del activo puede generar su asiento Dr 1210 / Cr 2101.
- Periodos en `/dashboard/contabilidad/periodos`: cerrar y reabrir meses; el trigger `asientos_periodo_abierto` bloquea crear o anular asientos con fecha en un mes cerrado. El cierre de resultados del año lleva ingresos, costos y gastos a 3202 Utilidad del ejercicio y es idempotente por año.
- Migraciones aditivas `20261114300000_activos_fijos.sql` y `20261114300100_periodos_cierre.sql` (pendientes de aplicar por Coder). Cuentas nuevas: 12, 1210, 1211, 6109 y 3202. pgTAP: `activos_fijos_test.sql` y `periodos_cierre_test.sql`.
- Verificado: `pnpm typecheck`, Biome de los archivos nuevos, `pnpm test` (400) y `pnpm build`. pgTAP no se pudo correr aquí (sin Docker/Supabase local).

## Corrección de carga multiusuario (17 nov 2026)

Tras las pruebas de carga (32k docs) y concurrencia (C1–C8, todas sanas), se corrigieron las lecturas — el motor de escritura no se tocó. Ramas desde `prueba`, una por paquete, listas para revisión de Coder:

- `fix/rpc-desvinculado` — `supabase.rpc(...)` directo (revive libro diario, balance, balanza/auxiliar tercero, movimientos y guardar numeraciones); `.limit(300)` en listas de compras/pagos; candado `rpc-sin-extraer.test.ts`.
- `fix/paginacion-fiscales` — helper `paginarConsulta` (`src/lib/supabase/paginar.ts`, 5 tests) + 606/607/608/IT-1/IR-17/retenciones/exportador paginados y joins en vez de `.in()` masivo. 607 mar-2023 verificado en vivo: 1,700 filas (antes 1,033 truncadas).
- `fix/consultas-in` — bancos/conciliaciones/auxiliar/fichas/estado-cuenta/v3/d: `.in()` de miles de ids reemplazados por embeds `!inner` o `consultarEnLotes` (`lotes.ts`, 3 tests); `hasta` se filtra en SQL.
- `fix/paginacion-reportes` — `reporte_movimientos`, `reporte_libro_diario`, `reporte_saldos_tercero`, `reporte_cxc`, CxC/CxP/compras/transacciones/anual/contactos/cuentas paginados (incluye merge de `fix/rpc-desvinculado`). Nota: en `reporte_movimientos`/`libro_diario` la orden es (fecha/asiento/cuenta) — empate residual si un asiento repite la misma cuenta con mismo monto.
- `perf/fichas` — `cache()` en `getImpuestosActivos`; empresa/impuestos arrancan en paralelo con la factura; ficha de compra pide cuentas+retenciones en el primer batch; estado de cuenta corre rol+datos en paralelo.
- `docs/investigacion-carga` — `docs/pruebas/resultados/investigacion-p4.md` + `docs/pruebas/cuadre-inventario.sql` (solo lectura, lo corre Waldy).

Verificado: `pnpm typecheck`, `pnpm check:fix`, `pnpm test` (671) en la punta apilada. Sondas de UI/carga y `cuadre-inventario.sql` quedan por correr. Pendientes de Waldy/Contable: `docs/pruebas/cuadre.sql` (I2), `cuadre-inventario.sql` (D6), decisión RNC único / NC sobre factura pagada / unicidad NCF-B03-B04, y OK para borrar ~19.5k docs ZZTEST.

## Rendimiento de Inicio y catálogo de cuentas (17 nov 2026)

Medido en build de producción con ~32k documentos y ~258k líneas de asiento: Inicio p95 4.7 s (una corrida de 9.0 s) y catálogo 5.2 s. Las listas y reportes ya se habían arreglado; esto había quedado fuera.

- **Diagnóstico (leyendo el código, sin acceso a la base):** el Inicio no agrega sobre el mayor dentro de `dashboard_resumen` — esa RPC solo mira facturas, compras, notas y líneas de factura del periodo. El trabajo de base más caro de las dos pantallas es el mayor completo de `asiento_lineas` recalculado en cada visita, y ninguna de las dos lo necesita:
  - Inicio y `/dashboard/reportes` (`AvisoSaldoNegativo` → `obtenerSaldosCajaBanco`): `saldos_caja_banco` unía **todas** las líneas de las cuentas de caja/banco con `asientos` para filtrar por fecha (`20261113180100_saldos_caja_banco.sql:24-31`).
  - Catálogo (`obtenerCatalogoContable`, `src/lib/reportes/consultas.ts`): pedía `reporte_balance_comprobacion('1900-01-01', hoy)` solo para pintar el saldo de cada cuenta. Es un reporte completo (asientos + líneas + cuentas, agrupado) usado como consulta de tarjetas.
- **Cambio:** migración aditiva `20261117100000_perf_inicio_catalogo.sql` (no aplicada al remoto; la aplica Coder):
  - Índice de cobertura `asiento_lineas_cuenta_importes_idx (cuenta_id) include (debito, credito)`.
  - `saldos_caja_banco`: misma firma y mismo resultado; suma el total por cuenta y le resta solo las líneas de asientos posteriores al corte (normalmente ninguna), sin unir cada línea con su asiento.
  - Nueva `catalogo_saldos(p_hasta)`: saldo por código con la misma fórmula (débito − crédito o crédito − débito según naturaleza) y el mismo corte que el balance desde 1900. El catálogo ya no pide el balance de comprobación.
- **TS:** `obtenerCatalogoContable` llama `catalogo_saldos`; `indexarSaldosPorCodigo` (puro, en `src/lib/contabilidad/catalogo.ts`) arma el mapa por código y tiene 3 tests Vitest. `types.ts` actualizado a mano solo con la firma nueva (la migración no está aplicada).
- **pgTAP:** `supabase/tests/perf_inicio_catalogo_test.sql` (10 asserts) compara `catalogo_saldos` contra `reporte_balance_comprobacion` cuenta por cuenta y en total, y `saldos_caja_banco` contra la suma de líneas con corte, incluido un gasto en fecha posterior al corte.
- **Verificado:** `pnpm typecheck`, Biome de los archivos tocados, `pnpm exec vitest run src/lib/contabilidad/catalogo.test.ts` (12), `pnpm build` y pre-push (719 tests) en verde. No se pudo medir antes/después: este worktree no tiene `.env.local`, Docker ni Supabase CLI, y no se escribe en la base remota. pgTAP tampoco se pudo correr aquí (sin Docker).
- **Pendiente:** aplicar la migración junto con el merge (sin ella `catalogo_saldos` no existe y el catálogo muestra saldos en cero, igual que hoy cuando falla el balance) y volver a medir en `prueba`; si el p95 sigue alto, el siguiente paso es `EXPLAIN (ANALYZE, BUFFERS)` de las dos funciones contra la base real (solo lectura). `20261115900000_indices_rendimiento.sql` sigue sin aplicar; estas consultas no dependen de él (los índices base existen), pero conviene aplicarlo. `dashboard_resumen` no se tocó: su lógica, orden y cálculos quedan igual.
- **Hallazgo de CI:** el job `Supabase` ya venía rojo en `prueba` (desde el 14 nov) por `motor_esquema_test.sql:57`: `config_contable tiene 12 claves`, pero las migraciones posteriores (caja chica, inventario, retenciones) dejaron 17. El pgTAP nuevo de este PR pasó en ese mismo job; el paso «Tipos al día» no llega a correr porque el job se corta antes. No se tocó esa aserción en este PR (fuera de alcance).

## Tabla de listas estilo Alegra — Facturas de venta (16 nov 2026)

- `dashboard/facturacion` reestructurada según `docs/alegra/css-tablas/GUIA-TABLAS.md` (medidas en vivo de app.alegra.com/invoice): una sola tarjeta `ring-1` que contiene buscador (barra 48 px), tabla y paginación con `border-t`.
- `facturas-tabla.tsx` sin envoltorio propio (la tarjeta la pone la página); thead `bg-slate-200/20` con cabeceras `text-xs`; filas `h-12` con hover `hover:bg-slate-200/45`; pills de estado sin borde 11 px (Cobrada verde / Por cobrar ámbar / Anulada rojo); vencimiento vencido en `text-red-600`. Título de página «Facturas de venta».
- `paginador-lista.tsx`: nuevo prop opcional `className` (compatible con las ~15 listas que lo usan).
- Sin migración ni datos. Queda por revisar de Coder: extender el patrón al resto de listas.
- Verificado: `pnpm typecheck`, `pnpm check`, `pnpm test` (731), `pnpm build`; capturas claro/oscuro/móvil vía preview temporal en `/login` (borrada antes del commit, como siempre).

## Fase 1 — Tablas unificadas: componente compartido y Facturas (16 nov 2026)

- Rama `diseno/tablas-unificadas`, solo frontend. Nuevo `src/components/listas/tabla-lista.tsx` **sin `"use client"`**: `TarjetaLista`, `BarraLista`, `ContenedorLista`, `TablaLista<T>`, `PillEstado` y `EstadoVacioLista` con la API de `docs/diseno/tablas-unificadas.md` §3.2. Tabla real (`thead`/`tbody`, `scope="col"`), `colSpan` calculado, `TableFooter` opcional (`pie`), densidad 56/44, toolbar 56 px, cabecera 48 px `bg-slate-200/20`, filas 56 px con hover `slate-200/45`, padding 20/24 px, montos a la derecha y pills de 11 px sin borde; `dark:` en cabecera, hover y pills.
- `facturacion/page.tsx` + `facturas-tabla.tsx`: encabezado y tarjeta dentro de `ContenedorLista` (`mx-auto max-w-[1289px]`), tarjeta `data-lista="facturas"` (radio 16, borde, sin sombra) con el buscador **fuera** del Suspense; la tarjeta envuelve tabla y paginación. Vacío «Sin resultados / La búsqueda no arrojó facturas» con el pie visible y «¡Aún no tienes facturas!» + CTA «Nueva factura» solo si el rol puede crear. Sin columnas, datos, consultas ni botón «Filtrar» nuevos.
- `paginador-lista.tsx` (URL) gana props opcionales `etiqueta`, `tamano`, `opciones`, `visible`, `mostrarEnVacio` y `botonesExtremos`; mantiene default 25 y la misma apariencia en las otras 16 listas. `paginador-local.tsx` nuevo para fichas (página base 0 como `usePagina`, ‹ › + «Página n de N»).
- Candados: `src/lib/tablas-listas.test.ts` (`LISTAS_MIGRADAS` importa `TablaLista`, prohíbe `EstadoPill`/`EstadoBadge` local, exige `h-14`/`h-12`, `bg-slate-200/20` y `text-[11px]`, el `ContenedorLista` centrado y que el componente no sea cliente) y `tests/e2e/tablas.spec.ts` (toolbar+tabla+pie en la tarjeta, sin «Filtrar», 48/56 px, vacío con pie y tarjeta ≤1290 px centrada a 1920).
- **Desviación:** el selector ofrece 25/50/100, no 10, porque `src/lib/listas/parametros.ts` (`TAMANOS_PAGINA`) aún no acepta 10 y esta fase no toca `src/lib`. Al agregarlo, `PaginadorLista` lo toma solo.
- Verificado: `pnpm typecheck`, Biome de los archivos tocados, `pnpm exec vitest run src/lib/tablas-listas.test.ts` (5), `pnpm test` (742) y `pnpm build` en verde. Sin push ni merge; capturas pendientes de Coder.

## NCF antes de guardar y campos obligatorios en factura (17 nov 2026)

- Actualizado con `origin/prueba` `e4ec55f` (#25 tablas restantes y DGII, #27 validación de formularios); sin conflictos y conservando todas las secciones del HANDOFF.
- **NCF preview:** `src/lib/numeraciones/preview.ts` (puro) replica la selección de `crear_factura`: numeración activa del tipo con el `id` más bajo, `prefijo + lpad(siguiente, 8, '0')`. Distingue sin configurar, inactiva, agotada (`siguiente > hasta`) y vencida (`vence < fecha` de la factura). No reserva, no incrementa y no escribe nada.
- `facturacion/nueva/page.tsx` carga `getNumeraciones()` en el servidor y pasa `numeraciones` a `DocumentoVentaForm`; el encabezado muestra el NCF read-only en una caja compacta de 215 × 56 px debajo del selector de comprobante, con el engranaje fuera a la derecha para ir a Numeraciones. La nota «Se asigna al guardar» quedó como tooltip de la caja. Se recalcula al cambiar el tipo de comprobante o la fecha; si no se puede asignar, la caja muestra `—`, borde rojo y el motivo debajo. La asignación atómica sigue en la RPC; la preview puede quedar desfasada si otro usuario guarda antes y el número definitivo es el que devuelve el guardado.
- **Validación inline (formulario compartido de documentos de venta):** `erroresValidacionDocumento` (puro, en `documento-venta/calculo.ts`) devuelve errores por campo en orden: cliente, fechas, líneas (producto, cantidad, precio, descuento), total y cuenta de pago. `DocumentoVentaForm` pinta el campo en rojo (`aria-invalid` + estilos de shadcn), el mensaje debajo (`role="alert"`), un toast de error «Revise los campos obligatorios / Asegúrese de completar todos los campos marcados en rojo» y enfoca el primer campo inválido. Los errores se limpian al corregir el campo.
- Se agregaron props opcionales `aria-invalid`/`aria-describedby` a `SelectorContacto`, `SelectorProducto` y `DatePicker`, y `error` a `FormField`; sin cambios de comportamiento para los demás formularios.
- Verificado: `pnpm typecheck`, Biome de los archivos tocados y `pnpm test` (781) en verde; `pnpm check` sin errores (57 avisos y 19 infos preexistentes). Sin build ni dev server, como pedía el brief.

## CI db verde: pgTAP busqueda_global y check de tipos tolerante a versiones (19 nov 2026)

- Rama `feat/producto-campos-alegra-orq` (PR #41). El job `Supabase` fallaba en dos puntos distintos:
- **pgTAP** `busqueda_global_test.sql`: ya quedó arreglado en `d7cb1e6` (`distinct` en el total del grupo); este cambio blinda lo que quedaba: `count(*)::int` en el assert de duplicados (pgTAP no unifica `bigint` con literal `int`: `is(bigint, integer)` no existe) y `limit 1` en las subconsultas escalares de `rango`/`estado` (un subquery que devuelve >1 fila aborta la transacción y corta la corrida con "Bad plan").
- **Tipos al día**: el paso comparaba formatos, no esquema. `pnpm db:types` usa `--project-id` (postgres-meta remoto, más nuevo) y emite `Args: never`, bloques `SetofOptions` y args/columnas en orden alfabético; el `gen --local` del CI emite `Record<PropertyKey, never>` y orden de declaración. `src/lib/supabase/types.ts` (regenerado en `97e70a5` con el remoto) y el de `main` difieren solo en formato + los deltas reales de migraciones (verificado con diff de tokens normalizados: `MAIN-ONLY` vacío). `scripts/extract-db-schema.mjs` ahora normaliza `Record<PropertyKey, never>` a `never`, elimina `SetofOptions` y ordena los campos de cada objeto hoja: compara esquema, no versión del generador, como dice su propio comentario.
- **Verificado:** `node scripts/extract-db-schema.mjs` sobre el types.ts local y el de `origin/main` da salida idéntica salvo los objetos nuevos de las migraciones (auditoria, campos de producto/existencias/contactos, 5 funciones). pgTAP ya pasa en CI (952 asserts); sin Docker local no se pudo correr aquí. Bug heredado de `main`, no del feature; la rama `adjuntos` tiene el mismo fallo.
