-- ---------------------------------------------------------------------------
-- Kardex de inventario y recosteo de ventas en negativo
--
-- · productos.valor_inventario / costo_promedio: valor exacto al centavo.
-- · movimientos_inventario: kardex append-only por producto, documento y asiento.
-- · las compras/entradas que cubren stock negativo emiten un asiento visible
--   de recosteo (5101 contra 1104 o cuentas propias del producto).
-- · las salidas que agotan stock arrastran el residuo exacto para que el
--   Mayor de inventario y la suma del Kardex terminen en 0.00, sin centavos
--   fantasma.
--
-- Migración aditiva y reintentable. No borra datos ni toca documentos
-- históricos; solo inicializa columnas nuevas de productos ya existentes.
-- ---------------------------------------------------------------------------

-- ---------------------------------------------------------------------------
-- Esquema: valor y promedio exacto por producto
-- ---------------------------------------------------------------------------

alter table public.productos
  add column if not exists valor_inventario numeric(14,2) not null default 0,
  add column if not exists costo_promedio numeric(16,6) not null default 0;

-- Backfill idempotente: solo productos que todavía no tienen valoración
-- cargada. Los productos ya corregidos por una corrida anterior no se tocan.
update public.productos pr
set costo_promedio = round(coalesce(pr.costo, 0), 6),
    valor_inventario = round(coalesce(pr.cantidad, 0) * coalesce(pr.costo, 0), 2)
where pr.inventariable
  and pr.valor_inventario = 0
  and pr.costo_promedio = 0
  and (pr.cantidad <> 0 or pr.costo <> 0);

-- ---------------------------------------------------------------------------
-- origen_tipo: 21 valores (suma recosteo_inventario)
-- ---------------------------------------------------------------------------

do $$
declare
  v_nombre text;
begin
  select conname into v_nombre
  from pg_constraint
  where conrelid = 'public.asientos'::regclass
    and contype = 'c'
    and pg_get_constraintdef(oid) like '%origen_tipo%'
  limit 1;

  if v_nombre is not null then
    execute format('alter table public.asientos drop constraint %I', v_nombre);
  end if;
end;
$$;

alter table public.asientos
  add constraint asientos_origen_tipo_check check (origen_tipo in (
    'factura',
    'pago_recibido',
    'factura_proveedor',
    'pago_proveedor',
    'gasto_menor',
    'manual',
    'anulacion',
    'nota_credito_venta',
    'nota_credito_compra',
    'nota_debito',
    'transferencia',
    'deposito',
    'conciliacion',
    'ajuste_inventario',
    'saldo_inicial',
    'inventario_inicial',
    'pos_movimiento',
    'pos_diferencia',
    'nomina',
    'pago_nomina',
    'recosteo_inventario'
  ));

-- ---------------------------------------------------------------------------
-- Kardex append-only
-- ---------------------------------------------------------------------------

create table if not exists public.movimientos_inventario (
  id uuid primary key default gen_random_uuid(),
  fecha date not null,
  producto_id uuid not null references public.productos (id),
  almacen_id uuid references public.almacenes (id),
  tipo text not null check (tipo in ('entrada', 'salida', 'recosteo')),
  origen_tipo text not null,
  origen_id uuid,
  asiento_id uuid references public.asientos (id),
  documento_ref text,
  descripcion text,
  cantidad numeric(14,2) not null default 0,
  cantidad_antes numeric(14,2) not null,
  cantidad_despues numeric(14,2) not null,
  costo_unitario numeric(16,6) not null default 0,
  costo_promedio_antes numeric(16,6) not null default 0,
  costo_promedio_despues numeric(16,6) not null default 0,
  valor_movimiento numeric(14,2) not null default 0,
  valor_antes numeric(14,2) not null default 0,
  valor_despues numeric(14,2) not null default 0,
  es_recosteo boolean not null default false,
  creado_en timestamptz not null default now(),
  creado_por uuid references auth.users (id)
);

create index if not exists movimientos_inventario_producto_crono_idx
  on public.movimientos_inventario (producto_id, fecha, creado_en, id);
create index if not exists movimientos_inventario_origen_idx
  on public.movimientos_inventario (origen_tipo, origen_id);
create index if not exists movimientos_inventario_fecha_tipo_idx
  on public.movimientos_inventario (fecha, tipo);
create index if not exists movimientos_inventario_recosteo_idx
  on public.movimientos_inventario (es_recosteo, fecha)
  where es_recosteo;

alter table public.movimientos_inventario enable row level security;
revoke all on public.movimientos_inventario from anon;
revoke all on public.movimientos_inventario from authenticated;
grant select on public.movimientos_inventario to authenticated;

drop policy if exists movimientos_inventario_lectura on public.movimientos_inventario;
create policy movimientos_inventario_lectura
  on public.movimientos_inventario
  for select to authenticated
  using ((select public.rol_actual()) is not null);

-- ---------------------------------------------------------------------------
-- Internas de valoración exacta
-- ---------------------------------------------------------------------------

create or replace function public._registrar_movimiento_inventario(
  p_fecha date,
  p_producto_id uuid,
  p_almacen_id uuid,
  p_tipo text,
  p_origen_tipo text,
  p_origen_id uuid,
  p_asiento_id uuid,
  p_documento_ref text,
  p_descripcion text,
  p_cantidad numeric,
  p_cantidad_antes numeric,
  p_cantidad_despues numeric,
  p_costo_unitario numeric,
  p_costo_promedio_antes numeric,
  p_costo_promedio_despues numeric,
  p_valor_movimiento numeric,
  p_valor_antes numeric,
  p_valor_despues numeric,
  p_es_recosteo boolean default false
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_id uuid;
begin
  insert into public.movimientos_inventario (
    fecha, producto_id, almacen_id, tipo, origen_tipo, origen_id, asiento_id,
    documento_ref, descripcion, cantidad, cantidad_antes, cantidad_despues,
    costo_unitario, costo_promedio_antes, costo_promedio_despues,
    valor_movimiento, valor_antes, valor_despues, es_recosteo, creado_en, creado_por
  )
  values (
    coalesce(p_fecha, current_date), p_producto_id, p_almacen_id, p_tipo, p_origen_tipo,
    p_origen_id, p_asiento_id, p_documento_ref, p_descripcion,
    round(coalesce(p_cantidad, 0), 2), round(coalesce(p_cantidad_antes, 0), 2),
    round(coalesce(p_cantidad_despues, 0), 2), round(coalesce(p_costo_unitario, 0), 6),
    round(coalesce(p_costo_promedio_antes, 0), 6), round(coalesce(p_costo_promedio_despues, 0), 6),
    round(coalesce(p_valor_movimiento, 0), 2), round(coalesce(p_valor_antes, 0), 2),
    round(coalesce(p_valor_despues, 0), 2), coalesce(p_es_recosteo, false), clock_timestamp(), auth.uid()
  )
  returning id into v_id;

  return v_id;
end;
$$;

create or replace function public._crear_asiento_recosteo(
  p_fecha date,
  p_producto_id uuid,
  p_cuenta_inventario uuid,
  p_cuenta_costo uuid,
  p_delta_cogs numeric,
  p_descripcion text,
  p_origen_id uuid,
  p_centro_costo_id uuid default null
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_delta numeric(14,2);
  v_lineas jsonb;
  v_asiento_id uuid;
begin
  v_delta := round(coalesce(p_delta_cogs, 0), 2);
  if v_delta = 0 then
    return null;
  end if;

  if v_delta > 0 then
    v_lineas := jsonb_build_array(
      jsonb_build_object(
        'cuenta_id', p_cuenta_costo,
        'debito', v_delta,
        'credito', 0,
        'centro_costo_id', p_centro_costo_id,
        'descripcion', p_descripcion
      ),
      jsonb_build_object(
        'cuenta_id', p_cuenta_inventario,
        'debito', 0,
        'credito', v_delta,
        'centro_costo_id', p_centro_costo_id,
        'descripcion', p_descripcion
      )
    );
  else
    v_lineas := jsonb_build_array(
      jsonb_build_object(
        'cuenta_id', p_cuenta_inventario,
        'debito', abs(v_delta),
        'credito', 0,
        'centro_costo_id', p_centro_costo_id,
        'descripcion', p_descripcion
      ),
      jsonb_build_object(
        'cuenta_id', p_cuenta_costo,
        'debito', 0,
        'credito', abs(v_delta),
        'centro_costo_id', p_centro_costo_id,
        'descripcion', p_descripcion
      )
    );
  end if;

  v_asiento_id := public._crear_asiento(
    p_fecha,
    p_descripcion,
    'recosteo_inventario',
    p_origen_id,
    v_lineas
  );

  update public.asientos
  set producto_id = p_producto_id
  where id = v_asiento_id;

  return v_asiento_id;
end;
$$;

create or replace function public._aplicar_entrada_inventario(
  p_fecha date,
  p_producto_id uuid,
  p_almacen_id uuid,
  p_cantidad_base numeric,
  p_valor_entrada numeric,
  p_origen_tipo text,
  p_origen_id uuid,
  p_documento_ref text,
  p_descripcion text,
  p_asiento_id uuid default null,
  p_centro_costo_id uuid default null
)
returns numeric
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_producto public.productos%rowtype;
  q_antes numeric(14,2);
  q_ent numeric(14,2);
  q_despues numeric(14,2);
  v_antes numeric(14,2);
  v_ent numeric(14,2);
  v_libros numeric(14,2);
  v_despues numeric(14,2);
  v_objetivo numeric(14,2);
  c_antes numeric(16,6);
  c_ent numeric(16,6);
  c_despues numeric(16,6);
  v_delta numeric(14,2) := 0;
  v_asiento_recosteo uuid;
  v_cuenta_inventario uuid;
  v_cuenta_costo uuid;
begin
  q_ent := round(coalesce(p_cantidad_base, 0), 2);
  if q_ent <= 0 then
    raise exception 'la entrada de inventario requiere una cantidad positiva' using errcode = '22023';
  end if;

  v_ent := round(coalesce(p_valor_entrada, 0), 2);
  if v_ent < 0 then
    raise exception 'el valor de la entrada de inventario no puede ser negativo' using errcode = '22023';
  end if;

  select * into v_producto
  from public.productos pr
  where pr.id = p_producto_id
  for update;

  if not found or not v_producto.inventariable then
    raise exception 'producto inventariable no encontrado' using errcode = '22023';
  end if;

  q_antes := round(coalesce(v_producto.cantidad, 0), 2);
  v_antes := round(coalesce(v_producto.valor_inventario, 0), 2);
  c_antes := round(coalesce(nullif(v_producto.costo_promedio, 0), v_producto.costo, 0), 6);
  c_ent := round(v_ent / q_ent, 6);
  q_despues := round(q_antes + q_ent, 2);
  v_libros := round(v_antes + v_ent, 2);

  if q_antes >= 0 then
    v_despues := v_libros;
    c_despues := round(v_despues / q_despues, 6);
  elsif q_despues = 0 then
    v_delta := v_libros;
    v_despues := 0.00;
    c_despues := c_ent;
  elsif q_despues < 0 then
    v_objetivo := round(q_despues * c_antes, 2);
    v_delta := round(v_libros - v_objetivo, 2);
    v_despues := v_objetivo;
    c_despues := c_antes;
  else
    v_objetivo := round(q_despues * c_ent, 2);
    v_delta := round(v_libros - v_objetivo, 2);
    v_despues := v_objetivo;
    c_despues := round(v_despues / q_despues, 6);
  end if;

  perform public._mover_existencia(p_producto_id, p_almacen_id, q_ent);

  update public.productos pr
  set valor_inventario = v_despues,
      costo_promedio = c_despues,
      costo = round(c_despues, 2)
  where pr.id = p_producto_id;

  perform public._registrar_movimiento_inventario(
    p_fecha, p_producto_id, p_almacen_id, 'entrada', p_origen_tipo, p_origen_id,
    p_asiento_id, p_documento_ref, p_descripcion, q_ent, q_antes, q_despues,
    c_ent, c_antes, c_despues, v_ent, v_antes, v_libros, false
  );

  if v_delta <> 0 then
    v_cuenta_inventario := coalesce(v_producto.cuenta_inventario_id, public._cuenta_config('inventario'));
    v_cuenta_costo := coalesce(v_producto.cuenta_costo_id, public._cuenta_config('costo_ventas'));

    v_asiento_recosteo := public._crear_asiento_recosteo(
      p_fecha,
      p_producto_id,
      v_cuenta_inventario,
      v_cuenta_costo,
      v_delta,
      'Recosteo de inventario: ' || left(coalesce(p_descripcion, v_producto.nombre), 90),
      p_origen_id,
      p_centro_costo_id
    );

    perform public._registrar_movimiento_inventario(
      p_fecha, p_producto_id, p_almacen_id, 'recosteo', 'recosteo_inventario', p_origen_id,
      v_asiento_recosteo, p_documento_ref,
      'Recosteo de inventario: ' || left(coalesce(p_descripcion, v_producto.nombre), 90),
      0, q_despues, q_despues, 0, c_antes, c_despues,
      -v_delta, v_libros, v_despues, true
    );
  end if;

  return v_delta;
end;
$$;

drop function if exists public._aplicar_salida_inventario(date, uuid, uuid, numeric, text, uuid, text, text, uuid);

create or replace function public._aplicar_salida_inventario(
  p_fecha date,
  p_producto_id uuid,
  p_almacen_id uuid,
  p_cantidad_base numeric,
  p_origen_tipo text,
  p_origen_id uuid,
  p_documento_ref text,
  p_descripcion text,
  p_asiento_id uuid default null,
  p_costo_unitario numeric default null
)
returns numeric
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_producto public.productos%rowtype;
  q_antes numeric(14,2);
  q_salida numeric(14,2);
  q_despues numeric(14,2);
  v_antes numeric(14,2);
  v_salida numeric(14,2);
  v_despues numeric(14,2);
  c_antes numeric(16,6);
  c_ref numeric(16,6);
  c_salida numeric(16,6);
begin
  q_salida := round(coalesce(p_cantidad_base, 0), 2);
  if q_salida <= 0 then
    raise exception 'la salida de inventario requiere una cantidad positiva' using errcode = '22023';
  end if;

  select * into v_producto
  from public.productos pr
  where pr.id = p_producto_id
  for update;

  if not found or not v_producto.inventariable then
    raise exception 'producto inventariable no encontrado' using errcode = '22023';
  end if;

  q_antes := round(coalesce(v_producto.cantidad, 0), 2);
  v_antes := round(coalesce(v_producto.valor_inventario, 0), 2);
  c_antes := round(coalesce(nullif(v_producto.costo_promedio, 0), v_producto.costo, 0), 6);
  c_ref := c_antes;

  if q_antes > 0 and q_salida = q_antes then
    v_salida := greatest(v_antes, 0);
  elsif p_costo_unitario is not null then
    v_salida := round(q_salida * round(p_costo_unitario, 6), 2);
  else
    v_salida := round(q_salida * c_ref, 2);
  end if;

  q_despues := round(q_antes - q_salida, 2);
  v_despues := round(v_antes - v_salida, 2);
  c_salida := case when q_salida <> 0 then round(v_salida / q_salida, 6) else 0 end;

  perform public._mover_existencia(p_producto_id, p_almacen_id, -q_salida);

  update public.productos pr
  set valor_inventario = v_despues
  where pr.id = p_producto_id;

  perform public._registrar_movimiento_inventario(
    p_fecha, p_producto_id, p_almacen_id, 'salida', p_origen_tipo, p_origen_id,
    p_asiento_id, p_documento_ref, p_descripcion, -q_salida, q_antes, q_despues,
    c_salida, c_antes, c_antes, -v_salida, v_antes, v_despues, false
  );

  return v_salida;
end;
$$;

create or replace function public._aplicar_retiro_inventario_exacto(
  p_fecha date,
  p_producto_id uuid,
  p_almacen_id uuid,
  p_cantidad_base numeric,
  p_valor_retiro numeric,
  p_origen_tipo text,
  p_origen_id uuid,
  p_documento_ref text,
  p_descripcion text,
  p_asiento_id uuid default null,
  p_centro_costo_id uuid default null
)
returns numeric
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_producto public.productos%rowtype;
  q_antes numeric(14,2);
  q_retiro numeric(14,2);
  q_despues numeric(14,2);
  v_antes numeric(14,2);
  v_retiro numeric(14,2);
  v_libros numeric(14,2);
  v_objetivo numeric(14,2);
  v_despues numeric(14,2);
  c_antes numeric(16,6);
  c_despues numeric(16,6);
  c_retiro numeric(16,6);
  v_costo_visible numeric(14,2);
  v_delta numeric(14,2) := 0;
  v_asiento_recosteo uuid;
  v_cuenta_inventario uuid;
  v_cuenta_costo uuid;
begin
  q_retiro := round(coalesce(p_cantidad_base, 0), 2);
  if q_retiro <= 0 then
    raise exception 'el retiro de inventario requiere una cantidad positiva' using errcode = '22023';
  end if;

  v_retiro := round(coalesce(p_valor_retiro, 0), 2);
  if v_retiro < 0 then
    raise exception 'el valor del retiro de inventario no puede ser negativo' using errcode = '22023';
  end if;

  select * into v_producto
  from public.productos pr
  where pr.id = p_producto_id
  for update;

  if not found or not v_producto.inventariable then
    raise exception 'producto inventariable no encontrado' using errcode = '22023';
  end if;

  q_antes := round(coalesce(v_producto.cantidad, 0), 2);
  v_antes := round(coalesce(v_producto.valor_inventario, 0), 2);
  c_antes := round(coalesce(nullif(v_producto.costo_promedio, 0), v_producto.costo, 0), 6);
  q_despues := round(q_antes - q_retiro, 2);
  v_libros := round(v_antes - v_retiro, 2);
  c_retiro := round(v_retiro / q_retiro, 6);

  if q_despues > 0 then
    if v_libros >= 0 then
      v_despues := v_libros;
      c_despues := round(v_despues / q_despues, 6);
    else
      v_objetivo := round(q_despues * c_antes, 2);
      v_delta := round(v_libros - v_objetivo, 2);
      v_despues := v_objetivo;
      c_despues := c_antes;
    end if;
  elsif q_despues = 0 then
    v_delta := v_libros;
    v_despues := 0.00;
    c_despues := 0;
  else
    v_objetivo := round(q_despues * c_antes, 2);
    v_delta := round(v_libros - v_objetivo, 2);
    v_despues := v_objetivo;
    c_despues := c_antes;
  end if;

  if q_despues > 0 then
    v_costo_visible := round(
      greatest(q_antes * round(c_antes, 2) - v_retiro, 0) / q_despues,
      2
    );
  else
    v_costo_visible := round(c_despues, 2);
  end if;

  perform public._mover_existencia(p_producto_id, p_almacen_id, -q_retiro);

  update public.productos pr
  set valor_inventario = v_despues,
      costo_promedio = c_despues,
      costo = v_costo_visible
  where pr.id = p_producto_id;

  perform public._registrar_movimiento_inventario(
    p_fecha, p_producto_id, p_almacen_id, 'salida', p_origen_tipo, p_origen_id,
    p_asiento_id, p_documento_ref, p_descripcion, -q_retiro, q_antes, q_despues,
    c_retiro, c_antes, c_despues, -v_retiro, v_antes, v_libros, false
  );

  if v_delta <> 0 then
    v_cuenta_inventario := coalesce(v_producto.cuenta_inventario_id, public._cuenta_config('inventario'));
    v_cuenta_costo := coalesce(v_producto.cuenta_costo_id, public._cuenta_config('costo_ventas'));

    v_asiento_recosteo := public._crear_asiento_recosteo(
      p_fecha,
      p_producto_id,
      v_cuenta_inventario,
      v_cuenta_costo,
      v_delta,
      'Recosteo de inventario: ' || left(coalesce(p_descripcion, v_producto.nombre), 90),
      p_origen_id,
      p_centro_costo_id
    );

    perform public._registrar_movimiento_inventario(
      p_fecha, p_producto_id, p_almacen_id, 'recosteo', 'recosteo_inventario', p_origen_id,
      v_asiento_recosteo, p_documento_ref,
      'Recosteo de inventario: ' || left(coalesce(p_descripcion, v_producto.nombre), 90),
      0, q_despues, q_despues, 0, c_antes, c_despues,
      -v_delta, v_libros, v_despues, true
    );
  end if;

  return v_delta;
end;
$$;

create or replace function public._aplicar_salida_combo_inventario(
  p_fecha date,
  p_combo_id uuid,
  p_almacen_id uuid,
  p_cantidad_base numeric,
  p_origen_tipo text,
  p_origen_id uuid,
  p_documento_ref text,
  p_descripcion text,
  p_asiento_id uuid default null
)
returns numeric
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_componente record;
  v_cantidad numeric(14,2);
  v_costo numeric(14,2);
  v_total numeric(14,2) := 0;
begin
  for v_componente in
    select cc.componente_id, cc.cantidad
    from public.combo_componentes cc
    join public.productos pr on pr.id = cc.componente_id
    where cc.combo_id = p_combo_id
      and pr.inventariable
    order by cc.componente_id
  loop
    v_cantidad := round(v_componente.cantidad * p_cantidad_base, 2);
    if v_cantidad = 0 then
      continue;
    end if;

    v_costo := public._aplicar_salida_inventario(
      p_fecha, v_componente.componente_id, p_almacen_id, v_cantidad,
      p_origen_tipo, p_origen_id, p_documento_ref, p_descripcion, p_asiento_id
    );
    v_total := round(v_total + v_costo, 2);
  end loop;

  return v_total;
end;
$$;

create or replace function public._aplicar_entrada_combo_inventario(
  p_fecha date,
  p_combo_id uuid,
  p_almacen_id uuid,
  p_cantidad_base numeric,
  p_origen_tipo text,
  p_origen_id uuid,
  p_documento_ref text,
  p_descripcion text,
  p_asiento_id uuid default null,
  p_centro_costo_id uuid default null
)
returns numeric
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_componente record;
  v_cantidad numeric(14,2);
  v_costo_ref numeric(16,6);
  v_valor numeric(14,2);
  v_total numeric(14,2) := 0;
begin
  for v_componente in
    select cc.componente_id, cc.cantidad
    from public.combo_componentes cc
    join public.productos pr on pr.id = cc.componente_id
    where cc.combo_id = p_combo_id
      and pr.inventariable
    order by cc.componente_id
  loop
    v_cantidad := round(v_componente.cantidad * p_cantidad_base, 2);
    if v_cantidad = 0 then
      continue;
    end if;

    select round(coalesce(nullif(pr.costo_promedio, 0), pr.costo, 0), 6)
    into v_costo_ref
    from public.productos pr
    where pr.id = v_componente.componente_id;

    v_valor := round(v_cantidad * coalesce(v_costo_ref, 0), 2);
    perform public._aplicar_entrada_inventario(
      p_fecha, v_componente.componente_id, p_almacen_id, v_cantidad, v_valor,
      p_origen_tipo, p_origen_id, p_documento_ref, p_descripcion, p_asiento_id, p_centro_costo_id
    );
    v_total := round(v_total + v_valor, 2);
  end loop;

  return v_total;
end;
$$;

revoke all on function public._registrar_movimiento_inventario(date, uuid, uuid, text, text, uuid, uuid, text, text, numeric, numeric, numeric, numeric, numeric, numeric, numeric, numeric, numeric, boolean)
  from public, anon, authenticated;
revoke all on function public._crear_asiento_recosteo(date, uuid, uuid, uuid, numeric, text, uuid, uuid)
  from public, anon, authenticated;
revoke all on function public._aplicar_entrada_inventario(date, uuid, uuid, numeric, numeric, text, uuid, text, text, uuid, uuid)
  from public, anon, authenticated;
revoke all on function public._aplicar_salida_inventario(date, uuid, uuid, numeric, text, uuid, text, text, uuid, numeric)
  from public, anon, authenticated;
revoke all on function public._aplicar_retiro_inventario_exacto(date, uuid, uuid, numeric, numeric, text, uuid, text, text, uuid, uuid)
  from public, anon, authenticated;
revoke all on function public._aplicar_salida_combo_inventario(date, uuid, uuid, numeric, text, uuid, text, text, uuid)
  from public, anon, authenticated;
revoke all on function public._aplicar_entrada_combo_inventario(date, uuid, uuid, numeric, text, uuid, text, text, uuid, uuid)
  from public, anon, authenticated;

CREATE OR REPLACE FUNCTION public._costo_combo(p_combo_id uuid, p_cantidad_base numeric)
 RETURNS numeric
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
  select round(coalesce(sum(coalesce(nullif(pr.costo_promedio, 0), pr.costo, 0) * cc.cantidad * p_cantidad_base), 0), 2)
  from public.combo_componentes cc
  join public.productos pr on pr.id = cc.componente_id
  where cc.combo_id = p_combo_id
    and pr.inventariable;
$function$;

revoke all on function public._costo_combo(uuid, numeric) from public, anon, authenticated;

-- Venta: salidas exactas y Kardex por componente
CREATE OR REPLACE FUNCTION public._crear_factura_sin_impuestos(p jsonb)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  v_rol text;
  v_contacto public.contactos%rowtype;
  v_almacen_id uuid;
  v_factura_id uuid;
  v_numero int;
  v_ncf text;
  v_tipo text;
  v_fecha date;
  v_vencimiento date;
  v_vendedor_id uuid;
  v_centro_costo_id uuid;
  v_num public.numeraciones%rowtype;
  v_linea jsonb;
  v_pago jsonb;
  v_asiento_id uuid;
  v_asiento_lineas jsonb := '[]'::jsonb;
  v_producto_id uuid;
  v_producto_nombre text;
  v_producto_tipo text;
  v_producto_precio numeric(14,2);
  v_producto_itbis numeric(5,2);
  v_producto_costo numeric(14,2);
  v_producto_inventariable boolean;
  v_producto_unidad text;
  v_producto_cuenta_ingreso uuid;
  v_producto_cuenta_costo uuid;
  v_producto_cuenta_inventario uuid;
  v_unidad_id uuid;
  v_unidad_nombre text;
  v_factor numeric(14,4);
  v_cantidad numeric(14,2);
  v_cantidad_base numeric(14,2);
  v_precio numeric(14,2);
  v_descuento_pct numeric(5,2);
  v_itbis_tasa numeric(5,2);
  v_descripcion text;
  v_bruto numeric(14,2);
  v_descuento numeric(14,2);
  v_subtotal numeric(14,2);
  v_itbis numeric(14,2);
  v_total numeric(14,2);
  v_costo_unitario numeric(14,2);
  v_costo_total numeric(14,2);
  v_cuenta_ingreso uuid;
  v_subtotal_factura numeric(14,2) := 0;
  v_descuento_factura numeric(14,2) := 0;
  v_itbis_factura numeric(14,2) := 0;
  v_total_factura numeric(14,2) := 0;
begin
  v_rol := public.rol_actual();
  if v_rol is null or v_rol not in ('admin', 'contador') then
    raise exception 'sin permiso' using errcode = '42501';
  end if;

  if p is null then
    raise exception 'datos de la factura requeridos' using errcode = '22023';
  end if;

  v_tipo := p->>'tipo_comprobante';
  if v_tipo is null or v_tipo not in ('01', '02', '14', '15', '16') then
    raise exception 'tipo de comprobante inválido' using errcode = '22023';
  end if;

  if p->>'contacto_id' is null then
    raise exception 'el contacto es obligatorio' using errcode = '22023';
  end if;

  select * into v_contacto
  from public.contactos c
  where c.id = (p->>'contacto_id')::uuid and c.activo;

  if not found then
    raise exception 'contacto no encontrado' using errcode = '22023';
  end if;

  v_vendedor_id := nullif(p->>'vendedor_id', '')::uuid;
  if v_vendedor_id is not null
     and not exists (select 1 from public.vendedores v where v.id = v_vendedor_id and v.activo) then
    raise exception 'vendedor no encontrado o inactivo' using errcode = '22023';
  end if;

  v_centro_costo_id := nullif(p->>'centro_costo_id', '')::uuid;
  if v_centro_costo_id is not null
     and not exists (select 1 from public.centros_costo c where c.id = v_centro_costo_id and c.activo) then
    raise exception 'centro de costo no encontrado o inactivo' using errcode = '22023';
  end if;

  v_almacen_id := nullif(p->>'almacen_id', '')::uuid;
  if v_almacen_id is null then
    v_almacen_id := public._almacen_principal();
  end if;
  if v_almacen_id is null
     or not exists (select 1 from public.almacenes al where al.id = v_almacen_id and al.activo) then
    raise exception 'almacén no encontrado o inactivo' using errcode = '22023';
  end if;

  v_fecha := coalesce((p->>'fecha')::date, current_date);
  v_vencimiento := coalesce((p->>'vencimiento')::date, v_fecha);
  if v_vencimiento < v_fecha then
    raise exception 'el vencimiento no puede ser anterior a la fecha' using errcode = '22023';
  end if;

  if p->'lineas' is null
     or jsonb_typeof(p->'lineas') <> 'array'
     or jsonb_array_length(p->'lineas') = 0 then
    raise exception 'la factura requiere al menos una línea' using errcode = '22023';
  end if;

  select * into v_num
  from public.numeraciones n
  where n.tipo_comprobante = v_tipo and n.activa
  order by n.id
  limit 1
  for update;

  if not found then
    raise exception 'no hay numeración activa para el comprobante %', v_tipo using errcode = '22023';
  end if;
  if v_num.hasta is not null and v_num.siguiente > v_num.hasta then
    raise exception 'la numeración % está agotada', v_num.prefijo using errcode = '22023';
  end if;
  if v_num.vence is not null and v_num.vence < v_fecha then
    raise exception 'la numeración % está vencida', v_num.prefijo using errcode = '22023';
  end if;

  v_ncf := v_num.prefijo || lpad(v_num.siguiente::text, 8, '0');
  update public.numeraciones set siguiente = siguiente + 1 where id = v_num.id;

  insert into public.facturas (
    tipo_comprobante, ncf, contacto_id, vendedor_id, centro_costo_id, almacen_id, fecha, vencimiento,
    notas, terminos, pie, creado_por
  )
  values (
    v_tipo, v_ncf, v_contacto.id, v_vendedor_id, v_centro_costo_id, v_almacen_id, v_fecha, v_vencimiento,
    p->>'notas', p->>'terminos', p->>'pie', auth.uid()
  )
  returning id, numero into v_factura_id, v_numero;

  for v_linea in select * from jsonb_array_elements(p->'lineas') loop
    v_producto_id := nullif(v_linea->>'producto_id', '')::uuid;
    v_unidad_id := nullif(v_linea->>'unidad_id', '')::uuid;
    v_producto_nombre := null;
    v_producto_tipo := null;
    v_producto_precio := null;
    v_producto_itbis := null;
    v_producto_costo := null;
    v_producto_inventariable := false;
    v_producto_unidad := null;
    v_producto_cuenta_ingreso := null;
    v_producto_cuenta_costo := null;
    v_producto_cuenta_inventario := null;
    v_factor := 1;
    v_unidad_nombre := null;

    if v_producto_id is null and v_unidad_id is not null then
      raise exception 'la unidad de medida requiere un producto' using errcode = '22023';
    end if;

    if v_producto_id is not null then
      select
        pr.nombre, pr.tipo, pr.precio, pr.itbis_tasa, pr.costo, pr.inventariable, pr.unidad_medida,
        pr.cuenta_ingreso_id, pr.cuenta_costo_id, pr.cuenta_inventario_id
      into
        v_producto_nombre, v_producto_tipo, v_producto_precio, v_producto_itbis, v_producto_costo,
        v_producto_inventariable, v_producto_unidad, v_producto_cuenta_ingreso,
        v_producto_cuenta_costo, v_producto_cuenta_inventario
      from public.productos pr
      where pr.id = v_producto_id and pr.activo;

      if not found then
        raise exception 'producto no encontrado' using errcode = '22023';
      end if;

      v_unidad_nombre := v_producto_unidad;
      if v_unidad_id is not null then
        select pu.nombre, pu.factor_base
        into v_unidad_nombre, v_factor
        from public.producto_unidades pu
        where pu.id = v_unidad_id
          and pu.producto_id = v_producto_id
          and pu.activa;

        if not found then
          raise exception 'unidad de medida no encontrada para el producto' using errcode = '22023';
        end if;
      end if;
    end if;

    v_cantidad := round(coalesce((v_linea->>'cantidad')::numeric, 0), 2);
    if v_cantidad <= 0 then
      raise exception 'la cantidad debe ser mayor a cero' using errcode = '22023';
    end if;

    v_cantidad_base := round(v_cantidad * v_factor, 2);

    v_precio := round(coalesce((v_linea->>'precio')::numeric, v_producto_precio, 0), 2);
    if v_precio < 0 then
      raise exception 'el precio no puede ser negativo' using errcode = '22023';
    end if;

    v_descuento_pct := round(coalesce((v_linea->>'descuento_pct')::numeric, 0), 2);
    if v_descuento_pct < 0 or v_descuento_pct > 100 then
      raise exception 'el descuento debe estar entre 0 y 100' using errcode = '22023';
    end if;

    v_itbis_tasa := round(coalesce((v_linea->>'itbis_tasa')::numeric, v_producto_itbis, 18), 2);
    if v_itbis_tasa < 0 or v_itbis_tasa > 100 then
      raise exception 'la tasa de ITBIS es inválida' using errcode = '22023';
    end if;

    v_descripcion := coalesce(nullif(v_linea->>'descripcion', ''), v_producto_nombre, '');

    v_bruto := round(v_cantidad * v_precio, 2);
    v_descuento := round(v_bruto * v_descuento_pct / 100, 2);
    v_subtotal := round(v_bruto - v_descuento, 2);
    v_itbis := round(v_subtotal * v_itbis_tasa / 100, 2);
    v_total := round(v_subtotal + v_itbis, 2);

    v_costo_unitario := 0;
    v_costo_total := 0;

    if v_producto_tipo = 'combo' then
      if not exists (
        select 1 from public.combo_componentes cc where cc.combo_id = v_producto_id
      ) then
        raise exception 'el combo % no tiene componentes', v_producto_nombre using errcode = '22023';
      end if;

      v_costo_total := public._aplicar_salida_combo_inventario(
        v_fecha, v_producto_id, v_almacen_id, v_cantidad_base,
        'factura', v_factura_id, v_ncf, 'Salida de inventario: ' || left(v_descripcion, 80)
      );
      v_costo_unitario := case
        when v_cantidad > 0 then round(v_costo_total / v_cantidad, 2)
        else 0
      end;
    elsif v_producto_inventariable then
      v_costo_total := public._aplicar_salida_inventario(
        v_fecha, v_producto_id, v_almacen_id, v_cantidad_base,
        'factura', v_factura_id, v_ncf, 'Salida de inventario: ' || left(v_descripcion, 80)
      );
      v_costo_unitario := case
        when v_cantidad > 0 then round(v_costo_total / v_cantidad, 2)
        else 0
      end;
    end if;

    insert into public.factura_lineas (
      factura_id, producto_id, descripcion, cantidad, precio, descuento_pct, itbis_tasa,
      subtotal, itbis, total, costo_unitario, unidad_id, unidad_nombre, factor_base
    )
    values (
      v_factura_id, v_producto_id, v_descripcion, v_cantidad, v_precio, v_descuento_pct, v_itbis_tasa,
      v_subtotal, v_itbis, v_total, v_costo_unitario, v_unidad_id, v_unidad_nombre, v_factor
    );

    v_subtotal_factura := v_subtotal_factura + v_subtotal;
    v_descuento_factura := v_descuento_factura + v_descuento;
    v_itbis_factura := v_itbis_factura + v_itbis;
    v_total_factura := v_total_factura + v_total;

    v_cuenta_ingreso := coalesce(
      v_producto_cuenta_ingreso,
      case when v_producto_tipo = 'servicio'
        then public._cuenta_config('ventas_servicios')
        else public._cuenta_config('ventas')
      end
    );

    if v_subtotal > 0 then
      v_asiento_lineas := v_asiento_lineas || jsonb_build_array(jsonb_build_object(
        'cuenta_id', v_cuenta_ingreso,
        'debito', 0,
        'credito', v_subtotal,
        'descripcion', 'Venta: ' || left(v_descripcion, 80)
      ));
    end if;

    if v_producto_tipo = 'combo' or v_producto_inventariable then
      if v_costo_total > 0 then
        v_asiento_lineas := v_asiento_lineas || jsonb_build_array(
          jsonb_build_object(
            'cuenta_id', coalesce(v_producto_cuenta_costo, public._cuenta_config('costo_ventas')),
            'debito', v_costo_total,
            'credito', 0,
            'descripcion', 'Costo de venta: ' || left(v_descripcion, 80)
          ),
          jsonb_build_object(
            'cuenta_id', coalesce(v_producto_cuenta_inventario, public._cuenta_config('inventario')),
            'debito', 0,
            'credito', v_costo_total,
            'descripcion', 'Salida de inventario: ' || left(v_descripcion, 80)
          )
        );
      end if;

    end if;
  end loop;

  if v_total_factura <= 0 then
    raise exception 'el total de la factura debe ser mayor a cero' using errcode = '22023';
  end if;

  update public.facturas
  set subtotal = v_subtotal_factura,
      descuento = v_descuento_factura,
      itbis = v_itbis_factura,
      total = v_total_factura
  where id = v_factura_id;

  v_asiento_lineas := jsonb_build_array(jsonb_build_object(
    'cuenta_id', coalesce(v_contacto.cuenta_cxc_id, public._cuenta_config('cxc')),
    'debito', v_total_factura,
    'credito', 0,
    'contacto_id', v_contacto.id,
    'descripcion', 'CxC factura ' || v_ncf
  )) || v_asiento_lineas;

  if v_itbis_factura > 0 then
    v_asiento_lineas := v_asiento_lineas || jsonb_build_array(jsonb_build_object(
      'cuenta_id', public._cuenta_config('itbis_por_pagar'),
      'debito', 0,
      'credito', v_itbis_factura,
      'descripcion', 'ITBIS factura ' || v_ncf
    ));
  end if;

  v_asiento_id := public._crear_asiento(
    v_fecha,
    'Factura ' || v_ncf,
    'factura',
    v_factura_id,
    v_asiento_lineas
  );

  update public.facturas set asiento_id = v_asiento_id where id = v_factura_id;

  update public.movimientos_inventario mi
  set asiento_id = v_asiento_id
  where mi.origen_tipo = 'factura'
    and mi.origen_id = v_factura_id
    and mi.asiento_id is null
    and not mi.es_recosteo;

  if v_centro_costo_id is not null then
    update public.asiento_lineas
    set centro_costo_id = v_centro_costo_id
    where asiento_id = v_asiento_id;
  end if;

  v_pago := p->'pago';
  if v_pago is not null and jsonb_typeof(v_pago) = 'object' then
    perform public.registrar_pago_recibido(jsonb_build_object(
      'factura_id', v_factura_id,
      'contacto_id', v_contacto.id,
      'fecha', coalesce(v_pago->>'fecha', v_fecha::text),
      'cuenta_id', v_pago->>'cuenta_id',
      'metodo', coalesce(v_pago->>'metodo', 'efectivo'),
      'monto', v_pago->'monto',
      'notas', v_pago->>'notas'
    ));
  end if;

  return v_factura_id;
end;
$function$;


revoke all on function public._crear_factura_sin_impuestos(jsonb) from public, anon, authenticated;

-- Compra: entrada exacta y recosteo visible al cubrir negativos
CREATE OR REPLACE FUNCTION public._crear_factura_proveedor_sin_impuestos(p jsonb)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  v_rol text;
  v_contacto public.contactos%rowtype;
  v_almacen_id uuid;
  v_factura_id uuid;
  v_numero int;
  v_ncf text;
  v_fecha date;
  v_vencimiento date;
  v_centro_costo_id uuid;
  v_linea jsonb;
  v_asiento_id uuid;
  v_asiento_lineas jsonb := '[]'::jsonb;
  v_producto_id uuid;
  v_cuenta_id uuid;
  v_cuenta_debito uuid;
  v_producto_nombre text;
  v_producto_tipo text;
  v_producto_unidad text;
  v_producto_costo numeric(14,2);
  v_producto_cantidad numeric(14,2);
  v_producto_inventariable boolean;
  v_producto_cuenta_costo uuid;
  v_producto_cuenta_inventario uuid;
  v_unidad_id uuid;
  v_unidad_nombre text;
  v_factor numeric(14,4);
  v_cantidad numeric(14,2);
  v_cantidad_base numeric(14,2);
  v_costo numeric(14,2);
  v_costo_base numeric(14,2);
  v_itbis_tasa numeric(5,2);
  v_descripcion text;
  v_subtotal numeric(14,2);
  v_itbis numeric(14,2);
  v_total numeric(14,2);
  v_nuevo_costo numeric(14,2);
  v_subtotal_factura numeric(14,2) := 0;
  v_itbis_factura numeric(14,2) := 0;
  v_total_factura numeric(14,2) := 0;
begin
  v_rol := public.rol_actual();
  if v_rol is null or v_rol not in ('admin', 'contador') then
    raise exception 'sin permiso' using errcode = '42501';
  end if;

  if p is null then
    raise exception 'datos de la factura de proveedor requeridos' using errcode = '22023';
  end if;

  if p->>'contacto_id' is null then
    raise exception 'el proveedor es obligatorio' using errcode = '22023';
  end if;

  select * into v_contacto
  from public.contactos c
  where c.id = (p->>'contacto_id')::uuid and c.activo;

  if not found then
    raise exception 'proveedor no encontrado' using errcode = '22023';
  end if;

  v_centro_costo_id := nullif(p->>'centro_costo_id', '')::uuid;
  if v_centro_costo_id is not null
     and not exists (select 1 from public.centros_costo c where c.id = v_centro_costo_id and c.activo) then
    raise exception 'centro de costo no encontrado o inactivo' using errcode = '22023';
  end if;

  v_almacen_id := nullif(p->>'almacen_id', '')::uuid;
  if v_almacen_id is null then
    v_almacen_id := public._almacen_principal();
  end if;
  if v_almacen_id is null
     or not exists (select 1 from public.almacenes al where al.id = v_almacen_id and al.activo) then
    raise exception 'almacén no encontrado o inactivo' using errcode = '22023';
  end if;

  v_fecha := coalesce((p->>'fecha')::date, current_date);
  v_vencimiento := coalesce((p->>'vencimiento')::date, v_fecha);
  if v_vencimiento < v_fecha then
    raise exception 'el vencimiento no puede ser anterior a la fecha' using errcode = '22023';
  end if;

  v_ncf := nullif(p->>'ncf', '');
  if v_ncf is not null and exists (select 1 from public.facturas_proveedor fp where fp.ncf = v_ncf) then
    raise exception 'el NCF del proveedor ya está registrado' using errcode = '22023';
  end if;

  if p->'lineas' is null
     or jsonb_typeof(p->'lineas') <> 'array'
     or jsonb_array_length(p->'lineas') = 0 then
    raise exception 'la factura de proveedor requiere al menos una línea' using errcode = '22023';
  end if;

  insert into public.facturas_proveedor (ncf, contacto_id, centro_costo_id, almacen_id, fecha, vencimiento, notas, creado_por)
  values (v_ncf, v_contacto.id, v_centro_costo_id, v_almacen_id, v_fecha, v_vencimiento, p->>'notas', auth.uid())
  returning id, numero into v_factura_id, v_numero;

  for v_linea in select * from jsonb_array_elements(p->'lineas') loop
    v_producto_id := nullif(v_linea->>'producto_id', '')::uuid;
    v_cuenta_id := nullif(v_linea->>'cuenta_id', '')::uuid;
    v_unidad_id := nullif(v_linea->>'unidad_id', '')::uuid;
    v_producto_nombre := null;
    v_producto_tipo := null;
    v_producto_unidad := null;
    v_producto_costo := null;
    v_producto_cantidad := null;
    v_producto_inventariable := false;
    v_producto_cuenta_costo := null;
    v_producto_cuenta_inventario := null;
    v_factor := 1;
    v_unidad_nombre := null;

    if v_producto_id is null and v_unidad_id is not null then
      raise exception 'la unidad de medida requiere un producto' using errcode = '22023';
    end if;

    if v_producto_id is not null then
      select
        pr.nombre, pr.tipo, pr.unidad_medida, pr.costo, pr.cantidad, pr.inventariable,
        pr.cuenta_costo_id, pr.cuenta_inventario_id
      into
        v_producto_nombre, v_producto_tipo, v_producto_unidad, v_producto_costo, v_producto_cantidad,
        v_producto_inventariable, v_producto_cuenta_costo, v_producto_cuenta_inventario
      from public.productos pr
      where pr.id = v_producto_id and pr.activo;

      if not found then
        raise exception 'producto no encontrado' using errcode = '22023';
      end if;

      if v_producto_tipo = 'combo' then
        raise exception 'un combo no se puede comprar; registra sus componentes' using errcode = '22023';
      end if;

      v_unidad_nombre := v_producto_unidad;
      if v_unidad_id is not null then
        select pu.nombre, pu.factor_base
        into v_unidad_nombre, v_factor
        from public.producto_unidades pu
        where pu.id = v_unidad_id
          and pu.producto_id = v_producto_id
          and pu.activa;

        if not found then
          raise exception 'unidad de medida no encontrada para el producto' using errcode = '22023';
        end if;
      end if;
    elsif v_cuenta_id is null then
      raise exception 'cada línea requiere un producto o una cuenta' using errcode = '22023';
    end if;

    v_cantidad := round(coalesce((v_linea->>'cantidad')::numeric, 0), 2);
    if v_cantidad <= 0 then
      raise exception 'la cantidad debe ser mayor a cero' using errcode = '22023';
    end if;

    v_cantidad_base := round(v_cantidad * v_factor, 2);

    v_costo := round(coalesce((v_linea->>'costo')::numeric, 0), 2);
    if v_costo < 0 then
      raise exception 'el costo no puede ser negativo' using errcode = '22023';
    end if;

    v_costo_base := case
      when v_cantidad_base > 0 then round(v_costo * v_cantidad / v_cantidad_base, 2)
      else v_costo
    end;

    v_itbis_tasa := round(coalesce((v_linea->>'itbis_tasa')::numeric, 0), 2);
    if v_itbis_tasa < 0 or v_itbis_tasa > 100 then
      raise exception 'la tasa de ITBIS es inválida' using errcode = '22023';
    end if;

    v_descripcion := coalesce(nullif(v_linea->>'descripcion', ''), v_producto_nombre, '');
    v_subtotal := round(v_cantidad * v_costo, 2);
    v_itbis := round(v_subtotal * v_itbis_tasa / 100, 2);
    v_total := round(v_subtotal + v_itbis, 2);

    if v_producto_id is not null and v_producto_inventariable then
      v_cuenta_debito := coalesce(v_producto_cuenta_inventario, public._cuenta_config('inventario'));
    elsif v_producto_id is not null then
      v_cuenta_debito := coalesce(v_producto_cuenta_costo, public._cuenta_config('gastos_generales'));
    else
      v_cuenta_debito := v_cuenta_id;
    end if;

    insert into public.facturas_proveedor_lineas (
      factura_proveedor_id, producto_id, cuenta_id, descripcion, cantidad, costo, itbis_tasa,
      subtotal, itbis, total, unidad_id, unidad_nombre, factor_base
    )
    values (
      v_factura_id,
      v_producto_id,
      case when v_producto_id is null then v_cuenta_id else null end,
      v_descripcion,
      v_cantidad,
      v_costo,
      v_itbis_tasa,
      v_subtotal,
      v_itbis,
      v_total,
      v_unidad_id,
      v_unidad_nombre,
      v_factor
    );

    v_subtotal_factura := v_subtotal_factura + v_subtotal;
    v_itbis_factura := v_itbis_factura + v_itbis;
    v_total_factura := v_total_factura + v_total;

    if v_subtotal > 0 then
      v_asiento_lineas := v_asiento_lineas || jsonb_build_array(jsonb_build_object(
        'cuenta_id', v_cuenta_debito,
        'debito', v_subtotal,
        'credito', 0,
        'descripcion', 'Compra: ' || left(v_descripcion, 80)
      ));
    end if;

    if v_producto_id is not null and v_producto_inventariable then
      perform public._aplicar_entrada_inventario(
        v_fecha, v_producto_id, v_almacen_id, v_cantidad_base, v_subtotal,
        'factura_proveedor', v_factura_id, coalesce(v_ncf, v_numero::text),
        'Compra: ' || left(v_descripcion, 80), null, v_centro_costo_id
      );
    end if;
  end loop;

  if v_total_factura <= 0 then
    raise exception 'el total de la factura de proveedor debe ser mayor a cero' using errcode = '22023';
  end if;

  update public.facturas_proveedor
  set subtotal = v_subtotal_factura,
      itbis = v_itbis_factura,
      total = v_total_factura
  where id = v_factura_id;

  v_asiento_lineas := jsonb_build_array(jsonb_build_object(
    'cuenta_id', coalesce(v_contacto.cuenta_cxp_id, public._cuenta_config('cxp')),
    'debito', 0,
    'credito', v_total_factura,
    'contacto_id', v_contacto.id,
    'descripcion', 'CxP factura proveedor ' || coalesce(v_ncf, v_numero::text)
  )) || v_asiento_lineas;

  if v_itbis_factura > 0 then
    v_asiento_lineas := v_asiento_lineas || jsonb_build_array(jsonb_build_object(
      'cuenta_id', public._cuenta_config('itbis_adelantado'),
      'debito', v_itbis_factura,
      'credito', 0,
      'descripcion', 'ITBIS adelantado factura proveedor ' || coalesce(v_ncf, v_numero::text)
    ));
  end if;

  v_asiento_id := public._crear_asiento(
    v_fecha,
    'Factura proveedor ' || coalesce(v_ncf, v_numero::text),
    'factura_proveedor',
    v_factura_id,
    v_asiento_lineas
  );

  update public.facturas_proveedor set asiento_id = v_asiento_id where id = v_factura_id;

  update public.movimientos_inventario mi
  set asiento_id = v_asiento_id
  where mi.origen_tipo = 'factura_proveedor'
    and mi.origen_id = v_factura_id
    and mi.asiento_id is null
    and not mi.es_recosteo;

  if v_centro_costo_id is not null then
    update public.asiento_lineas
    set centro_costo_id = v_centro_costo_id
    where asiento_id = v_asiento_id;
  end if;

  return v_factura_id;
end;
$function$;


revoke all on function public._crear_factura_proveedor_sin_impuestos(jsonb) from public, anon, authenticated;

-- Nota de crédito de venta: reingreso al promedio vigente exacto
CREATE OR REPLACE FUNCTION public._crear_nota_credito_venta_sin_impuestos(p jsonb)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  v_rol text;
  v_factura public.facturas%rowtype;
  v_almacen_id uuid;
  v_cuenta_cxc uuid;
  v_cuenta_devoluciones uuid;
  v_nota_id uuid;
  v_num public.numeraciones%rowtype;
  v_ncf text;
  v_fecha date;
  v_devuelve boolean;
  v_linea jsonb;
  v_factura_linea public.factura_lineas%rowtype;
  v_acreditado numeric(14,2);
  v_acreditado_subtotal numeric(14,2);
  v_acreditado_itbis numeric(14,2);
  v_cantidad numeric(14,2);
  v_cantidad_base numeric(14,2);
  v_unidad_id uuid;
  v_unidad_nombre text;
  v_factor numeric(14,4);
  v_precio numeric(14,2);
  v_descuento_pct numeric(5,2);
  v_itbis_tasa numeric(5,2);
  v_subtotal numeric(14,2);
  v_itbis numeric(14,2);
  v_total numeric(14,2);
  v_costo_unitario numeric(14,2);
  v_costo_total numeric(14,2);
  v_producto_id uuid;
  v_producto_tipo text;
  v_producto_inventariable boolean;
  v_producto_costo numeric(14,2);
  v_producto_cuenta_costo uuid;
  v_producto_cuenta_inventario uuid;
  v_subtotal_nota numeric(14,2) := 0;
  v_itbis_nota numeric(14,2) := 0;
  v_total_nota numeric(14,2) := 0;
  v_asiento_lineas jsonb := '[]'::jsonb;
  v_asiento_id uuid;
  v_nuevo_credito numeric(14,2);
  v_credito_disponible numeric(14,2);
  v_permite_saldo_a_favor boolean;
begin
  v_rol := public.rol_actual();
  if v_rol is null or v_rol not in ('admin', 'contador') then
    raise exception 'sin permiso' using errcode = '42501';
  end if;

  if p is null or p->>'factura_id' is null then
    raise exception 'la factura es obligatoria' using errcode = '22023';
  end if;

  select * into v_factura
  from public.facturas f
  where f.id = (p->>'factura_id')::uuid
  for update;

  if not found then
    raise exception 'factura no encontrada' using errcode = '22023';
  end if;
  if v_factura.estado = 'anulada' then
    raise exception 'la factura está anulada' using errcode = '22023';
  end if;

  if p->'lineas' is null
     or jsonb_typeof(p->'lineas') <> 'array'
     or jsonb_array_length(p->'lineas') = 0 then
    raise exception 'la nota de crédito requiere al menos una línea' using errcode = '22023';
  end if;

  v_fecha := coalesce((p->>'fecha')::date, current_date);
  v_devuelve := coalesce(nullif(p->>'devuelve_inventario', '')::boolean, true);
  v_cuenta_devoluciones := public._cuenta_config('devoluciones_ventas');

  select * into v_num
  from public.numeraciones n
  where n.tipo_comprobante = '04' and n.activa
  order by n.id
  limit 1
  for update;

  if not found then
    raise exception 'no hay numeración activa para notas de crédito (04)' using errcode = '22023';
  end if;
  if v_num.hasta is not null and v_num.siguiente > v_num.hasta then
    raise exception 'la numeración % está agotada', v_num.prefijo using errcode = '22023';
  end if;
  if v_num.vence is not null and v_num.vence < v_fecha then
    raise exception 'la numeración % está vencida', v_num.prefijo using errcode = '22023';
  end if;

  v_ncf := v_num.prefijo || lpad(v_num.siguiente::text, 8, '0');
  update public.numeraciones set siguiente = siguiente + 1 where id = v_num.id;

  v_almacen_id := nullif(p->>'almacen_id', '')::uuid;
  if v_almacen_id is null then
    v_almacen_id := coalesce(v_factura.almacen_id, public._almacen_principal());
  end if;
  if v_almacen_id is null
     or not exists (select 1 from public.almacenes al where al.id = v_almacen_id and al.activo) then
    raise exception 'almacén no encontrado o inactivo' using errcode = '22023';
  end if;

  insert into public.notas_credito_venta (
    ncf, factura_id, contacto_id, almacen_id, fecha, devuelve_inventario, notas, creado_por
  )
  values (
    v_ncf, v_factura.id, v_factura.contacto_id, v_almacen_id, v_fecha, v_devuelve, p->>'notas', auth.uid()
  )
  returning id into v_nota_id;

  for v_linea in select * from jsonb_array_elements(p->'lineas') loop
    if nullif(v_linea->>'factura_linea_id', '') is null then
      raise exception 'cada línea requiere la línea de la factura' using errcode = '22023';
    end if;

    select * into v_factura_linea
    from public.factura_lineas fl
    where fl.id = (v_linea->>'factura_linea_id')::uuid
      and fl.factura_id = v_factura.id;

    if not found then
      raise exception 'línea de factura no encontrada' using errcode = '22023';
    end if;

    v_cantidad := round(coalesce((v_linea->>'cantidad')::numeric, 0), 2);
    if v_cantidad <= 0 then
      raise exception 'la cantidad debe ser mayor a cero' using errcode = '22023';
    end if;

    select
      round(coalesce(sum(nl.cantidad), 0), 2),
      round(coalesce(sum(nl.subtotal), 0), 2),
      round(coalesce(sum(nl.itbis), 0), 2)
    into v_acreditado, v_acreditado_subtotal, v_acreditado_itbis
    from public.nota_credito_venta_lineas nl
    join public.notas_credito_venta n on n.id = nl.nota_id
    where nl.factura_linea_id = v_factura_linea.id
      and n.factura_id = v_factura.id
      and n.estado = 'activa';

    if v_cantidad > round(v_factura_linea.cantidad - v_acreditado, 2) then
      raise exception 'la cantidad excede lo disponible por acreditar en la línea' using errcode = '22023';
    end if;

    v_unidad_id := v_factura_linea.unidad_id;
    v_unidad_nombre := v_factura_linea.unidad_nombre;
    v_factor := coalesce(v_factura_linea.factor_base, 1);
    v_cantidad_base := round(v_cantidad * v_factor, 2);

    v_precio := v_factura_linea.precio;
    v_descuento_pct := v_factura_linea.descuento_pct;
    v_itbis_tasa := v_factura_linea.itbis_tasa;
    v_costo_unitario := v_factura_linea.costo_unitario;

    -- Si esta NC agota la línea, el monto es exactamente lo que falta por
    -- acreditar: la línea de la factura menos lo ya acreditado. Evita el
    -- ±0.01 de prorratear varias parciales y que la última unidad se bloquee.
    if round(v_acreditado + v_cantidad, 2) = round(v_factura_linea.cantidad, 2) then
      v_subtotal := greatest(round(v_factura_linea.subtotal - v_acreditado_subtotal, 2), 0);
      v_itbis := greatest(round(v_factura_linea.itbis - v_acreditado_itbis, 2), 0);
    else
      v_subtotal := round(
        round(v_cantidad * v_precio, 2) - round(round(v_cantidad * v_precio, 2) * v_descuento_pct / 100, 2),
        2
      );
      v_itbis := round(v_subtotal * v_itbis_tasa / 100, 2);
    end if;
    v_total := round(v_subtotal + v_itbis, 2);
    v_costo_total := round(v_cantidad * v_costo_unitario, 2);

    v_producto_id := v_factura_linea.producto_id;
    v_producto_tipo := null;
    v_producto_inventariable := false;
    v_producto_costo := 0;
    v_producto_cuenta_costo := null;
    v_producto_cuenta_inventario := null;

    if v_producto_id is not null then
      select
        pr.tipo, pr.inventariable, pr.costo, pr.cuenta_costo_id, pr.cuenta_inventario_id
      into
        v_producto_tipo, v_producto_inventariable, v_producto_costo,
        v_producto_cuenta_costo, v_producto_cuenta_inventario
      from public.productos pr
      where pr.id = v_producto_id;

      if not found then
        v_producto_tipo := null;
        v_producto_inventariable := false;
        v_producto_costo := 0;
        v_producto_cuenta_costo := null;
        v_producto_cuenta_inventario := null;
      end if;
    end if;

    -- Devolución al costo promedio VIGENTE (no al costo de la venta) y, en
    -- combos, a la suma de los componentes vigentes.
    if v_devuelve then
      if v_producto_tipo = 'combo' then
        if not exists (
          select 1 from public.combo_componentes cc where cc.combo_id = v_producto_id
        ) then
          raise exception 'el combo % no tiene componentes', v_factura_linea.descripcion using errcode = '22023';
        end if;
        v_costo_total := public._aplicar_entrada_combo_inventario(
          v_fecha, v_producto_id, v_almacen_id, v_cantidad_base,
          'nota_credito_venta', v_nota_id, v_ncf,
          'Devolución inventario: ' || left(v_factura_linea.descripcion, 70)
        );
      elsif v_producto_inventariable then
        v_costo_total := round(
          v_cantidad_base * coalesce(nullif((select pr.costo_promedio from public.productos pr where pr.id = v_producto_id), 0), v_producto_costo, 0),
          2
        );
        perform public._aplicar_entrada_inventario(
          v_fecha, v_producto_id, v_almacen_id, v_cantidad_base, v_costo_total,
          'nota_credito_venta', v_nota_id, v_ncf,
          'Devolución inventario: ' || left(v_factura_linea.descripcion, 70)
        );
      end if;

      v_costo_unitario := case
        when v_cantidad > 0 then round(v_costo_total / v_cantidad, 2)
        else 0
      end;
    end if;

    insert into public.nota_credito_venta_lineas (
      nota_id, factura_linea_id, producto_id, descripcion, cantidad, precio, descuento_pct,
      itbis_tasa, subtotal, itbis, total, costo_unitario, unidad_id, unidad_nombre, factor_base
    )
    values (
      v_nota_id, v_factura_linea.id, v_factura_linea.producto_id, v_factura_linea.descripcion,
      v_cantidad, v_precio, v_descuento_pct, v_itbis_tasa, v_subtotal, v_itbis, v_total, v_costo_unitario,
      v_unidad_id, v_unidad_nombre, v_factor
    );

    v_subtotal_nota := v_subtotal_nota + v_subtotal;
    v_itbis_nota := v_itbis_nota + v_itbis;
    v_total_nota := v_total_nota + v_total;

    if v_subtotal > 0 then
      v_asiento_lineas := v_asiento_lineas || jsonb_build_array(jsonb_build_object(
        'cuenta_id', v_cuenta_devoluciones,
        'debito', v_subtotal,
        'credito', 0,
        'descripcion', 'Devolución venta: ' || left(v_factura_linea.descripcion, 70)
      ));
    end if;

    if v_devuelve and (v_producto_tipo = 'combo' or v_producto_inventariable) then
      if v_costo_total > 0 then
        v_asiento_lineas := v_asiento_lineas || jsonb_build_array(
          jsonb_build_object(
            'cuenta_id', coalesce(v_producto_cuenta_inventario, public._cuenta_config('inventario')),
            'debito', v_costo_total,
            'credito', 0,
            'descripcion', 'Devolución inventario: ' || left(v_factura_linea.descripcion, 70)
          ),
          jsonb_build_object(
            'cuenta_id', coalesce(v_producto_cuenta_costo, public._cuenta_config('costo_ventas')),
            'debito', 0,
            'credito', v_costo_total,
            'descripcion', 'Reversión costo de venta: ' || left(v_factura_linea.descripcion, 70)
          )
        );
      end if;

    end if;
  end loop;

  if v_total_nota <= 0 then
    raise exception 'el total de la nota de crédito debe ser mayor a cero' using errcode = '22023';
  end if;

  v_nuevo_credito := round(v_factura.credito + v_total_nota, 2);
  if v_nuevo_credito > v_factura.total then
    raise exception 'el crédito de la nota excede el total de la factura' using errcode = '22023';
  end if;

  -- Sin reembolso explícito, la NC no puede dejar crédito por encima de lo
  -- que la factura todavía debe. El POS sí puede: elige el reembolso en
  -- pantalla y el excedente queda como saldo a favor del cliente.
  v_credito_disponible := round(v_factura.total - v_factura.pagado - v_factura.retenido, 2);
  v_permite_saldo_a_favor := coalesce(
    nullif(p->>'permite_saldo_a_favor', '')::boolean,
    false
  );
  if v_nuevo_credito > v_credito_disponible and not v_permite_saldo_a_favor then
    raise exception 'la nota dejaría un crédito de % sobre una factura con % pendiente',
      v_nuevo_credito, greatest(v_credito_disponible, 0)
      using errcode = '22023';
  end if;

  update public.notas_credito_venta
  set subtotal = v_subtotal_nota,
      itbis = v_itbis_nota,
      total = v_total_nota
  where id = v_nota_id;

  select c.cuenta_cxc_id into v_cuenta_cxc
  from public.contactos c
  where c.id = v_factura.contacto_id;

  v_asiento_lineas := jsonb_build_array(jsonb_build_object(
    'cuenta_id', coalesce(v_cuenta_cxc, public._cuenta_config('cxc')),
    'debito', 0,
    'credito', v_total_nota,
    'contacto_id', v_factura.contacto_id,
    'descripcion', 'CxC nota de crédito ' || v_ncf
  )) || v_asiento_lineas;

  if v_itbis_nota > 0 then
    v_asiento_lineas := v_asiento_lineas || jsonb_build_array(jsonb_build_object(
      'cuenta_id', public._cuenta_config('itbis_por_pagar'),
      'debito', v_itbis_nota,
      'credito', 0,
      'descripcion', 'ITBIS nota de crédito ' || v_ncf
    ));
  end if;

  v_asiento_id := public._crear_asiento(
    v_fecha,
    'Nota de crédito ' || v_ncf,
    'nota_credito_venta',
    v_nota_id,
    v_asiento_lineas
  );

  update public.notas_credito_venta set asiento_id = v_asiento_id where id = v_nota_id;

  update public.movimientos_inventario mi
  set asiento_id = v_asiento_id
  where mi.origen_tipo = 'nota_credito_venta'
    and mi.origen_id = v_nota_id
    and mi.asiento_id is null
    and not mi.es_recosteo;

  update public.facturas
  set credito = v_nuevo_credito,
      estado = case
        when round(v_factura.pagado + v_factura.retenido + v_nuevo_credito, 2) >= v_factura.total then 'pagada'
        else 'abierta'
      end
  where id = v_factura.id;

  return v_nota_id;
end;
$function$;


revoke all on function public._crear_nota_credito_venta_sin_impuestos(jsonb) from public, anon, authenticated;

-- Nota de crédito de compra: retiro exacto de la compra acreditada
CREATE OR REPLACE FUNCTION public._crear_nota_credito_compra_sin_impuestos(p jsonb)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  v_rol text;
  v_factura public.facturas_proveedor%rowtype;
  v_contacto public.contactos%rowtype;
  v_almacen_id uuid;
  v_nota_id uuid;
  v_ncf text;
  v_fecha date;
  v_devuelve boolean;
  v_linea jsonb;
  v_factura_linea public.facturas_proveedor_lineas%rowtype;
  v_acreditado numeric(14,2);
  v_cantidad numeric(14,2);
  v_cantidad_base numeric(14,2);
  v_costo numeric(14,2);
  v_itbis_tasa numeric(5,2);
  v_subtotal numeric(14,2);
  v_itbis numeric(14,2);
  v_total numeric(14,2);
  v_producto public.productos%rowtype;
  v_cuenta_credito uuid;
  v_cantidad_actual numeric(14,2);
  v_costo_actual numeric(14,2);
  v_cantidad_nueva numeric(14,2);
  v_costo_nuevo numeric(14,2);
  v_subtotal_nota numeric(14,2) := 0;
  v_itbis_nota numeric(14,2) := 0;
  v_total_nota numeric(14,2) := 0;
  v_asiento_lineas jsonb := '[]'::jsonb;
  v_asiento_id uuid;
  v_nuevo_credito numeric(14,2);
begin
  v_rol := public.rol_actual();
  if v_rol is null or v_rol not in ('admin', 'contador') then
    raise exception 'sin permiso' using errcode = '42501';
  end if;

  if p is null or p->>'factura_proveedor_id' is null then
    raise exception 'la factura de proveedor es obligatoria' using errcode = '22023';
  end if;

  select * into v_factura
  from public.facturas_proveedor fp
  where fp.id = (p->>'factura_proveedor_id')::uuid
  for update;

  if not found then
    raise exception 'factura de proveedor no encontrada' using errcode = '22023';
  end if;
  if v_factura.estado = 'anulada' then
    raise exception 'la factura de proveedor está anulada' using errcode = '22023';
  end if;

  if p->'lineas' is null
     or jsonb_typeof(p->'lineas') <> 'array'
     or jsonb_array_length(p->'lineas') = 0 then
    raise exception 'la nota de crédito requiere al menos una línea' using errcode = '22023';
  end if;

  v_fecha := coalesce((p->>'fecha')::date, current_date);
  v_devuelve := coalesce(nullif(p->>'devuelve_inventario', '')::boolean, true);

  v_ncf := nullif(upper(trim(p->>'ncf')), '');
  if v_ncf is not null and v_ncf !~ '^(B04[0-9]{8}|E34[0-9]{10})$' then
    raise exception 'el NCF de la nota debe ser B04 + 8 dígitos o E34 + 10 dígitos' using errcode = '22023';
  end if;

  v_almacen_id := nullif(p->>'almacen_id', '')::uuid;
  if v_almacen_id is null then
    v_almacen_id := coalesce(v_factura.almacen_id, public._almacen_principal());
  end if;
  if v_almacen_id is null
     or not exists (select 1 from public.almacenes al where al.id = v_almacen_id and al.activo) then
    raise exception 'almacén no encontrado o inactivo' using errcode = '22023';
  end if;

  insert into public.notas_credito_compra (
    ncf, factura_proveedor_id, contacto_id, almacen_id, fecha, devuelve_inventario, notas, creado_por
  )
  values (
    v_ncf, v_factura.id, v_factura.contacto_id, v_almacen_id, v_fecha, v_devuelve, p->>'notas', auth.uid()
  )
  returning id into v_nota_id;

  for v_linea in select * from jsonb_array_elements(p->'lineas') loop
    if nullif(v_linea->>'factura_proveedor_linea_id', '') is null then
      raise exception 'cada línea requiere la línea de la factura de proveedor' using errcode = '22023';
    end if;

    select * into v_factura_linea
    from public.facturas_proveedor_lineas fpl
    where fpl.id = (v_linea->>'factura_proveedor_linea_id')::uuid
      and fpl.factura_proveedor_id = v_factura.id;

    if not found then
      raise exception 'línea de factura de proveedor no encontrada' using errcode = '22023';
    end if;

    v_cantidad := round(coalesce((v_linea->>'cantidad')::numeric, 0), 2);
    if v_cantidad <= 0 then
      raise exception 'la cantidad debe ser mayor a cero' using errcode = '22023';
    end if;

    select coalesce(sum(nl.cantidad), 0)
    into v_acreditado
    from public.nota_credito_compra_lineas nl
    join public.notas_credito_compra n on n.id = nl.nota_id
    where nl.factura_proveedor_linea_id = v_factura_linea.id
      and n.estado = 'activa';

    if v_cantidad > round(v_factura_linea.cantidad - v_acreditado, 2) then
      raise exception 'la cantidad excede lo disponible por acreditar en la línea' using errcode = '22023';
    end if;

    v_cantidad_base := round(v_cantidad * coalesce(v_factura_linea.factor_base, 1), 2);
    v_costo := v_factura_linea.costo;
    v_itbis_tasa := v_factura_linea.itbis_tasa;
    v_subtotal := round(v_cantidad * v_costo, 2);
    v_itbis := round(v_subtotal * v_itbis_tasa / 100, 2);
    v_total := round(v_subtotal + v_itbis, 2);

    insert into public.nota_credito_compra_lineas (
      nota_id, factura_proveedor_linea_id, producto_id, cuenta_id, descripcion,
      cantidad, costo, itbis_tasa, subtotal, itbis, total
    )
    values (
      v_nota_id, v_factura_linea.id, v_factura_linea.producto_id, v_factura_linea.cuenta_id,
      v_factura_linea.descripcion, v_cantidad, v_costo, v_itbis_tasa, v_subtotal, v_itbis, v_total
    );

    v_subtotal_nota := v_subtotal_nota + v_subtotal;
    v_itbis_nota := v_itbis_nota + v_itbis;
    v_total_nota := v_total_nota + v_total;

    v_cuenta_credito := null;
    if v_factura_linea.producto_id is not null then
      select * into v_producto
      from public.productos pr
      where pr.id = v_factura_linea.producto_id;

      if found then
        if v_producto.inventariable then
          v_cuenta_credito := coalesce(v_producto.cuenta_inventario_id, public._cuenta_config('inventario'));
        else
          v_cuenta_credito := coalesce(v_producto.cuenta_costo_id, public._cuenta_config('gastos_generales'));
        end if;
      end if;
    end if;
    if v_cuenta_credito is null then
      v_cuenta_credito := coalesce(v_factura_linea.cuenta_id, public._cuenta_config('gastos_generales'));
    end if;

    if v_subtotal > 0 then
      v_asiento_lineas := v_asiento_lineas || jsonb_build_array(jsonb_build_object(
        'cuenta_id', v_cuenta_credito,
        'debito', 0,
        'credito', v_subtotal,
        'descripcion', 'Devolución compra: ' || left(v_factura_linea.descripcion, 70)
      ));
    end if;

    if v_devuelve
       and v_factura_linea.producto_id is not null
       and v_producto.inventariable then
      perform public._aplicar_retiro_inventario_exacto(
        v_fecha, v_producto.id, v_almacen_id, v_cantidad_base, v_subtotal,
        'nota_credito_compra', v_nota_id, coalesce(v_ncf, 'sin NCF'),
        'Devolución compra: ' || left(v_factura_linea.descripcion, 70)
      );
    end if;
  end loop;

  if v_total_nota <= 0 then
    raise exception 'el total de la nota de crédito debe ser mayor a cero' using errcode = '22023';
  end if;

  v_nuevo_credito := round(v_factura.credito + v_total_nota, 2);
  if v_nuevo_credito > v_factura.total then
    raise exception 'el crédito de la nota excede el total de la factura de proveedor' using errcode = '22023';
  end if;

  update public.notas_credito_compra
  set subtotal = v_subtotal_nota,
      itbis = v_itbis_nota,
      total = v_total_nota
  where id = v_nota_id;

  select * into v_contacto from public.contactos c where c.id = v_factura.contacto_id;

  v_asiento_lineas := jsonb_build_array(jsonb_build_object(
    'cuenta_id', coalesce(v_contacto.cuenta_cxp_id, public._cuenta_config('cxp')),
    'debito', v_total_nota,
    'credito', 0,
    'contacto_id', v_factura.contacto_id,
    'descripcion', 'CxP nota de crédito compra ' || coalesce(v_ncf, 'sin NCF')
  )) || v_asiento_lineas;

  if v_itbis_nota > 0 then
    v_asiento_lineas := v_asiento_lineas || jsonb_build_array(jsonb_build_object(
      'cuenta_id', public._cuenta_config('itbis_adelantado'),
      'debito', 0,
      'credito', v_itbis_nota,
      'descripcion', 'ITBIS nota de crédito compra ' || coalesce(v_ncf, 'sin NCF')
    ));
  end if;

  v_asiento_id := public._crear_asiento(
    v_fecha,
    'Nota de crédito compra ' || coalesce(v_ncf, 'sin NCF'),
    'nota_credito_compra',
    v_nota_id,
    v_asiento_lineas
  );

  update public.notas_credito_compra set asiento_id = v_asiento_id where id = v_nota_id;

  update public.movimientos_inventario mi
  set asiento_id = v_asiento_id
  where mi.origen_tipo = 'nota_credito_compra'
    and mi.origen_id = v_nota_id
    and mi.asiento_id is null
    and not mi.es_recosteo;

  update public.facturas_proveedor
  set credito = v_nuevo_credito,
      estado = case
        when round(v_factura.pagado + v_nuevo_credito, 2) >= v_factura.total then 'pagada'
        else 'abierta'
      end
  where id = v_factura.id;

  return v_nota_id;
end;
$function$;


revoke all on function public._crear_nota_credito_compra_sin_impuestos(jsonb) from public, anon, authenticated;

-- Ajustes de inventario: entradas y salidas exactas
CREATE OR REPLACE FUNCTION public._crear_ajuste_inventario_base(p jsonb)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  v_rol text;
  v_almacen public.almacenes%rowtype;
  v_id uuid;
  v_numero int;
  v_fecha date;
  v_observaciones text;
  v_lineas jsonb;
  v_linea jsonb;
  v_producto public.productos%rowtype;
  v_producto_id uuid;
  v_tipo text;
  v_cantidad numeric(14,2);
  v_costo numeric(14,2);
  v_total_linea numeric(14,2);
  v_total numeric(14,2) := 0;
  v_cantidad_nueva numeric(14,2);
  v_costo_nuevo numeric(14,2);
  v_cuenta_inventario uuid;
  v_cuenta_ajuste uuid;
  v_asiento_lineas jsonb := '[]'::jsonb;
  v_asiento_id uuid;
  v_descripcion text;
begin
  v_rol := public.rol_actual();
  if v_rol is null or v_rol not in ('admin', 'contador') then
    raise exception 'sin permiso' using errcode = '42501';
  end if;

  if p is null then
    raise exception 'datos del ajuste requeridos' using errcode = '22023';
  end if;

  if nullif(p->>'almacen_id', '') is null then
    raise exception 'selecciona el almacén del ajuste' using errcode = '22023';
  end if;

  select * into v_almacen
  from public.almacenes a
  where a.id = (p->>'almacen_id')::uuid
    and a.activo;

  if not found then
    raise exception 'almacén no encontrado o inactivo' using errcode = '22023';
  end if;

  v_fecha := coalesce((p->>'fecha')::date, current_date);
  v_observaciones := nullif(trim(coalesce(p->>'observaciones', '')), '');

  v_lineas := coalesce(p->'lineas', '[]'::jsonb);
  if jsonb_typeof(v_lineas) <> 'array' or jsonb_array_length(v_lineas) = 0 then
    raise exception 'el ajuste requiere al menos un producto' using errcode = '22023';
  end if;

  v_cuenta_ajuste := public._cuenta_config('ajuste_inventario');

  insert into public.ajustes_inventario (fecha, almacen_id, observaciones, total)
  values (v_fecha, v_almacen.id, v_observaciones, 0)
  returning id, numero into v_id, v_numero;

  for v_linea in select * from jsonb_array_elements(v_lineas) loop
    v_producto_id := nullif(v_linea->>'producto_id', '')::uuid;
    if v_producto_id is null then
      raise exception 'cada línea requiere un producto' using errcode = '22023';
    end if;

    select * into v_producto
    from public.productos pr
    where pr.id = v_producto_id
      and pr.activo
    for update;

    if not found then
      raise exception 'producto no encontrado o inactivo' using errcode = '22023';
    end if;

    if not v_producto.inventariable then
      raise exception 'el producto % no controla inventario', v_producto.nombre using errcode = '22023';
    end if;

    v_tipo := lower(coalesce(nullif(v_linea->>'tipo', ''), 'entrada'));
    if v_tipo not in ('entrada', 'salida') then
      raise exception 'el tipo de ajuste debe ser entrada o salida' using errcode = '22023';
    end if;

    v_cantidad := round(coalesce((v_linea->>'cantidad')::numeric, 0), 2);
    if v_cantidad <= 0 then
      raise exception 'la cantidad ajustada debe ser mayor a cero' using errcode = '22023';
    end if;

    v_costo := round(coalesce((v_linea->>'costo_unitario')::numeric, v_producto.costo), 2);
    if v_costo < 0 then
      raise exception 'el costo no puede ser negativo' using errcode = '22023';
    end if;

    v_total_linea := round(v_cantidad * v_costo, 2);
    if v_total_linea <= 0 then
      raise exception 'el costo del ajuste debe ser mayor a cero' using errcode = '22023';
    end if;

    if v_tipo = 'entrada' then
      perform public._aplicar_entrada_inventario(
        v_fecha, v_producto.id, v_almacen.id, v_cantidad, v_total_linea,
        'ajuste_inventario', v_id, v_numero::text,
        'Entrada de inventario: ' || left(v_producto.nombre, 80)
      );
    else
      v_total_linea := public._aplicar_salida_inventario(
        v_fecha, v_producto.id, v_almacen.id, v_cantidad,
        'ajuste_inventario', v_id, v_numero::text,
        'Salida de inventario: ' || left(v_producto.nombre, 80), null, v_costo
      );
      v_costo := case when v_cantidad > 0 then round(v_total_linea / v_cantidad, 2) else v_costo end;
    end if;

    insert into public.ajuste_inventario_lineas (
      ajuste_id, producto_id, tipo, cantidad, costo_unitario, total
    )
    values (
      v_id, v_producto.id, v_tipo, v_cantidad, v_costo, v_total_linea
    );

    v_cuenta_inventario := coalesce(v_producto.cuenta_inventario_id, public._cuenta_config('inventario'));

    if v_tipo = 'entrada' then
      v_asiento_lineas := v_asiento_lineas || jsonb_build_array(
        jsonb_build_object(
          'cuenta_id', v_cuenta_inventario,
          'debito', v_total_linea,
          'credito', 0,
          'descripcion', 'Entrada de inventario: ' || left(v_producto.nombre, 80)
        ),
        jsonb_build_object(
          'cuenta_id', v_cuenta_ajuste,
          'debito', 0,
          'credito', v_total_linea,
          'descripcion', 'Ajuste de inventario: ' || left(v_producto.nombre, 80)
        )
      );
    else
      v_asiento_lineas := v_asiento_lineas || jsonb_build_array(
        jsonb_build_object(
          'cuenta_id', v_cuenta_ajuste,
          'debito', v_total_linea,
          'credito', 0,
          'descripcion', 'Ajuste de inventario: ' || left(v_producto.nombre, 80)
        ),
        jsonb_build_object(
          'cuenta_id', v_cuenta_inventario,
          'debito', 0,
          'credito', v_total_linea,
          'descripcion', 'Salida de inventario: ' || left(v_producto.nombre, 80)
        )
      );
    end if;

    v_total := v_total + v_total_linea;
  end loop;

  v_descripcion := coalesce(v_observaciones, 'Ajuste de inventario #' || v_numero);

  v_asiento_id := public._crear_asiento(
    v_fecha,
    v_descripcion,
    'ajuste_inventario',
    v_id,
    v_asiento_lineas
  );

  update public.ajustes_inventario
  set total = v_total,
      asiento_id = v_asiento_id
  where id = v_id;

  update public.movimientos_inventario mi
  set asiento_id = v_asiento_id
  where mi.origen_tipo = 'ajuste_inventario'
    and mi.origen_id = v_id
    and mi.asiento_id is null
    and not mi.es_recosteo;

  return v_id;
end;
$function$;


revoke all on function public._crear_ajuste_inventario_base(jsonb) from public, anon, authenticated;

CREATE OR REPLACE FUNCTION public.crear_ajuste_inventario(p jsonb)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  v_linea jsonb;
  v_norm jsonb := '[]'::jsonb;
  v_producto_id uuid;
  v_costo numeric(14,2);
begin
  if p is null or jsonb_typeof(p->'lineas') <> 'array' then
    return public._crear_ajuste_inventario_base(p);
  end if;

  for v_linea in select * from jsonb_array_elements(p->'lineas') loop
    -- Solo las salidas: Alegra bloquea su costo al promedio vigente. Las
    -- entradas conservan el costo editable que envió la pantalla.
    if lower(coalesce(nullif(v_linea->>'tipo', ''), 'entrada')) = 'salida' then
      v_producto_id := nullif(v_linea->>'producto_id', '')::uuid;
      if v_producto_id is not null then
        select round(coalesce(nullif(pr.costo_promedio, 0), pr.costo, 0), 2) into v_costo
        from public.productos pr
        where pr.id = v_producto_id;

        if found then
          v_linea := v_linea || jsonb_build_object('costo_unitario', v_costo);
        end if;
      end if;
    end if;

    v_norm := v_norm || jsonb_build_array(v_linea);
  end loop;

  return public._crear_ajuste_inventario_base(
    p || jsonb_build_object('lineas', v_norm)
  );
end;
$function$;


revoke all on function public.crear_ajuste_inventario(jsonb) from public, anon, authenticated;
grant execute on function public.crear_ajuste_inventario(jsonb) to authenticated;

-- Anulación de ajustes: reversión exacta al centavo
CREATE OR REPLACE FUNCTION public._anular_documento_ajustes_base(p_tipo text, p_id uuid)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  v_rol text;
  v_ajuste public.ajustes_inventario%rowtype;
  v_linea public.ajuste_inventario_lineas%rowtype;
  v_cantidad_actual numeric(14,2);
  v_costo_actual numeric(14,2);
  v_cantidad_nueva numeric(14,2);
  v_costo_nuevo numeric(14,2);
  v_asiento public.asientos%rowtype;
  v_lineas jsonb;
  v_reversion_id uuid;
begin
  if p_tipo is distinct from 'ajuste_inventario' then
    return public._anular_documento_base(p_tipo, p_id);
  end if;

  v_rol := public.rol_actual();
  if v_rol is null or v_rol not in ('admin', 'contador') then
    raise exception 'sin permiso' using errcode = '42501';
  end if;

  if p_id is null then
    raise exception 'el documento es obligatorio' using errcode = '22023';
  end if;

  select * into v_ajuste
  from public.ajustes_inventario ai
  where ai.id = p_id
  for update;

  if not found then
    raise exception 'ajuste de inventario no encontrado' using errcode = '22023';
  end if;
  if v_ajuste.estado = 'anulada' then
    raise exception 'el ajuste de inventario ya está anulado' using errcode = '22023';
  end if;

  for v_linea in
    select * from public.ajuste_inventario_lineas ail
    where ail.ajuste_id = p_id
    order by ail.id
  loop
    if v_linea.tipo = 'entrada' then
      perform public._aplicar_retiro_inventario_exacto(
        current_date, v_linea.producto_id, v_ajuste.almacen_id, v_linea.cantidad, v_linea.total,
        'anulacion', p_id, 'Ajuste #' || v_ajuste.numero::text,
        'Anulación entrada de inventario: ' || v_linea.producto_id::text
      );
    else
      perform public._aplicar_entrada_inventario(
        current_date, v_linea.producto_id, v_ajuste.almacen_id, v_linea.cantidad, v_linea.total,
        'anulacion', p_id, 'Ajuste #' || v_ajuste.numero::text,
        'Anulación salida de inventario: ' || v_linea.producto_id::text
      );
    end if;
  end loop;

  if v_ajuste.asiento_id is null then
    raise exception 'el documento no tiene asiento contable' using errcode = '22023';
  end if;

  select * into v_asiento
  from public.asientos a
  where a.id = v_ajuste.asiento_id;

  if not found then
    raise exception 'asiento no encontrado' using errcode = '22023';
  end if;
  if exists (
    select 1 from public.asientos a where a.anula_asiento_id = v_ajuste.asiento_id
  ) then
    raise exception 'el asiento del documento ya fue anulado' using errcode = '22023';
  end if;

  select jsonb_agg(jsonb_build_object(
    'cuenta_id', l.cuenta_id,
    'contacto_id', l.contacto_id,
    'centro_costo_id', l.centro_costo_id,
    'descripcion', 'Anulación: ' || left(coalesce(l.descripcion, ''), 70),
    'debito', l.credito,
    'credito', l.debito
  ) order by l.id)
  into v_lineas
  from public.asiento_lineas l
  where l.asiento_id = v_ajuste.asiento_id;

  if v_lineas is null or jsonb_array_length(v_lineas) < 2 then
    raise exception 'el asiento no tiene líneas para revertir' using errcode = '22023';
  end if;

  v_reversion_id := public._crear_asiento(
    current_date,
    'Anulación ajuste_inventario #' || coalesce(v_ajuste.numero::text, ''),
    'anulacion',
    p_id,
    v_lineas
  );

  update public.asientos
  set anula_asiento_id = v_ajuste.asiento_id
  where id = v_reversion_id;

  update public.ajustes_inventario set estado = 'anulada' where id = p_id;

  update public.movimientos_inventario mi
  set asiento_id = v_reversion_id
  where mi.origen_tipo = 'anulacion'
    and mi.origen_id = p_id
    and mi.asiento_id is null
    and not mi.es_recosteo;

  return p_id;
end;
$function$;


revoke all on function public._anular_documento_ajustes_base(text, uuid) from public, anon, authenticated;

-- Anulación de ventas/compras/NC: reversión exacta al centavo
CREATE OR REPLACE FUNCTION public._anular_documento_ajustes(p_tipo text, p_id uuid, p_fecha date DEFAULT NULL::date)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  v_rol text;
  v_factura public.facturas%rowtype;
  v_factura_prov public.facturas_proveedor%rowtype;
  v_nota_credito public.notas_credito_venta%rowtype;
  v_nota_credito_linea public.nota_credito_venta_lineas%rowtype;
  v_nota_debito public.notas_debito_venta%rowtype;
  v_gasto public.gastos_menores%rowtype;
  v_linea public.factura_lineas%rowtype;
  v_linea_prov public.facturas_proveedor_lineas%rowtype;
  v_producto_tipo text;
  v_producto_inventariable boolean;
  v_cantidad_base numeric(14,2);
  v_cantidad_actual numeric(14,2);
  v_costo_actual numeric(14,2);
  v_cantidad_nueva numeric(14,2);
  v_costo_nuevo numeric(14,2);
  v_costo_linea_base numeric(14,2);
  v_almacen_id uuid;
  v_asiento public.asientos%rowtype;
  v_asiento_id uuid;
  v_numero int;
  v_lineas jsonb;
  v_reversion_id uuid;
  v_nuevo_credito numeric(14,2);
  v_valor_exacto numeric(14,2);
  v_linea_resumen record;
  v_componente record;
  v_cantidad_componente numeric(14,2);
  v_costo_referencia numeric(16,6);
begin
  if p_tipo is null or p_tipo not in (
    'factura', 'factura_proveedor', 'nota_credito_venta', 'nota_debito_venta',
    'gasto_menor'
  ) then
    return public._anular_documento_ajustes_base(p_tipo, p_id);
  end if;

  v_rol := public.rol_actual();
  if v_rol is null or v_rol not in ('admin', 'contador') then
    raise exception 'sin permiso' using errcode = '42501';
  end if;

  if p_id is null then
    raise exception 'el documento es obligatorio' using errcode = '22023';
  end if;

  if p_tipo = 'factura' then
    select * into v_factura
    from public.facturas f
    where f.id = p_id
    for update;

    if not found then
      raise exception 'factura no encontrada' using errcode = '22023';
    end if;
    if v_factura.estado = 'anulada' then
      raise exception 'la factura ya está anulada' using errcode = '22023';
    end if;
    if exists (
      select 1 from public.pagos_recibidos pr
      where pr.factura_id = p_id and pr.estado = 'activo'
    ) or exists (
      select 1
      from public.pago_recibido_aplicaciones pa
      join public.pagos_recibidos pr on pr.id = pa.pago_id
      where pa.factura_id = p_id and pr.estado = 'activo'
    ) then
      raise exception 'no se puede anular una factura con pagos activos' using errcode = 'P0001';
    end if;
    if exists (
      select 1 from public.notas_credito_venta nc
      where nc.factura_id = p_id and nc.estado = 'activa'
    ) or exists (
      select 1 from public.notas_debito_venta nd
      where nd.factura_id = p_id and nd.estado = 'activa'
    ) then
      raise exception 'no se puede anular una factura con notas de crédito o débito activas'
        using errcode = 'P0001';
    end if;

    v_almacen_id := coalesce(v_factura.almacen_id, public._almacen_principal());

    for v_linea_resumen in
      select fl.producto_id,
             round(sum(fl.cantidad * coalesce(fl.factor_base, 1)), 2) as cantidad_base,
             round(sum(fl.cantidad * fl.costo_unitario), 2) as costo_estimado
      from public.factura_lineas fl
      where fl.factura_id = p_id
        and fl.producto_id is not null
      group by fl.producto_id
      order by fl.producto_id
    loop
      select pr.tipo, pr.inventariable
      into v_producto_tipo, v_producto_inventariable
      from public.productos pr
      where pr.id = v_linea_resumen.producto_id;

      if not found then
        continue;
      end if;

      v_cantidad_base := round(v_linea_resumen.cantidad_base, 2);

      if v_producto_tipo = 'combo' then
        for v_componente in
          select cc.componente_id, cc.cantidad
          from public.combo_componentes cc
          join public.productos pr on pr.id = cc.componente_id
          where cc.combo_id = v_linea_resumen.producto_id
            and pr.inventariable
          order by cc.componente_id
        loop
          v_cantidad_componente := round(v_componente.cantidad * v_cantidad_base, 2);
          select sum(-mi.valor_movimiento)
          into v_valor_exacto
          from public.movimientos_inventario mi
          where mi.origen_tipo = 'factura'
            and mi.origen_id = p_id
            and mi.producto_id = v_componente.componente_id
            and mi.tipo = 'salida'
            and not mi.es_recosteo;

          if v_valor_exacto is null then
            select round(coalesce(nullif(pr.costo_promedio, 0), pr.costo, 0), 6)
            into v_costo_referencia
            from public.productos pr
            where pr.id = v_componente.componente_id;
            v_valor_exacto := round(v_cantidad_componente * coalesce(v_costo_referencia, 0), 2);
          end if;

          perform public._aplicar_entrada_inventario(
            coalesce(p_fecha, current_date), v_componente.componente_id, v_almacen_id,
            v_cantidad_componente, v_valor_exacto,
            'anulacion', p_id, v_factura.ncf,
            'Anulación salida de inventario: ' || v_componente.componente_id::text
          );
        end loop;
      elsif v_producto_inventariable then
        select sum(-mi.valor_movimiento)
        into v_valor_exacto
        from public.movimientos_inventario mi
        where mi.origen_tipo = 'factura'
          and mi.origen_id = p_id
          and mi.producto_id = v_linea_resumen.producto_id
          and mi.tipo = 'salida'
          and not mi.es_recosteo;

        if v_valor_exacto is null then
          v_valor_exacto := round(v_linea_resumen.costo_estimado, 2);
        end if;

        perform public._aplicar_entrada_inventario(
          coalesce(p_fecha, current_date), v_linea_resumen.producto_id, v_almacen_id,
          v_cantidad_base, v_valor_exacto,
          'anulacion', p_id, v_factura.ncf,
          'Anulación salida de inventario: ' || v_linea_resumen.producto_id::text
        );
      end if;
    end loop;

    v_asiento_id := v_factura.asiento_id;
    v_numero := v_factura.numero;

    update public.facturas
    set estado = 'anulada', pagado = 0, retenido = 0, credito = 0
    where id = p_id;

  elsif p_tipo = 'nota_credito_venta' then
    select * into v_nota_credito
    from public.notas_credito_venta n
    where n.id = p_id
    for update;

    if not found then
      raise exception 'nota de crédito no encontrada' using errcode = '22023';
    end if;
    if v_nota_credito.estado = 'anulada' then
      raise exception 'la nota de crédito ya está anulada' using errcode = '22023';
    end if;

    -- Espejo de la creación: si la nota devolvió inventario, se retira otra vez.
    if v_nota_credito.devuelve_inventario then
      v_almacen_id := coalesce(v_nota_credito.almacen_id, public._almacen_principal());

      for v_linea_resumen in
        select nl.producto_id,
               round(sum(nl.cantidad * coalesce(nl.factor_base, 1)), 2) as cantidad_base,
               round(sum(nl.cantidad * nl.costo_unitario), 2) as costo_estimado
        from public.nota_credito_venta_lineas nl
        where nl.nota_id = p_id
          and nl.producto_id is not null
        group by nl.producto_id
        order by nl.producto_id
      loop
        select pr.tipo, pr.inventariable
        into v_producto_tipo, v_producto_inventariable
        from public.productos pr
        where pr.id = v_linea_resumen.producto_id;

        if not found then
          continue;
        end if;

        v_cantidad_base := round(v_linea_resumen.cantidad_base, 2);

        if v_producto_tipo = 'combo' then
          for v_componente in
            select cc.componente_id, cc.cantidad
            from public.combo_componentes cc
            join public.productos pr on pr.id = cc.componente_id
            where cc.combo_id = v_linea_resumen.producto_id
              and pr.inventariable
            order by cc.componente_id
          loop
            v_cantidad_componente := round(v_componente.cantidad * v_cantidad_base, 2);
            select sum(mi.valor_movimiento)
            into v_valor_exacto
            from public.movimientos_inventario mi
            where mi.origen_tipo = 'nota_credito_venta'
              and mi.origen_id = p_id
              and mi.producto_id = v_componente.componente_id
              and mi.tipo = 'entrada'
              and not mi.es_recosteo;

            if v_valor_exacto is null then
              select round(coalesce(nullif(pr.costo_promedio, 0), pr.costo, 0), 6)
              into v_costo_referencia
              from public.productos pr
              where pr.id = v_componente.componente_id;
              v_valor_exacto := round(v_cantidad_componente * coalesce(v_costo_referencia, 0), 2);
            end if;

            perform public._aplicar_retiro_inventario_exacto(
              coalesce(p_fecha, current_date), v_componente.componente_id, v_almacen_id,
              v_cantidad_componente, v_valor_exacto,
              'anulacion', p_id, v_nota_credito.ncf,
              'Anulación devolución de inventario: ' || v_componente.componente_id::text
            );
          end loop;
        elsif v_producto_inventariable then
          select sum(mi.valor_movimiento)
          into v_valor_exacto
          from public.movimientos_inventario mi
          where mi.origen_tipo = 'nota_credito_venta'
            and mi.origen_id = p_id
            and mi.producto_id = v_linea_resumen.producto_id
            and mi.tipo = 'entrada'
            and not mi.es_recosteo;

          if v_valor_exacto is null then
            v_valor_exacto := round(v_linea_resumen.costo_estimado, 2);
          end if;

          perform public._aplicar_retiro_inventario_exacto(
            coalesce(p_fecha, current_date), v_linea_resumen.producto_id, v_almacen_id,
            v_cantidad_base, v_valor_exacto,
            'anulacion', p_id, v_nota_credito.ncf,
            'Anulación devolución de inventario: ' || v_linea_resumen.producto_id::text
          );
        end if;
      end loop;
    end if;

    -- Espejo de la creación: la NC sumó su total al crédito de la factura.
    select * into v_factura
    from public.facturas f
    where f.id = v_nota_credito.factura_id
    for update;

    if found and v_factura.estado <> 'anulada' then
      v_nuevo_credito := round(greatest(v_factura.credito - v_nota_credito.total, 0), 2);
      update public.facturas
      set credito = v_nuevo_credito,
          estado = case
            when round(v_factura.pagado + v_factura.retenido + v_nuevo_credito, 2) >= v_factura.total then 'pagada'
            else 'abierta'
          end
      where id = v_factura.id;
    end if;

    v_asiento_id := v_nota_credito.asiento_id;
    v_numero := v_nota_credito.numero;

    update public.notas_credito_venta set estado = 'anulada' where id = p_id;

  elsif p_tipo = 'nota_debito_venta' then
    select * into v_nota_debito
    from public.notas_debito_venta n
    where n.id = p_id
    for update;

    if not found then
      raise exception 'nota de débito no encontrada' using errcode = '22023';
    end if;
    if v_nota_debito.estado = 'anulada' then
      raise exception 'la nota de débito ya está anulada' using errcode = '22023';
    end if;

    -- La ND no mueve inventario ni el saldo de la factura: solo el asiento.
    v_asiento_id := v_nota_debito.asiento_id;
    v_numero := v_nota_debito.numero;

    update public.notas_debito_venta set estado = 'anulada' where id = p_id;

  elsif p_tipo = 'gasto_menor' then
    select * into v_gasto
    from public.gastos_menores gm
    where gm.id = p_id
    for update;

    if not found then
      raise exception 'gasto menor no encontrado' using errcode = '22023';
    end if;
    if v_gasto.estado = 'anulado' then
      raise exception 'el gasto menor ya está anulado' using errcode = '22023';
    end if;

    v_asiento_id := v_gasto.asiento_id;
    v_numero := v_gasto.numero;

    update public.gastos_menores set estado = 'anulado' where id = p_id;

  else
    select * into v_factura_prov
    from public.facturas_proveedor fp
    where fp.id = p_id
    for update;

    if not found then
      raise exception 'factura de proveedor no encontrada' using errcode = '22023';
    end if;
    if v_factura_prov.estado = 'anulada' then
      raise exception 'la factura de proveedor ya está anulada' using errcode = '22023';
    end if;
    if exists (
      select 1 from public.pagos_proveedor pp
      where pp.factura_proveedor_id = p_id and pp.estado = 'activo'
    ) or exists (
      select 1
      from public.pago_proveedor_aplicaciones pa
      join public.pagos_proveedor pp on pp.id = pa.pago_id
      where pa.factura_proveedor_id = p_id and pp.estado = 'activo'
    ) then
      raise exception 'no se puede anular una factura de proveedor con pagos activos' using errcode = 'P0001';
    end if;
    if exists (
      select 1 from public.notas_credito_compra nc
      where nc.factura_proveedor_id = p_id and nc.estado = 'activa'
    ) then
      raise exception 'no se puede anular una factura de proveedor con notas de crédito activas' using errcode = 'P0001';
    end if;

    v_almacen_id := coalesce(v_factura_prov.almacen_id, public._almacen_principal());

    for v_linea_resumen in
      select fpl.producto_id,
             round(sum(fpl.cantidad * coalesce(fpl.factor_base, 1)), 2) as cantidad_base,
             round(sum(fpl.subtotal), 2) as valor_original
      from public.facturas_proveedor_lineas fpl
      where fpl.factura_proveedor_id = p_id
        and fpl.producto_id is not null
      group by fpl.producto_id
      order by fpl.producto_id
    loop
      select pr.inventariable
      into v_producto_inventariable
      from public.productos pr
      where pr.id = v_linea_resumen.producto_id;

      if not found or not v_producto_inventariable then
        continue;
      end if;

      v_cantidad_base := round(v_linea_resumen.cantidad_base, 2);
      if v_cantidad_base = 0 then
        continue;
      end if;

      select sum(mi.valor_movimiento)
      into v_valor_exacto
      from public.movimientos_inventario mi
      where mi.origen_tipo = 'factura_proveedor'
        and mi.origen_id = p_id
        and mi.producto_id = v_linea_resumen.producto_id
        and mi.tipo = 'entrada'
        and not mi.es_recosteo;

      if v_valor_exacto is null then
        v_valor_exacto := round(v_linea_resumen.valor_original, 2);
      end if;

      perform public._aplicar_retiro_inventario_exacto(
        coalesce(p_fecha, current_date), v_linea_resumen.producto_id, v_almacen_id,
        v_cantidad_base, v_valor_exacto,
        'anulacion', p_id, coalesce(v_factura_prov.ncf, v_factura_prov.numero::text),
        'Anulación compra: ' || v_linea_resumen.producto_id::text
      );
    end loop;

    v_asiento_id := v_factura_prov.asiento_id;
    v_numero := v_factura_prov.numero;

    update public.facturas_proveedor
    set estado = 'anulada', pagado = 0, credito = 0, retenido = 0
    where id = p_id;
  end if;

  if v_asiento_id is null then
    raise exception 'el documento no tiene asiento contable' using errcode = '22023';
  end if;

  select * into v_asiento
  from public.asientos a
  where a.id = v_asiento_id;

  if not found then
    raise exception 'asiento no encontrado' using errcode = '22023';
  end if;
  if exists (select 1 from public.asientos a where a.anula_asiento_id = v_asiento_id) then
    raise exception 'el asiento del documento ya fue anulado' using errcode = '22023';
  end if;

  select jsonb_agg(jsonb_build_object(
    'cuenta_id', l.cuenta_id,
    'contacto_id', l.contacto_id,
    'centro_costo_id', l.centro_costo_id,
    'descripcion', 'Anulación: ' || left(coalesce(l.descripcion, ''), 70),
    'debito', l.credito,
    'credito', l.debito
  ) order by l.id)
  into v_lineas
  from public.asiento_lineas l
  where l.asiento_id = v_asiento_id;

  if v_lineas is null or jsonb_array_length(v_lineas) < 2 then
    raise exception 'el asiento no tiene líneas para revertir' using errcode = '22023';
  end if;

  v_reversion_id := public._crear_asiento(
    coalesce(p_fecha, current_date),
    'Anulación ' || p_tipo || ' #' || coalesce(v_numero::text, ''),
    'anulacion',
    p_id,
    v_lineas
  );

  update public.asientos set anula_asiento_id = v_asiento_id where id = v_reversion_id;

  update public.movimientos_inventario mi
  set asiento_id = v_reversion_id
  where mi.origen_tipo = 'anulacion'
    and mi.origen_id = p_id
    and mi.asiento_id is null
    and not mi.es_recosteo;

  return p_id;
end;
$function$;


revoke all on function public._anular_documento_ajustes(text, uuid, date) from public, anon, authenticated;

-- Anulación base: NC de compra reingresa el valor exacto retirado
CREATE OR REPLACE FUNCTION public._anular_documento_base(p_tipo text, p_id uuid)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  v_rol text;
  v_factura public.facturas%rowtype;
  v_factura_prov public.facturas_proveedor%rowtype;
  v_nota public.notas_credito_compra%rowtype;
  v_ajuste public.ajustes_inventario%rowtype;
  v_ajuste_linea public.ajuste_inventario_lineas%rowtype;
  v_pago public.pagos_recibidos%rowtype;
  v_pago_prov public.pagos_proveedor%rowtype;
  v_aplicacion public.pago_recibido_aplicaciones%rowtype;
  v_aplicacion_prov public.pago_proveedor_aplicaciones%rowtype;
  v_gasto public.gastos_menores%rowtype;
  v_asiento public.asientos%rowtype;
  v_asiento_id uuid;
  v_numero int;
  v_lineas jsonb;
  v_reversion_id uuid;
  v_prod_id uuid;
  v_cantidad numeric(14,2);
  v_costo_linea numeric(14,2);
  v_cantidad_actual numeric(14,2);
  v_costo_actual numeric(14,2);
  v_cantidad_nueva numeric(14,2);
  v_costo_nuevo numeric(14,2);
  v_nuevo_pagado numeric(14,2);
  v_nuevo_credito numeric(14,2);
  v_nuevo_retenido numeric(14,2);
  v_almacen_id uuid;
begin
  v_rol := public.rol_actual();
  if v_rol is null or v_rol not in ('admin', 'contador') then
    raise exception 'sin permiso' using errcode = '42501';
  end if;

  if p_tipo is null or p_tipo not in (
    'factura', 'pago_recibido', 'factura_proveedor', 'pago_proveedor', 'gasto_menor',
    'nota_credito_compra', 'ajuste_inventario'
  ) then
    raise exception 'tipo de documento inválido' using errcode = '22023';
  end if;

  if p_id is null then
    raise exception 'el documento es obligatorio' using errcode = '22023';
  end if;

  if p_tipo = 'factura' then
    select * into v_factura from public.facturas f where f.id = p_id for update;
    if not found then
      raise exception 'factura no encontrada' using errcode = '22023';
    end if;
    if v_factura.estado = 'anulada' then
      raise exception 'la factura ya está anulada' using errcode = '22023';
    end if;
    if exists (
      select 1 from public.pagos_recibidos pr
      where pr.factura_id = p_id and pr.estado = 'activo'
    ) or exists (
      select 1
      from public.pago_recibido_aplicaciones pa
      join public.pagos_recibidos pr on pr.id = pa.pago_id
      where pa.factura_id = p_id and pr.estado = 'activo'
    ) then
      raise exception 'no se puede anular una factura con pagos activos' using errcode = 'P0001';
    end if;

    v_almacen_id := coalesce(v_factura.almacen_id, public._almacen_principal());

    for v_prod_id, v_cantidad in
      select fl.producto_id, fl.cantidad
      from public.factura_lineas fl
      join public.productos pr on pr.id = fl.producto_id
      where fl.factura_id = p_id and pr.inventariable
    loop
      perform public._mover_existencia(v_prod_id, v_almacen_id, v_cantidad);
    end loop;

    v_asiento_id := v_factura.asiento_id;
    v_numero := v_factura.numero;

    update public.facturas set estado = 'anulada', pagado = 0, retenido = 0 where id = p_id;

  elsif p_tipo = 'pago_recibido' then
    select * into v_pago from public.pagos_recibidos pr where pr.id = p_id for update;
    if not found then
      raise exception 'pago no encontrado' using errcode = '22023';
    end if;
    if v_pago.estado = 'anulado' then
      raise exception 'el pago ya está anulado' using errcode = '22023';
    end if;

    v_asiento_id := v_pago.asiento_id;
    v_numero := v_pago.numero;

    update public.pagos_recibidos set estado = 'anulado' where id = p_id;

    if exists (select 1 from public.pago_recibido_aplicaciones pa where pa.pago_id = p_id) then
      for v_aplicacion in
        select * from public.pago_recibido_aplicaciones pa where pa.pago_id = p_id
      loop
        select * into v_factura
        from public.facturas f
        where f.id = v_aplicacion.factura_id
        for update;

        if found and v_factura.estado <> 'anulada' then
          v_nuevo_pagado := round(greatest(v_factura.pagado - v_aplicacion.monto, 0), 2);
          v_nuevo_retenido := round(greatest(v_factura.retenido - v_aplicacion.retenido, 0), 2);
          update public.facturas
          set pagado = v_nuevo_pagado,
              retenido = v_nuevo_retenido,
              estado = case
                when round(v_nuevo_pagado + v_nuevo_retenido + v_factura.credito, 2) >= v_factura.total then 'pagada'
                else 'abierta'
              end
          where id = v_factura.id;
        end if;
      end loop;
    elsif v_pago.factura_id is not null then
      select * into v_factura from public.facturas f where f.id = v_pago.factura_id for update;
      if found and v_factura.estado <> 'anulada' then
        v_nuevo_pagado := round(greatest(v_factura.pagado - v_pago.monto, 0), 2);
        v_nuevo_retenido := round(greatest(v_factura.retenido - v_pago.retenido, 0), 2);
        update public.facturas
        set pagado = v_nuevo_pagado,
            retenido = v_nuevo_retenido,
            estado = case
              when round(v_nuevo_pagado + v_nuevo_retenido + v_factura.credito, 2) >= v_factura.total then 'pagada'
              else 'abierta'
            end
        where id = v_factura.id;
      end if;
    end if;

  elsif p_tipo = 'factura_proveedor' then
    select * into v_factura_prov from public.facturas_proveedor fp where fp.id = p_id for update;
    if not found then
      raise exception 'factura de proveedor no encontrada' using errcode = '22023';
    end if;
    if v_factura_prov.estado = 'anulada' then
      raise exception 'la factura de proveedor ya está anulada' using errcode = '22023';
    end if;
    if exists (
      select 1 from public.pagos_proveedor pp
      where pp.factura_proveedor_id = p_id and pp.estado = 'activo'
    ) or exists (
      select 1
      from public.pago_proveedor_aplicaciones pa
      join public.pagos_proveedor pp on pp.id = pa.pago_id
      where pa.factura_proveedor_id = p_id and pp.estado = 'activo'
    ) then
      raise exception 'no se puede anular una factura de proveedor con pagos activos' using errcode = 'P0001';
    end if;
    if exists (
      select 1 from public.notas_credito_compra nc
      where nc.factura_proveedor_id = p_id and nc.estado = 'activa'
    ) then
      raise exception 'no se puede anular una factura de proveedor con notas de crédito activas' using errcode = 'P0001';
    end if;

    v_almacen_id := coalesce(v_factura_prov.almacen_id, public._almacen_principal());

    for v_prod_id, v_cantidad, v_costo_linea in
      select fpl.producto_id, fpl.cantidad, fpl.costo
      from public.facturas_proveedor_lineas fpl
      join public.productos pr on pr.id = fpl.producto_id
      where fpl.factura_proveedor_id = p_id and pr.inventariable
      order by fpl.id
    loop
      select pr.cantidad, pr.costo
      into v_cantidad_actual, v_costo_actual
      from public.productos pr
      where pr.id = v_prod_id
      for update;

      v_cantidad_nueva := v_cantidad_actual - v_cantidad;

      if v_cantidad_nueva > 0 then
        v_costo_nuevo := round(
          greatest(v_cantidad_actual * v_costo_actual - v_cantidad * v_costo_linea, 0)
          / v_cantidad_nueva,
          2
        );
      elsif v_cantidad_nueva = 0 then
        v_costo_nuevo := 0;
      else
        v_costo_nuevo := v_costo_actual;
      end if;

      perform public._mover_existencia(v_prod_id, v_almacen_id, -v_cantidad);

      update public.productos
      set costo = v_costo_nuevo
      where id = v_prod_id;
    end loop;

    v_asiento_id := v_factura_prov.asiento_id;
    v_numero := v_factura_prov.numero;

    update public.facturas_proveedor
    set estado = 'anulada', pagado = 0, credito = 0, retenido = 0
    where id = p_id;

  elsif p_tipo = 'pago_proveedor' then
    select * into v_pago_prov from public.pagos_proveedor pp where pp.id = p_id for update;
    if not found then
      raise exception 'pago a proveedor no encontrado' using errcode = '22023';
    end if;
    if v_pago_prov.estado = 'anulado' then
      raise exception 'el pago a proveedor ya está anulado' using errcode = '22023';
    end if;

    v_asiento_id := v_pago_prov.asiento_id;
    v_numero := v_pago_prov.numero;

    update public.pagos_proveedor set estado = 'anulado' where id = p_id;

    if exists (select 1 from public.pago_proveedor_aplicaciones pa where pa.pago_id = p_id) then
      for v_aplicacion_prov in
        select * from public.pago_proveedor_aplicaciones pa where pa.pago_id = p_id
      loop
        select * into v_factura_prov
        from public.facturas_proveedor fp
        where fp.id = v_aplicacion_prov.factura_proveedor_id
        for update;

        if found and v_factura_prov.estado <> 'anulada' then
          v_nuevo_pagado := round(greatest(v_factura_prov.pagado - v_aplicacion_prov.monto, 0), 2);
          v_nuevo_retenido := round(greatest(v_factura_prov.retenido - v_aplicacion_prov.retenido, 0), 2);
          update public.facturas_proveedor
          set pagado = v_nuevo_pagado,
              retenido = v_nuevo_retenido,
              estado = case
                when round(v_nuevo_pagado + v_nuevo_retenido + v_factura_prov.credito, 2) >= v_factura_prov.total then 'pagada'
                else 'abierta'
              end
          where id = v_factura_prov.id;
        end if;
      end loop;
    elsif v_pago_prov.factura_proveedor_id is not null then
      select * into v_factura_prov
      from public.facturas_proveedor fp
      where fp.id = v_pago_prov.factura_proveedor_id
      for update;

      if found and v_factura_prov.estado <> 'anulada' then
        v_nuevo_pagado := round(greatest(v_factura_prov.pagado - v_pago_prov.monto, 0), 2);
        v_nuevo_retenido := round(greatest(v_factura_prov.retenido - v_pago_prov.retenido, 0), 2);
        update public.facturas_proveedor
        set pagado = v_nuevo_pagado,
            retenido = v_nuevo_retenido,
            estado = case
              when round(v_nuevo_pagado + v_nuevo_retenido + v_factura_prov.credito, 2) >= v_factura_prov.total then 'pagada'
              else 'abierta'
            end
        where id = v_factura_prov.id;
      end if;
    end if;

  elsif p_tipo = 'ajuste_inventario' then
    select * into v_ajuste from public.ajustes_inventario ai where ai.id = p_id for update;
    if not found then
      raise exception 'ajuste de inventario no encontrado' using errcode = '22023';
    end if;
    if v_ajuste.estado = 'anulada' then
      raise exception 'el ajuste de inventario ya está anulado' using errcode = '22023';
    end if;

    for v_ajuste_linea in
      select * from public.ajuste_inventario_lineas ail
      where ail.ajuste_id = p_id
      order by ail.id
    loop
      if v_ajuste_linea.tipo = 'entrada' then
        perform public._mover_existencia(v_ajuste_linea.producto_id, v_ajuste.almacen_id, -v_ajuste_linea.cantidad);
      else
        perform public._mover_existencia(v_ajuste_linea.producto_id, v_ajuste.almacen_id, v_ajuste_linea.cantidad);
      end if;
    end loop;

    v_asiento_id := v_ajuste.asiento_id;
    v_numero := v_ajuste.numero;

    update public.ajustes_inventario set estado = 'anulada' where id = p_id;

  elsif p_tipo = 'nota_credito_compra' then
    select * into v_nota from public.notas_credito_compra nc where nc.id = p_id for update;
    if not found then
      raise exception 'nota de crédito de compra no encontrada' using errcode = '22023';
    end if;
    if v_nota.estado = 'anulada' then
      raise exception 'la nota de crédito ya está anulada' using errcode = '22023';
    end if;

    if v_nota.devuelve_inventario then
      v_almacen_id := coalesce(v_nota.almacen_id, public._almacen_principal());

      for v_prod_id, v_cantidad, v_costo_linea in
        select nl.producto_id,
               round(sum(nl.cantidad * coalesce(fpl.factor_base, 1)), 2) as cantidad_base,
               round(sum(nl.subtotal), 2) as valor_original
        from public.nota_credito_compra_lineas nl
        join public.productos pr on pr.id = nl.producto_id
        join public.facturas_proveedor_lineas fpl on fpl.id = nl.factura_proveedor_linea_id
        where nl.nota_id = p_id and pr.inventariable
        group by nl.producto_id
        order by nl.producto_id
      loop
        select sum(-mi.valor_movimiento)
        into v_cantidad_actual
        from public.movimientos_inventario mi
        where mi.origen_tipo = 'nota_credito_compra'
          and mi.origen_id = p_id
          and mi.producto_id = v_prod_id
          and mi.tipo = 'salida'
          and not mi.es_recosteo;

        if v_cantidad_actual is null then
          v_cantidad_actual := round(v_costo_linea, 2);
        end if;

        perform public._aplicar_entrada_inventario(
          current_date, v_prod_id, v_almacen_id, v_cantidad, v_cantidad_actual,
          'anulacion', p_id, coalesce(v_nota.ncf, v_nota.numero::text),
          'Anulación devolución de compra: ' || v_prod_id::text
        );
      end loop;
    end if;

    select * into v_factura_prov
    from public.facturas_proveedor fp
    where fp.id = v_nota.factura_proveedor_id
    for update;

    if found and v_factura_prov.estado <> 'anulada' then
      v_nuevo_credito := round(greatest(v_factura_prov.credito - v_nota.total, 0), 2);
      update public.facturas_proveedor
      set credito = v_nuevo_credito,
          estado = case
            when round(v_factura_prov.pagado + v_nuevo_credito + v_factura_prov.retenido, 2) >= v_factura_prov.total then 'pagada'
            else 'abierta'
          end
      where id = v_factura_prov.id;
    end if;

    v_asiento_id := v_nota.asiento_id;
    v_numero := v_nota.numero;

    update public.notas_credito_compra set estado = 'anulada' where id = p_id;

  else
    select * into v_gasto from public.gastos_menores gm where gm.id = p_id for update;
    if not found then
      raise exception 'gasto menor no encontrado' using errcode = '22023';
    end if;
    if v_gasto.estado = 'anulado' then
      raise exception 'el gasto menor ya está anulado' using errcode = '22023';
    end if;

    v_asiento_id := v_gasto.asiento_id;
    v_numero := v_gasto.numero;

    update public.gastos_menores set estado = 'anulado' where id = p_id;
  end if;

  if v_asiento_id is null then
    raise exception 'el documento no tiene asiento contable' using errcode = '22023';
  end if;

  select * into v_asiento from public.asientos a where a.id = v_asiento_id;
  if not found then
    raise exception 'asiento no encontrado' using errcode = '22023';
  end if;
  if exists (select 1 from public.asientos a where a.anula_asiento_id = v_asiento_id) then
    raise exception 'el asiento del documento ya fue anulado' using errcode = '22023';
  end if;

  select jsonb_agg(jsonb_build_object(
    'cuenta_id', l.cuenta_id,
    'contacto_id', l.contacto_id,
    'centro_costo_id', l.centro_costo_id,
    'descripcion', 'Anulación: ' || left(coalesce(l.descripcion, ''), 70),
    'debito', l.credito,
    'credito', l.debito
  ) order by l.id)
  into v_lineas
  from public.asiento_lineas l
  where l.asiento_id = v_asiento_id;

  if v_lineas is null or jsonb_array_length(v_lineas) < 2 then
    raise exception 'el asiento no tiene líneas para revertir' using errcode = '22023';
  end if;

  v_reversion_id := public._crear_asiento(
    current_date,
    'Anulación ' || p_tipo || ' #' || coalesce(v_numero::text, ''),
    'anulacion',
    p_id,
    v_lineas
  );

  update public.asientos set anula_asiento_id = v_asiento_id where id = v_reversion_id;

  update public.movimientos_inventario mi
  set asiento_id = v_reversion_id
  where mi.origen_tipo = 'anulacion'
    and mi.origen_id = p_id
    and mi.asiento_id is null
    and not mi.es_recosteo;

  return p_id;
end;
$function$;


revoke all on function public._anular_documento_base(text, uuid) from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- Transferencias: no cambian el valor global ni generan asiento, pero sí son
-- parte del Kardex por almacén. Se registran dos filas de valor 0.00.
-- ---------------------------------------------------------------------------

create or replace function public._registrar_transferencia_inventario(
  p_fecha date,
  p_producto_id uuid,
  p_almacen_origen_id uuid,
  p_almacen_destino_id uuid,
  p_cantidad numeric,
  p_origen_tipo text,
  p_documento_id uuid,
  p_descripcion text
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_producto public.productos%rowtype;
  q_actual numeric(14,2);
  v_actual numeric(14,2);
  c_ref numeric(16,6);
begin
  select * into v_producto
  from public.productos pr
  where pr.id = p_producto_id;

  if not found or not v_producto.inventariable then
    return;
  end if;

  q_actual := round(coalesce(v_producto.cantidad, 0), 2);
  v_actual := round(coalesce(v_producto.valor_inventario, 0), 2);
  c_ref := round(coalesce(nullif(v_producto.costo_promedio, 0), v_producto.costo, 0), 6);

  perform public._registrar_movimiento_inventario(
    p_fecha, p_producto_id, p_almacen_origen_id, 'salida', p_origen_tipo, p_documento_id,
    null, null, p_descripcion, -p_cantidad, q_actual, q_actual,
    c_ref, c_ref, c_ref, 0, v_actual, v_actual, false
  );

  perform public._registrar_movimiento_inventario(
    p_fecha, p_producto_id, p_almacen_destino_id, 'entrada', p_origen_tipo, p_documento_id,
    null, null, p_descripcion, p_cantidad, q_actual, q_actual,
    c_ref, c_ref, c_ref, 0, v_actual, v_actual, false
  );
end;
$$;

revoke all on function public._registrar_transferencia_inventario(date, uuid, uuid, uuid, numeric, text, uuid, text)
  from public, anon, authenticated;

create or replace function public.crear_transferencia_inventario(p jsonb)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_rol text;
  v_id uuid;
  v_fecha date;
  v_origen uuid;
  v_destino uuid;
  v_observaciones text;
  v_lineas jsonb;
  v_linea jsonb;
  v_producto public.productos%rowtype;
  v_producto_id uuid;
  v_cantidad numeric(14,2);
  v_disponible numeric(14,2);
begin
  v_rol := public.rol_actual();
  if v_rol is null or v_rol not in ('admin', 'contador') then
    raise exception 'sin permiso' using errcode = '42501';
  end if;

  if p is null then
    raise exception 'datos de la transferencia requeridos' using errcode = '22023';
  end if;

  v_origen := nullif(p->>'origen_id', '')::uuid;
  v_destino := nullif(p->>'destino_id', '')::uuid;

  if v_origen is null or v_destino is null then
    raise exception 'selecciona el almacén de origen y el de destino' using errcode = '22023';
  end if;
  if v_origen = v_destino then
    raise exception 'el almacén de origen y destino deben ser distintos' using errcode = '22023';
  end if;

  if not exists (select 1 from public.almacenes a where a.id = v_origen and a.activo) then
    raise exception 'almacén de origen no encontrado o inactivo' using errcode = '22023';
  end if;
  if not exists (select 1 from public.almacenes a where a.id = v_destino and a.activo) then
    raise exception 'almacén de destino no encontrado o inactivo' using errcode = '22023';
  end if;

  v_fecha := coalesce((p->>'fecha')::date, current_date);
  v_observaciones := nullif(trim(coalesce(p->>'observaciones', '')), '');

  v_lineas := coalesce(p->'lineas', '[]'::jsonb);
  if jsonb_typeof(v_lineas) <> 'array' or jsonb_array_length(v_lineas) = 0 then
    raise exception 'la transferencia requiere al menos un producto' using errcode = '22023';
  end if;

  if exists (
    select 1
    from jsonb_array_elements(v_lineas) e
    group by e->>'producto_id'
    having count(*) > 1
  ) then
    raise exception 'no repitas el mismo producto en la transferencia' using errcode = '22023';
  end if;

  insert into public.transferencias_inventario (fecha, origen_id, destino_id, observaciones)
  values (v_fecha, v_origen, v_destino, v_observaciones)
  returning id into v_id;

  for v_linea in select * from jsonb_array_elements(v_lineas) loop
    v_producto_id := nullif(v_linea->>'producto_id', '')::uuid;
    if v_producto_id is null then
      raise exception 'cada línea requiere un producto' using errcode = '22023';
    end if;

    select * into v_producto
    from public.productos pr
    where pr.id = v_producto_id and pr.activo;

    if not found then
      raise exception 'producto no encontrado o inactivo' using errcode = '22023';
    end if;
    if not v_producto.inventariable then
      raise exception 'el producto % no controla inventario', v_producto.nombre using errcode = '22023';
    end if;

    v_cantidad := round(coalesce((v_linea->>'cantidad')::numeric, 0), 2);
    if v_cantidad <= 0 then
      raise exception 'la cantidad a transferir debe ser mayor a cero' using errcode = '22023';
    end if;

    select e.cantidad into v_disponible
    from public.existencias e
    where e.producto_id = v_producto_id and e.almacen_id = v_origen
    for update;

    if coalesce(v_disponible, 0) < v_cantidad then
      raise exception 'no hay existencia suficiente de % en el almacén de origen', v_producto.nombre
        using errcode = '22023';
    end if;

    insert into public.transferencia_inventario_lineas (transferencia_id, producto_id, cantidad)
    values (v_id, v_producto_id, v_cantidad);

    perform public._sumar_existencia(v_producto_id, v_origen, -v_cantidad);
    perform public._sumar_existencia(v_producto_id, v_destino, v_cantidad);
    perform public._registrar_transferencia_inventario(
      v_fecha, v_producto_id, v_origen, v_destino, v_cantidad,
      'transferencia_inventario', v_id,
      'Transferencia #' || (select t.numero from public.transferencias_inventario t where t.id = v_id)::text
    );
  end loop;

  return v_id;
end;
$$;;

revoke all on function public.crear_transferencia_inventario(jsonb) from public, anon, authenticated;
grant execute on function public.crear_transferencia_inventario(jsonb) to authenticated;

create or replace function public.anular_transferencia_inventario(p_id uuid)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_rol text;
  v_transferencia public.transferencias_inventario%rowtype;
  v_linea public.transferencia_inventario_lineas%rowtype;
begin
  v_rol := public.rol_actual();
  if v_rol is null or v_rol not in ('admin', 'contador') then
    raise exception 'sin permiso' using errcode = '42501';
  end if;

  if p_id is null then
    raise exception 'la transferencia es obligatoria' using errcode = '22023';
  end if;

  select * into v_transferencia
  from public.transferencias_inventario t
  where t.id = p_id
  for update;

  if not found then
    raise exception 'transferencia no encontrada' using errcode = '22023';
  end if;
  if v_transferencia.estado = 'anulada' then
    raise exception 'la transferencia ya está anulada' using errcode = '22023';
  end if;

  for v_linea in
    select * from public.transferencia_inventario_lineas tl
    where tl.transferencia_id = p_id
    order by tl.id
  loop
    perform public._sumar_existencia(v_linea.producto_id, v_transferencia.destino_id, -v_linea.cantidad);
    perform public._sumar_existencia(v_linea.producto_id, v_transferencia.origen_id, v_linea.cantidad);
    perform public._registrar_transferencia_inventario(
      v_transferencia.fecha, v_linea.producto_id, v_transferencia.destino_id, v_transferencia.origen_id,
      v_linea.cantidad, 'anulacion', p_id,
      'Anulación transferencia #' || v_transferencia.numero::text
    );
  end loop;

  update public.transferencias_inventario set estado = 'anulada' where id = p_id;

  return p_id;
end;
$$;;

revoke all on function public.anular_transferencia_inventario(uuid) from public, anon, authenticated;
grant execute on function public.anular_transferencia_inventario(uuid) to authenticated;

-- Productos: inventario inicial visible en Kardex
CREATE OR REPLACE FUNCTION public.crear_producto(p jsonb)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  v_id uuid;
  v_producto public.productos%rowtype;
  v_asiento_id uuid;
  v_valor numeric(14,2);
begin
  v_id := public._crear_producto_con_inventario_inicial(p);
  perform public._producto_guardar_ferreteria(v_id, p, true);

  select * into v_producto
  from public.productos pr
  where pr.id = v_id;

  if found and v_producto.inventariable then
    v_valor := round(coalesce(v_producto.cantidad, 0) * coalesce(v_producto.costo, 0), 2);

    update public.productos pr
    set costo_promedio = round(coalesce(v_producto.costo, 0), 6),
        valor_inventario = v_valor
    where pr.id = v_id;

    if v_producto.cantidad <> 0 then
      select a.id into v_asiento_id
      from public.asientos a
      where a.origen_tipo = 'inventario_inicial'
        and a.producto_id = v_id
      order by a.creado_en desc, a.numero desc
      limit 1;

      perform public._registrar_movimiento_inventario(
        current_date, v_id, v_producto.almacen_id, 'entrada', 'inventario_inicial', v_id,
        v_asiento_id, null, 'Inventario inicial: ' || left(v_producto.nombre, 70),
        v_producto.cantidad, 0, v_producto.cantidad,
        round(coalesce(v_producto.costo, 0), 6), 0, round(coalesce(v_producto.costo, 0), 6),
        v_valor, 0, v_valor, false
      );
    end if;
  end if;

  return v_id;
end;
$function$;

revoke all on function public.crear_producto(jsonb) from public, anon, authenticated;
grant execute on function public.crear_producto(jsonb) to authenticated;

CREATE OR REPLACE FUNCTION public.actualizar_producto(p_id uuid, p jsonb)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  v_id uuid;
  v_producto public.productos%rowtype;
  v_asiento public.asientos%rowtype;
  v_cantidad_inicial numeric(14,2);
  v_valor numeric(14,2);
  v_q_mov numeric(14,2);
  v_v_mov numeric(14,2);
  v_q_objetivo numeric(14,2);
  v_v_objetivo numeric(14,2);
  v_delta_q numeric(14,2);
  v_delta_v numeric(14,2);
begin
  v_id := public._actualizar_producto_con_inventario_inicial(p_id, p);
  perform public._producto_guardar_ferreteria(v_id, p, false);

  select * into v_producto
  from public.productos pr
  where pr.id = v_id;

  if not found or not v_producto.inventariable then
    return v_id;
  end if;

  -- Una edición normal (nombre, precio, cuentas, unidades) no recalcula la
  -- valoración acumulada. Solo cantidad/costo son la edición especial de la
  -- carga inicial que la migración de inventario inicial ya contabiliza.
  if not (p ? 'cantidad' or p ? 'costo') then
    return v_id;
  end if;

  select a.* into v_asiento
  from public.asientos a
  where a.origen_tipo = 'inventario_inicial'
    and a.producto_id = v_id
    and not exists (
      select 1 from public.asientos r where r.anula_asiento_id = a.id
    )
  order by a.creado_en desc, a.numero desc
  limit 1;

  if found then
    -- El asiento vivo de inventario inicial es la referencia de la carga. La
    -- valoración corriente se mantiene coherente con la cantidad/costo que la
    -- edición acaba de dejar y con el costo usado por ese asiento.
    v_valor := round(coalesce(v_producto.cantidad, 0) * coalesce(v_producto.costo, 0), 2);

    update public.productos pr
    set costo_promedio = round(coalesce(v_producto.costo, 0), 6),
        valor_inventario = v_valor
    where pr.id = v_id;

    select e.cantidad_inicial into v_cantidad_inicial
    from public.existencias e
    where e.producto_id = v_id
      and e.almacen_id = v_producto.almacen_id;

    -- El Kardex es append-only incluso cuando la edición corrige la carga
    -- inicial: nunca se reescribe la fila original; se agrega el delta.
    v_q_objetivo := round(coalesce(v_cantidad_inicial, v_producto.cantidad), 2);
    v_v_objetivo := round(v_q_objetivo * coalesce(v_producto.costo, 0), 2);

    select
      round(coalesce(sum(mi.cantidad), 0), 2),
      round(coalesce(sum(mi.valor_movimiento), 0), 2)
    into v_q_mov, v_v_mov
    from public.movimientos_inventario mi
    where mi.origen_tipo = 'inventario_inicial'
      and mi.origen_id = v_id;

    v_delta_q := round(v_q_objetivo - coalesce(v_q_mov, 0), 2);
    v_delta_v := round(v_v_objetivo - coalesce(v_v_mov, 0), 2);

    if v_delta_q <> 0 or v_delta_v <> 0 then
      perform public._registrar_movimiento_inventario(
        v_asiento.fecha, v_id, v_producto.almacen_id,
        case
          when v_delta_q < 0 then 'salida'
          when v_delta_q = 0 then 'recosteo'
          else 'entrada'
        end,
        'inventario_inicial', v_id,
        v_asiento.id, null, 'Corrección inventario inicial: ' || left(v_producto.nombre, 60),
        v_delta_q, v_producto.cantidad - v_delta_q, v_producto.cantidad,
        case when v_delta_q <> 0 then round(v_delta_v / v_delta_q, 6) else 0 end,
        round(coalesce(v_producto.costo, 0), 6), round(coalesce(v_producto.costo, 0), 6),
        v_delta_v, round(v_valor - v_delta_v, 2), v_valor,
        v_delta_q = 0 and v_delta_v <> 0
      );
    end if;
  end if;

  return v_id;
end;
$function$;

revoke all on function public.actualizar_producto(uuid, jsonb) from public, anon, authenticated;
grant execute on function public.actualizar_producto(uuid, jsonb) to authenticated;

-- ---------------------------------------------------------------------------
-- Reportes de Kardex y salud del inventario
-- ---------------------------------------------------------------------------

create or replace function public.reporte_kardex_producto(
  p_producto_id uuid,
  p_desde date default null,
  p_hasta date default null,
  p_almacen_id uuid default null
)
returns table (
  id uuid,
  fecha date,
  producto_id uuid,
  producto_nombre text,
  referencia text,
  almacen_id uuid,
  almacen_nombre text,
  tipo text,
  origen_tipo text,
  origen_id uuid,
  asiento_id uuid,
  asiento_numero int,
  asiento_codigo text,
  documento_ref text,
  descripcion text,
  cantidad numeric,
  cantidad_antes numeric,
  cantidad_despues numeric,
  costo_unitario numeric,
  costo_promedio_antes numeric,
  costo_promedio_despues numeric,
  valor_movimiento numeric,
  valor_antes numeric,
  valor_despues numeric,
  es_recosteo boolean,
  creado_en timestamptz
)
language sql
stable
security invoker
set search_path = ''
as $$
  select
    mi.id,
    mi.fecha,
    mi.producto_id,
    pr.nombre,
    pr.referencia,
    mi.almacen_id,
    al.nombre,
    mi.tipo,
    mi.origen_tipo,
    mi.origen_id,
    mi.asiento_id,
    a.numero,
    a.codigo,
    mi.documento_ref,
    mi.descripcion,
    mi.cantidad,
    mi.cantidad_antes,
    mi.cantidad_despues,
    mi.costo_unitario,
    mi.costo_promedio_antes,
    mi.costo_promedio_despues,
    mi.valor_movimiento,
    mi.valor_antes,
    mi.valor_despues,
    mi.es_recosteo,
    mi.creado_en
  from public.movimientos_inventario mi
  join public.productos pr on pr.id = mi.producto_id
  left join public.almacenes al on al.id = mi.almacen_id
  left join public.asientos a on a.id = mi.asiento_id
  where mi.producto_id = p_producto_id
    and (p_desde is null or mi.fecha >= p_desde)
    and (p_hasta is null or mi.fecha <= p_hasta)
    and (p_almacen_id is null or mi.almacen_id = p_almacen_id)
  order by mi.fecha, mi.creado_en, mi.id;
$$;

create or replace function public.reporte_valor_inventario_corte(
  p_fecha date default current_date,
  p_almacen_id uuid default null
)
returns table (
  producto_id uuid,
  nombre text,
  referencia text,
  descripcion text,
  activo boolean,
  cantidad numeric,
  costo_promedio numeric,
  valor_inventario numeric
)
language sql
stable
security invoker
set search_path = ''
as $$
  with ultimo as (
    select distinct on (mi.producto_id)
      mi.producto_id,
      mi.cantidad_despues,
      mi.costo_promedio_despues,
      mi.valor_despues
    from public.movimientos_inventario mi
    where mi.fecha <= coalesce(p_fecha, current_date)
      and (p_almacen_id is null or mi.almacen_id = p_almacen_id)
    order by mi.producto_id, mi.fecha desc, mi.creado_en desc, mi.id desc
  ),
  primero_posterior as (
    select distinct on (mi.producto_id)
      mi.producto_id,
      mi.cantidad_antes,
      mi.costo_promedio_antes,
      mi.valor_antes
    from public.movimientos_inventario mi
    where mi.fecha > coalesce(p_fecha, current_date)
      and (p_almacen_id is null or mi.almacen_id = p_almacen_id)
    order by mi.producto_id, mi.fecha, mi.creado_en, mi.id
  )
  select
    pr.id,
    pr.nombre,
    pr.referencia,
    pr.descripcion,
    pr.activo,
    coalesce(u.cantidad_despues, fp.cantidad_antes, pr.cantidad),
    coalesce(u.costo_promedio_despues, fp.costo_promedio_antes, pr.costo_promedio),
    coalesce(u.valor_despues, fp.valor_antes, pr.valor_inventario)
  from public.productos pr
  left join ultimo u on u.producto_id = pr.id
  left join primero_posterior fp on fp.producto_id = pr.id
  where pr.inventariable
    and pr.creado_en::date <= coalesce(p_fecha, current_date)
  order by pr.nombre, pr.id;
$$;

create or replace function public.reporte_recosteos(
  p_desde date,
  p_hasta date,
  p_producto_id uuid default null
)
returns table (
  producto_id uuid,
  producto_nombre text,
  referencia text,
  fecha date,
  origen_tipo text,
  origen_id uuid,
  documento_ref text,
  descripcion text,
  asiento_id uuid,
  asiento_numero int,
  delta_cogs numeric,
  valor_movimiento numeric,
  cantidad_despues numeric,
  costo_promedio_antes numeric,
  costo_promedio_despues numeric
)
language sql
stable
security invoker
set search_path = ''
as $$
  select
    mi.producto_id,
    pr.nombre,
    pr.referencia,
    mi.fecha,
    mi.origen_tipo,
    mi.origen_id,
    mi.documento_ref,
    mi.descripcion,
    mi.asiento_id,
    a.numero,
    -mi.valor_movimiento,
    mi.valor_movimiento,
    mi.cantidad_despues,
    mi.costo_promedio_antes,
    mi.costo_promedio_despues
  from public.movimientos_inventario mi
  join public.productos pr on pr.id = mi.producto_id
  left join public.asientos a on a.id = mi.asiento_id
  where mi.es_recosteo
    and mi.fecha between p_desde and p_hasta
    and (p_producto_id is null or mi.producto_id = p_producto_id)
  order by mi.fecha, mi.creado_en, mi.id;
$$;

create or replace function public.reporte_salud_inventario(p_fecha date default current_date)
returns jsonb
language sql
stable
security invoker
set search_path = ''
as $$
  with cuentas_inventario as (
    select distinct cuenta_id
    from (
      select cc.cuenta_id
      from public.config_contable cc
      where cc.clave = 'inventario'
      union
      select pr.cuenta_inventario_id
      from public.productos pr
      where pr.cuenta_inventario_id is not null
    ) x
  ),
  mayor as (
    select coalesce(sum(l.debito - l.credito), 0)::numeric(14,2) as saldo
    from public.asiento_lineas l
    join public.asientos a on a.id = l.asiento_id
    where l.cuenta_id in (select cuenta_id from cuentas_inventario)
      and a.fecha <= coalesce(p_fecha, current_date)
  ),
  corte as (
    select coalesce(sum(r.valor_inventario), 0)::numeric(14,2) as valor
    from public.reporte_valor_inventario_corte(coalesce(p_fecha, current_date), null) r
  ),
  negativos as (
    select
      (
        select count(*)::int
        from public.productos pr
        where pr.inventariable and pr.cantidad < 0
      ) as total,
      coalesce((
        select jsonb_agg(jsonb_build_object(
          'id', x.id,
          'nombre', x.nombre,
          'referencia', x.referencia,
          'cantidad', x.cantidad,
          'costo', x.costo,
          'valor_inventario', x.valor_inventario
        ) order by x.cantidad)
        from (
          select pr.id, pr.nombre, pr.referencia, pr.cantidad, pr.costo, pr.valor_inventario
          from public.productos pr
          where pr.inventariable and pr.cantidad < 0
          order by pr.cantidad, pr.nombre
          limit 20
        ) x
      ), '[]'::jsonb) as items
  ),
  costo_cero as (
    select count(*)::int as total
    from public.productos pr
    where pr.inventariable
      and pr.activo
      and pr.costo = 0
      and pr.cantidad <= 0
  ),
  recosteos as (
    select
      count(*)::int as total,
      coalesce(sum(-mi.valor_movimiento), 0)::numeric(14,2) as delta_cogs
    from public.movimientos_inventario mi
    where mi.es_recosteo
      and mi.fecha >= date_trunc('month', coalesce(p_fecha, current_date))::date
      and mi.fecha < (date_trunc('month', coalesce(p_fecha, current_date)) + interval '1 month')::date
  )
  select jsonb_build_object(
    'saldo_mayor_inventario', mayor.saldo,
    'valor_kardex_total', corte.valor,
    'diferencia', round(mayor.saldo - corte.valor, 2),
    'productos_negativos', negativos.total,
    'productos_negativos_top', negativos.items,
    'productos_costo_cero', costo_cero.total,
    'recosteos_periodo', jsonb_build_object(
      'total', recosteos.total,
      'delta_cogs', recosteos.delta_cogs
    )
  )
  from mayor, corte, negativos, costo_cero, recosteos;
$$;

revoke all on function public.reporte_kardex_producto(uuid, date, date, uuid)
  from public, anon, authenticated;
revoke all on function public.reporte_valor_inventario_corte(date, uuid)
  from public, anon, authenticated;
revoke all on function public.reporte_recosteos(date, date, uuid)
  from public, anon, authenticated;
revoke all on function public.reporte_salud_inventario(date)
  from public, anon, authenticated;

grant execute on function public.reporte_kardex_producto(uuid, date, date, uuid) to authenticated;
grant execute on function public.reporte_valor_inventario_corte(date, uuid) to authenticated;
grant execute on function public.reporte_recosteos(date, date, uuid) to authenticated;
grant execute on function public.reporte_salud_inventario(date) to authenticated;
