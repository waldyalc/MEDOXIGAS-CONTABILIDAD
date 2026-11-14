begin;
select plan(36);

create temp table _ids (clave text primary key, id uuid) on commit drop;
grant select, insert, update, delete on _ids to authenticated;

insert into auth.users (id, email) values
  ('11111111-1111-1111-1111-111111111111', 'admin@prueba.local'),
  ('33333333-3333-3333-3333-333333333333', 'lector@prueba.local');

insert into public.perfiles (user_id, nombre, rol) values
  ('11111111-1111-1111-1111-111111111111', 'Admin', 'admin'),
  ('33333333-3333-3333-3333-333333333333', 'Lector', 'lector');

set local role authenticated;
set local request.jwt.claims = '{"sub":"11111111-1111-1111-1111-111111111111","role":"authenticated"}';

-- ---------------------------------------------------------------------------
-- Vendedores
-- ---------------------------------------------------------------------------

select has_table('public', 'vendedores', 'existe la tabla vendedores');

select col_type_is('public', 'vendedores', 'identificacion', 'text', 'identificación es opcional de texto');

select public.crear_vendedor(
  '{"nombre":"Ana Pérez pgTAP 18","identificacion":"001-0000000-1","observacion":"Zona norte"}'::jsonb
);

select is(
  (select nombre from public.vendedores where nombre = 'Ana Pérez pgTAP 18'),
  'Ana Pérez pgTAP 18',
  'crear_vendedor guarda el vendedor'
);

select public.actualizar_vendedor(
  (select id from public.vendedores where nombre = 'Ana Pérez pgTAP 18'),
  '{"observacion":"Zona norte y este"}'::jsonb
);

select is(
  (select observacion from public.vendedores where nombre = 'Ana Pérez pgTAP 18'),
  'Zona norte y este',
  'actualizar_vendedor cambia la observación'
);

select throws_ok(
  $q$select public.crear_vendedor('{"nombre":"Ana Pérez pgTAP 18"}'::jsonb)$q$,
  '22023',
  null,
  'rechaza un vendedor con nombre repetido'
);

-- ---------------------------------------------------------------------------
-- Centros de costo
-- ---------------------------------------------------------------------------

select has_table('public', 'centros_costo', 'existe la tabla centros_costo');

select public.crear_centro_costo(
  '{"codigo":"CC-S18-01","nombre":"Administración pgTAP","descripcion":"Gastos administrativos"}'::jsonb
);

select is(
  (select codigo from public.centros_costo where codigo = 'CC-S18-01'),
  'CC-S18-01',
  'crear_centro_costo guarda el código'
);

select public.crear_centro_costo('{"codigo":"CC-S18-02","nombre":"Ventas pgTAP"}'::jsonb);

select public.actualizar_centro_costo(
  (select id from public.centros_costo where codigo = 'CC-S18-02'),
  '{"nombre":"Sucursal Norte pgTAP"}'::jsonb
);

select is(
  (select nombre from public.centros_costo where codigo = 'CC-S18-02'),
  'Sucursal Norte pgTAP',
  'actualizar_centro_costo cambia el nombre'
);

select throws_ok(
  $q$select public.crear_centro_costo('{"codigo":"cc-s18-01","nombre":"Repetido"}'::jsonb)$q$,
  '22023',
  null,
  'rechaza un código repetido sin importar mayúsculas'
);

-- ---------------------------------------------------------------------------
-- Factura con vendedor y centro de costo
-- ---------------------------------------------------------------------------

select public.crear_contacto('{"tipo":"cliente","nombre":"Cliente pgTAP 18"}'::jsonb);
select public.crear_producto(
  '{"tipo":"servicio","nombre":"Servicio pgTAP 18","precio":1000,"itbis_tasa":18}'::jsonb
);

insert into _ids (clave, id)
select 'factura', public.crear_factura(jsonb_build_object(
  'tipo_comprobante', '02',
  'contacto_id', (select id from public.contactos where nombre = 'Cliente pgTAP 18'),
  'vendedor_id', (select id from public.vendedores where nombre = 'Ana Pérez pgTAP 18'),
  'centro_costo_id', (select id from public.centros_costo where codigo = 'CC-S18-01'),
  'fecha', '2026-11-15',
  'vencimiento', '2026-11-15',
  'lineas', jsonb_build_array(jsonb_build_object(
    'producto_id', (select id from public.productos where nombre = 'Servicio pgTAP 18'),
    'cantidad', 1,
    'precio', 1000,
    'descuento_pct', 0,
    'itbis_tasa', 18
  ))
));

select is(
  (select vendedor_id::text from public.facturas where id = (select id from _ids where clave = 'factura')),
  (select id::text from public.vendedores where nombre = 'Ana Pérez pgTAP 18'),
  'la factura guarda el vendedor'
);

select is(
  (select centro_costo_id::text from public.facturas where id = (select id from _ids where clave = 'factura')),
  (select id::text from public.centros_costo where codigo = 'CC-S18-01'),
  'la factura guarda el centro de costo'
);

select is(
  (select count(*) from public.asiento_lineas al
    where al.asiento_id = (select asiento_id from public.facturas where id = (select id from _ids where clave = 'factura'))
      and al.centro_costo_id = (select id from public.centros_costo where codigo = 'CC-S18-01')),
  (select count(*) from public.asiento_lineas al
    where al.asiento_id = (select asiento_id from public.facturas where id = (select id from _ids where clave = 'factura'))),
  'todas las líneas del asiento heredan el centro de la factura'
);

select is(
  (select round(sum(al.debito) - sum(al.credito), 2)
     from public.asiento_lineas al
    where al.asiento_id = (select asiento_id from public.facturas where id = (select id from _ids where clave = 'factura'))),
  0.00::numeric,
  'el asiento de la factura sigue cuadrado'
);

-- ---------------------------------------------------------------------------
-- Asiento manual con centro por línea
-- ---------------------------------------------------------------------------

select public.crear_asiento_manual(jsonb_build_object(
  'fecha', '2026-11-15',
  'descripcion', 'Gasto administrativo manual',
  'lineas', jsonb_build_array(
    jsonb_build_object(
      'cuenta_id', (select cuenta_id from public.config_contable where clave = 'gastos_generales'),
      'centro_costo_id', (select id from public.centros_costo where codigo = 'CC-S18-02'),
      'debito', 100,
      'credito', 0
    ),
    jsonb_build_object(
      'cuenta_id', (select cuenta_id from public.config_contable where clave = 'caja'),
      'centro_costo_id', (select id from public.centros_costo where codigo = 'CC-S18-02'),
      'debito', 0,
      'credito', 100
    )
  )
));

select is(
  (select count(*) from public.asiento_lineas al
    where al.asiento_id = (select id from public.asientos where descripcion = 'Gasto administrativo manual')),
  2::bigint,
  'el asiento manual guarda sus dos líneas'
);

select is(
  (select count(*) from public.asiento_lineas al
    where al.asiento_id = (select id from public.asientos where descripcion = 'Gasto administrativo manual')
      and al.centro_costo_id = (select id from public.centros_costo where codigo = 'CC-S18-02')),
  2::bigint,
  'las líneas del asiento manual llevan su centro de costo'
);

-- ---------------------------------------------------------------------------
-- Estado de resultados por centro de costo
-- ---------------------------------------------------------------------------

select is(
  (select monto from public.reporte_estado_resultados_centro(
    '2026-11-01', '2026-11-30',
    (select id from public.centros_costo where codigo = 'CC-S18-01')
  ) where cuenta_codigo = (
    select c.codigo
    from public.config_contable cc
    join public.cuentas c on c.id = cc.cuenta_id
    where cc.clave = 'ventas_servicios'
  )),
  1000.00::numeric,
  'el estado de resultados filtra las ventas del centro CC-S18-01'
);

select is(
  (select monto from public.reporte_estado_resultados_centro(
    '2026-11-01', '2026-11-30',
    (select id from public.centros_costo where codigo = 'CC-S18-02')
  ) where cuenta_codigo = (
    select c.codigo
    from public.config_contable cc
    join public.cuentas c on c.id = cc.cuenta_id
    where cc.clave = 'gastos_generales'
  )),
  100.00::numeric,
  'el estado de resultados filtra el gasto del centro CC-S18-02'
);

-- ---------------------------------------------------------------------------
-- Cotización convertida conserva vendedor y centro
-- ---------------------------------------------------------------------------

insert into _ids (clave, id)
select 'cotizacion', public.crear_cotizacion(jsonb_build_object(
  'contacto_id', (select id from public.contactos where nombre = 'Cliente pgTAP 18'),
  'vendedor_id', (select id from public.vendedores where nombre = 'Ana Pérez pgTAP 18'),
  'centro_costo_id', (select id from public.centros_costo where codigo = 'CC-S18-01'),
  'fecha', '2026-11-15',
  'vencimiento', '2026-11-15',
  'lineas', jsonb_build_array(jsonb_build_object(
    'producto_id', (select id from public.productos where nombre = 'Servicio pgTAP 18'),
    'cantidad', 1,
    'precio', 100,
    'descuento_pct', 0,
    'itbis_tasa', 18
  ))
));

select is(
  (select vendedor_id::text from public.cotizaciones where id = (select id from _ids where clave = 'cotizacion')),
  (select id::text from public.vendedores where nombre = 'Ana Pérez pgTAP 18'),
  'la cotización guarda el vendedor'
);

select is(
  (select centro_costo_id::text from public.cotizaciones where id = (select id from _ids where clave = 'cotizacion')),
  (select id::text from public.centros_costo where codigo = 'CC-S18-01'),
  'la cotización guarda el centro de costo'
);

insert into _ids (clave, id)
select 'factura_convertida', public.convertir_a_factura(jsonb_build_object(
  'tipo', 'cotizacion',
  'id', (select id from _ids where clave = 'cotizacion'),
  'tipo_comprobante', '02'
));

select is(
  (select vendedor_id::text from public.facturas where id = (select id from _ids where clave = 'factura_convertida')),
  (select id::text from public.vendedores where nombre = 'Ana Pérez pgTAP 18'),
  'la factura convertida conserva el vendedor'
);

select is(
  (select centro_costo_id::text from public.facturas where id = (select id from _ids where clave = 'factura_convertida')),
  (select id::text from public.centros_costo where codigo = 'CC-S18-01'),
  'la factura convertida conserva el centro de costo'
);

-- ---------------------------------------------------------------------------
-- Monedas y tasas
-- ---------------------------------------------------------------------------

select has_table('public', 'monedas', 'existe la tabla monedas');

select is(
  (select count(*) from public.monedas where codigo in ('DOP', 'USD', 'EUR')),
  3::bigint,
  'están sembradas DOP, USD y EUR'
);

select is(
  (select es_base from public.monedas where codigo = 'DOP'),
  true,
  'DOP es la moneda base'
);

select public.guardar_tasa_cambio('{"moneda_codigo":"USD","fecha":"2026-11-15","tasa":58.50}'::jsonb);

select is(
  (select tasa from public.tasas_cambio where moneda_codigo = 'USD' and fecha = '2026-11-15'),
  58.500000::numeric,
  'guardar_tasa_cambio registra la tasa del día'
);

select public.guardar_tasa_cambio('{"moneda_codigo":"USD","fecha":"2026-11-15","tasa":59}'::jsonb);

select is(
  (select tasa from public.tasas_cambio where moneda_codigo = 'USD' and fecha = '2026-11-15'),
  59.000000::numeric,
  'guardar_tasa_cambio corrige la tasa de la misma fecha'
);

select throws_ok(
  $q$select public.guardar_tasa_cambio('{"moneda_codigo":"DOP","fecha":"2026-11-15","tasa":1}'::jsonb)$q$,
  '22023',
  null,
  'rechaza una tasa para la moneda base'
);

select throws_ok(
  $q$select public.guardar_tasa_cambio('{"moneda_codigo":"EUR","fecha":"2026-11-15","tasa":0}'::jsonb)$q$,
  '22023',
  null,
  'rechaza una tasa en cero'
);

-- ---------------------------------------------------------------------------
-- Plantillas de impresión
-- ---------------------------------------------------------------------------

select has_table('public', 'plantillas_impresion', 'existe la tabla plantillas_impresion');

select is(
  (select count(*) from public.plantillas_impresion
    where tipo_documento in ('factura', 'cotizacion', 'conduce')),
  3::bigint,
  'están sembradas las plantillas de factura, cotización y conduce'
);

select public.guardar_plantilla_impresion(jsonb_build_object(
  'tipo_documento', 'factura',
  'notas_pie', 'Gracias por su compra',
  'terminos', 'Pago a 30 días',
  'mostrar_logo', false
));

select is(
  (select notas_pie from public.plantillas_impresion where tipo_documento = 'factura'),
  'Gracias por su compra',
  'guardar_plantilla_impresion guarda las notas al pie'
);

select is(
  (select mostrar_logo from public.plantillas_impresion where tipo_documento = 'factura'),
  false,
  'guardar_plantilla_impresion guarda si se muestra el logo'
);

-- ---------------------------------------------------------------------------
-- RLS y permisos
-- ---------------------------------------------------------------------------

select ok(
  has_table_privilege('authenticated', 'public.vendedores', 'SELECT')
  and has_table_privilege('authenticated', 'public.centros_costo', 'SELECT')
  and has_table_privilege('authenticated', 'public.monedas', 'SELECT')
  and has_table_privilege('authenticated', 'public.tasas_cambio', 'SELECT')
  and has_table_privilege('authenticated', 'public.plantillas_impresion', 'SELECT'),
  'authenticated puede leer las tablas de configuración extra'
);

select ok(
  not has_table_privilege('authenticated', 'public.vendedores', 'INSERT')
  and not has_table_privilege('authenticated', 'public.centros_costo', 'INSERT')
  and not has_table_privilege('authenticated', 'public.monedas', 'INSERT')
  and not has_table_privilege('authenticated', 'public.plantillas_impresion', 'INSERT'),
  'authenticated no escribe directo en las tablas de configuración extra'
);

set local request.jwt.claims = '{"sub":"33333333-3333-3333-3333-333333333333","role":"authenticated"}';

select throws_ok(
  $q$select public.crear_vendedor('{"nombre":"Lector"}'::jsonb)$q$,
  '42501',
  null,
  'el rol lector no puede crear vendedores'
);

select throws_ok(
  $q$select public.guardar_tasa_cambio('{"moneda_codigo":"EUR","fecha":"2026-11-16","tasa":65}'::jsonb)$q$,
  '42501',
  null,
  'el rol lector no puede guardar tasas de cambio'
);

select * from finish();
rollback;
