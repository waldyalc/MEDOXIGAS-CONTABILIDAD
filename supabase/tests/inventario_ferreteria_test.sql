begin;
select plan(48);

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

set local role authenticated;
set local request.jwt.claims = '{"sub":"11111111-1111-1111-1111-111111111111","role":"authenticated"}';

insert into _ids (clave, id)
select 'almacen', a.id from public.almacenes a where a.es_principal limit 1;

insert into _ids (clave, id)
select 'contacto', public.crear_contacto('{"tipo":"cliente","nombre":"Cliente pgTAP 1A"}'::jsonb);

insert into _ids (clave, id)
select 'proveedor', public.crear_contacto('{"tipo":"proveedor","nombre":"Proveedor pgTAP 1A"}'::jsonb);

-- ---------------------------------------------------------------------------
-- RLS de las tablas nuevas
-- ---------------------------------------------------------------------------

select ok(
  has_table_privilege('authenticated', 'public.producto_unidades', 'SELECT')
  and has_table_privilege('authenticated', 'public.producto_codigos_barra', 'SELECT')
  and has_table_privilege('authenticated', 'public.combo_componentes', 'SELECT')
  and has_table_privilege('authenticated', 'public.conteos_inventario', 'SELECT')
  and has_table_privilege('authenticated', 'public.conteo_inventario_lineas', 'SELECT'),
  'authenticated puede leer las tablas nuevas de inventario de ferretería'
);

select ok(
  not has_table_privilege('authenticated', 'public.producto_unidades', 'INSERT')
  and not has_table_privilege('authenticated', 'public.producto_codigos_barra', 'INSERT')
  and not has_table_privilege('authenticated', 'public.combo_componentes', 'INSERT')
  and not has_table_privilege('authenticated', 'public.conteos_inventario', 'INSERT')
  and not has_table_privilege('authenticated', 'public.conteos_inventario', 'UPDATE')
  and not has_table_privilege('authenticated', 'public.conteos_inventario', 'DELETE')
  and not has_table_privilege('authenticated', 'public.conteo_inventario_lineas', 'INSERT'),
  'authenticated no escribe directo en las tablas nuevas'
);

select ok(
  not has_table_privilege('anon', 'public.producto_unidades', 'SELECT')
  and not has_table_privilege('anon', 'public.producto_codigos_barra', 'SELECT')
  and not has_table_privilege('anon', 'public.combo_componentes', 'SELECT')
  and not has_table_privilege('anon', 'public.conteos_inventario', 'SELECT')
  and not has_table_privilege('anon', 'public.conteo_inventario_lineas', 'SELECT'),
  'anon no lee las tablas nuevas'
);

-- ---------------------------------------------------------------------------
-- Producto con marca, favorito, ubicación, unidad y código de barra
-- ---------------------------------------------------------------------------

insert into _ids (clave, id)
select 'producto_a', public.crear_producto(jsonb_build_object(
  'tipo', 'producto',
  'nombre', 'Cemento gris pgTAP 1A',
  'referencia', 'CEM-1A',
  'marca', 'Ferretería X',
  'favorito_pos', true,
  'ubicacion', 'Pasillo 1 / Estante A',
  'precio', 650,
  'itbis_tasa', 18,
  'inventariable', true,
  'cantidad', 10,
  'costo', 100,
  'unidades', jsonb_build_array(jsonb_build_object(
    'nombre', 'Caja 5',
    'factor_base', 5,
    'precio', 3200,
    'es_venta', true
  )),
  'codigos_barra', jsonb_build_array(jsonb_build_object(
    'codigo', '7501234567890',
    'principal', true
  ))
));

select is(
  (select marca from public.productos where id = (select id from _ids where clave = 'producto_a')),
  'Ferretería X',
  'crear_producto guarda la marca'
);

select is(
  (select favorito_pos from public.productos where id = (select id from _ids where clave = 'producto_a')),
  true,
  'crear_producto guarda favorito_pos'
);

select is(
  (select ubicacion from public.existencias
    where producto_id = (select id from _ids where clave = 'producto_a')
      and almacen_id = (select id from _ids where clave = 'almacen')),
  'Pasillo 1 / Estante A',
  'la ubicación del producto queda en la existencia del almacén'
);

select is(
  (select factor_base from public.producto_unidades
    where producto_id = (select id from _ids where clave = 'producto_a')
      and nombre = 'Caja 5'),
  5::numeric,
  'la unidad guarda su factor base'
);

select is(
  (select count(*) from public.producto_codigos_barra
    where producto_id = (select id from _ids where clave = 'producto_a')),
  1::bigint,
  'crear_producto guarda el código de barra'
);

select public.actualizar_producto(
  (select id from _ids where clave = 'producto_a'),
  jsonb_build_object(
    'codigos_barra', jsonb_build_array(jsonb_build_object(
      'codigo', '7501234567890',
      'unidad_id', (select id from public.producto_unidades
        where producto_id = (select id from _ids where clave = 'producto_a')
          and nombre = 'Caja 5'),
      'principal', true
    ))
  )
);

select is(
  (select cb.unidad_id
   from public.producto_codigos_barra cb
   where cb.codigo = '7501234567890'),
  (select id from public.producto_unidades
    where producto_id = (select id from _ids where clave = 'producto_a')
      and nombre = 'Caja 5'),
  'actualizar_producto asocia el código con la presentación'
);

select throws_ok(
  $q$select public.crear_producto(jsonb_build_object(
    'tipo', 'producto',
    'nombre', 'Duplicado pgTAP 1A',
    'codigos_barra', jsonb_build_array(jsonb_build_object('codigo', '7501234567890'))
  ))$q$,
  '22023',
  'el código de barra ya está registrado en otro producto',
  'no se repite un código de barra entre productos'
);

-- ---------------------------------------------------------------------------
-- Venta con unidad: 2 cajas de 5 unidades base
-- ---------------------------------------------------------------------------

insert into _ids (clave, id)
select 'factura_a', public.crear_factura(jsonb_build_object(
  'tipo_comprobante', '02',
  'contacto_id', (select id from _ids where clave = 'contacto'),
  'fecha', '2026-11-25',
  'almacen_id', (select id from _ids where clave = 'almacen'),
  'lineas', jsonb_build_array(jsonb_build_object(
    'producto_id', (select id from _ids where clave = 'producto_a'),
    'cantidad', 2,
    'precio', 3200,
    'unidad_id', (select id from public.producto_unidades
      where producto_id = (select id from _ids where clave = 'producto_a')
        and nombre = 'Caja 5')
  ))
));

insert into _ids (clave, id)
select 'factura_linea_a', fl.id
from public.factura_lineas fl
where fl.factura_id = (select id from _ids where clave = 'factura_a');

select is(
  (select cantidad from public.existencias
    where producto_id = (select id from _ids where clave = 'producto_a')
      and almacen_id = (select id from _ids where clave = 'almacen')),
  0::numeric,
  'vender 2 cajas de 5 descuenta 10 unidades base'
);

select is(
  (select cantidad from public.factura_lineas where id = (select id from _ids where clave = 'factura_linea_a')),
  2::numeric,
  'la línea conserva la cantidad de la presentación'
);

select is(
  (select factor_base from public.factura_lineas where id = (select id from _ids where clave = 'factura_linea_a')),
  5::numeric,
  'la línea guarda el factor base'
);

select is(
  (select unidad_nombre from public.factura_lineas where id = (select id from _ids where clave = 'factura_linea_a')),
  'Caja 5',
  'la línea guarda el nombre de la presentación'
);

select is(
  (select coalesce(sum(l.debito), 0)
   from public.asiento_lineas l
   where l.asiento_id = (select f.asiento_id from public.facturas f
                          where f.id = (select id from _ids where clave = 'factura_a'))
     and l.cuenta_id = (select cuenta_id from public.config_contable where clave = 'costo_ventas')),
  1000::numeric,
  'el costo de venta usa la cantidad base: 2 x 5 x 100'
);

select throws_ok(
  $q$select public.crear_factura(jsonb_build_object(
    'tipo_comprobante', '02',
    'contacto_id', (select id from _ids where clave = 'contacto'),
    'fecha', '2026-11-25',
    'almacen_id', (select id from _ids where clave = 'almacen'),
    'lineas', jsonb_build_array(jsonb_build_object(
      'producto_id', (select id from _ids where clave = 'producto_a'),
      'cantidad', 1,
      'precio', 3200,
      'unidad_id', (select id from public.producto_unidades
        where producto_id = (select id from _ids where clave = 'producto_a')
          and nombre = 'Caja 5')
    ))
  ))$q$,
  '22023',
  'no hay existencia suficiente del producto Cemento gris pgTAP 1A',
  'bloquea vender una caja si no hay 5 unidades base'
);

-- ---------------------------------------------------------------------------
-- Nota de crédito: devuelve la cantidad base al costo promedio vigente
-- ---------------------------------------------------------------------------

insert into _ids (clave, id)
select 'nota_a', public.crear_nota_credito_venta(jsonb_build_object(
  'factura_id', (select id from _ids where clave = 'factura_a'),
  'fecha', '2026-11-25',
  'lineas', jsonb_build_array(jsonb_build_object(
    'factura_linea_id', (select id from _ids where clave = 'factura_linea_a'),
    'cantidad', 1
  ))
));

select is(
  (select cantidad from public.existencias
    where producto_id = (select id from _ids where clave = 'producto_a')
      and almacen_id = (select id from _ids where clave = 'almacen')),
  5::numeric,
  'la nota de crédito reingresa 5 unidades base por 1 caja'
);

select is(
  (select factor_base from public.nota_credito_venta_lineas
    where nota_id = (select id from _ids where clave = 'nota_a')),
  5::numeric,
  'la línea de la nota conserva el factor de la presentación'
);

select is(
  (select coalesce(sum(l.debito), 0)
   from public.asiento_lineas l
   where l.asiento_id = (select n.asiento_id from public.notas_credito_venta n
                          where n.id = (select id from _ids where clave = 'nota_a'))
     and l.cuenta_id = (select cuenta_id from public.config_contable where clave = 'inventario')),
  500::numeric,
  'la devolución reingresa 5 x 100 al costo promedio vigente'
);

-- ---------------------------------------------------------------------------
-- Compra con unidad: 1 caja de 10 a costo 500
-- ---------------------------------------------------------------------------

insert into _ids (clave, id)
select 'producto_f', public.crear_producto(jsonb_build_object(
  'tipo', 'producto',
  'nombre', 'Alambre pgTAP 1A',
  'precio', 100,
  'itbis_tasa', 18,
  'inventariable', true,
  'cantidad', 0,
  'costo', 0,
  'unidades', jsonb_build_array(jsonb_build_object(
    'nombre', 'Caja 10',
    'factor_base', 10,
    'es_compra', true
  ))
));

insert into _ids (clave, id)
select 'factura_prov_f', public.crear_factura_proveedor(jsonb_build_object(
  'contacto_id', (select id from _ids where clave = 'proveedor'),
  'fecha', '2026-11-25',
  'almacen_id', (select id from _ids where clave = 'almacen'),
  'lineas', jsonb_build_array(jsonb_build_object(
    'producto_id', (select id from _ids where clave = 'producto_f'),
    'cantidad', 1,
    'costo', 500,
    'itbis_tasa', 0,
    'unidad_id', (select id from public.producto_unidades
      where producto_id = (select id from _ids where clave = 'producto_f')
        and nombre = 'Caja 10')
  ))
));

select is(
  (select cantidad from public.existencias
    where producto_id = (select id from _ids where clave = 'producto_f')
      and almacen_id = (select id from _ids where clave = 'almacen')),
  10::numeric,
  'comprar 1 caja de 10 suma 10 unidades base'
);

select is(
  (select costo from public.productos where id = (select id from _ids where clave = 'producto_f')),
  50::numeric,
  'el costo promedio queda en unidad base: 500 / 10'
);

select public.anular_documento('factura_proveedor', (select id from _ids where clave = 'factura_prov_f'));

select is(
  (select cantidad from public.existencias
    where producto_id = (select id from _ids where clave = 'producto_f')
      and almacen_id = (select id from _ids where clave = 'almacen')),
  0::numeric,
  'anular la compra resta la cantidad base de la línea'
);

select is(
  (select costo from public.productos where id = (select id from _ids where clave = 'producto_f')),
  0::numeric,
  'anular la compra revierte el costo promedio'
);

-- ---------------------------------------------------------------------------
-- Combos: componentes reales, sin anidar
-- ---------------------------------------------------------------------------

insert into _ids (clave, id)
select 'componente_b', public.crear_producto(jsonb_build_object(
  'tipo', 'producto', 'nombre', 'Componente B pgTAP 1A', 'precio', 100,
  'itbis_tasa', 18, 'inventariable', true, 'cantidad', 4, 'costo', 50
));

insert into _ids (clave, id)
select 'componente_c', public.crear_producto(jsonb_build_object(
  'tipo', 'producto', 'nombre', 'Componente C pgTAP 1A', 'precio', 50,
  'itbis_tasa', 18, 'inventariable', true, 'cantidad', 10, 'costo', 20
));

insert into _ids (clave, id)
select 'combo', public.crear_producto(jsonb_build_object(
  'tipo', 'combo',
  'nombre', 'Kit pgTAP 1A',
  'precio', 300,
  'itbis_tasa', 18,
  'componentes', jsonb_build_array(
    jsonb_build_object('componente_id', (select id from _ids where clave = 'componente_b'), 'cantidad', 2),
    jsonb_build_object('componente_id', (select id from _ids where clave = 'componente_c'), 'cantidad', 1)
  )
));

select is(
  (select count(*) from public.combo_componentes
    where combo_id = (select id from _ids where clave = 'combo')),
  2::bigint,
  'el combo guarda sus dos componentes'
);

select throws_ok(
  $q$select public.crear_producto(jsonb_build_object(
    'tipo', 'combo',
    'nombre', 'Combo anidado pgTAP 1A',
    'componentes', jsonb_build_array(jsonb_build_object(
      'componente_id', (select id from _ids where clave = 'combo'),
      'cantidad', 1
    ))
  ))$q$,
  '22023',
  'un combo no puede tener componentes que sean combos',
  'no permite combos anidados'
);

insert into _ids (clave, id)
select 'factura_combo', public.crear_factura(jsonb_build_object(
  'tipo_comprobante', '02',
  'contacto_id', (select id from _ids where clave = 'contacto'),
  'fecha', '2026-11-25',
  'almacen_id', (select id from _ids where clave = 'almacen'),
  'lineas', jsonb_build_array(jsonb_build_object(
    'producto_id', (select id from _ids where clave = 'combo'),
    'cantidad', 2,
    'precio', 300
  ))
));

select is(
  (select cantidad from public.existencias
    where producto_id = (select id from _ids where clave = 'componente_b')
      and almacen_id = (select id from _ids where clave = 'almacen')),
  0::numeric,
  'vender 2 combos descuenta 4 del componente B'
);

select is(
  (select cantidad from public.existencias
    where producto_id = (select id from _ids where clave = 'componente_c')
      and almacen_id = (select id from _ids where clave = 'almacen')),
  8::numeric,
  'vender 2 combos descuenta 2 del componente C'
);

select is(
  (select coalesce(sum(l.debito), 0)
   from public.asiento_lineas l
   where l.asiento_id = (select f.asiento_id from public.facturas f
                          where f.id = (select id from _ids where clave = 'factura_combo'))
     and l.cuenta_id = (select cuenta_id from public.config_contable where clave = 'costo_ventas')),
  240::numeric,
  'el costo del combo suma los promedios de sus componentes: 2 x (2x50 + 1x20)'
);

select throws_ok(
  $q$select public.crear_factura(jsonb_build_object(
    'tipo_comprobante', '02',
    'contacto_id', (select id from _ids where clave = 'contacto'),
    'fecha', '2026-11-25',
    'almacen_id', (select id from _ids where clave = 'almacen'),
    'lineas', jsonb_build_array(jsonb_build_object(
      'producto_id', (select id from _ids where clave = 'combo'),
      'cantidad', 1,
      'precio', 300
    ))
  ))$q$,
  '22023',
  'no hay existencia suficiente del producto Componente B pgTAP 1A',
  'bloquea el combo si un componente no tiene stock'
);

select public.anular_documento('factura', (select id from _ids where clave = 'factura_combo'));

select is(
  (select cantidad from public.existencias
    where producto_id = (select id from _ids where clave = 'componente_b')
      and almacen_id = (select id from _ids where clave = 'almacen')),
  4::numeric,
  'anular la factura devuelve los componentes del combo'
);

select is(
  (select cantidad from public.existencias
    where producto_id = (select id from _ids where clave = 'componente_c')
      and almacen_id = (select id from _ids where clave = 'almacen')),
  10::numeric,
  'anular la factura devuelve todas las unidades de los componentes'
);

-- ---------------------------------------------------------------------------
-- Conteo físico: aplicar genera ajuste y asiento
-- ---------------------------------------------------------------------------

insert into _ids (clave, id)
select 'producto_d', public.crear_producto(jsonb_build_object(
  'tipo', 'producto', 'nombre', 'Alambre grueso pgTAP 1A', 'precio', 50,
  'itbis_tasa', 18, 'inventariable', true, 'cantidad', 10, 'costo', 30
));

insert into _ids (clave, id)
select 'conteo', public.crear_conteo_inventario(jsonb_build_object(
  'almacen_id', (select id from _ids where clave = 'almacen'),
  'fecha', '2026-11-25',
  'notas', 'Conteo pgTAP 1A',
  'lineas', jsonb_build_array(jsonb_build_object(
    'producto_id', (select id from _ids where clave = 'producto_d'),
    'cantidad_contada', 7
  ))
));

select is(
  (select cantidad_sistema from public.conteo_inventario_lineas
    where conteo_id = (select id from _ids where clave = 'conteo')),
  10::numeric,
  'el conteo toma la cantidad del sistema al guardar'
);

select is(
  (select diferencia from public.conteo_inventario_lineas
    where conteo_id = (select id from _ids where clave = 'conteo')),
  (-3)::numeric,
  'la diferencia es contada menos sistema'
);

insert into _ids (clave, id)
select 'ajuste_conteo', public.aplicar_conteo_inventario((select id from _ids where clave = 'conteo'));

select is(
  (select estado from public.conteos_inventario where id = (select id from _ids where clave = 'conteo')),
  'aplicado',
  'aplicar deja el conteo en aplicado'
);

select is(
  (select total from public.ajustes_inventario
    where id = (select id from _ids where clave = 'ajuste_conteo')),
  90::numeric,
  'el ajuste del conteo vale 3 x 30'
);

select is(
  (select cantidad from public.existencias
    where producto_id = (select id from _ids where clave = 'producto_d')
      and almacen_id = (select id from _ids where clave = 'almacen')),
  7::numeric,
  'el ajuste del conteo baja el stock a 7'
);

select is(
  (select a.origen_tipo
   from public.ajustes_inventario ai
   join public.asientos a on a.id = ai.asiento_id
   where ai.id = (select id from _ids where clave = 'ajuste_conteo')),
  'ajuste_inventario',
  'el conteo genera el asiento de ajuste de inventario'
);

select throws_ok(
  $q$select public.anular_conteo_inventario((select id from _ids where clave = 'conteo'))$q$,
  '22023',
  'un conteo aplicado se revierte anulando su ajuste de inventario',
  'no se anula un conteo aplicado'
);

insert into _ids (clave, id)
select 'conteo_borrador', public.crear_conteo_inventario(jsonb_build_object(
  'almacen_id', (select id from _ids where clave = 'almacen'),
  'fecha', '2026-11-25'
));

select public.anular_conteo_inventario((select id from _ids where clave = 'conteo_borrador'));

select is(
  (select estado from public.conteos_inventario
    where id = (select id from _ids where clave = 'conteo_borrador')),
  'anulado',
  'un conteo en borrador se anula'
);

-- ---------------------------------------------------------------------------
-- Lecturas rápidas del POS
-- ---------------------------------------------------------------------------

select is(
  (select unidad_nombre from public.pos_buscar_por_codigo_barra(
    '7501234567890',
    (select id from _ids where clave = 'almacen'),
    null
  )),
  'Caja 5',
  'la búsqueda exacta por código devuelve la presentación'
);

select is(
  (select factor_base from public.pos_buscar_por_codigo_barra(
    '7501234567890',
    (select id from _ids where clave = 'almacen'),
    null
  )),
  5::numeric,
  'la búsqueda exacta por código devuelve el factor'
);

select is(
  (select precio from public.pos_buscar_por_codigo_barra(
    '7501234567890',
    (select id from _ids where clave = 'almacen'),
    null
  )),
  3200::numeric,
  'la búsqueda exacta por código devuelve el precio de la presentación'
);

select is(
  (select count(*) from public.pos_catalogo_productos(
    (select id from _ids where clave = 'almacen'),
    null,
    'Ferretería X',
    null,
    true,
    50,
    0
  )),
  1::bigint,
  'el catálogo filtra por búsqueda de marca y favoritos'
);

-- ---------------------------------------------------------------------------
-- Reporte de stock bajo
-- ---------------------------------------------------------------------------

insert into _ids (clave, id)
select 'producto_e', public.crear_producto(jsonb_build_object(
  'tipo', 'producto', 'nombre', 'Tornillo pgTAP 1A', 'precio', 10,
  'itbis_tasa', 18, 'inventariable', true, 'cantidad', 2, 'costo', 5,
  'minimo', 5, 'maximo', 10
));

select is(
  (select faltante from public.reporte_stock_bajo((select id from _ids where clave = 'almacen'))
    where producto_id = (select id from _ids where clave = 'producto_e')),
  3::numeric,
  'el reporte calcula el faltante hasta el mínimo'
);

select is(
  (select sugerido from public.reporte_stock_bajo((select id from _ids where clave = 'almacen'))
    where producto_id = (select id from _ids where clave = 'producto_e')),
  8::numeric,
  'el reporte sugiere reponer hasta el máximo'
);

select is(
  (select count(*) from public.reporte_stock_bajo((select id from _ids where clave = 'almacen'))
    where producto_id = (select id from _ids where clave = 'producto_d')),
  0::bigint,
  'un producto sobre el mínimo no aparece en stock bajo'
);

-- ---------------------------------------------------------------------------
-- Rol lector: lee el POS, no escribe conteos
-- ---------------------------------------------------------------------------

set local request.jwt.claims = '{"sub":"33333333-3333-3333-3333-333333333333","role":"authenticated"}';

select ok(
  (select count(*) from public.pos_catalogo_productos(
    (select id from _ids where clave = 'almacen'), null, 'pgTAP 1A', null, false, 50, 0
  )) > 0,
  'el rol lector puede consultar el catálogo del POS'
);

select throws_ok(
  $q$select public.crear_conteo_inventario(jsonb_build_object(
    'almacen_id', (select id from _ids where clave = 'almacen'),
    'fecha', '2026-11-25'
  ))$q$,
  '42501',
  'sin permiso',
  'el rol lector no puede crear conteos'
);

select * from finish();
rollback;
