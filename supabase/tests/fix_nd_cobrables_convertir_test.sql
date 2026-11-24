begin;
select plan(36);

create temp table _ids (clave text primary key, id uuid) on commit drop;
create temp table _valores (clave text primary key, valor text) on commit drop;
grant select, insert, update, delete on _ids to authenticated;
grant select, insert, update, delete on _valores to authenticated;

insert into auth.users (id, email) values
  ('11111111-1111-1111-1111-111111111111', 'admin@prueba.local'),
  ('22222222-2222-2222-2222-222222222222', 'contador@prueba.local'),
  ('33333333-3333-3333-3333-333333333333', 'lector@prueba.local');
insert into public.perfiles (user_id, nombre, rol) values
  ('11111111-1111-1111-1111-111111111111', 'Admin', 'admin'),
  ('22222222-2222-2222-2222-222222222222', 'Contador', 'contador'),
  ('33333333-3333-3333-3333-333333333333', 'Lector', 'lector');

-- ---------------------------------------------------------------------------
-- Semilla: factura con su nota de débito de venta (B03)
-- ---------------------------------------------------------------------------

set local role authenticated;
set local request.jwt.claims = '{"sub":"11111111-1111-1111-1111-111111111111","role":"authenticated"}';

insert into _ids (clave, id)
select 'cliente', public.crear_contacto(jsonb_build_object(
  'tipo', 'cliente',
  'nombre', 'ND Cobrable Cliente'
));

insert into _ids (clave, id)
select 'otro', public.crear_contacto(jsonb_build_object(
  'tipo', 'cliente',
  'nombre', 'ND Otro Cliente'
));

insert into _ids (clave, id)
select 'servicio', public.crear_producto(jsonb_build_object(
  'tipo', 'servicio',
  'nombre', 'Servicio ND',
  'precio', 1000.00::numeric,
  'itbis_tasa', 18.00::numeric
));

insert into _ids (clave, id)
select 'factura', public.crear_factura(jsonb_build_object(
  'tipo_comprobante', '02',
  'contacto_id', (select id from _ids where clave = 'cliente'),
  'fecha', '2026-11-13',
  'vencimiento', '2026-12-13',
  'lineas', jsonb_build_array(jsonb_build_object(
    'producto_id', (select id from _ids where clave = 'servicio'),
    'cantidad', 1.00::numeric,
    'precio', 1000.00::numeric
  ))
));

insert into _ids (clave, id)
select 'nota', public.crear_nota_debito_venta(jsonb_build_object(
  'factura_id', (select id from _ids where clave = 'factura'),
  'tipo', 'montos',
  'fecha', '2026-11-13',
  'notas', 'Cargo por flete',
  'lineas', jsonb_build_array(jsonb_build_object(
    'descripcion', 'Cargo por flete',
    'cantidad', 1.00::numeric,
    'precio', 500.00::numeric,
    'itbis_tasa', 18.00::numeric
  ))
));

select is(
  (select total::numeric(14,2) from public.notas_debito_venta where id = (select id from _ids where clave = 'nota')),
  590.00::numeric(14,2),
  'nota de débito base: total 590.00'
);

-- ---------------------------------------------------------------------------
-- Bug A: la nota de débito aparece en reporte_cxc con su saldo
-- ---------------------------------------------------------------------------

select ok(
  exists (select 1 from public.reporte_cxc('2026-11-30') r where r.factura_id = (select id from _ids where clave = 'nota')),
  'reporte_cxc incluye la nota de débito activa'
);

select is(
  (select r.saldo from public.reporte_cxc('2026-11-30') r where r.factura_id = (select id from _ids where clave = 'nota')),
  590.00::numeric,
  'reporte_cxc: saldo de la nota de débito 590.00'
);

select is(
  (select r.pagado from public.reporte_cxc('2026-11-30') r where r.factura_id = (select id from _ids where clave = 'nota')),
  0.00::numeric,
  'reporte_cxc: nota de débito nace sin pagos'
);

select is(
  (select r.total from public.reporte_cxc('2026-11-30') r where r.factura_id = (select id from _ids where clave = 'nota')),
  590.00::numeric,
  'reporte_cxc: total de la nota de débito'
);

select is(
  (select r.ncf from public.reporte_cxc('2026-11-30') r where r.factura_id = (select id from _ids where clave = 'nota')),
  (select ncf from public.notas_debito_venta where id = (select id from _ids where clave = 'nota')),
  'reporte_cxc: NCF de la nota de débito'
);

select is(
  (select r.vencimiento from public.reporte_cxc('2026-11-30') r where r.factura_id = (select id from _ids where clave = 'nota')),
  '2026-11-13'::date,
  'reporte_cxc: la nota de débito vence en su fecha'
);

select is(
  (select r.dias_vencida from public.reporte_cxc('2026-11-30') r where r.factura_id = (select id from _ids where clave = 'nota')),
  17,
  'reporte_cxc: días vencidos de la nota de débito'
);

select is(
  (select r.contacto_nombre from public.reporte_cxc('2026-11-30') r where r.factura_id = (select id from _ids where clave = 'nota')),
  'ND Cobrable Cliente',
  'reporte_cxc: cliente de la nota de débito'
);

select is(
  (select r.saldo from public.reporte_cxc('2026-11-30') r where r.factura_id = (select id from _ids where clave = 'factura')),
  1180.00::numeric,
  'reporte_cxc: la factura conserva su saldo y no se mezcla con la nota'
);

select is(
  (select r.total from public.reporte_cxc('2026-11-30') r where r.factura_id = (select id from _ids where clave = 'factura')),
  1180.00::numeric,
  'reporte_cxc: total de la factura intacto'
);

select is(
  (select count(*)::int from public.reporte_cxc('2026-11-30') r where r.contacto_id = (select id from _ids where clave = 'cliente')),
  2,
  'reporte_cxc: una fila por factura y otra por nota de débito'
);

-- ---------------------------------------------------------------------------
-- Bug A: registrar_pago_recibido cobra la nota de débito
-- ---------------------------------------------------------------------------

insert into _ids (clave, id)
select 'pago_nd1', public.registrar_pago_recibido(jsonb_build_object(
  'nota_debito_id', (select id from _ids where clave = 'nota'),
  'fecha', '2026-11-20',
  'cuenta_id', (select id from public.cuentas where codigo = '1101'),
  'metodo', 'efectivo',
  'monto', 200.00::numeric
));

select ok(
  exists (select 1 from public.pagos_recibidos where id = (select id from _ids where clave = 'pago_nd1')),
  'registrar_pago_recibido crea el cobro de la nota de débito'
);

select is(
  (select nota_debito_id from public.pagos_recibidos where id = (select id from _ids where clave = 'pago_nd1')),
  (select id from _ids where clave = 'nota'),
  'el pago queda ligado a la nota de débito'
);

select is(
  (select factura_id from public.pagos_recibidos where id = (select id from _ids where clave = 'pago_nd1')),
  null::uuid,
  'el cobro de la nota no se disfraza de pago de factura'
);

select is(
  (select monto::numeric(14,2) from public.pagos_recibidos where id = (select id from _ids where clave = 'pago_nd1')),
  200.00::numeric(14,2),
  'el cobro guarda el monto recibido'
);

select is(
  (select coalesce(sum(al.debito), 0)::numeric(14,2)
   from public.asiento_lineas al
   join public.cuentas c on c.id = al.cuenta_id
   where al.asiento_id = (select asiento_id from public.pagos_recibidos where id = (select id from _ids where clave = 'pago_nd1'))
     and c.codigo = '1101'),
  200.00::numeric(14,2),
  'el asiento del cobro debita caja 1101'
);

select is(
  (select coalesce(sum(al.credito), 0)::numeric(14,2)
   from public.asiento_lineas al
   join public.cuentas c on c.id = al.cuenta_id
   where al.asiento_id = (select asiento_id from public.pagos_recibidos where id = (select id from _ids where clave = 'pago_nd1'))
     and c.codigo = '1103'),
  200.00::numeric(14,2),
  'el asiento del cobro acredita cuentas por cobrar 1103'
);

select is(
  (select r.saldo from public.reporte_cxc('2026-11-30') r where r.factura_id = (select id from _ids where clave = 'nota')),
  390.00::numeric,
  'el pago parcial baja el saldo de la nota a 390.00'
);

select is(
  (select r.pagado from public.reporte_cxc('2026-11-30') r where r.factura_id = (select id from _ids where clave = 'nota')),
  200.00::numeric,
  'reporte_cxc muestra los 200.00 cobrados de la nota'
);

select is(
  (select pagado::numeric(14,2) from public.facturas where id = (select id from _ids where clave = 'factura')),
  0.00::numeric(14,2),
  'cobrar la nota no toca el pagado de la factura'
);

select throws_ok(
  $q$select public.registrar_pago_recibido(jsonb_build_object(
    'nota_debito_id', (select id from _ids where clave = 'nota'),
    'fecha', '2026-11-20',
    'cuenta_id', (select id from public.cuentas where codigo = '1101'),
    'metodo', 'efectivo',
    'monto', 391
  ))$q$,
  '22023',
  null,
  'cobrar más que el saldo de la nota de débito falla'
);

select throws_ok(
  $q$select public.registrar_pago_recibido(jsonb_build_object(
    'factura_id', (select id from _ids where clave = 'factura'),
    'nota_debito_id', (select id from _ids where clave = 'nota'),
    'fecha', '2026-11-20',
    'cuenta_id', (select id from public.cuentas where codigo = '1101'),
    'metodo', 'efectivo',
    'monto', 10
  ))$q$,
  '22023',
  null,
  'un pago no aplica a factura y nota de débito a la vez'
);

select throws_ok(
  $q$select public.registrar_pago_recibido(jsonb_build_object(
    'nota_debito_id', (select id from _ids where clave = 'nota'),
    'contacto_id', (select id from _ids where clave = 'otro'),
    'fecha', '2026-11-20',
    'cuenta_id', (select id from public.cuentas where codigo = '1101'),
    'metodo', 'efectivo',
    'monto', 10
  ))$q$,
  '22023',
  null,
  'la nota de débito debe pertenecer al cliente indicado'
);

insert into _ids (clave, id)
select 'pago_nd2', public.registrar_pago_recibido(jsonb_build_object(
  'nota_debito_id', (select id from _ids where clave = 'nota'),
  'fecha', '2026-11-21',
  'cuenta_id', (select id from public.cuentas where codigo = '1101'),
  'metodo', 'efectivo',
  'monto', 390.00::numeric
));

select is(
  (select count(*)::int from public.reporte_cxc('2026-11-30') r where r.factura_id = (select id from _ids where clave = 'nota')),
  0,
  'la nota de débito pagada sale de CxC'
);

select is(
  (select coalesce(sum(pr.monto), 0)::numeric(14,2)
   from public.pagos_recibidos pr
   where pr.nota_debito_id = (select id from _ids where clave = 'nota')
     and pr.estado = 'activo'),
  590.00::numeric(14,2),
  'los dos cobros suman el total de la nota'
);

select is(
  public.anular_documento('pago_recibido', (select id from _ids where clave = 'pago_nd2')),
  (select id from _ids where clave = 'pago_nd2'),
  'anular el pago de la nota devuelve el documento'
);

select is(
  (select r.saldo from public.reporte_cxc('2026-11-30') r where r.factura_id = (select id from _ids where clave = 'nota')),
  390.00::numeric,
  'anular el pago devuelve el saldo de la nota a CxC'
);

-- ---------------------------------------------------------------------------
-- Bug B: convertir cotizaciones con B14, B15 y B16
-- ---------------------------------------------------------------------------

insert into _ids (clave, id)
select 'cot_b14', public.crear_cotizacion(jsonb_build_object(
  'contacto_id', (select id from _ids where clave = 'cliente'),
  'fecha', '2026-11-13',
  'vencimiento', '2026-12-13',
  'lineas', jsonb_build_array(jsonb_build_object(
    'producto_id', (select id from _ids where clave = 'servicio'),
    'cantidad', 1.00::numeric
  ))
));

insert into _ids (clave, id)
select 'fac_b14', public.convertir_a_factura(jsonb_build_object(
  'tipo', 'cotizacion',
  'id', (select id from _ids where clave = 'cot_b14'),
  'tipo_comprobante', '14'
));

select is(
  (select tipo_comprobante from public.facturas where id = (select id from _ids where clave = 'fac_b14')),
  '14',
  'convertir a factura acepta el comprobante 14'
);

select ok(
  (select ncf from public.facturas where id = (select id from _ids where clave = 'fac_b14')) like 'B14%',
  'la factura del comprobante 14 usa la numeración B14'
);

insert into _ids (clave, id)
select 'cot_b15', public.crear_cotizacion(jsonb_build_object(
  'contacto_id', (select id from _ids where clave = 'cliente'),
  'fecha', '2026-11-13',
  'vencimiento', '2026-12-13',
  'lineas', jsonb_build_array(jsonb_build_object(
    'producto_id', (select id from _ids where clave = 'servicio'),
    'cantidad', 1.00::numeric
  ))
));

insert into _ids (clave, id)
select 'fac_b15', public.convertir_a_factura(jsonb_build_object(
  'tipo', 'cotizacion',
  'id', (select id from _ids where clave = 'cot_b15'),
  'tipo_comprobante', '15'
));

select is(
  (select tipo_comprobante from public.facturas where id = (select id from _ids where clave = 'fac_b15')),
  '15',
  'convertir a factura acepta el comprobante 15'
);

select ok(
  (select ncf from public.facturas where id = (select id from _ids where clave = 'fac_b15')) like 'B15%',
  'la factura del comprobante 15 usa la numeración B15'
);

insert into _ids (clave, id)
select 'cot_b16', public.crear_cotizacion(jsonb_build_object(
  'contacto_id', (select id from _ids where clave = 'cliente'),
  'fecha', '2026-11-13',
  'vencimiento', '2026-12-13',
  'lineas', jsonb_build_array(jsonb_build_object(
    'producto_id', (select id from _ids where clave = 'servicio'),
    'cantidad', 1.00::numeric
  ))
));

insert into _ids (clave, id)
select 'fac_b16', public.convertir_a_factura(jsonb_build_object(
  'tipo', 'cotizacion',
  'id', (select id from _ids where clave = 'cot_b16'),
  'tipo_comprobante', '16'
));

select is(
  (select tipo_comprobante from public.facturas where id = (select id from _ids where clave = 'fac_b16')),
  '16',
  'convertir a factura acepta el comprobante 16'
);

select ok(
  (select ncf from public.facturas where id = (select id from _ids where clave = 'fac_b16')) like 'B16%',
  'la factura del comprobante 16 usa la numeración B16'
);

select throws_ok(
  $q$select public.convertir_a_factura(jsonb_build_object(
    'tipo', 'cotizacion',
    'id', (select id from _ids where clave = 'cot_b16'),
    'tipo_comprobante', '17'
  ))$q$,
  '22023',
  null,
  'un comprobante inexistente sigue rechazándose'
);

-- ---------------------------------------------------------------------------
-- Permisos: lector no cobra notas de débito
-- ---------------------------------------------------------------------------

set local request.jwt.claims = '{"sub":"33333333-3333-3333-3333-333333333333","role":"authenticated"}';

select throws_ok(
  $q$select public.registrar_pago_recibido(jsonb_build_object(
    'nota_debito_id', (select id from _ids where clave = 'nota'),
    'fecha', '2026-11-21',
    'cuenta_id', (select id from public.cuentas where codigo = '1101'),
    'metodo', 'efectivo',
    'monto', 10
  ))$q$,
  '42501',
  null,
  'lector no puede cobrar la nota de débito'
);

select * from finish();
rollback;
