begin;
select * from no_plan();

create temp table _ids (clave text primary key, id uuid) on commit drop;
grant select, insert, update, delete on _ids to authenticated;

insert into auth.users (id, email) values
  ('11111111-1111-1111-1111-111111111111', 'admin-kardex@prueba.local'),
  ('33333333-3333-3333-3333-333333333333', 'lector-kardex@prueba.local');
insert into public.perfiles (user_id, nombre, rol) values
  ('11111111-1111-1111-1111-111111111111', 'Admin Kardex', 'admin'),
  ('33333333-3333-3333-3333-333333333333', 'Lector Kardex', 'lector');

set local role authenticated;
set local request.jwt.claims = '{"sub":"11111111-1111-1111-1111-111111111111","role":"authenticated"}';

insert into _ids (clave, id)
select 'almacen', a.id from public.almacenes a where a.es_principal limit 1;

insert into _ids (clave, id)
select 'cliente', public.crear_contacto(jsonb_build_object(
  'tipo', 'cliente', 'nombre', 'Cliente Kardex Recosteo'
));

insert into _ids (clave, id)
select 'proveedor', public.crear_contacto(jsonb_build_object(
  'tipo', 'proveedor', 'nombre', 'Proveedor Kardex Recosteo'
));

-- ---------------------------------------------------------------------------
-- 1. Cemento clásico: -10 a 500, compra 20 a 520, venta final exacta
-- ---------------------------------------------------------------------------

insert into _ids (clave, id)
select 'cemento', public.crear_producto(jsonb_build_object(
  'tipo', 'producto', 'nombre', 'Cemento Kardex', 'referencia', 'KARDEX-CEM',
  'precio', 1000, 'inventariable', true, 'vende_negativo', true,
  'cantidad', 0, 'costo', 500
));

insert into _ids (clave, id)
select 'venta_cemento_1', public.crear_factura(jsonb_build_object(
  'tipo_comprobante', '02',
  'contacto_id', (select id from _ids where clave = 'cliente'),
  'fecha', '2026-11-26',
  'almacen_id', (select id from _ids where clave = 'almacen'),
  'lineas', jsonb_build_array(jsonb_build_object(
    'producto_id', (select id from _ids where clave = 'cemento'),
    'cantidad', 10, 'precio', 1000
  ))
));

insert into _ids (clave, id)
select 'compra_cemento', public.crear_factura_proveedor(jsonb_build_object(
  'contacto_id', (select id from _ids where clave = 'proveedor'),
  'fecha', '2026-11-26',
  'almacen_id', (select id from _ids where clave = 'almacen'),
  'lineas', jsonb_build_array(jsonb_build_object(
    'producto_id', (select id from _ids where clave = 'cemento'),
    'cantidad', 20, 'costo', 520
  ))
));

select is(
  (select cantidad from public.productos where id = (select id from _ids where clave = 'cemento')),
  10.00::numeric,
  'cemento: la compra deja 10 unidades'
);

select is(
  (select costo from public.productos where id = (select id from _ids where clave = 'cemento')),
  520.00::numeric,
  'cemento: el costo visible queda en 520.00'
);

select is(
  (select valor_inventario from public.productos where id = (select id from _ids where clave = 'cemento')),
  5200.00::numeric,
  'cemento: valor_inventario queda en 5200.00'
);

select is(
  (select coalesce(sum(al.debito), 0)
   from public.asientos a
   join public.asiento_lineas al on al.asiento_id = a.id
   join public.cuentas c on c.id = al.cuenta_id
   where a.origen_tipo = 'recosteo_inventario'
     and a.origen_id = (select id from _ids where clave = 'compra_cemento')
     and c.codigo = '5101'),
  200.00::numeric,
  'cemento: recosteo visible Dr 5101 por 200.00'
);

select is(
  (select coalesce(sum(al.credito), 0)
   from public.asientos a
   join public.asiento_lineas al on al.asiento_id = a.id
   join public.cuentas c on c.id = al.cuenta_id
   where a.origen_tipo = 'recosteo_inventario'
     and a.origen_id = (select id from _ids where clave = 'compra_cemento')
     and c.codigo = '1104'),
  200.00::numeric,
  'cemento: recosteo visible Cr 1104 por 200.00'
);

select is(
  (select valor_movimiento
   from public.movimientos_inventario
   where origen_tipo = 'recosteo_inventario'
     and origen_id = (select id from _ids where clave = 'compra_cemento')
     and producto_id = (select id from _ids where clave = 'cemento')),
  -200.00::numeric,
  'cemento: el Kardex guarda la fila de recosteo'
);

insert into _ids (clave, id)
select 'venta_cemento_2', public.crear_factura(jsonb_build_object(
  'tipo_comprobante', '02',
  'contacto_id', (select id from _ids where clave = 'cliente'),
  'fecha', '2026-11-26',
  'almacen_id', (select id from _ids where clave = 'almacen'),
  'lineas', jsonb_build_array(jsonb_build_object(
    'producto_id', (select id from _ids where clave = 'cemento'),
    'cantidad', 10, 'precio', 1000
  ))
));

select is(
  (select cantidad from public.productos where id = (select id from _ids where clave = 'cemento')),
  0.00::numeric,
  'cemento: la venta final agota exactamente el stock'
);

select is(
  (select valor_inventario from public.productos where id = (select id from _ids where clave = 'cemento')),
  0.00::numeric,
  'cemento: valor_inventario termina en 0.00 sin residuo'
);

select is(
  (select coalesce(sum(al.debito - al.credito), 0)
   from public.asiento_lineas al
   join public.cuentas c on c.id = al.cuenta_id
   where c.codigo = '1104'),
  0.00::numeric,
  'cemento: Mayor 1104 termina en 0.00'
);

select is(
  (select coalesce(sum(al.debito - al.credito), 0)
   from public.asiento_lineas al
   join public.cuentas c on c.id = al.cuenta_id
   where c.codigo = '5101'),
  10400.00::numeric,
  'cemento: costo de ventas total exacto 10400.00'
);

-- ---------------------------------------------------------------------------
-- 2. Compra más barata: el recosteo baja COGS y sube inventario
-- ---------------------------------------------------------------------------

insert into _ids (clave, id)
select 'barato', public.crear_producto(jsonb_build_object(
  'tipo', 'producto', 'nombre', 'Producto compra barata', 'referencia', 'KARDEX-BAR',
  'precio', 900, 'inventariable', true, 'vende_negativo', true,
  'cantidad', 0, 'costo', 500
));

insert into _ids (clave, id)
select 'venta_barato', public.crear_factura(jsonb_build_object(
  'tipo_comprobante', '02',
  'contacto_id', (select id from _ids where clave = 'cliente'),
  'fecha', '2026-11-26',
  'almacen_id', (select id from _ids where clave = 'almacen'),
  'lineas', jsonb_build_array(jsonb_build_object(
    'producto_id', (select id from _ids where clave = 'barato'),
    'cantidad', 10, 'precio', 900
  ))
));

insert into _ids (clave, id)
select 'compra_barato', public.crear_factura_proveedor(jsonb_build_object(
  'contacto_id', (select id from _ids where clave = 'proveedor'),
  'fecha', '2026-11-26',
  'almacen_id', (select id from _ids where clave = 'almacen'),
  'lineas', jsonb_build_array(jsonb_build_object(
    'producto_id', (select id from _ids where clave = 'barato'),
    'cantidad', 20, 'costo', 480
  ))
));

select is(
  (select valor_inventario from public.productos where id = (select id from _ids where clave = 'barato')),
  4800.00::numeric,
  'compra barata: valor_inventario queda en 4800.00'
);

select is(
  (select coalesce(sum(al.debito), 0)
   from public.asientos a
   join public.asiento_lineas al on al.asiento_id = a.id
   join public.cuentas c on c.id = al.cuenta_id
   where a.origen_tipo = 'recosteo_inventario'
     and a.origen_id = (select id from _ids where clave = 'compra_barato')
     and c.codigo = '1104'),
  200.00::numeric,
  'compra barata: recosteo visible Dr 1104 por 200.00'
);

select is(
  (select coalesce(sum(al.credito), 0)
   from public.asientos a
   join public.asiento_lineas al on al.asiento_id = a.id
   join public.cuentas c on c.id = al.cuenta_id
   where a.origen_tipo = 'recosteo_inventario'
     and a.origen_id = (select id from _ids where clave = 'compra_barato')
     and c.codigo = '5101'),
  200.00::numeric,
  'compra barata: recosteo visible Cr 5101 por 200.00'
);

select is(
  (select coalesce(sum(al.debito - al.credito), 0)
   from public.asiento_lineas al
   join public.cuentas c on c.id = al.cuenta_id
   where c.codigo = '1104'),
  4800.00::numeric,
  'compra barata: Mayor 1104 cuadra con el Kardex'
);

select is(
  (select coalesce(sum(valor_inventario), 0) from public.productos where inventariable),
  4800.00::numeric,
  'compra barata: suma de valor_inventario cuadra con el Mayor'
);

-- ---------------------------------------------------------------------------
-- 3. Compra parcial que sigue negativa y segunda compra que cruza a positivo
-- ---------------------------------------------------------------------------

insert into _ids (clave, id)
select 'parcial', public.crear_producto(jsonb_build_object(
  'tipo', 'producto', 'nombre', 'Producto compras parciales', 'referencia', 'KARDEX-PAR',
  'precio', 900, 'inventariable', true, 'vende_negativo', true,
  'cantidad', 0, 'costo', 500
));

insert into _ids (clave, id)
select 'venta_parcial', public.crear_factura(jsonb_build_object(
  'tipo_comprobante', '02',
  'contacto_id', (select id from _ids where clave = 'cliente'),
  'fecha', '2026-11-26',
  'almacen_id', (select id from _ids where clave = 'almacen'),
  'lineas', jsonb_build_array(jsonb_build_object(
    'producto_id', (select id from _ids where clave = 'parcial'),
    'cantidad', 10, 'precio', 900
  ))
));

insert into _ids (clave, id)
select 'compra_parcial_1', public.crear_factura_proveedor(jsonb_build_object(
  'contacto_id', (select id from _ids where clave = 'proveedor'),
  'fecha', '2026-11-26',
  'almacen_id', (select id from _ids where clave = 'almacen'),
  'lineas', jsonb_build_array(jsonb_build_object(
    'producto_id', (select id from _ids where clave = 'parcial'),
    'cantidad', 6, 'costo', 520
  ))
));

select is(
  (select cantidad from public.productos where id = (select id from _ids where clave = 'parcial')),
  -4.00::numeric,
  'compra parcial: queda stock -4'
);

select is(
  (select valor_inventario from public.productos where id = (select id from _ids where clave = 'parcial')),
  -2000.00::numeric,
  'compra parcial: valor_inventario queda en -2000.00'
);

select is(
  (select coalesce(sum(al.debito), 0)
   from public.asientos a
   join public.asiento_lineas al on al.asiento_id = a.id
   join public.cuentas c on c.id = al.cuenta_id
   where a.origen_tipo = 'recosteo_inventario'
     and a.origen_id = (select id from _ids where clave = 'compra_parcial_1')
     and c.codigo = '5101'),
  120.00::numeric,
  'compra parcial 1: recosteo por 120.00'
);

insert into _ids (clave, id)
select 'compra_parcial_2', public.crear_factura_proveedor(jsonb_build_object(
  'contacto_id', (select id from _ids where clave = 'proveedor'),
  'fecha', '2026-11-26',
  'almacen_id', (select id from _ids where clave = 'almacen'),
  'lineas', jsonb_build_array(jsonb_build_object(
    'producto_id', (select id from _ids where clave = 'parcial'),
    'cantidad', 10, 'costo', 530
  ))
));

select is(
  (select cantidad from public.productos where id = (select id from _ids where clave = 'parcial')),
  6.00::numeric,
  'compra parcial 2: queda stock +6'
);

select is(
  (select valor_inventario from public.productos where id = (select id from _ids where clave = 'parcial')),
  3180.00::numeric,
  'compra parcial 2: valor_inventario = 6 x 530'
);

select is(
  (select costo from public.productos where id = (select id from _ids where clave = 'parcial')),
  530.00::numeric,
  'compra parcial 2: costo final 530.00'
);

select is(
  (select coalesce(sum(al.debito), 0)
   from public.asientos a
   join public.asiento_lineas al on al.asiento_id = a.id
   join public.cuentas c on c.id = al.cuenta_id
   where a.origen_tipo = 'recosteo_inventario'
     and a.origen_id = (select id from _ids where clave = 'compra_parcial_2')
     and c.codigo = '5101'),
  120.00::numeric,
  'compra parcial 2: segundo recosteo por 120.00'
);

select is(
  (
    (select coalesce(sum(al.debito), 0)
     from public.facturas f
     join public.asiento_lineas al on al.asiento_id = f.asiento_id
     join public.cuentas c on c.id = al.cuenta_id
     where f.id = (select id from _ids where clave = 'venta_parcial')
       and c.codigo = '5101')
    +
    (select coalesce(sum(al.debito), 0)
     from public.asientos a
     join public.asiento_lineas al on al.asiento_id = a.id
     join public.cuentas c on c.id = al.cuenta_id
     where a.origen_tipo = 'recosteo_inventario'
       and a.origen_id in (
         (select id from _ids where clave = 'compra_parcial_1'),
         (select id from _ids where clave = 'compra_parcial_2')
       )
       and c.codigo = '5101')
  ),
  5240.00::numeric,
  'compra parcial: COGS total de las 10 unidades = 5240.00'
);

select is(
  (select coalesce(sum(al.debito - al.credito), 0)
   from public.asiento_lineas al
   join public.cuentas c on c.id = al.cuenta_id
   where c.codigo = '1104'),
  (select coalesce(sum(valor_inventario), 0) from public.productos where inventariable),
  'compras parciales: Mayor 1104 sigue igual a la suma del Kardex'
);

-- ---------------------------------------------------------------------------
-- 4. Producto con costo cero vendido en negativo
-- ---------------------------------------------------------------------------

insert into _ids (clave, id)
select 'cero', public.crear_producto(jsonb_build_object(
  'tipo', 'producto', 'nombre', 'Producto costo cero', 'referencia', 'KARDEX-CERO',
  'precio', 800, 'inventariable', true, 'vende_negativo', true,
  'cantidad', 0, 'costo', 0
));

insert into _ids (clave, id)
select 'venta_cero', public.crear_factura(jsonb_build_object(
  'tipo_comprobante', '02',
  'contacto_id', (select id from _ids where clave = 'cliente'),
  'fecha', '2026-11-26',
  'almacen_id', (select id from _ids where clave = 'almacen'),
  'lineas', jsonb_build_array(jsonb_build_object(
    'producto_id', (select id from _ids where clave = 'cero'),
    'cantidad', 10, 'precio', 800
  ))
));

select is(
  (select cantidad from public.productos where id = (select id from _ids where clave = 'cero')),
  -10.00::numeric,
  'costo cero: la venta en negativo es permitida'
);

select is(
  (select valor_inventario from public.productos where id = (select id from _ids where clave = 'cero')),
  0.00::numeric,
  'costo cero: la salida sale con valor 0.00'
);

insert into _ids (clave, id)
select 'compra_cero', public.crear_factura_proveedor(jsonb_build_object(
  'contacto_id', (select id from _ids where clave = 'proveedor'),
  'fecha', '2026-11-26',
  'almacen_id', (select id from _ids where clave = 'almacen'),
  'lineas', jsonb_build_array(jsonb_build_object(
    'producto_id', (select id from _ids where clave = 'cero'),
    'cantidad', 20, 'costo', 520
  ))
));

select is(
  (select coalesce(sum(al.debito), 0)
   from public.asientos a
   join public.asiento_lineas al on al.asiento_id = a.id
   join public.cuentas c on c.id = al.cuenta_id
   where a.origen_tipo = 'recosteo_inventario'
     and a.origen_id = (select id from _ids where clave = 'compra_cero')
     and c.codigo = '5101'),
  5200.00::numeric,
  'costo cero: la compra recostea el 100% en 5200.00'
);

select is(
  (select valor_inventario from public.productos where id = (select id from _ids where clave = 'cero')),
  5200.00::numeric,
  'costo cero: el inventario final vale 5200.00'
);

select is(
  (select costo from public.productos where id = (select id from _ids where clave = 'cero')),
  520.00::numeric,
  'costo cero: el costo final es 520.00'
);

select public.anular_documento(
  'factura',
  (select id from _ids where clave = 'venta_cero')
);

select is(
  (select cantidad from public.productos where id = (select id from _ids where clave = 'cero')),
  20.00::numeric,
  'costo cero: anular la venta reingresa las 10 unidades'
);

select is(
  (select valor_inventario from public.productos where id = (select id from _ids where clave = 'cero')),
  5200.00::numeric,
  'costo cero: la anulación reingresa al costo exacto original 0.00 sin contaminar el valor'
);

-- ---------------------------------------------------------------------------
-- 5. Ajuste de entrada sobre stock negativo no contamina el promedio
-- ---------------------------------------------------------------------------

insert into _ids (clave, id)
select 'ajustado', public.crear_producto(jsonb_build_object(
  'tipo', 'producto', 'nombre', 'Producto ajuste negativo', 'referencia', 'KARDEX-AJU',
  'precio', 1000, 'inventariable', true, 'vende_negativo', true,
  'cantidad', 0, 'costo', 500
));

insert into _ids (clave, id)
select 'venta_ajustado', public.crear_factura(jsonb_build_object(
  'tipo_comprobante', '02',
  'contacto_id', (select id from _ids where clave = 'cliente'),
  'fecha', '2026-11-26',
  'almacen_id', (select id from _ids where clave = 'almacen'),
  'lineas', jsonb_build_array(jsonb_build_object(
    'producto_id', (select id from _ids where clave = 'ajustado'),
    'cantidad', 43.7, 'precio', 1000
  ))
));

select is(
  (select valor_inventario from public.productos where id = (select id from _ids where clave = 'ajustado')),
  -21850.00::numeric,
  'ajuste negativo: la venta deja valor -21850.00'
);

insert into _ids (clave, id)
select 'ajuste_entrada', public.crear_ajuste_inventario(jsonb_build_object(
  'fecha', '2026-11-26',
  'almacen_id', (select id from _ids where clave = 'almacen'),
  'lineas', jsonb_build_array(jsonb_build_object(
    'producto_id', (select id from _ids where clave = 'ajustado'),
    'tipo', 'entrada', 'cantidad', 200, 'costo_unitario', 520
  ))
));

select is(
  (select costo from public.productos where id = (select id from _ids where clave = 'ajustado')),
  520.00::numeric,
  'ajuste negativo: el costo queda en 520.00, no contaminado'
);

select isnt(
  (select costo from public.productos where id = (select id from _ids where clave = 'ajustado')),
  525.59::numeric,
  'ajuste negativo: el promedio no es 525.59'
);

select is(
  (select cantidad from public.productos where id = (select id from _ids where clave = 'ajustado')),
  156.30::numeric,
  'ajuste negativo: queda cantidad 156.30'
);

select is(
  (select valor_inventario from public.productos where id = (select id from _ids where clave = 'ajustado')),
  81276.00::numeric,
  'ajuste negativo: valor_inventario exacto 81276.00'
);

select is(
  (select coalesce(sum(al.debito), 0)
   from public.asientos a
   join public.asiento_lineas al on al.asiento_id = a.id
   join public.cuentas c on c.id = al.cuenta_id
   where a.origen_tipo = 'recosteo_inventario'
     and a.origen_id = (select id from _ids where clave = 'ajuste_entrada')
     and c.codigo = '5101'),
  874.00::numeric,
  'ajuste negativo: recosteo visible por 874.00'
);

-- ---------------------------------------------------------------------------
-- 6. Alto volumen con promedio periódico: agotar sin centavos fantasma
-- ---------------------------------------------------------------------------

insert into _ids (clave, id)
select 'arena', public.crear_producto(jsonb_build_object(
  'tipo', 'producto', 'nombre', 'Arena alto volumen', 'referencia', 'KARDEX-ARE',
  'precio', 180, 'inventariable', true, 'vende_negativo', true,
  'cantidad', 0, 'costo', 0
));

insert into _ids (clave, id)
select 'compra_arena_1', public.crear_factura_proveedor(jsonb_build_object(
  'contacto_id', (select id from _ids where clave = 'proveedor'),
  'fecha', '2026-11-26',
  'almacen_id', (select id from _ids where clave = 'almacen'),
  'lineas', jsonb_build_array(jsonb_build_object(
    'producto_id', (select id from _ids where clave = 'arena'),
    'cantidad', 1000, 'costo', 100
  ))
));

insert into _ids (clave, id)
select 'compra_arena_2', public.crear_factura_proveedor(jsonb_build_object(
  'contacto_id', (select id from _ids where clave = 'proveedor'),
  'fecha', '2026-11-26',
  'almacen_id', (select id from _ids where clave = 'almacen'),
  'lineas', jsonb_build_array(jsonb_build_object(
    'producto_id', (select id from _ids where clave = 'arena'),
    'cantidad', 1000, 'costo', 100
  ))
));

insert into _ids (clave, id)
select 'compra_arena_3', public.crear_factura_proveedor(jsonb_build_object(
  'contacto_id', (select id from _ids where clave = 'proveedor'),
  'fecha', '2026-11-26',
  'almacen_id', (select id from _ids where clave = 'almacen'),
  'lineas', jsonb_build_array(jsonb_build_object(
    'producto_id', (select id from _ids where clave = 'arena'),
    'cantidad', 1000, 'costo', 100.01
  ))
));

select ok(
  (select costo_promedio from public.productos where id = (select id from _ids where clave = 'arena')) <> 100.00,
  'alto volumen: el promedio interno conserva decimales periódicos'
);

insert into _ids (clave, id)
select 'venta_arena_1', public.crear_factura(jsonb_build_object(
  'tipo_comprobante', '02',
  'contacto_id', (select id from _ids where clave = 'cliente'),
  'fecha', '2026-11-26',
  'almacen_id', (select id from _ids where clave = 'almacen'),
  'lineas', jsonb_build_array(jsonb_build_object(
    'producto_id', (select id from _ids where clave = 'arena'),
    'cantidad', 1000, 'precio', 180
  ))
));

insert into _ids (clave, id)
select 'venta_arena_2', public.crear_factura(jsonb_build_object(
  'tipo_comprobante', '02',
  'contacto_id', (select id from _ids where clave = 'cliente'),
  'fecha', '2026-11-26',
  'almacen_id', (select id from _ids where clave = 'almacen'),
  'lineas', jsonb_build_array(jsonb_build_object(
    'producto_id', (select id from _ids where clave = 'arena'),
    'cantidad', 1000, 'precio', 180
  ))
));

insert into _ids (clave, id)
select 'venta_arena_3', public.crear_factura(jsonb_build_object(
  'tipo_comprobante', '02',
  'contacto_id', (select id from _ids where clave = 'cliente'),
  'fecha', '2026-11-26',
  'almacen_id', (select id from _ids where clave = 'almacen'),
  'lineas', jsonb_build_array(jsonb_build_object(
    'producto_id', (select id from _ids where clave = 'arena'),
    'cantidad', 1000, 'precio', 180
  ))
));

select is(
  (select cantidad from public.productos where id = (select id from _ids where clave = 'arena')),
  0.00::numeric,
  'alto volumen: la cantidad termina exactamente en cero'
);

select is(
  (select valor_inventario from public.productos where id = (select id from _ids where clave = 'arena')),
  0.00::numeric,
  'alto volumen: no queda ningún centavo fantasma en valor_inventario'
);

select is(
  (select (public.reporte_salud_inventario('2026-11-26')->>'diferencia')::numeric),
  0.00::numeric,
  'alto volumen: salud inventario reporta diferencia 0.00'
);

-- ---------------------------------------------------------------------------
-- 7. Anular venta después del cambio de costo y reingresar una NC de venta
-- ---------------------------------------------------------------------------

insert into _ids (clave, id)
select 'anulado', public.crear_producto(jsonb_build_object(
  'tipo', 'producto', 'nombre', 'Producto anulación y NC', 'referencia', 'KARDEX-ANU',
  'precio', 1000, 'inventariable', true, 'vende_negativo', true,
  'cantidad', 0, 'costo', 500
));

insert into _ids (clave, id)
select 'venta_anulada', public.crear_factura(jsonb_build_object(
  'tipo_comprobante', '02',
  'contacto_id', (select id from _ids where clave = 'cliente'),
  'fecha', '2026-11-26',
  'almacen_id', (select id from _ids where clave = 'almacen'),
  'lineas', jsonb_build_array(jsonb_build_object(
    'producto_id', (select id from _ids where clave = 'anulado'),
    'cantidad', 10, 'precio', 1000
  ))
));

insert into _ids (clave, id)
select 'compra_anulado', public.crear_factura_proveedor(jsonb_build_object(
  'contacto_id', (select id from _ids where clave = 'proveedor'),
  'fecha', '2026-11-26',
  'almacen_id', (select id from _ids where clave = 'almacen'),
  'lineas', jsonb_build_array(jsonb_build_object(
    'producto_id', (select id from _ids where clave = 'anulado'),
    'cantidad', 20, 'costo', 520
  ))
));

insert into _ids (clave, id)
select 'venta_nc_base', public.crear_factura(jsonb_build_object(
  'tipo_comprobante', '02',
  'contacto_id', (select id from _ids where clave = 'cliente'),
  'fecha', '2026-11-26',
  'almacen_id', (select id from _ids where clave = 'almacen'),
  'lineas', jsonb_build_array(jsonb_build_object(
    'producto_id', (select id from _ids where clave = 'anulado'),
    'cantidad', 5, 'precio', 1000
  ))
));

select is(
  (select valor_inventario from public.productos where id = (select id from _ids where clave = 'anulado')),
  2600.00::numeric,
  'anulación/NC: antes de anular quedan 5 x 520'
);

select public.anular_documento(
  'factura',
  (select id from _ids where clave = 'venta_anulada')
);

select is(
  (select cantidad from public.productos where id = (select id from _ids where clave = 'anulado')),
  15.00::numeric,
  'anulación/NC: anular la venta reingresa 10 unidades'
);

select is(
  (select valor_inventario from public.productos where id = (select id from _ids where clave = 'anulado')),
  7600.00::numeric,
  'anulación/NC: el reingreso usa el valor exacto original'
);

insert into _ids (clave, id)
select 'nc_venta', public.crear_nota_credito_venta(jsonb_build_object(
  'factura_id', (select id from _ids where clave = 'venta_nc_base'),
  'tipo_comprobante', '04',
  'fecha', '2026-11-26',
  'almacen_id', (select id from _ids where clave = 'almacen'),
  'devuelve_inventario', true,
  'permite_saldo_a_favor', true,
  'lineas', jsonb_build_array(jsonb_build_object(
    'factura_linea_id', (select fl.id from public.factura_lineas fl where fl.factura_id = (select id from _ids where clave = 'venta_nc_base') limit 1),
    'cantidad', 5
  ))
));

select is(
  (select cantidad from public.productos where id = (select id from _ids where clave = 'anulado')),
  20.00::numeric,
  'anulación/NC: la nota de crédito reingresa las 5 unidades'
);

select is(
  (select valor_inventario from public.productos where id = (select id from _ids where clave = 'anulado')),
  10133.33::numeric,
  'anulación/NC: el valor reingresado por la NC cuadra al centavo'
);

select is(
  (select coalesce(sum(al.debito - al.credito), 0)
   from public.asiento_lineas al
   join public.cuentas c on c.id = al.cuenta_id
   where c.codigo = '1104'),
  (select coalesce(sum(valor_inventario), 0) from public.productos where inventariable),
  'anulación/NC: Mayor 1104 sigue igual a valor_inventario'
);

-- ---------------------------------------------------------------------------
-- 8. Inventario inicial visible en Kardex
-- ---------------------------------------------------------------------------

insert into _ids (clave, id)
select 'inicial', public.crear_producto(jsonb_build_object(
  'tipo', 'producto', 'nombre', 'Producto inventario inicial', 'referencia', 'KARDEX-INI',
  'precio', 300, 'inventariable', true,
  'cantidad', 2, 'costo', 100
));

select is(
  (select count(*)
   from public.movimientos_inventario
   where producto_id = (select id from _ids where clave = 'inicial')
     and origen_tipo = 'inventario_inicial'
     and tipo = 'entrada'),
  1::bigint,
  'inventario inicial: registra una entrada en el Kardex'
);

select is(
  (select valor_movimiento
   from public.movimientos_inventario
   where producto_id = (select id from _ids where clave = 'inicial')
     and origen_tipo = 'inventario_inicial'),
  200.00::numeric,
  'inventario inicial: el valor del movimiento es 200.00'
);

select is(
  (select valor_inventario from public.productos where id = (select id from _ids where clave = 'inicial')),
  200.00::numeric,
  'inventario inicial: valor_inventario arranca en 200.00'
);

-- ---------------------------------------------------------------------------
-- 8B. Transferencia por almacén en Kardex (sin cambiar valor global)
-- ---------------------------------------------------------------------------

insert into _ids (clave, id)
select 'almacen_secundario', public.crear_almacen(jsonb_build_object(
  'nombre', 'Bodega Kardex Secundaria'
));

insert into _ids (clave, id)
select 'transferencia', public.crear_transferencia_inventario(jsonb_build_object(
  'fecha', '2026-11-26',
  'origen_id', (select id from _ids where clave = 'almacen'),
  'destino_id', (select id from _ids where clave = 'almacen_secundario'),
  'lineas', jsonb_build_array(jsonb_build_object(
    'producto_id', (select id from _ids where clave = 'inicial'),
    'cantidad', 1
  ))
));

select is(
  (select count(*)
   from public.movimientos_inventario
   where origen_tipo = 'transferencia_inventario'
     and origen_id = (select id from _ids where clave = 'transferencia')),
  2::bigint,
  'transferencia: registra salida y entrada en el Kardex'
);

select is(
  (select coalesce(sum(valor_movimiento), 0)
   from public.movimientos_inventario
   where origen_tipo = 'transferencia_inventario'
     and origen_id = (select id from _ids where clave = 'transferencia')),
  0.00::numeric,
  'transferencia: no altera el valor global del inventario'
);

select is(
  (select cantidad
   from public.movimientos_inventario
   where origen_tipo = 'transferencia_inventario'
     and origen_id = (select id from _ids where clave = 'transferencia')
     and almacen_id = (select id from _ids where clave = 'almacen_secundario')),
  1.00::numeric,
  'transferencia: la entrada queda atribuida al almacén destino'
);

-- ---------------------------------------------------------------------------
-- 9. RPCs de lectura y salud
-- ---------------------------------------------------------------------------

select is(
  (select count(*)
   from public.reporte_kardex_producto((select id from _ids where clave = 'cemento'))),
  4::bigint,
  'reporte_kardex_producto devuelve los 4 movimientos del cemento'
);

select is(
  (select cantidad_despues
   from public.reporte_kardex_producto((select id from _ids where clave = 'cemento'))
   order by fecha desc, creado_en desc, id desc
   limit 1),
  0.00::numeric,
  'reporte_kardex_producto ordena cronológicamente hasta el agotamiento'
);

select is(
  (select valor_inventario
   from public.reporte_valor_inventario_corte('2026-11-26')
   where producto_id = (select id from _ids where clave = 'anulado')),
  10133.33::numeric,
  'reporte_valor_inventario_corte devuelve el valor exacto del producto'
);

select is(
  (select count(*)
   from public.reporte_recosteos('2026-11-01', '2026-11-30', (select id from _ids where clave = 'cemento'))),
  1::bigint,
  'reporte_recosteos encuentra el recosteo del cemento'
);

select is(
  (select delta_cogs
   from public.reporte_recosteos('2026-11-01', '2026-11-30', (select id from _ids where clave = 'cemento'))),
  200.00::numeric,
  'reporte_recosteos expone delta_cogs positivo 200.00'
);

select is(
  (select count(*)
   from public.reporte_valor_inventario_corte('2026-11-25')
   where producto_id = (select id from _ids where clave = 'inicial')),
  0::bigint,
  'reporte_valor_inventario_corte no incluye productos creados después del corte'
);

select is(
  (select (public.reporte_salud_inventario('2026-11-26')->>'diferencia')::numeric),
  0.00::numeric,
  'reporte_salud_inventario: diferencia global 0.00'
);

select ok(
  (select (public.reporte_salud_inventario('2026-11-26')->'recosteos_periodo'->>'total')::int) >= 5,
  'reporte_salud_inventario cuenta los recosteos del período'
);

select is(
  (select mi.asiento_id
   from public.movimientos_inventario mi
   where mi.origen_tipo = 'factura_proveedor'
     and mi.origen_id = (select id from _ids where clave = 'compra_cemento')
     and not mi.es_recosteo),
  (select asiento_id from public.facturas_proveedor where id = (select id from _ids where clave = 'compra_cemento')),
  'el movimiento de compra queda enlazado al asiento del documento'
);

select ok(
  (select mi.asiento_id
   from public.movimientos_inventario mi
   where mi.origen_tipo = 'recosteo_inventario'
     and mi.origen_id = (select id from _ids where clave = 'compra_cemento')
     and mi.es_recosteo)
  in (select a.id from public.asientos a where a.origen_tipo = 'recosteo_inventario'),
  'la fila de recosteo queda enlazada a su asiento visible'
);

-- ---------------------------------------------------------------------------
-- 10. RLS/privilegios del Kardex append-only
-- ---------------------------------------------------------------------------

select ok(
  has_table_privilege('authenticated', 'public.movimientos_inventario', 'SELECT'),
  'RLS Kardex: authenticated puede leer movimientos_inventario'
);

select ok(
  not has_table_privilege('authenticated', 'public.movimientos_inventario', 'INSERT')
  and not has_table_privilege('authenticated', 'public.movimientos_inventario', 'UPDATE')
  and not has_table_privilege('authenticated', 'public.movimientos_inventario', 'DELETE'),
  'RLS Kardex: authenticated no escribe directamente'
);

select ok(
  not has_table_privilege('anon', 'public.movimientos_inventario', 'SELECT')
  and not has_table_privilege('anon', 'public.movimientos_inventario', 'INSERT')
  and not has_table_privilege('anon', 'public.movimientos_inventario', 'UPDATE')
  and not has_table_privilege('anon', 'public.movimientos_inventario', 'DELETE'),
  'RLS Kardex: anon no lee ni escribe'
);

select throws_ok(
  $q$insert into public.movimientos_inventario (
    fecha, producto_id, tipo, origen_tipo, cantidad, cantidad_antes, cantidad_despues
  ) values (
    current_date,
    (select id from _ids where clave = 'cemento'),
    'entrada', 'manual', 1, 0, 1
  )$q$,
  '42501',
  null,
  'RLS Kardex: un INSERT directo de authenticated es rechazado'
);

select * from finish();
rollback;
