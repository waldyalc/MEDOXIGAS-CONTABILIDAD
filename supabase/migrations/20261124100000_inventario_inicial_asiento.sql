-- ---------------------------------------------------------------------------
-- Inventario inicial con asiento "vivo" (Alegra, Pruebas 1 y 2)
--
-- Alegra genera un asiento [II] al crear un producto inventariable con
-- cantidad inicial > 0: Dr Inventarios / Cr Ajustes iniciales en inventario.
-- Al editar la cantidad o el costo del producto, ESE MISMO asiento se muta en
-- el lugar (misma fecha, mismo número); no se crea una reversión ni un asiento
-- de revalúo. Si la cantidad inicial vuelve a cero, se crea un asiento de
-- reversa ('anulacion') que anula el vivo, para no perder el rastro del monto
-- original.
--
-- · Cuenta "Ajustes iniciales en inventario" bajo Capital (3) y su clave
--   'ajustes_iniciales_inventario' en config_contable.
-- · asientos.producto_id + índice: ubica el asiento vivo de un ítem.
-- · asientos.origen_tipo suma 'inventario_inicial'.
-- · crear_producto/actualizar_producto envuelven los wrappers de impuestos:
--   la base no cambia; el envoltorio agrega el asiento y corrige
--   existencias.cantidad_inicial al editar la cantidad.
--
-- Los productos que ya existían NO reciben asiento retroactivo: su carga
-- inicial se sigue registrando por Saldos iniciales, como hasta hoy.
--
-- Migración aditiva y reintentable: no borra datos ni toca RLS.
-- ---------------------------------------------------------------------------

-- ---------------------------------------------------------------------------
-- Asiento ↔ producto
-- ---------------------------------------------------------------------------

alter table public.asientos
  add column if not exists producto_id uuid references public.productos (id);

-- Si la columna ya existía sin la llave foránea (base migrada a mano), se
-- agrega una sola vez con el nombre que Postgres usaría por defecto.
do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conrelid = 'public.asientos'::regclass
      and contype = 'f'
      and conname = 'asientos_producto_id_fkey'
  ) then
    alter table public.asientos
      add constraint asientos_producto_id_fkey
      foreign key (producto_id) references public.productos (id);
  end if;
end;
$$;

create index if not exists asientos_producto_idx on public.asientos (producto_id);

-- ---------------------------------------------------------------------------
-- origen_tipo: 16 valores (suma el asiento de inventario inicial)
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
    'inventario_inicial'
  ));

-- ---------------------------------------------------------------------------
-- Contrapartida: "Ajustes iniciales en inventario" bajo Capital
-- ---------------------------------------------------------------------------

do $$
declare
  v_capital_id uuid;
  v_cuenta_id uuid;
  v_siguiente int;
  v_codigo text;
begin
  select c.id into v_cuenta_id
  from public.cuentas c
  where c.tipo = 'capital'
    and c.acepta_movimientos
    and c.activa
    and c.nombre = 'Ajustes iniciales en inventario'
  order by c.codigo
  limit 1;

  if v_cuenta_id is null then
    select c.id into v_capital_id
    from public.cuentas c
    where c.codigo = '3';

    if v_capital_id is null then
      raise exception 'no existe la cuenta de capital' using errcode = '22023';
    end if;

    select max(c.codigo::int) into v_siguiente
    from public.cuentas c
    where c.padre_id = v_capital_id
      and c.codigo ~ '^[0-9]+$';

    v_codigo := (coalesce(v_siguiente, 3000) + 100)::text;
    while exists (select 1 from public.cuentas c where c.codigo = v_codigo) loop
      v_codigo := (v_codigo::int + 1)::text;
    end loop;

    insert into public.cuentas (
      codigo, nombre, tipo, naturaleza, padre_id, acepta_movimientos
    )
    values (
      v_codigo, 'Ajustes iniciales en inventario', 'capital', 'credito', v_capital_id, true
    )
    returning id into v_cuenta_id;
  end if;

  insert into public.config_contable (clave, cuenta_id)
  values ('ajustes_iniciales_inventario', v_cuenta_id)
  on conflict (clave) do nothing;
end;
$$;

-- ---------------------------------------------------------------------------
-- Alta de producto: el wrapper de impuestos pasa a interno
-- ---------------------------------------------------------------------------

do $$
begin
  if to_regprocedure('public.crear_producto(jsonb)') is not null
     and to_regprocedure('public._crear_producto_con_impuestos(jsonb)') is null then
    alter function public.crear_producto(jsonb) rename to _crear_producto_con_impuestos;
  end if;

  if to_regprocedure('public.actualizar_producto(uuid, jsonb)') is not null
     and to_regprocedure('public._actualizar_producto_con_impuestos(uuid, jsonb)') is null then
    alter function public.actualizar_producto(uuid, jsonb)
      rename to _actualizar_producto_con_impuestos;
  end if;
end;
$$;

revoke all on function public._crear_producto_con_impuestos(jsonb)
  from public, anon, authenticated;
revoke all on function public._actualizar_producto_con_impuestos(uuid, jsonb)
  from public, anon, authenticated;

create or replace function public.crear_producto(p jsonb)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_id uuid;
  v_producto public.productos%rowtype;
  v_cuenta_inventario uuid;
  v_cuenta_ajustes uuid;
  v_monto numeric(14,2);
  v_asiento_id uuid;
begin
  v_id := public._crear_producto_con_impuestos(p);

  select * into v_producto
  from public.productos pr
  where pr.id = v_id;

  if not found then
    return v_id;
  end if;

  -- Servicio, combo, cantidad inicial cero o costo cero: no hay carga de
  -- inventario que asentar (un asiento de 0 no es válido).
  if not v_producto.inventariable or v_producto.cantidad <= 0 then
    return v_id;
  end if;

  v_monto := round(v_producto.cantidad * v_producto.costo, 2);
  if v_monto <= 0 then
    return v_id;
  end if;

  v_cuenta_inventario := coalesce(
    v_producto.cuenta_inventario_id,
    public._cuenta_config('inventario')
  );
  v_cuenta_ajustes := public._cuenta_config('ajustes_iniciales_inventario');

  v_asiento_id := public._crear_asiento(
    current_date,
    'Inventario inicial ' || left(v_producto.nombre, 60),
    'inventario_inicial',
    v_id,
    jsonb_build_array(
      jsonb_build_object(
        'cuenta_id', v_cuenta_inventario,
        'debito', v_monto,
        'credito', 0,
        'descripcion', 'Inventario inicial: ' || left(v_producto.nombre, 70)
      ),
      jsonb_build_object(
        'cuenta_id', v_cuenta_ajustes,
        'debito', 0,
        'credito', v_monto,
        'descripcion', 'Ajustes iniciales en inventario: ' || left(v_producto.nombre, 60)
      )
    )
  );

  update public.asientos
  set producto_id = v_id
  where id = v_asiento_id;

  return v_id;
end;
$$;

-- ---------------------------------------------------------------------------
-- Edición de producto: muta el asiento vivo o lo anula con una reversa
-- ---------------------------------------------------------------------------

create or replace function public.actualizar_producto(p_id uuid, p jsonb)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_id uuid;
  v_previa public.productos%rowtype;
  v_actual public.productos%rowtype;
  v_inicial_previa numeric(14,2);
  v_inicial_nueva numeric(14,2);
  v_delta numeric(14,2);
  v_monto numeric(14,2);
  v_asiento public.asientos%rowtype;
  v_cuenta_inventario uuid;
  v_cuenta_ajustes uuid;
  v_lineas jsonb;
  v_reversion_id uuid;
begin
  if p is null then
    return public._actualizar_producto_con_impuestos(p_id, p);
  end if;

  select * into v_previa
  from public.productos pr
  where pr.id = p_id
  for update;

  if not found then
    -- La base devuelve el error correcto (permiso o producto no encontrado).
    return public._actualizar_producto_con_impuestos(p_id, p);
  end if;

  v_inicial_previa := coalesce((
    select e.cantidad_inicial
    from public.existencias e
    where e.producto_id = p_id
      and e.almacen_id = v_previa.almacen_id
  ), 0);

  v_id := public._actualizar_producto_con_impuestos(p_id, p);

  select * into v_actual
  from public.productos pr
  where pr.id = p_id;

  -- Solo cantidad/costo de un producto que controla inventario.
  if not v_actual.inventariable or not (p ? 'cantidad' or p ? 'costo') then
    return v_id;
  end if;

  -- La cantidad inicial acompaña al stock: si la cantidad sube o baja, la
  -- carga inicial se corrige por el mismo delta (Alegra muestra "Cant.
  -- inicial" y "Cant. actual" coherentes). Nunca queda negativa.
  v_delta := round(v_actual.cantidad - v_previa.cantidad, 2);
  v_inicial_nueva := greatest(round(v_inicial_previa + v_delta, 2), 0);

  update public.existencias e
  set cantidad_inicial = v_inicial_nueva
  where e.producto_id = p_id
    and e.almacen_id = v_previa.almacen_id;

  -- Asiento vivo = inventario inicial del producto sin reversa registrada.
  -- Sin asiento vivo no se crea nada retroactivo: los productos anteriores a
  -- esta migración cargaron su saldo por Saldos iniciales y un asiento ya
  -- anulado no revive por editar la cantidad.
  select a.* into v_asiento
  from public.asientos a
  where a.origen_tipo = 'inventario_inicial'
    and a.producto_id = p_id
    and not exists (
      select 1
      from public.asientos r
      where r.anula_asiento_id = a.id
    )
  order by a.creado_en desc, a.numero desc
  limit 1;

  if not found then
    return v_id;
  end if;

  v_monto := round(v_inicial_nueva * v_actual.costo, 2);

  if v_monto > 0 then
    v_cuenta_inventario := coalesce(
      v_actual.cuenta_inventario_id,
      public._cuenta_config('inventario')
    );
    v_cuenta_ajustes := public._cuenta_config('ajustes_iniciales_inventario');

    update public.asiento_lineas l
    set
      cuenta_id = case
        when l.debito > 0 then v_cuenta_inventario
        else v_cuenta_ajustes
      end,
      debito = case when l.debito > 0 then v_monto else 0 end,
      credito = case when l.credito > 0 then v_monto else 0 end
    where l.asiento_id = v_asiento.id;

    update public.asientos
    set total = v_monto
    where id = v_asiento.id;

    return v_id;
  end if;

  -- Cantidad inicial en cero: reversa del asiento vivo (no se muta a cero).
  select jsonb_agg(jsonb_build_object(
    'cuenta_id', l.cuenta_id,
    'descripcion', 'Anulación: ' || left(coalesce(l.descripcion, ''), 70),
    'debito', l.credito,
    'credito', l.debito
  ) order by l.id)
  into v_lineas
  from public.asiento_lineas l
  where l.asiento_id = v_asiento.id;

  v_reversion_id := public._crear_asiento(
    current_date,
    'Anulación inventario inicial ' || left(v_actual.nombre, 50),
    'anulacion',
    v_asiento.id,
    v_lineas
  );

  update public.asientos
  set anula_asiento_id = v_asiento.id,
      producto_id = p_id
  where id = v_reversion_id;

  return v_id;
end;
$$;

revoke all on function public.crear_producto(jsonb)
  from public, anon, authenticated;
revoke all on function public.actualizar_producto(uuid, jsonb)
  from public, anon, authenticated;

grant execute on function public.crear_producto(jsonb) to authenticated;
grant execute on function public.actualizar_producto(uuid, jsonb) to authenticated;
