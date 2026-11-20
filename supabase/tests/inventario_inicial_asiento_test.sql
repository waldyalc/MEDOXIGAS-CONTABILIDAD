begin;
select plan(32);

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
-- Cuenta de contrapartida y su clave de configuración
-- ---------------------------------------------------------------------------

select is(
  (select c.nombre
   from public.config_contable cc
   join public.cuentas c on c.id = cc.cuenta_id
   where cc.clave = 'ajustes_iniciales_inventario'),
  'Ajustes iniciales en inventario',
  'la cuenta Ajustes iniciales en inventario existe y está configurada'
);

select ok(
  (select c.tipo = 'capital' and c.naturaleza = 'credito' and c.acepta_movimientos and c.activa
   from public.config_contable cc
   join public.cuentas c on c.id = cc.cuenta_id
   where cc.clave = 'ajustes_iniciales_inventario'),
  'la cuenta es de patrimonio, crédito, activa y acepta movimientos'
);

select is(
  (select c.padre_id
   from public.config_contable cc
   join public.cuentas c on c.id = cc.cuenta_id
   where cc.clave = 'ajustes_iniciales_inventario'),
  (select c.id from public.cuentas c where c.codigo = '3'),
  'la cuenta cuelga de Capital'
);

-- ---------------------------------------------------------------------------
-- Alta: 10 unidades × 500 = 5,000
-- ---------------------------------------------------------------------------

insert into _ids (clave, id)
select 'producto', public.crear_producto(jsonb_build_object(
  'tipo', 'producto',
  'nombre', 'Inventario inicial pgTAP',
  'precio', 800.00::numeric,
  'itbis_tasa', 18.00::numeric,
  'inventariable', true,
  'cantidad', 10.00::numeric,
  'costo', 500.00::numeric
));

insert into _ids (clave, id)
select 'asiento', a.id
from public.asientos a
where a.producto_id = (select id from _ids where clave = 'producto')
  and a.origen_tipo = 'inventario_inicial';

select is(
  (select count(*)::int
   from public.asientos a
   where a.producto_id = (select id from _ids where clave = 'producto')
     and a.origen_tipo = 'inventario_inicial'),
  1,
  'crear un producto inventariable con cantidad genera un asiento de inventario inicial'
);

select is(
  (select a.producto_id from public.asientos a where a.id = (select id from _ids where clave = 'asiento')),
  (select id from _ids where clave = 'producto'),
  'el asiento queda ligado al producto'
);

select is(
  (select a.fecha from public.asientos a where a.id = (select id from _ids where clave = 'asiento')),
  current_date,
  'el asiento usa la fecha de la carga'
);

select is(
  (select a.total from public.asientos a where a.id = (select id from _ids where clave = 'asiento')),
  5000.00::numeric(14,2),
  'el asiento suma 10 × 500 = 5,000.00'
);

select is(
  (select coalesce(sum(l.debito), 0)
   from public.asiento_lineas l
   join public.config_contable cc on cc.cuenta_id = l.cuenta_id and cc.clave = 'inventario'
   where l.asiento_id = (select id from _ids where clave = 'asiento')),
  5000.00::numeric(14,2),
  'debita 5,000.00 en la cuenta de inventario'
);

select is(
  (select coalesce(sum(l.credito), 0)
   from public.asiento_lineas l
   join public.config_contable cc on cc.cuenta_id = l.cuenta_id and cc.clave = 'ajustes_iniciales_inventario'
   where l.asiento_id = (select id from _ids where clave = 'asiento')),
  5000.00::numeric(14,2),
  'acredita 5,000.00 en Ajustes iniciales en inventario'
);

select is(
  (select coalesce(sum(l.debito) - sum(l.credito), 0)
   from public.asiento_lineas l
   where l.asiento_id = (select id from _ids where clave = 'asiento')),
  0.00::numeric(14,2),
  'el asiento de inventario inicial está cuadrado'
);

select is(
  (select e.cantidad_inicial
   from public.existencias e
   where e.producto_id = (select id from _ids where clave = 'producto')
     and e.almacen_id = (select a.id from public.almacenes a where a.es_principal)),
  10.00::numeric(14,2),
  'la existencia guarda la cantidad inicial 10'
);

select is(
  (select p.cantidad from public.productos p where p.id = (select id from _ids where clave = 'producto')),
  10.00::numeric(14,2),
  'la cantidad actual también queda en 10'
);

-- ---------------------------------------------------------------------------
-- Edición: cantidad 15 y costo 600 mutan el MISMO asiento a 9,000
-- ---------------------------------------------------------------------------

select public.actualizar_producto(
  (select id from _ids where clave = 'producto'),
  '{"cantidad":15,"costo":600}'::jsonb
);

select is(
  (select a.id
   from public.asientos a
   where a.producto_id = (select id from _ids where clave = 'producto')
     and a.origen_tipo = 'inventario_inicial'),
  (select id from _ids where clave = 'asiento'),
  'editar cantidad/costo conserva el mismo asiento (no crea otro)'
);

select is(
  (select a.total from public.asientos a where a.id = (select id from _ids where clave = 'asiento')),
  9000.00::numeric(14,2),
  'el asiento vivo se muta a 15 × 600 = 9,000.00'
);

select is(
  (select coalesce(sum(l.debito), 0)
   from public.asiento_lineas l
   join public.config_contable cc on cc.cuenta_id = l.cuenta_id and cc.clave = 'inventario'
   where l.asiento_id = (select id from _ids where clave = 'asiento')),
  9000.00::numeric(14,2),
  'la línea de inventario sube a 9,000.00'
);

select is(
  (select coalesce(sum(l.credito), 0)
   from public.asiento_lineas l
   join public.config_contable cc on cc.cuenta_id = l.cuenta_id and cc.clave = 'ajustes_iniciales_inventario'
   where l.asiento_id = (select id from _ids where clave = 'asiento')),
  9000.00::numeric(14,2),
  'la contrapartida sube a 9,000.00'
);

select is(
  (select a.fecha from public.asientos a where a.id = (select id from _ids where clave = 'asiento')),
  current_date,
  'la mutación conserva la fecha original del asiento'
);

select is(
  (select e.cantidad_inicial
   from public.existencias e
   where e.producto_id = (select id from _ids where clave = 'producto')
     and e.almacen_id = (select a.id from public.almacenes a where a.es_principal)),
  15.00::numeric(14,2),
  'editar la cantidad corrige existencias.cantidad_inicial a 15'
);

select is(
  (select p.costo from public.productos p where p.id = (select id from _ids where clave = 'producto')),
  600.00::numeric(14,2),
  'el costo vigente del producto queda en 600'
);

select is(
  (select count(*)::int
   from public.asientos a
   where a.producto_id = (select id from _ids where clave = 'producto')
     and a.origen_tipo = 'inventario_inicial'),
  1,
  'sigue existiendo un solo asiento de inventario inicial'
);

-- ---------------------------------------------------------------------------
-- Sin asiento: producto sin cantidad, servicio y producto insertado por SQL
-- ---------------------------------------------------------------------------

insert into _ids (clave, id)
select 'sin_cantidad', public.crear_producto(jsonb_build_object(
  'tipo', 'producto',
  'nombre', 'Sin cantidad inicial pgTAP',
  'precio', 100.00::numeric,
  'itbis_tasa', 18.00::numeric,
  'inventariable', true,
  'costo', 50.00::numeric
));

select ok(
  not exists (
    select 1 from public.asientos a
    where a.producto_id = (select id from _ids where clave = 'sin_cantidad')
  ),
  'un producto inventariable sin cantidad inicial no genera asiento'
);

insert into _ids (clave, id)
select 'servicio', public.crear_producto(jsonb_build_object(
  'tipo', 'servicio',
  'nombre', 'Servicio sin inventario pgTAP',
  'precio', 200.00::numeric,
  'itbis_tasa', 18.00::numeric,
  'cantidad', 5.00::numeric,
  'costo', 100.00::numeric
));

select ok(
  not exists (
    select 1 from public.asientos a
    where a.producto_id = (select id from _ids where clave = 'servicio')
  ),
  'un servicio no genera asiento de inventario inicial'
);

-- Producto cargado por SQL directo (como los que ya existían antes de esta
-- migración): al editarlo no se crea asiento retroactivo.
reset role;

with nuevo as (
  insert into public.productos (
    tipo, nombre, precio, itbis_tasa, inventariable, cantidad, costo, almacen_id, unidad_medida
  )
  values (
    'producto', 'Producto directo pgTAP', 300.00, 18.00, true, 5.00, 100.00,
    (select a.id from public.almacenes a where a.es_principal), 'Unidad'
  )
  returning id
)
insert into _ids (clave, id)
select 'directo', n.id from nuevo n;

insert into public.existencias (producto_id, almacen_id, cantidad, cantidad_inicial)
select (select id from _ids where clave = 'directo'),
       (select a.id from public.almacenes a where a.es_principal),
       5.00, 5.00;

set local role authenticated;
set local request.jwt.claims = '{"sub":"11111111-1111-1111-1111-111111111111","role":"authenticated"}';

select public.actualizar_producto(
  (select id from _ids where clave = 'directo'),
  '{"cantidad":6}'::jsonb
);

select ok(
  not exists (
    select 1 from public.asientos a
    where a.producto_id = (select id from _ids where clave = 'directo')
  ),
  'editar un producto sin asiento previo no crea asiento retroactivo'
);

select is(
  (select e.cantidad_inicial
   from public.existencias e
   where e.producto_id = (select id from _ids where clave = 'directo')
     and e.almacen_id = (select a.id from public.almacenes a where a.es_principal)),
  6.00::numeric(14,2),
  'la cantidad inicial del producto directo también acompaña al delta'
);

-- ---------------------------------------------------------------------------
-- Cantidad inicial en cero: reversa del asiento vivo
-- ---------------------------------------------------------------------------

select public.actualizar_producto(
  (select id from _ids where clave = 'producto'),
  '{"cantidad":0}'::jsonb
);

select ok(
  exists (
    select 1
    from public.asientos r
    where r.origen_tipo = 'anulacion'
      and r.anula_asiento_id = (select id from _ids where clave = 'asiento')
  ),
  'llevar la cantidad inicial a cero crea el asiento de reversa'
);

select is(
  (select a.total from public.asientos a where a.id = (select id from _ids where clave = 'asiento')),
  9000.00::numeric(14,2),
  'el asiento vivo conserva el monto original (no se muta a cero)'
);

select is(
  (select a.total
   from public.asientos a
   where a.anula_asiento_id = (select id from _ids where clave = 'asiento')),
  9000.00::numeric(14,2),
  'la reversa revierte el monto completo de 9,000.00'
);

select is(
  (select coalesce(sum(l.debito), 0)
   from public.asiento_lineas l
   join public.asientos a on a.id = l.asiento_id
   join public.config_contable cc on cc.cuenta_id = l.cuenta_id and cc.clave = 'ajustes_iniciales_inventario'
   where a.anula_asiento_id = (select id from _ids where clave = 'asiento')),
  9000.00::numeric(14,2),
  'la reversa debita Ajustes iniciales en inventario por 9,000.00'
);

select is(
  (select e.cantidad_inicial
   from public.existencias e
   where e.producto_id = (select id from _ids where clave = 'producto')
     and e.almacen_id = (select a.id from public.almacenes a where a.es_principal)),
  0.00::numeric(14,2),
  'la cantidad inicial vuelve a cero'
);

-- ---------------------------------------------------------------------------
-- Permisos: lector y anon no escriben; la función interna no se expone
-- ---------------------------------------------------------------------------

set local request.jwt.claims = '{"sub":"33333333-3333-3333-3333-333333333333","role":"authenticated"}';

select throws_ok(
  $q$select public.crear_producto('{"tipo":"producto","nombre":"No permitido pgTAP"}'::jsonb)$q$,
  '42501',
  'sin permiso',
  'el rol lector no puede crear productos'
);

select ok(
  not has_function_privilege('anon', 'public.crear_producto(jsonb)', 'execute'),
  'anon no puede ejecutar crear_producto'
);

select ok(
  not has_function_privilege('authenticated', 'public._crear_producto_con_impuestos(jsonb)', 'execute'),
  'authenticated no puede ejecutar el wrapper interno de impuestos'
);

select * from finish();
rollback;
