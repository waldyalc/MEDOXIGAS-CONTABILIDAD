begin;
select plan(40);

create temp table _ids (clave text primary key, id uuid) on commit drop;
grant select, insert, update, delete on _ids to authenticated;

insert into auth.users (id, email) values
  ('11111111-1111-1111-1111-111111111111', 'admin@prueba.local'),
  ('22222222-2222-2222-2222-222222222222', 'contador@prueba.local'),
  ('33333333-3333-3333-3333-333333333333', 'lector@prueba.local');

insert into public.perfiles (user_id, nombre, rol) values
  ('11111111-1111-1111-1111-111111111111', 'Admin', 'admin'),
  ('22222222-2222-2222-2222-222222222222', 'Contador', 'contador'),
  ('33333333-3333-3333-3333-333333333333', 'Lector', 'lector');

set local request.jwt.claims = '{"sub":"11111111-1111-1111-1111-111111111111","role":"authenticated"}';

-- Las tablas del POS no admiten INSERT directo: los constraints y el candado de
-- un turno abierto se prueban como dueño de las tablas (reset role).
reset role;

-- ---------------------------------------------------------------------------
-- Esquema, RLS y permisos
-- ---------------------------------------------------------------------------

select ok(
  to_regclass('public.pos_terminales') is not null
  and to_regclass('public.pos_turnos') is not null
  and to_regclass('public.pos_turno_movimientos') is not null,
  'existen las tres tablas del POS'
);

select ok(
  (select bool_and(relrowsecurity) from pg_class
   where oid in (
     to_regclass('public.pos_terminales')::oid,
     to_regclass('public.pos_turnos')::oid,
     to_regclass('public.pos_turno_movimientos')::oid
   )),
  'RLS activo en las tablas del POS'
);

select ok(
  has_table_privilege('authenticated', 'public.pos_terminales', 'SELECT')
  and has_table_privilege('authenticated', 'public.pos_turnos', 'SELECT')
  and has_table_privilege('authenticated', 'public.pos_turno_movimientos', 'SELECT'),
  'authenticated puede leer las tablas del POS'
);

select ok(
  not has_table_privilege('authenticated', 'public.pos_terminales', 'INSERT')
  and not has_table_privilege('authenticated', 'public.pos_terminales', 'UPDATE')
  and not has_table_privilege('authenticated', 'public.pos_terminales', 'DELETE')
  and not has_table_privilege('authenticated', 'public.pos_turnos', 'INSERT')
  and not has_table_privilege('authenticated', 'public.pos_turnos', 'UPDATE')
  and not has_table_privilege('authenticated', 'public.pos_turnos', 'DELETE')
  and not has_table_privilege('authenticated', 'public.pos_turno_movimientos', 'INSERT')
  and not has_table_privilege('authenticated', 'public.pos_turno_movimientos', 'UPDATE')
  and not has_table_privilege('authenticated', 'public.pos_turno_movimientos', 'DELETE'),
  'authenticated no escribe ni borra directo en las tablas del POS'
);

select ok(
  not has_table_privilege('anon', 'public.pos_terminales', 'SELECT')
  and not has_table_privilege('anon', 'public.pos_turnos', 'SELECT')
  and not has_table_privilege('anon', 'public.pos_turno_movimientos', 'SELECT'),
  'anon no lee las tablas del POS'
);

select is(
  (select count(*)::int
   from pg_policies
   where schemaname = 'public'
     and tablename in ('pos_terminales', 'pos_turnos', 'pos_turno_movimientos')),
  3,
  'cada tabla del POS tiene una sola política (lectura)'
);

-- ---------------------------------------------------------------------------
-- Semillas: sobrante y faltante de caja, una sola vez
-- ---------------------------------------------------------------------------

select is(
  (select count(*)::int
   from public.cuentas c
   where c.tipo = 'ingreso'
     and c.acepta_movimientos
     and lower(btrim(c.nombre)) = 'sobrantes de caja'),
  1,
  'se siembra una sola cuenta de sobrantes de caja'
);

select is(
  (select count(*)::int
   from public.cuentas c
   where c.tipo = 'gasto'
     and c.acepta_movimientos
     and lower(btrim(c.nombre)) = 'faltantes de caja'),
  1,
  'se siembra una sola cuenta de faltantes de caja'
);

select is(
  (select cc.cuenta_id
   from public.config_contable cc
   join public.cuentas c on c.id = cc.cuenta_id
   where cc.clave = 'sobrante_caja'
     and c.tipo = 'ingreso'
     and lower(btrim(c.nombre)) = 'sobrantes de caja'),
  (select c.id from public.cuentas c
   where c.tipo = 'ingreso' and lower(btrim(c.nombre)) = 'sobrantes de caja'),
  'config_contable.sobrante_caja apunta a la cuenta de sobrantes'
);

select is(
  (select cc.cuenta_id
   from public.config_contable cc
   join public.cuentas c on c.id = cc.cuenta_id
   where cc.clave = 'faltante_caja'
     and c.tipo = 'gasto'
     and lower(btrim(c.nombre)) = 'faltantes de caja'),
  (select c.id from public.cuentas c
   where c.tipo = 'gasto' and lower(btrim(c.nombre)) = 'faltantes de caja'),
  'config_contable.faltante_caja apunta a la cuenta de faltantes'
);

select is(
  (select count(*)::int from public.config_contable
   where clave in ('sobrante_caja', 'faltante_caja')),
  2,
  'las dos claves nuevas de config_contable quedan una sola vez'
);

-- ---------------------------------------------------------------------------
-- Terminales
-- ---------------------------------------------------------------------------

with nuevo as (
  insert into public.contactos (tipo, nombre, rnc_cedula, activo)
  values ('cliente', 'Consumidor Final pgTAP POS', '22222222222', true)
  returning id
)
insert into _ids (clave, id) select 'contacto', id from nuevo;

with nueva as (
  insert into public.pos_terminales (
    nombre, almacen_id, cuenta_efectivo_id, numeracion_defecto_id, contacto_defecto_id
  )
  values (
    'Caja 1 pgTAP POS',
    (select a.id from public.almacenes a where a.es_principal order by a.creado_en, a.id limit 1),
    (select c.id from public.cuentas c where c.codigo = '1101'),
    (select n.id from public.numeraciones n where n.tipo_comprobante = '02' order by n.id limit 1),
    (select id from _ids where clave = 'contacto')
  )
  returning id
)
insert into _ids (clave, id) select 'terminal_1', id from nueva;

with nueva as (
  insert into public.pos_terminales (
    nombre, almacen_id, cuenta_efectivo_id, numeracion_defecto_id, contacto_defecto_id
  )
  values (
    'Caja 2 pgTAP POS',
    (select a.id from public.almacenes a where a.es_principal order by a.creado_en, a.id limit 1),
    (select c.id from public.cuentas c where c.codigo = '1106'),
    (select n.id from public.numeraciones n where n.tipo_comprobante = '02' order by n.id limit 1),
    (select id from _ids where clave = 'contacto')
  )
  returning id
)
insert into _ids (clave, id) select 'terminal_2', id from nueva;

select is(
  (select count(*)::int from public.pos_terminales where activa),
  2,
  'se crean dos terminales activas con cajones distintos'
);

select is(
  (select (plantilla_ticket ->> 'ancho_mm') || '/' || (plantilla_ticket ->> 'estilo')
   from public.pos_terminales
   where id = (select id from _ids where clave = 'terminal_1')),
  '80/clasico',
  'la plantilla del ticket nace con el default del contrato'
);

select throws_ok(
  $q$insert into public.pos_terminales (
       nombre, almacen_id, cuenta_efectivo_id, numeracion_defecto_id, contacto_defecto_id
     )
     values (
       'Caja duplicada pgTAP POS',
       (select a.id from public.almacenes a where a.es_principal limit 1),
       (select c.id from public.cuentas c where c.codigo = '1101'),
       (select n.id from public.numeraciones n where n.tipo_comprobante = '02' limit 1),
       (select id from _ids where clave = 'contacto')
     )$q$,
  '23505',
  null,
  'dos terminales activas no comparten el mismo cajón'
);

-- ---------------------------------------------------------------------------
-- Turnos: candado de uno abierto por terminal y checks de cierre
-- ---------------------------------------------------------------------------

with nuevo as (
  insert into public.pos_turnos (terminal_id, base_inicial)
  values ((select id from _ids where clave = 'terminal_1'), 0)
  returning id
)
insert into _ids (clave, id) select 'turno_1', id from nuevo;

select is(
  (select estado from public.pos_turnos where id = (select id from _ids where clave = 'turno_1')),
  'abierto',
  'abrir turno lo deja en estado abierto'
);

select throws_ok(
  $q$insert into public.pos_turnos (terminal_id, base_inicial)
     values ((select id from _ids where clave = 'terminal_1'), 100)$q$,
  '23505',
  null,
  'el índice único parcial impide dos turnos abiertos en la misma terminal'
);

with nuevo as (
  insert into public.pos_turnos (terminal_id, base_inicial)
  values ((select id from _ids where clave = 'terminal_2'), 500)
  returning id
)
insert into _ids (clave, id) select 'turno_2', id from nuevo;

select is(
  (select count(*)::int from public.pos_turnos where estado = 'abierto'),
  2,
  'una segunda terminal sí puede abrir su propio turno'
);

select throws_ok(
  $q$insert into public.pos_turnos (terminal_id, base_inicial)
     values ((select id from _ids where clave = 'terminal_1'), -1)$q$,
  '23514',
  null,
  'la base inicial no puede ser negativa'
);

select throws_ok(
  $q$insert into public.pos_turnos (terminal_id, estado)
     values ((select id from _ids where clave = 'terminal_1'), 'cerrado')$q$,
  '23514',
  null,
  'un turno cerrado exige cierre, conteos y diferencia'
);

with nuevo as (
  insert into public.pos_turnos (
    terminal_id, estado, cerrado_por, cerrado_en,
    efectivo_esperado, efectivo_real, diferencia
  )
  values (
    (select id from _ids where clave = 'terminal_1'),
    'cerrado',
    '11111111-1111-1111-1111-111111111111',
    now(),
    1000,
    990,
    -10
  )
  returning id
)
insert into _ids (clave, id) select 'turno_cerrado', id from nuevo;

select is(
  (select diferencia from public.pos_turnos
   where id = (select id from _ids where clave = 'turno_cerrado')),
  (-10)::numeric,
  'un cierre coherente guarda la diferencia real menos esperado'
);

-- ---------------------------------------------------------------------------
-- Asientos: el CHECK acepta los orígenes del POS y rechaza basura
-- ---------------------------------------------------------------------------

with nuevo as (
  insert into public.asientos (descripcion, origen_tipo)
  values ('Movimiento de caja pgTAP POS', 'pos_movimiento')
  returning id
)
insert into _ids (clave, id) select 'asiento_movimiento', id from nuevo;

with nuevo as (
  insert into public.asientos (descripcion, origen_tipo)
  values ('Diferencia de cierre pgTAP POS', 'pos_diferencia')
  returning id
)
insert into _ids (clave, id) select 'asiento_diferencia', id from nuevo;

select is(
  (select count(*)::int from public.asientos
   where origen_tipo in ('pos_movimiento', 'pos_diferencia')),
  2,
  'el CHECK de asientos acepta pos_movimiento y pos_diferencia'
);

select throws_ok(
  $q$insert into public.asientos (descripcion, origen_tipo)
     values ('Origen inválido pgTAP POS', 'pos_basura')$q$,
  '23514',
  null,
  'el CHECK de asientos rechaza un origen que no existe'
);

-- ---------------------------------------------------------------------------
-- Movimientos de caja: tipo, motivo, monto y vínculos
-- ---------------------------------------------------------------------------

select throws_ok(
  $q$insert into public.pos_turno_movimientos (
       turno_id, tipo, motivo, monto, cuenta_contrapartida_id, asiento_id
     )
     values (
       (select id from _ids where clave = 'turno_1'),
       'entrada',
       'fondo_caja',
       100,
       (select c.id from public.cuentas c where c.codigo = '1102'),
       (select id from _ids where clave = 'asiento_movimiento')
     )$q$,
  '23514',
  null,
  'el tipo del movimiento solo admite ingreso o retiro'
);

select throws_ok(
  $q$insert into public.pos_turno_movimientos (
       turno_id, tipo, motivo, monto, cuenta_contrapartida_id, asiento_id
     )
     values (
       (select id from _ids where clave = 'turno_1'),
       'ingreso',
       'venta',
       100,
       (select c.id from public.cuentas c where c.codigo = '1102'),
       (select id from _ids where clave = 'asiento_movimiento')
     )$q$,
  '23514',
  null,
  'el motivo del movimiento solo admite los seis del contrato'
);

select throws_ok(
  $q$insert into public.pos_turno_movimientos (
       turno_id, tipo, motivo, monto, cuenta_contrapartida_id, asiento_id
     )
     values (
       (select id from _ids where clave = 'turno_1'),
       'ingreso',
       'fondo_caja',
       0,
       (select c.id from public.cuentas c where c.codigo = '1102'),
       (select id from _ids where clave = 'asiento_movimiento')
     )$q$,
  '23514',
  null,
  'el monto del movimiento debe ser mayor a cero'
);

select throws_ok(
  $q$insert into public.pos_turno_movimientos (
       turno_id, tipo, motivo, monto, cuenta_contrapartida_id, asiento_id
     )
     values (
       (select id from _ids where clave = 'turno_1'),
       'ingreso',
       'cobro_factura',
       100,
       (select c.id from public.cuentas c where c.codigo = '1103'),
       (select id from _ids where clave = 'asiento_movimiento')
     )$q$,
  '23514',
  null,
  'un cobro de factura exige factura y pago ligados'
);

with nuevo as (
  insert into public.pos_turno_movimientos (
    turno_id, tipo, motivo, monto, cuenta_contrapartida_id, asiento_id
  )
  values (
    (select id from _ids where clave = 'turno_1'),
    'ingreso',
    'fondo_caja',
    100,
    (select c.id from public.cuentas c where c.codigo = '1102'),
    (select id from _ids where clave = 'asiento_movimiento')
  )
  returning id
)
insert into _ids (clave, id) select 'movimiento_1', id from nuevo;

select is(
  (select motivo from public.pos_turno_movimientos
   where id = (select id from _ids where clave = 'movimiento_1')),
  'fondo_caja',
  'un ingreso de fondo de caja se guarda con su asiento'
);

-- ---------------------------------------------------------------------------
-- Extensiones: facturas, cotizaciones, pagos y notas de crédito
-- ---------------------------------------------------------------------------

with nueva as (
  insert into public.facturas (tipo_comprobante, ncf, contacto_id, vencimiento)
  values (
    '02',
    'B02-PGTAP-POS-1',
    (select id from _ids where clave = 'contacto'),
    current_date
  )
  returning id
)
insert into _ids (clave, id) select 'factura_1', id from nueva;

select is(
  (select origen from public.facturas where id = (select id from _ids where clave = 'factura_1')),
  'contabilidad',
  'las facturas existentes y nuevas nacen con origen contabilidad'
);

with nueva as (
  insert into public.facturas (
    tipo_comprobante, ncf, contacto_id, vencimiento, origen, turno_id
  )
  values (
    '02',
    'B02-PGTAP-POS-2',
    (select id from _ids where clave = 'contacto'),
    current_date,
    'pos',
    (select id from _ids where clave = 'turno_1')
  )
  returning id
)
insert into _ids (clave, id) select 'factura_pos', id from nueva;

select is(
  (select turno_id from public.facturas where id = (select id from _ids where clave = 'factura_pos')),
  (select id from _ids where clave = 'turno_1'),
  'una factura del POS queda ligada a su turno'
);

select throws_ok(
  $q$insert into public.facturas (tipo_comprobante, ncf, contacto_id, vencimiento, origen)
     values (
       '02',
       'B02-PGTAP-POS-3',
       (select id from _ids where clave = 'contacto'),
       current_date,
       'otro'
     )$q$,
  '23514',
  null,
  'el origen de la factura solo admite contabilidad o pos'
);

select throws_ok(
  $q$insert into public.facturas (
       tipo_comprobante, ncf, contacto_id, vencimiento, monto_recibido, cambio
     )
     values (
       '02',
       'B02-PGTAP-POS-4',
       (select id from _ids where clave = 'contacto'),
       current_date,
       100,
       150
     )$q$,
  '23514',
  null,
  'el cambio no puede ser mayor al efectivo recibido'
);

with nueva as (
  insert into public.cotizaciones (contacto_id, vencimiento)
  values ((select id from _ids where clave = 'contacto'), current_date)
  returning id
)
insert into _ids (clave, id) select 'cotizacion_1', id from nueva;

select is(
  (select origen from public.cotizaciones where id = (select id from _ids where clave = 'cotizacion_1')),
  'contabilidad',
  'las cotizaciones nacen con origen contabilidad'
);

select throws_ok(
  $q$insert into public.cotizaciones (contacto_id, vencimiento, origen)
     values (
       (select id from _ids where clave = 'contacto'),
       current_date,
       'otro'
     )$q$,
  '23514',
  null,
  'el origen de la cotización solo admite contabilidad o pos'
);

with nuevo as (
  insert into public.pagos_recibidos (
    contacto_id, cuenta_id, metodo, monto, turno_id
  )
  values (
    (select id from _ids where clave = 'contacto'),
    (select c.id from public.cuentas c where c.codigo = '1101'),
    'efectivo',
    50,
    (select id from _ids where clave = 'turno_1')
  )
  returning id
)
insert into _ids (clave, id) select 'pago_1', id from nuevo;

select is(
  (select turno_id from public.pagos_recibidos where id = (select id from _ids where clave = 'pago_1')),
  (select id from _ids where clave = 'turno_1'),
  'un pago del POS queda ligado a su turno'
);

with nueva as (
  insert into public.notas_credito_venta (ncf, factura_id, contacto_id)
  values (
    'B04-PGTAP-POS-1',
    (select id from _ids where clave = 'factura_1'),
    (select id from _ids where clave = 'contacto')
  )
  returning id
)
insert into _ids (clave, id) select 'nota_1', id from nueva;

select is(
  (select tipo_reembolso || '/' || monto_reembolso_efectivo::text
   from public.notas_credito_venta
   where id = (select id from _ids where clave = 'nota_1')),
  'credito_factura/0.00',
  'las notas de crédito nacen como crédito a factura sin efectivo'
);

select throws_ok(
  $q$insert into public.notas_credito_venta (ncf, factura_id, contacto_id, tipo_reembolso)
     values (
       'B04-PGTAP-POS-2',
       (select id from _ids where clave = 'factura_1'),
       (select id from _ids where clave = 'contacto'),
       'tarjeta'
     )$q$,
  '23514',
  null,
  'el tipo de reembolso solo admite los tres del contrato'
);

select throws_ok(
  $q$insert into public.notas_credito_venta (ncf, factura_id, contacto_id, tipo_reembolso)
     values (
       'B04-PGTAP-POS-3',
       (select id from _ids where clave = 'factura_1'),
       (select id from _ids where clave = 'contacto'),
       'efectivo'
     )$q$,
  '23514',
  null,
  'un reembolso en efectivo exige monto y cuenta de reembolso'
);

-- ---------------------------------------------------------------------------
-- RLS en ejecución: authenticated lee, anon no ve nada
-- ---------------------------------------------------------------------------

set local role authenticated;
set local request.jwt.claims = '{"sub":"33333333-3333-3333-3333-333333333333","role":"authenticated"}';

select ok(
  (select count(*) from public.pos_terminales) > 0
  and (select count(*) from public.pos_turnos) > 0
  and (select count(*) from public.pos_turno_movimientos) > 0,
  'el rol lector ve terminales, turnos y movimientos del POS'
);

select throws_ok(
  $q$insert into public.pos_turnos (terminal_id) values ((select id from _ids where clave = 'terminal_1'))$q$,
  '42501',
  null,
  'ningún usuario autenticado inserta turnos directo'
);

reset role;
set local role anon;
set local request.jwt.claims = '{"role":"anon"}';

select throws_ok(
  $q$select count(*) from public.pos_turnos$q$,
  '42501',
  null,
  'anon no puede leer los turnos del POS'
);

reset role;
select * from finish();
rollback;
