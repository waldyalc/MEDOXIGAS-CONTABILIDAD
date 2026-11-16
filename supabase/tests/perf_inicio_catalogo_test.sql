begin;
select plan(10);

create temp table _perf_ids (clave text primary key, id uuid) on commit drop;
grant select, insert, update, delete on _perf_ids to authenticated;

create temp table _perf_antes (
  codigo text not null,
  fecha date not null,
  saldo numeric(14,2) not null,
  primary key (codigo, fecha)
) on commit drop;
grant select, insert on _perf_antes to authenticated;

insert into auth.users (id, email) values
  ('aa11aa11-0000-0000-0000-000000000001', 'admin.perf@prueba.local');

insert into public.perfiles (user_id, nombre, rol) values
  ('aa11aa11-0000-0000-0000-000000000001', 'Admin Perf', 'admin');

set local role authenticated;
set local request.jwt.claims = '{"sub":"aa11aa11-0000-0000-0000-000000000001","role":"authenticated"}';

-- ---------------------------------------------------------------------------
-- Saldos de caja/banco antes de este test (fechas 2099, mismas que usan los
-- otros pgTAP, para no depender de documentos que no controlamos aquí)
-- ---------------------------------------------------------------------------

insert into _perf_antes (codigo, fecha, saldo)
select codigo, '2099-01-31'::date, saldo::numeric(14,2)
from public.saldos_caja_banco('2099-01-31')
where codigo = '1101'
union all
select codigo, '2099-03-31'::date, saldo::numeric(14,2)
from public.saldos_caja_banco('2099-03-31')
where codigo = '1101';

-- ---------------------------------------------------------------------------
-- Datos: factura + pago en enero y un gasto en febrero (posterior al corte)
-- ---------------------------------------------------------------------------

insert into _perf_ids (clave, id)
select 'cliente', public.crear_contacto('{"tipo":"cliente","nombre":"Perf Cliente"}'::jsonb);

insert into _perf_ids (clave, id)
select 'servicio', public.crear_producto(
  '{"tipo":"servicio","nombre":"Perf Servicio","precio":1000,"itbis_tasa":18}'::jsonb
);

insert into _perf_ids (clave, id)
select 'factura', public.crear_factura(jsonb_build_object(
  'tipo_comprobante', '02',
  'contacto_id', (select id from _perf_ids where clave = 'cliente'),
  'fecha', '2099-01-10',
  'vencimiento', '2099-01-20',
  'lineas', jsonb_build_array(jsonb_build_object(
    'producto_id', (select id from _perf_ids where clave = 'servicio'),
    'cantidad', 1,
    'precio', 1000
  ))
));

select public.registrar_pago_recibido(jsonb_build_object(
  'factura_id', (select id from _perf_ids where clave = 'factura'),
  'fecha', '2099-01-20',
  'cuenta_id', (select id from public.cuentas where codigo = '1101'),
  'metodo', 'efectivo',
  'monto', 1180
));

insert into _perf_ids (clave, id)
select 'gasto_febrero', public.crear_gasto_menor(jsonb_build_object(
  'fecha', '2099-02-15',
  'descripcion', 'Gasto posterior al corte de enero',
  'subtotal', 100.00::numeric,
  'itbis_tasa', 0.00::numeric,
  'cuenta_pago_id', (select id from public.cuentas where codigo = '1101')
));

-- ---------------------------------------------------------------------------
-- catalogo_saldos: mismo resultado que el balance de comprobación completo
-- ---------------------------------------------------------------------------

select is(
  (
    select count(*)::int
    from public.reporte_balance_comprobacion('1900-01-01', '2099-01-31') b
    full join public.catalogo_saldos('2099-01-31') c using (cuenta_codigo)
    where c.saldo is distinct from b.saldo
  ),
  0,
  'catalogo_saldos cuadra cuenta por cuenta con el balance de comprobación'
);

select is(
  (select round(sum(saldo), 2) from public.catalogo_saldos('2099-01-31')),
  (select round(sum(saldo), 2) from public.reporte_balance_comprobacion('1900-01-01', '2099-01-31')),
  'el total del catálogo cuadra con el balance de comprobación'
);

select is(
  coalesce((select saldo from public.catalogo_saldos('2099-03-31') where cuenta_codigo = '6101'), 0)
    - coalesce((select saldo from public.catalogo_saldos('2099-01-31') where cuenta_codigo = '6101'), 0),
  100.00::numeric,
  'catalogo_saldos no incluye el gasto de febrero antes del corte y sí lo incluye después'
);

select is(
  (select saldo from public.catalogo_saldos('2099-01-31') where cuenta_codigo = '1101'),
  (select round(coalesce(sum(l.debito - l.credito), 0), 2)
   from public.asiento_lineas l
   join public.asientos a on a.id = l.asiento_id
   join public.cuentas c on c.id = l.cuenta_id
   where c.codigo = '1101' and a.fecha <= '2099-01-31'),
  'el saldo de caja del catálogo iguala la suma de sus líneas hasta la fecha'
);

select ok(
  not exists (select 1 from public.catalogo_saldos('2099-01-31') where cuenta_codigo = '6101'),
  'el catálogo no incluye una cuenta cuyo único movimiento es posterior al corte'
);

-- ---------------------------------------------------------------------------
-- saldos_caja_banco: mismo resultado que antes, con el corte de fecha intacto
-- ---------------------------------------------------------------------------

select is(
  (select saldo from public.saldos_caja_banco('2099-01-31') where codigo = '1101'),
  (select round(coalesce(sum(l.debito - l.credito), 0), 2)
   from public.asiento_lineas l
   join public.asientos a on a.id = l.asiento_id
   join public.cuentas c on c.id = l.cuenta_id
   where c.codigo = '1101' and a.fecha <= '2099-01-31'),
  'saldos_caja_banco cuadra con las líneas de caja hasta la fecha'
);

select is(
  (select saldo::numeric(14,2) from public.saldos_caja_banco('2099-01-31') where codigo = '1101'),
  (select saldo + 1180.00 from _perf_antes where codigo = '1101' and fecha = '2099-01-31'),
  'el pago de enero sube la caja al 31 de enero'
);

select is(
  (select saldo::numeric(14,2) from public.saldos_caja_banco('2099-03-31') where codigo = '1101'),
  (select saldo + 1180.00 - 100.00 from _perf_antes where codigo = '1101' and fecha = '2099-03-31'),
  'el gasto de febrero sí descuenta cuando el corte es posterior'
);

select is(
  (select count(*)::int from public.saldos_caja_banco('2099-01-31')),
  (select count(*)::int from public.cuentas where es_caja_banco),
  'saldos_caja_banco sigue devolviendo todas las cuentas de caja y banco'
);

select ok(
  has_function_privilege('authenticated', 'public.catalogo_saldos(date)', 'execute')
    and not has_function_privilege('anon', 'public.catalogo_saldos(date)', 'execute'),
  'catalogo_saldos queda solo para authenticated'
);

select * from finish();
rollback;
