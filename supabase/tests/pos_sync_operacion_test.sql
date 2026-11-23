-- POS 11: idempotencia, permisos y RLS de pos_sincronizar_operacion.
-- Cubre la migración 20261126120000_pos_offline_client_uuid.sql:
--   1. solo admin/contador sincronizan; lector recibe 42501.
--   2. el mismo client_uuid devuelve la factura original sin duplicar factura,
--      NCF, asiento ni inventario.
--   3. el mismo client_uuid con otro payload se rechaza.
--   4. pos_sync_operaciones: cada usuario solo ve sus operaciones y nadie
--      escribe directo en la tabla.
--   5. una operación sobre un turno cerrado se rechaza.
--   6. la idempotencia también aplica a los movimientos de turno.
begin;
select plan(31);

create temp table _ids (clave text primary key, id uuid) on commit drop;
create temp table _contadores (clave text primary key, valor numeric) on commit drop;
create temp table _sync (clave text primary key, payload jsonb) on commit drop;
grant select, insert, update, delete on _ids to authenticated;
grant select, insert, update, delete on _contadores to authenticated;
grant select, insert, update, delete on _sync to authenticated;

insert into auth.users (id, email) values
  ('11111111-1111-1111-1111-111111111111', 'admin@prueba.local'),
  ('22222222-2222-2222-2222-222222222222', 'contador@prueba.local'),
  ('33333333-3333-3333-3333-333333333333', 'lector@prueba.local'),
  ('44444444-4444-4444-4444-444444444444', 'contador2@prueba.local');

insert into public.perfiles (user_id, nombre, rol) values
  ('11111111-1111-1111-1111-111111111111', 'Admin', 'admin'),
  ('22222222-2222-2222-2222-222222222222', 'Contador', 'contador'),
  ('33333333-3333-3333-3333-333333333333', 'Lector', 'lector'),
  ('44444444-4444-4444-4444-444444444444', 'Contador 2', 'contador');

set local role authenticated;
set local request.jwt.claims = '{"sub":"11111111-1111-1111-1111-111111111111","role":"authenticated"}';

-- ---------------------------------------------------------------------------
-- Privilegios de la RPC y de la tabla
-- ---------------------------------------------------------------------------

select ok(
  has_function_privilege(
    'authenticated', 'public.pos_sincronizar_operacion(jsonb)', 'execute'
  ),
  'authenticated puede ejecutar pos_sincronizar_operacion'
);

select ok(
  not has_function_privilege(
    'anon', 'public.pos_sincronizar_operacion(jsonb)', 'execute'
  ),
  'anon no ejecuta pos_sincronizar_operacion'
);

select ok(
  has_table_privilege('authenticated', 'public.pos_sync_operaciones', 'select')
  and not has_table_privilege('authenticated', 'public.pos_sync_operaciones', 'insert')
  and not has_table_privilege('authenticated', 'public.pos_sync_operaciones', 'update')
  and not has_table_privilege('authenticated', 'public.pos_sync_operaciones', 'delete'),
  'authenticated solo lee pos_sync_operaciones (sin escritura directa)'
);

select ok(
  not has_table_privilege('anon', 'public.pos_sync_operaciones', 'select'),
  'anon no lee pos_sync_operaciones'
);

-- ---------------------------------------------------------------------------
-- Semillas del POS
-- ---------------------------------------------------------------------------

insert into _ids (clave, id)
select 'almacen', a.id from public.almacenes a where a.es_principal limit 1;

insert into _ids (clave, id)
select 'numeracion', n.id from public.numeraciones n
where n.tipo_comprobante = '02' and n.activa
order by n.id limit 1;

insert into _ids (clave, id)
select 'caja', public.crear_cuenta(jsonb_build_object(
  'codigo', '1911', 'nombre', 'Caja sync pgTAP', 'tipo', 'activo', 'naturaleza', 'debito',
  'es_caja_banco', true, 'acepta_movimientos', true
));

insert into _ids (clave, id)
select 'banco', public.crear_cuenta(jsonb_build_object(
  'codigo', '1912', 'nombre', 'Banco sync pgTAP', 'tipo', 'activo', 'naturaleza', 'debito',
  'es_caja_banco', true, 'acepta_movimientos', true
));

insert into _ids (clave, id)
select 'tarjeta', public.crear_cuenta(jsonb_build_object(
  'codigo', '1913', 'nombre', 'Tarjeta sync pgTAP', 'tipo', 'activo', 'naturaleza', 'debito',
  'es_caja_banco', true, 'acepta_movimientos', true
));

insert into _ids (clave, id)
select 'caja2', public.crear_cuenta(jsonb_build_object(
  'codigo', '1914', 'nombre', 'Caja cerrada sync pgTAP', 'tipo', 'activo', 'naturaleza', 'debito',
  'es_caja_banco', true, 'acepta_movimientos', true
));

insert into _ids (clave, id)
select 'gasto', public.crear_cuenta(jsonb_build_object(
  'codigo', '6991', 'nombre', 'Gasto sync pgTAP', 'tipo', 'gasto', 'naturaleza', 'debito',
  'acepta_movimientos', true
));

insert into _ids (clave, id)
select 'consumidor', public.crear_contacto(jsonb_build_object(
  'tipo', 'cliente', 'nombre', 'Consumidor Final sync pgTAP'
));

insert into _ids (clave, id)
select 'producto', public.crear_producto(jsonb_build_object(
  'tipo', 'producto', 'nombre', 'Producto sync pgTAP', 'referencia', 'SYNC-PGTAP',
  'precio', 100, 'itbis_tasa', 18, 'inventariable', true, 'cantidad', 10, 'costo', 40
));

insert into _ids (clave, id)
select 'terminal', public.pos_crear_terminal(jsonb_build_object(
  'nombre', 'Caja sync pgTAP',
  'almacen_id', (select id from _ids where clave = 'almacen'),
  'cuenta_efectivo_id', (select id from _ids where clave = 'caja'),
  'cuenta_tarjeta_debito_id', (select id from _ids where clave = 'tarjeta'),
  'cuenta_transferencia_id', (select id from _ids where clave = 'banco'),
  'numeracion_defecto_id', (select id from _ids where clave = 'numeracion'),
  'contacto_defecto_id', (select id from _ids where clave = 'consumidor')
));

insert into _ids (clave, id)
select 'terminal_cerrada', public.pos_crear_terminal(jsonb_build_object(
  'nombre', 'Caja cerrada sync pgTAP',
  'almacen_id', (select id from _ids where clave = 'almacen'),
  'cuenta_efectivo_id', (select id from _ids where clave = 'caja2'),
  'cuenta_tarjeta_debito_id', (select id from _ids where clave = 'tarjeta'),
  'cuenta_transferencia_id', (select id from _ids where clave = 'banco'),
  'numeracion_defecto_id', (select id from _ids where clave = 'numeracion'),
  'contacto_defecto_id', (select id from _ids where clave = 'consumidor')
));

insert into _ids (clave, id)
select 'turno', (public.pos_abrir_turno(jsonb_build_object(
  'terminal_id', (select id from _ids where clave = 'terminal'),
  'base_inicial', 100
))->'turno'->>'id')::uuid;

insert into _ids (clave, id)
select 'turno_cerrado', (public.pos_abrir_turno(jsonb_build_object(
  'terminal_id', (select id from _ids where clave = 'terminal_cerrada'),
  'base_inicial', 0
))->'turno'->>'id')::uuid;

insert into _sync (clave, payload) values ('venta', jsonb_build_object(
  'terminal_id', (select id from _ids where clave = 'terminal'),
  'lineas', jsonb_build_array(jsonb_build_object(
    'producto_id', (select id from _ids where clave = 'producto'),
    'cantidad', 2
  )),
  'pagos', jsonb_build_array(jsonb_build_object(
    'metodo', 'efectivo', 'monto', 236, 'monto_recibido', 236
  ))
));

insert into _contadores (clave, valor) values
  ('asientos_antes', (select count(*) from public.asientos)),
  ('siguiente_antes', (
    select siguiente::bigint from public.numeraciones
    where id = (select id from _ids where clave = 'numeracion')
  ));

-- ---------------------------------------------------------------------------
-- El rol lector no sincroniza
-- ---------------------------------------------------------------------------

set local request.jwt.claims = '{"sub":"33333333-3333-3333-3333-333333333333","role":"authenticated"}';

select throws_ok(
  $q$select public.pos_sincronizar_operacion(jsonb_build_object(
    'client_uuid', 'aaaaaaaa-0000-4000-8000-000000000099',
    'terminal_id', (select id from _ids where clave = 'terminal'),
    'turno_id', (select id from _ids where clave = 'turno'),
    'tipo', 'venta',
    'payload', (select payload from _sync where clave = 'venta')
  ))$q$,
  '42501',
  'sin permiso',
  'el rol lector no sincroniza operaciones del POS'
);

set local request.jwt.claims = '{"sub":"11111111-1111-1111-1111-111111111111","role":"authenticated"}';

-- ---------------------------------------------------------------------------
-- Idempotencia de una venta por client_uuid
-- ---------------------------------------------------------------------------

insert into _ids (clave, id)
select 'venta', (public.pos_sincronizar_operacion(jsonb_build_object(
  'client_uuid', 'aaaaaaaa-0000-4000-8000-000000000001',
  'terminal_id', (select id from _ids where clave = 'terminal'),
  'turno_id', (select id from _ids where clave = 'turno'),
  'tipo', 'venta',
  'payload', (select payload from _sync where clave = 'venta')
))->'factura'->>'id')::uuid;

insert into _contadores (clave, valor) values
  ('asientos_tras_venta', (select count(*) from public.asientos)),
  ('siguiente_tras_venta', (
    select siguiente::bigint from public.numeraciones
    where id = (select id from _ids where clave = 'numeracion')
  )),
  ('existencias_tras_venta', (
    select cantidad from public.existencias
    where producto_id = (select id from _ids where clave = 'producto')
      and almacen_id = (select id from _ids where clave = 'almacen')
  ));

select is(
  (select count(*)::int from public.facturas
   where client_uuid = 'aaaaaaaa-0000-4000-8000-000000000001'),
  1,
  'la primera sincronización crea una sola factura con el client_uuid'
);

select ok(
  (select ncf from public.facturas where id = (select id from _ids where clave = 'venta')) is not null,
  'la venta sincronizada recibe NCF'
);

select is(
  (select valor from _contadores where clave = 'siguiente_tras_venta'),
  (select valor from _contadores where clave = 'siguiente_antes') + 1,
  'la venta consume un solo número de NCF'
);

select is(
  (select valor from _contadores where clave = 'existencias_tras_venta'),
  8::numeric,
  'la venta descuenta 2 del inventario'
);

select is(
  (select valor from _contadores where clave = 'asientos_tras_venta'),
  -- El producto de prueba es inventariable con costo 40: pos_completar_venta
  -- crea el asiento de la venta y el asiento del costo de venta.
  (select valor from _contadores where clave = 'asientos_antes') + 2,
  'la venta genera su asiento y el del costo de venta'
);

insert into _ids (clave, id)
select 'venta_repetida', (public.pos_sincronizar_operacion(jsonb_build_object(
  'client_uuid', 'aaaaaaaa-0000-4000-8000-000000000001',
  'terminal_id', (select id from _ids where clave = 'terminal'),
  'turno_id', (select id from _ids where clave = 'turno'),
  'tipo', 'venta',
  'payload', (select payload from _sync where clave = 'venta')
))->'factura'->>'id')::uuid;

select is(
  (select id from _ids where clave = 'venta_repetida'),
  (select id from _ids where clave = 'venta'),
  'la repetición del client_uuid devuelve la factura original'
);

select is(
  (select count(*)::int from public.facturas
   where client_uuid = 'aaaaaaaa-0000-4000-8000-000000000001'),
  1,
  'la repetición no duplica la factura'
);

select is(
  (select count(*)::int from public.facturas
   where ncf = (
     select ncf from public.facturas where id = (select id from _ids where clave = 'venta')
   )),
  1,
  'la repetición no duplica el NCF'
);

select is(
  (select count(*)::numeric from public.asientos),
  (select valor from _contadores where clave = 'asientos_tras_venta'),
  'la repetición no duplica el asiento'
);

select is(
  (select cantidad from public.existencias
   where producto_id = (select id from _ids where clave = 'producto')
     and almacen_id = (select id from _ids where clave = 'almacen')),
  8::numeric,
  'la repetición no vuelve a descontar inventario'
);

select is(
  (select siguiente::bigint::numeric from public.numeraciones
   where id = (select id from _ids where clave = 'numeracion')),
  (select valor from _contadores where clave = 'siguiente_tras_venta'),
  'la repetición no consume otro número de NCF'
);

select is(
  (select count(*)::int from public.pos_sync_operaciones
   where client_uuid = 'aaaaaaaa-0000-4000-8000-000000000001'),
  1,
  'la operación queda registrada una sola vez'
);

select is(
  (select count(*)::int from public.factura_lineas
   where factura_id = (select id from _ids where clave = 'venta')),
  1,
  'la factura conserva una sola línea'
);

-- ---------------------------------------------------------------------------
-- El mismo client_uuid con otro payload se rechaza
-- ---------------------------------------------------------------------------

select throws_ok(
  $q$select public.pos_sincronizar_operacion(jsonb_build_object(
    'client_uuid', 'aaaaaaaa-0000-4000-8000-000000000001',
    'terminal_id', (select id from _ids where clave = 'terminal'),
    'turno_id', (select id from _ids where clave = 'turno'),
    'tipo', 'venta',
    'payload', jsonb_set(
      (select payload from _sync where clave = 'venta'),
      '{lineas,0,cantidad}', '3'
    )
  ))$q$,
  '22023',
  'el identificador ya pertenece a otra operación',
  'el mismo client_uuid con otro payload se rechaza'
);

-- ---------------------------------------------------------------------------
-- RLS de pos_sync_operaciones
-- ---------------------------------------------------------------------------

select is(
  (select count(*)::int from public.pos_sync_operaciones
   where client_uuid = 'aaaaaaaa-0000-4000-8000-000000000001'),
  1,
  'el dueño ve su operación sincronizada'
);

set local request.jwt.claims = '{"sub":"44444444-4444-4444-4444-444444444444","role":"authenticated"}';

select is(
  (select count(*)::int from public.pos_sync_operaciones),
  0,
  'otro contador no ve las operaciones ajenas'
);

select throws_ok(
  $q$insert into public.pos_sync_operaciones
    (client_uuid, creado_por, terminal_id, turno_id, tipo, payload, resultado)
  values (
    'aaaaaaaa-0000-4000-8000-000000000002',
    '44444444-4444-4444-4444-444444444444',
    (select id from _ids where clave = 'terminal'),
    (select id from _ids where clave = 'turno'),
    'movimiento', '{}'::jsonb, '{}'::jsonb
  )$q$,
  '42501',
  null,
  'authenticated no inserta directo en pos_sync_operaciones'
);

select throws_ok(
  $q$update public.pos_sync_operaciones set tipo = 'movimiento'$q$,
  '42501',
  null,
  'authenticated no actualiza directo pos_sync_operaciones'
);

select throws_ok(
  $q$delete from public.pos_sync_operaciones
    where client_uuid = 'aaaaaaaa-0000-4000-8000-000000000001'$q$,
  '42501',
  null,
  'authenticated no borra directo pos_sync_operaciones'
);

set local request.jwt.claims = '{"sub":"11111111-1111-1111-1111-111111111111","role":"authenticated"}';

-- ---------------------------------------------------------------------------
-- Operación sobre un turno cerrado
-- ---------------------------------------------------------------------------

select public.pos_cerrar_turno(jsonb_build_object(
  'turno_id', (select id from _ids where clave = 'turno_cerrado'),
  'efectivo_real', 0,
  'registrar_diferencia', false
));

select is(
  (select estado from public.pos_turnos
   where id = (select id from _ids where clave = 'turno_cerrado')),
  'cerrado',
  'el turno de la terminal cerrada queda cerrado'
);

select throws_ok(
  $q$select public.pos_sincronizar_operacion(jsonb_build_object(
    'client_uuid', 'aaaaaaaa-0000-4000-8000-000000000003',
    'terminal_id', (select id from _ids where clave = 'terminal_cerrada'),
    'turno_id', (select id from _ids where clave = 'turno_cerrado'),
    'tipo', 'venta',
    'payload', jsonb_build_object(
      'terminal_id', (select id from _ids where clave = 'terminal_cerrada'),
      'venta_simple', jsonb_build_object(
        'descripcion', 'Venta turno cerrado', 'monto', 100, 'itbis_tasa', 0
      ),
      'pagos', jsonb_build_array(jsonb_build_object('metodo', 'efectivo', 'monto', 100))
    )
  ))$q$,
  '22023',
  'el turno no existe, está cerrado o pertenece a otra terminal',
  'no se sincroniza una venta sobre un turno cerrado'
);

select is(
  (select count(*)::int from public.facturas
   where client_uuid = 'aaaaaaaa-0000-4000-8000-000000000003'),
  0,
  'la operación rechazada no crea factura'
);

-- ---------------------------------------------------------------------------
-- Idempotencia de un movimiento de turno
-- ---------------------------------------------------------------------------

insert into _sync (clave, payload) values ('movimiento', jsonb_build_object(
  'turno_id', (select id from _ids where clave = 'turno'),
  'tipo', 'retiro',
  'motivo', 'retiro_caja',
  'monto', 50,
  'cuenta_contrapartida_id', (select id from _ids where clave = 'gasto')
));

insert into _ids (clave, id)
select 'movimiento', (public.pos_sincronizar_operacion(jsonb_build_object(
  'client_uuid', 'aaaaaaaa-0000-4000-8000-000000000004',
  'terminal_id', (select id from _ids where clave = 'terminal'),
  'turno_id', (select id from _ids where clave = 'turno'),
  'tipo', 'movimiento',
  'payload', (select payload from _sync where clave = 'movimiento')
))->'movimiento'->>'id')::uuid;

insert into _contadores (clave, valor) values
  ('asientos_tras_movimiento', (select count(*) from public.asientos));

insert into _ids (clave, id)
select 'movimiento_repetido', (public.pos_sincronizar_operacion(jsonb_build_object(
  'client_uuid', 'aaaaaaaa-0000-4000-8000-000000000004',
  'terminal_id', (select id from _ids where clave = 'terminal'),
  'turno_id', (select id from _ids where clave = 'turno'),
  'tipo', 'movimiento',
  'payload', (select payload from _sync where clave = 'movimiento')
))->'movimiento'->>'id')::uuid;

select is(
  (select count(*)::int from public.pos_turno_movimientos
   where client_uuid = 'aaaaaaaa-0000-4000-8000-000000000004'),
  1,
  'el movimiento queda registrado una sola vez'
);

select is(
  (select id from _ids where clave = 'movimiento_repetido'),
  (select id from _ids where clave = 'movimiento'),
  'la repetición del movimiento devuelve el movimiento original'
);

select is(
  (select count(*)::numeric from public.asientos),
  (select valor from _contadores where clave = 'asientos_tras_movimiento'),
  'la repetición del movimiento no duplica el asiento'
);

select is(
  (select count(*)::int from public.pos_sync_operaciones
   where client_uuid = 'aaaaaaaa-0000-4000-8000-000000000004'),
  1,
  'la operación del movimiento queda registrada una sola vez'
);

select * from finish();
rollback;
