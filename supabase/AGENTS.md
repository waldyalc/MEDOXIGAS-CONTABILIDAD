# Supabase — reglas para agentes

Proyecto **MEDOXIGAS-CONTABILIDAD** (`ljfdhrnvlsfaweuvnqxz`, ca-central-1). Es la
**única base de datos**. Lo que escribas en local apunta al mismo proyecto si
usas las claves de `.env.local`.
Flujo contable en corto: `docs/motor-contable.md`. Contrato completo:
`docs/contrato-db.md`.

## Tablas (public)

- **Núcleo:** `perfiles` (rol por usuario: `admin`, `contador`, `lector`),
  `empresa`, `cuentas` (catálogo; `es_caja_banco` marca bancos y cajas),
  `config_contable`, `contactos`, `productos`, `numeraciones`, `impuestos`,
  `asientos`, `asiento_lineas`, `facturas`, `factura_lineas`,
  `pagos_recibidos`, `facturas_proveedor`, `facturas_proveedor_lineas`,
  `pagos_proveedor`, `gastos_menores`.
- **Ventas:** `notas_credito_venta` (+`nota_credito_venta_lineas`),
  `notas_debito_venta` (+`nota_debito_venta_lineas`), `cotizaciones`
  (+`cotizacion_lineas`), `remisiones` (+`remision_lineas`),
  `facturas_recurrentes` (+`factura_recurrente_lineas`,
  `factura_recurrente_generaciones`).
- **Compras:** `notas_credito_compra` (+`nota_credito_compra_lineas`),
  `ordenes_compra` (+`orden_compra_lineas`), `pagos_recurrentes`.
- **Pagos y retenciones:** `pago_recibido_aplicaciones`,
  `pago_proveedor_aplicaciones`, sus tablas de retenciones por aplicación,
  `pago_recibido_retenciones`, `pago_proveedor_retenciones`, `retenciones`.
- **Inventario:** `almacenes`, `categorias_productos`, `existencias`,
  `producto_unidades`, `producto_codigos_barra`, `combo_componentes`,
  `ajustes_inventario` (+`ajuste_inventario_lineas`),
  `transferencias_inventario` (+`transferencia_inventario_lineas`),
  `conteos_inventario` (+`conteo_inventario_lineas`),
  `listas_precios`, `producto_precios`.
- **Bancos:** no hay tabla `bancos`; los bancos y cajas son filas de `cuentas`
  con `es_caja_banco = true`. Movimientos: `conciliaciones` y
  `conciliacion_movimientos`. Saldos: RPC `saldos_caja_banco`.
- **Punto de venta:** `pos_terminales` (configuración), `pos_turnos`
  (+`pos_turno_movimientos`). Las ventas del POS son filas reales de
  `facturas`/`cotizaciones`/`pagos_recibidos`/`notas_credito_venta` con
  `turno_id` y `origen = 'pos'`.
- **Contabilidad:** `tipos_entrada_diario` (+ `asientos.tipo_entrada_id` /
  `asientos.codigo`), `periodos_contables`, `cierres_resultados`,
  `activos_fijos`, `activo_depreciaciones`, `centros_costo`, `vendedores`,
  `monedas`, `tasas_cambio`, `plantillas_impresion`, `terminos_pago`.
- **Nómina:** `nomina_parametros_rd`, `nomina_config_empresa`,
  `nomina_conceptos` y `nomina_mapeo_contable` (catálogos y configuración);
  `empleados` (+ `empleado_novedades_recurrentes`), con escritura solo por
  RPC. Periodos, recibos y pagos llegan en la fase 3B.
- **Transversales:** `auditoria` (append-only), `adjuntos` (metadatos; los
  archivos viven en el bucket privado `documentos`).

No hay tablas de borradores de factura: los documentos no contables
(cotizaciones y remisiones) son sus propias tablas y no generan asiento.

## RPC

RPC de escritura (todas `security definer`, `set search_path = ''`,
transaccionales; exigen rol `admin` o `contador`):

- **Catálogo:** `crear_contacto`, `actualizar_contacto`, `crear_producto`,
  `actualizar_producto`, `crear_cuenta`, `actualizar_cuenta`,
  `crear_cuenta_banco`, `crear_almacen`, `actualizar_almacen`,
  `crear_categoria_producto`, `actualizar_categoria_producto`,
  `crear_lista_precio`, `actualizar_lista_precio`, `crear_vendedor`,
  `actualizar_vendedor`, `crear_centro_costo`, `actualizar_centro_costo`,
  `crear_retencion`, `actualizar_retencion`, `crear_termino_pago`,
  `actualizar_empresa`, `guardar_tasa_cambio`, `guardar_plantilla_impresion`.
- **Numeraciones y diario:** `crear_numeracion`, `actualizar_numeracion`,
  `crear_tipo_entrada_diario`, `actualizar_tipo_entrada_diario`.
- **Documentos:** `crear_factura`, `crear_factura_proveedor`,
  `crear_gasto_menor`, `crear_nota_credito_venta`, `crear_nota_debito_venta`,
  `crear_nota_credito_compra`, `crear_cotizacion`, `crear_remision`,
  `editar_cotizacion`, `editar_remision`, `crear_remision_desde_cotizacion`,
  `convertir_a_factura`, `crear_orden_compra`, `vincular_orden_compra`,
  `crear_factura_recurrente`, `generar_factura_recurrente`,
  `crear_pago_recurrente`, `actualizar_pago_recurrente`,
  `generar_pago_recurrente`.
- **Pagos:** `registrar_pago_recibido`, `registrar_pago_proveedor`,
  `registrar_pago_recibido_multi`, `registrar_pago_proveedor_multi`.
- **Bancos:** `transferir_entre_cuentas`, `registrar_deposito`,
  `guardar_borrador_conciliacion`, `conciliar_cuenta`.
- **Inventario:** `crear_ajuste_inventario`, `crear_transferencia_inventario`,
  `anular_transferencia_inventario`, `crear_conteo_inventario`,
  `guardar_lineas_conteo`, `aplicar_conteo_inventario`,
  `anular_conteo_inventario`.
- **Contabilidad:** `crear_asiento_manual`, `registrar_saldos_iniciales`,
  `crear_activo_fijo`, `depreciar_activo`, `cerrar_periodo`, `reabrir_periodo`,
  `cerrar_resultados_anio`, `anular_documento(p_tipo, p_id)`.
- **Adjuntos:** `subir_adjunto`, `borrar_adjunto`, `descargar_adjunto`.
- **Internas (sin permiso para la app):** `rol_actual`, `_crear_asiento`,
  `_cuenta_config`, `_validar_cuenta_movimiento`, `_validar_asiento_cuadrado`,
  `_auditar` (trigger) y los helpers `_impuestos_*`, `_mover_existencia`,
  `_sumar_existencia`, `_almacen_principal`, `_conciliacion_*`,
  `_unidad_factor`, `_costo_combo`, `_mover_combo_existencia`,
  `_producto_guardar_ferreteria`.

Reportes y lecturas (`stable`, `security invoker`, respetan RLS):
`reporte_libro_diario`, `reporte_balance_comprobacion`,
`reporte_estado_resultados`, `reporte_estado_resultados_centro`,
`reporte_cxc`, `reporte_movimientos`, `reporte_saldos_tercero`,
`reporte_saldos_cuentas`, `dashboard_resumen`, `catalogo_saldos`,
`saldos_caja_banco`, `buscar_global`, `obtener_auditoria`,
`listar_terminos_pago`, `listar_perfiles`, `listar_retenciones`,
`pos_buscar_por_codigo_barra`, `pos_catalogo_productos`,
`reporte_stock_bajo`, `_precio_lista`, `_disponibilidad_combo`.

## Comandos (solo local, NUNCA contra producción)

```bash
supabase start        # levanta la pila local (Docker)
supabase db reset     # opcional: reaplica migraciones desde cero
supabase test db      # pgTAP: supabase/tests/*_test.sql (hace rollback solo)
pnpm db:types         # regenera src/lib/supabase/types.ts tras cada migración
```

## Migraciones

- Viven en `supabase/migrations/`. La migración del motor y las posteriores ya
  están aplicadas en el proyecto de Supabase. **No editar ninguna aplicada**:
  cualquier cambio va en una **migración nueva**, aditiva y reintentable.
- Nombre: `YYYYMMDDHHMMSS_descripcion_en_snake_case.sql`, con timestamp UTC
  real, estrictamente mayor que el último archivo existente. Sin horas
  inválidas ni fechas futuras inventadas.
- Nada que borre o cambie datos sin OK de Waldy.
- Probar en local (`supabase start` + `supabase db reset`) o en `BEGIN/ROLLBACK`
  antes de aplicar.
- Regenerar tipos con `pnpm db:types` y commitear `src/lib/supabase/types.ts`;
  el job `db` de CI falla si el esquema del repo no coincide con las
  migraciones.

## RLS (núcleo de seguridad)

- RLS activo en toda tabla de `public`. `anon` no ve nada. `authenticated` lee
  según su rol; las escrituras de negocio van por RPC (security definer, rol
  leído de `perfiles`), sin DELETE físico en documentos contables (se anulan).
- `perfiles`: cada usuario lee solo su fila; nadie escribe desde la app (los crea
  el admin por SQL/service_role).
- `auditoria` y `adjuntos`: todos los roles con perfil leen; nadie escribe
  directamente (los triggers y las RPC `security definer` insertan). No hay
  políticas de DELETE en `adjuntos`: el objeto se borra dentro de
  `borrar_adjunto`.
- `service_role` jamás en el cliente ni en prompts: la app solo usa
  `NEXT_PUBLIC_SUPABASE_URL` y `NEXT_PUBLIC_SUPABASE_ANON_KEY` (clave publicable).
- Nunca cambiar una política para que un test pase sin el OK de Waldy; nunca
  desactivar RLS.

## Storage

- Buckets privados `productos` (logos) y `documentos` (adjuntos PNG, JPG y PDF
  de hasta 10 MB). Lectura para autenticados; subida solo `admin`/`contador`.
- Las rutas de `documentos` son `<entidad_tipo>/<entidad_id>/<uuid>.<ext>`;
  `subir_adjunto` rechaza objetos de otra entidad.
- Sin políticas de update/delete: los objetos se reemplazan o borran desde la
  RPC correspondiente.

## pgTAP

- Corre en CI, job **`db`** (workflow «Supabase»), y en local con el mismo
  comando.
- `supabase/tests/` tiene 47 archivos `*_test.sql` y ~1,024 asserts. Cubren
  perfiles, el motor contable (esquema, factura, pagos, compras, gasto menor,
  anulación, reportes), notas de crédito/débito, cotizaciones y remisiones,
  NCF B14/B15/B16, caja chica, retenciones, inventario y almacenes, activos
  fijos, periodos y cierres, bancos y conciliaciones, impuestos, adjuntos,
  auditoría, búsqueda global, saldos iniciales, tipos de entrada de diario y
  documentos recurrentes.
- Cada módulo nuevo lleva su `tests/<modulo>_test.sql` con RLS y las
  invariantes del cálculo. Nada de cambiar una política para que el test pase.
