# Handoff — Medoxigas Contabilidad

## S24 — Papel impreso/PDF de factura, cotización y conduce (13 nov 2026)

- `DocumentoPapel`: las columnas de montos (Precio, Descuento, Impuesto y
  Valor/Subtotal) tienen ancho mínimo en pt y `whitespace-nowrap` para
  `RD$9,999,999.99`; la descripción absorbe el resto y puede partir.
- Bloque del cliente: RNC y Teléfono solo se muestran si tienen dato. Se oculta
  «Vencimiento NCF» sin fecha y «Vencimiento de la factura» lleva dos puntos.
- Tests de render con `renderToStaticMarkup` en `documento-papel.test.tsx` (7).
  Sin migraciones. `typecheck`, `test` (623), Biome de lo tocado y `build` en
  verde; sin verificación visual.

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