# Handoff — Medoxigas Contabilidad

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

- Rama `diseno/tablas-unificadas`, solo frontend. Nuevo `src/components/listas/tabla-lista.tsx` **sin `"use client"`**: `TarjetaLista`, `BarraLista`, `TablaLista<T>`, `PillEstado` y `EstadoVacioLista` con la API de `docs/diseno/tablas-unificadas.md` §3.2. Tabla real (`thead`/`tbody`, `scope="col"`), `colSpan` calculado, `TableFooter` opcional (`pie`), densidad 48/40, cabecera 40 px `bg-slate-200/20`, filas 48 px con hover `slate-200/45`, montos a la derecha y pills de 11 px sin borde; `dark:` en cabecera, hover y pills.
- `facturacion/page.tsx` + `facturas-tabla.tsx`: una sola tarjeta `data-lista="facturas"` (radio 16, borde, sin sombra) con el buscador **fuera** del Suspense; la tarjeta envuelve tabla y paginación. Vacío «Sin resultados / La búsqueda no arrojó facturas» con el pie visible y «¡Aún no tienes facturas!» + CTA «Nueva factura» solo si el rol puede crear. Sin columnas, datos, consultas ni botón «Filtrar» nuevos.
- `paginador-lista.tsx` (URL) gana props opcionales `etiqueta`, `tamano`, `opciones`, `visible`, `mostrarEnVacio` y `botonesExtremos`; mantiene default 25 y la misma apariencia en las otras 16 listas. `paginador-local.tsx` nuevo para fichas (página base 0 como `usePagina`, ‹ › + «Página n de N»).
- Candados: `src/lib/tablas-listas.test.ts` (`LISTAS_MIGRADAS` importa `TablaLista`, prohíbe `EstadoPill`/`EstadoBadge` local, exige `h-12`, `bg-slate-200/20` y `text-[11px]`, y que el componente no sea cliente) y `tests/e2e/tablas.spec.ts` (toolbar+tabla+pie en la tarjeta, sin «Filtrar», 40/48 px, vacío con pie).
- **Desviación:** el selector ofrece 25/50/100, no 10, porque `src/lib/listas/parametros.ts` (`TAMANOS_PAGINA`) aún no acepta 10 y esta fase no toca `src/lib`. Al agregarlo, `PaginadorLista` lo toma solo.
- Verificado: `pnpm typecheck`, Biome de los archivos tocados, `pnpm exec vitest run src/lib/tablas-listas.test.ts` (4), `pnpm test` (741) y `pnpm build` en verde. Sin push ni merge; capturas pendientes de Coder.
