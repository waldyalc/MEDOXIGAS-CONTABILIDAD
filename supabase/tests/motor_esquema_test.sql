begin;
select plan(27);

select ok(coalesce((select relrowsecurity from pg_class where oid = to_regclass('public.empresa')), false), 'RLS activo en empresa');
select ok(coalesce((select relrowsecurity from pg_class where oid = to_regclass('public.cuentas')), false), 'RLS activo en cuentas');
select ok(coalesce((select relrowsecurity from pg_class where oid = to_regclass('public.config_contable')), false), 'RLS activo en config_contable');
select ok(coalesce((select relrowsecurity from pg_class where oid = to_regclass('public.contactos')), false), 'RLS activo en contactos');
select ok(coalesce((select relrowsecurity from pg_class where oid = to_regclass('public.productos')), false), 'RLS activo en productos');
select ok(coalesce((select relrowsecurity from pg_class where oid = to_regclass('public.numeraciones')), false), 'RLS activo en numeraciones');
select ok(coalesce((select relrowsecurity from pg_class where oid = to_regclass('public.facturas')), false), 'RLS activo en facturas');
select ok(coalesce((select relrowsecurity from pg_class where oid = to_regclass('public.factura_lineas')), false), 'RLS activo en factura_lineas');
select ok(coalesce((select relrowsecurity from pg_class where oid = to_regclass('public.pagos_recibidos')), false), 'RLS activo en pagos_recibidos');
select ok(coalesce((select relrowsecurity from pg_class where oid = to_regclass('public.facturas_proveedor')), false), 'RLS activo en facturas_proveedor');
select ok(coalesce((select relrowsecurity from pg_class where oid = to_regclass('public.facturas_proveedor_lineas')), false), 'RLS activo en facturas_proveedor_lineas');
select ok(coalesce((select relrowsecurity from pg_class where oid = to_regclass('public.pagos_proveedor')), false), 'RLS activo en pagos_proveedor');
select ok(coalesce((select relrowsecurity from pg_class where oid = to_regclass('public.gastos_menores')), false), 'RLS activo en gastos_menores');
select ok(coalesce((select relrowsecurity from pg_class where oid = to_regclass('public.asientos')), false), 'RLS activo en asientos');
select ok(coalesce((select relrowsecurity from pg_class where oid = to_regclass('public.asiento_lineas')), false), 'RLS activo en asiento_lineas');

insert into auth.users (id, email) values
  ('11111111-1111-1111-1111-111111111111', 'admin@prueba.local'),
  ('22222222-2222-2222-2222-222222222222', 'contador@prueba.local'),
  ('33333333-3333-3333-3333-333333333333', 'lector@prueba.local');
insert into public.perfiles (user_id, nombre, rol) values
  ('11111111-1111-1111-1111-111111111111', 'Admin', 'admin'),
  ('22222222-2222-2222-2222-222222222222', 'Contador', 'contador'),
  ('33333333-3333-3333-3333-333333333333', 'Lector', 'lector');

reset role;
set local role anon;
set local request.jwt.claims = '{"role":"anon"}';

select throws_ok($$select * from public.cuentas$$, '42501', null, 'anon no lee cuentas');

reset role;
set local role authenticated;
set local request.jwt.claims = '{"sub":"33333333-3333-3333-3333-333333333333","role":"authenticated"}';

select ok((select count(*) from public.cuentas) > 0, 'lector puede leer cuentas');

select throws_ok($$select public.crear_contacto('{"tipo":"cliente","nombre":"No permitido"}'::jsonb)$$, '42501', null, 'lector no puede llamar crear_contacto');

reset role;
set local role authenticated;
set local request.jwt.claims = '{"sub":"11111111-1111-1111-1111-111111111111","role":"authenticated"}';

select throws_ok($$insert into public.asientos (fecha, descripcion, origen_tipo, total) values ('2026-11-13','directo','manual',100)$$, '42501', null, 'nadie inserta asientos directo');

select is((select count(*)::int from public.cuentas where codigo = any(array['1','11','1101','1102','1103','1104','1105','1106','2','21','2101','2102','3','3101','3201','4','4101','4102','5','5101','6','6101','6102','6103','6104','6105','6106','6107'])), 28, 'catálogo semilla completo (28 cuentas)');

select is((select count(*)::int from public.cuentas where codigo in ('1','11','2','21','3','4','5','6') and acepta_movimientos = false), 8, 'cuentas de agrupación no aceptan movimientos');

select is((select count(*)::int from public.cuentas where codigo in ('1101','1102') and es_caja_banco = true), 2, '1101 y 1102 marcadas es_caja_banco');

select is((select es_caja_banco from public.cuentas where codigo = '1106'), true, '1106 Caja chica marcada es_caja_banco');

select is((select count(*)::int from public.config_contable), 20, 'config_contable tiene 20 claves (18 base + ajustes_iniciales_inventario y devoluciones_ventas)');

select is(
  (select count(*)::int
   from public.config_contable cc
   join public.cuentas c on c.id = cc.cuenta_id
   where (cc.clave, c.codigo) in (
     ('caja','1101'), ('banco','1102'), ('cxc','1103'), ('inventario','1104'),
     ('itbis_adelantado','1105'), ('cxp','2101'), ('itbis_por_pagar','2102'),
     ('ventas','4101'), ('ventas_servicios','4102'), ('costo_ventas','5101'),
     ('gastos_generales','6101'), ('caja_chica','1106'), ('ajuste_inventario','5102'),
     ('retencion_itbis_por_cobrar','1107'), ('retencion_isr_por_cobrar','1108'),
     ('retencion_itbis_por_pagar','2103'), ('retencion_isr_por_pagar','2104'),
     ('ajustes_iniciales','3302')
   )),
  18,
  'config_contable mapea a las cuentas correctas'
);

select is((select nombre from public.empresa), 'MEDOXIGAS ALC, SRL', 'empresa semilla');

select ok(
  exists(select 1 from public.numeraciones where tipo_comprobante = '01' and prefijo = 'B01')
  and exists(select 1 from public.numeraciones where tipo_comprobante = '02' and prefijo = 'B02')
  and exists(select 1 from public.numeraciones where tipo_comprobante = '14' and prefijo = 'B14')
  and exists(select 1 from public.numeraciones where tipo_comprobante = '15' and prefijo = 'B15')
  and exists(select 1 from public.numeraciones where tipo_comprobante = '16' and prefijo = 'B16'),
  'existen numeraciones semilla 01/B01, 02/B02, 14/B14, 15/B15 y 16/B16'
);

select * from finish();
rollback;
