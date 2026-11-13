-- ---------------------------------------------------------------------------
-- Conciliación bancaria
--
-- · conciliaciones: cabecera (borrador o conciliada) por cuenta de caja/banco.
-- · conciliacion_movimientos: líneas de asiento marcadas; una sola vez.
-- · El asiento solo se crea si gastos, impuestos o entradas son > 0. Si todo
--   es 0, la conciliación no asienta (como Alegra 10.3).
--
-- Migración aditiva: no crea cuenta puente ni cambia el asiento de las
-- transferencias (sigue Dr destino / Cr origen).
-- RLS: authenticated lee; las escrituras van solo por RPC y no hay DELETE.
-- ---------------------------------------------------------------------------

-- Origen de asiento nuevo (se conserva la lista completa anterior).
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
    'conciliacion'
  ));

-- Cuentas por defecto para cargos e intereses (si no existen aún).
insert into public.cuentas (codigo, nombre, tipo, naturaleza, padre_id, acepta_movimientos)
select '6108', 'Gastos financieros', 'gasto', 'debito', p.id, true
from public.cuentas p
where p.codigo = '6'
  and not exists (select 1 from public.cuentas c where c.nombre = 'Gastos financieros')
on conflict (codigo) do nothing;

insert into public.cuentas (codigo, nombre, tipo, naturaleza, padre_id, acepta_movimientos)
select '4103', 'Ingresos por intereses', 'ingreso', 'credito', p.id, true
from public.cuentas p
where p.codigo = '4'
  and not exists (select 1 from public.cuentas c where c.nombre = 'Ingresos por intereses')
on conflict (codigo) do nothing;

-- ---------------------------------------------------------------------------
-- Tablas
-- ---------------------------------------------------------------------------

create table if not exists public.conciliaciones (
  id uuid primary key default gen_random_uuid(),
  cuenta_id uuid not null references public.cuentas (id),
  fecha_desde date not null,
  fecha_hasta date not null,
  saldo_bancario numeric(14,2),
  estado text not null default 'borrador' check (estado in ('borrador', 'conciliada')),
  gastos_bancarios numeric(14,2) not null default 0 check (gastos_bancarios >= 0),
  impuestos_bancarios numeric(14,2) not null default 0 check (impuestos_bancarios >= 0),
  entradas_bancarias numeric(14,2) not null default 0 check (entradas_bancarias >= 0),
  cuenta_gastos_id uuid references public.cuentas (id),
  cuenta_impuestos_id uuid references public.cuentas (id),
  cuenta_entradas_id uuid references public.cuentas (id),
  asiento_id uuid references public.asientos (id),
  creado_por uuid default auth.uid(),
  creado_en timestamptz not null default now(),
  conciliado_en timestamptz,
  constraint conciliaciones_fechas_check check (fecha_desde <= fecha_hasta)
);

create unique index if not exists conciliaciones_borrador_uidx
  on public.conciliaciones (cuenta_id)
  where estado = 'borrador';

create table if not exists public.conciliacion_movimientos (
  conciliacion_id uuid not null references public.conciliaciones (id) on delete cascade,
  asiento_linea_id uuid not null references public.asiento_lineas (id),
  primary key (conciliacion_id, asiento_linea_id),
  constraint conciliacion_movimientos_linea_unica unique (asiento_linea_id)
);

-- ---------------------------------------------------------------------------
-- Validaciones de tabla
-- ---------------------------------------------------------------------------

create or replace function public._validar_cuenta_conciliacion()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not exists (
    select 1 from public.cuentas c
    where c.id = new.cuenta_id and c.es_caja_banco
  ) then
    raise exception 'la cuenta de la conciliación debe ser de caja o banco'
      using errcode = '23514';
  end if;

  return new;
end;
$$;

drop trigger if exists conciliaciones_cuenta_banco on public.conciliaciones;
create trigger conciliaciones_cuenta_banco
before insert or update of cuenta_id on public.conciliaciones
for each row execute function public._validar_cuenta_conciliacion();

create or replace function public._validar_movimiento_conciliacion()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_cuenta_conciliacion uuid;
  v_desde date;
  v_hasta date;
  v_cuenta_linea uuid;
  v_fecha date;
begin
  select c.cuenta_id, c.fecha_desde, c.fecha_hasta
  into v_cuenta_conciliacion, v_desde, v_hasta
  from public.conciliaciones c
  where c.id = new.conciliacion_id;

  select l.cuenta_id, a.fecha
  into v_cuenta_linea, v_fecha
  from public.asiento_lineas l
  join public.asientos a on a.id = l.asiento_id
  where l.id = new.asiento_linea_id;

  if v_cuenta_linea is null then
    raise exception 'movimiento no encontrado' using errcode = '23503';
  end if;

  if v_cuenta_linea <> v_cuenta_conciliacion then
    raise exception 'el movimiento no pertenece a la cuenta de la conciliación'
      using errcode = '23514';
  end if;

  if v_fecha < v_desde or v_fecha > v_hasta then
    raise exception 'el movimiento está fuera del rango de la conciliación'
      using errcode = '23514';
  end if;

  return new;
end;
$$;

drop trigger if exists conciliacion_movimientos_validar on public.conciliacion_movimientos;
create trigger conciliacion_movimientos_validar
before insert or update on public.conciliacion_movimientos
for each row execute function public._validar_movimiento_conciliacion();

-- ---------------------------------------------------------------------------
-- Funciones internas
-- ---------------------------------------------------------------------------

create or replace function public._cuenta_conciliacion(
  p_cuenta_id text,
  p_nombre text,
  p_codigo text,
  p_tipo text,
  p_naturaleza text,
  p_padre_codigo text
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_id uuid;
begin
  v_id := nullif(p_cuenta_id, '')::uuid;

  if v_id is not null then
    if not exists (
      select 1 from public.cuentas c
      where c.id = v_id and c.activa and c.acepta_movimientos
    ) then
      raise exception 'cuenta contable no encontrada, inactiva o sin movimientos'
        using errcode = '22023';
    end if;
    return v_id;
  end if;

  select c.id into v_id
  from public.cuentas c
  where lower(c.nombre) = lower(p_nombre)
  order by c.activa desc, c.codigo
  limit 1;

  if v_id is not null then
    return v_id;
  end if;

  insert into public.cuentas (codigo, nombre, tipo, naturaleza, padre_id, acepta_movimientos)
  select p_codigo, p_nombre, p_tipo, p_naturaleza, p.id, true
  from public.cuentas p
  where p.codigo = p_padre_codigo
  on conflict (codigo) do nothing;

  select c.id into v_id
  from public.cuentas c
  where lower(c.nombre) = lower(p_nombre)
  order by c.codigo
  limit 1;

  if v_id is null then
    raise exception 'no se pudo crear la cuenta por defecto %', p_nombre
      using errcode = '22023';
  end if;

  return v_id;
end;
$$;

create or replace function public._conciliacion_lineas(p_lineas jsonb)
returns uuid[]
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_ids uuid[] := '{}';
  v_linea jsonb;
  v_id uuid;
begin
  if p_lineas is null then
    return v_ids;
  end if;

  if jsonb_typeof(p_lineas) <> 'array' then
    raise exception 'las líneas de la conciliación son inválidas' using errcode = '22023';
  end if;

  for v_linea in select * from jsonb_array_elements(p_lineas) loop
    if jsonb_typeof(v_linea) = 'object' then
      v_id := nullif(coalesce(v_linea->>'asiento_linea_id', v_linea->>'id'), '')::uuid;
    else
      v_id := nullif(v_linea #>> '{}', '')::uuid;
    end if;

    if v_id is null then
      raise exception 'las líneas de la conciliación son inválidas' using errcode = '22023';
    end if;

    if v_id = any(v_ids) then
      raise exception 'un movimiento está repetido en la conciliación' using errcode = '22023';
    end if;

    v_ids := v_ids || v_id;
  end loop;

  return v_ids;
end;
$$;

create or replace function public._validar_movimientos_conciliacion(
  p_cuenta_id uuid,
  p_desde date,
  p_hasta date,
  p_lineas uuid[],
  p_conciliacion_id uuid
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_total int;
begin
  if p_lineas is null or cardinality(p_lineas) = 0 then
    return;
  end if;

  select count(*)::int into v_total
  from unnest(p_lineas) as x (id)
  join public.asiento_lineas l on l.id = x.id
  join public.asientos a on a.id = l.asiento_id
  where l.cuenta_id = p_cuenta_id
    and a.fecha between p_desde and p_hasta;

  if v_total <> cardinality(p_lineas) then
    raise exception 'el movimiento no pertenece a la cuenta o está fuera del rango'
      using errcode = '22023';
  end if;

  if exists (
    select 1
    from public.conciliacion_movimientos cm
    join unnest(p_lineas) as x (id) on x.id = cm.asiento_linea_id
    where p_conciliacion_id is null or cm.conciliacion_id <> p_conciliacion_id
  ) then
    raise exception 'el movimiento ya está en otra conciliación' using errcode = '23505';
  end if;
end;
$$;

create or replace function public._guardar_conciliacion_cabecera(
  p_conciliacion_id uuid,
  p_cuenta_id uuid,
  p_desde date,
  p_hasta date,
  p_saldo numeric,
  p_gastos numeric,
  p_impuestos numeric,
  p_entradas numeric,
  p_cuenta_gastos uuid,
  p_cuenta_impuestos uuid,
  p_cuenta_entradas uuid
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_id uuid;
begin
  if p_conciliacion_id is not null then
    update public.conciliaciones
    set fecha_desde = p_desde,
        fecha_hasta = p_hasta,
        saldo_bancario = p_saldo,
        gastos_bancarios = p_gastos,
        impuestos_bancarios = p_impuestos,
        entradas_bancarias = p_entradas,
        cuenta_gastos_id = p_cuenta_gastos,
        cuenta_impuestos_id = p_cuenta_impuestos,
        cuenta_entradas_id = p_cuenta_entradas
    where id = p_conciliacion_id
      and cuenta_id = p_cuenta_id
      and estado = 'borrador'
    returning id into v_id;

    if v_id is null then
      raise exception 'conciliación no encontrada o ya conciliada' using errcode = '22023';
    end if;
  else
    insert into public.conciliaciones (
      cuenta_id,
      fecha_desde,
      fecha_hasta,
      saldo_bancario,
      gastos_bancarios,
      impuestos_bancarios,
      entradas_bancarias,
      cuenta_gastos_id,
      cuenta_impuestos_id,
      cuenta_entradas_id
    )
    values (
      p_cuenta_id,
      p_desde,
      p_hasta,
      p_saldo,
      p_gastos,
      p_impuestos,
      p_entradas,
      p_cuenta_gastos,
      p_cuenta_impuestos,
      p_cuenta_entradas
    )
    returning id into v_id;
  end if;

  return v_id;
end;
$$;

-- ---------------------------------------------------------------------------
-- RPC: guardar borrador
-- ---------------------------------------------------------------------------

create or replace function public.guardar_borrador_conciliacion(p jsonb)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_rol text;
  v_cuenta public.cuentas%rowtype;
  v_desde date;
  v_hasta date;
  v_saldo numeric(14,2);
  v_gastos numeric(14,2);
  v_impuestos numeric(14,2);
  v_entradas numeric(14,2);
  v_cuenta_gastos uuid;
  v_cuenta_impuestos uuid;
  v_cuenta_entradas uuid;
  v_conciliacion_id uuid;
  v_lineas uuid[];
  v_id uuid;
begin
  v_rol := public.rol_actual();
  if v_rol is null or v_rol not in ('admin', 'contador') then
    raise exception 'sin permiso' using errcode = '42501';
  end if;

  if p is null or jsonb_typeof(p) <> 'object' then
    raise exception 'datos de la conciliación requeridos' using errcode = '22023';
  end if;

  if nullif(p->>'cuenta_id', '') is null then
    raise exception 'selecciona la cuenta a conciliar' using errcode = '22023';
  end if;

  select * into v_cuenta
  from public.cuentas c
  where c.id = (p->>'cuenta_id')::uuid;

  if not found or not v_cuenta.es_caja_banco then
    raise exception 'la cuenta debe ser de caja o banco' using errcode = '22023';
  end if;

  if nullif(p->>'fecha_desde', '') is null or nullif(p->>'fecha_hasta', '') is null then
    raise exception 'el rango de fechas es obligatorio' using errcode = '22023';
  end if;

  v_desde := (p->>'fecha_desde')::date;
  v_hasta := (p->>'fecha_hasta')::date;

  if v_desde > v_hasta then
    raise exception 'el rango de fechas es inválido' using errcode = '22023';
  end if;

  if nullif(p->>'saldo_bancario', '') is not null then
    v_saldo := round((p->>'saldo_bancario')::numeric, 2);
  end if;

  v_gastos := round(coalesce(nullif(coalesce(p->>'gastos_bancarios', p->>'gastos'), '')::numeric, 0), 2);
  v_impuestos := round(coalesce(nullif(coalesce(p->>'impuestos_bancarios', p->>'impuestos'), '')::numeric, 0), 2);
  v_entradas := round(coalesce(nullif(coalesce(p->>'entradas_bancarias', p->>'entradas'), '')::numeric, 0), 2);

  if v_gastos < 0 or v_impuestos < 0 or v_entradas < 0 then
    raise exception 'los montos de la conciliación no pueden ser negativos'
      using errcode = '22023';
  end if;

  v_cuenta_gastos := public._cuenta_conciliacion(
    coalesce(p->>'cuenta_gastos_id', p->>'cuenta_gastos_bancarios_id'),
    'Gastos financieros',
    '6108',
    'gasto',
    'debito',
    '6'
  );

  v_cuenta_impuestos := public._cuenta_conciliacion(
    coalesce(p->>'cuenta_impuestos_id', p->>'cuenta_impuestos_bancarios_id'),
    'Gastos financieros',
    '6108',
    'gasto',
    'debito',
    '6'
  );

  v_cuenta_entradas := public._cuenta_conciliacion(
    coalesce(p->>'cuenta_entradas_id', p->>'cuenta_entradas_bancarias_id'),
    'Ingresos por intereses',
    '4103',
    'ingreso',
    'credito',
    '4'
  );

  v_conciliacion_id := nullif(coalesce(p->>'conciliacion_id', p->>'id'), '')::uuid;

  if v_conciliacion_id is not null then
    if not exists (
      select 1 from public.conciliaciones c
      where c.id = v_conciliacion_id
        and c.cuenta_id = v_cuenta.id
        and c.estado = 'borrador'
    ) then
      raise exception 'conciliación no encontrada o ya conciliada' using errcode = '22023';
    end if;
  else
    select c.id into v_conciliacion_id
    from public.conciliaciones c
    where c.cuenta_id = v_cuenta.id
      and c.estado = 'borrador'
    order by c.creado_en desc
    limit 1;
  end if;

  v_lineas := public._conciliacion_lineas(p->'lineas');
  perform public._validar_movimientos_conciliacion(
    v_cuenta.id, v_desde, v_hasta, v_lineas, v_conciliacion_id
  );

  v_id := public._guardar_conciliacion_cabecera(
    v_conciliacion_id,
    v_cuenta.id,
    v_desde,
    v_hasta,
    v_saldo,
    v_gastos,
    v_impuestos,
    v_entradas,
    v_cuenta_gastos,
    v_cuenta_impuestos,
    v_cuenta_entradas
  );

  delete from public.conciliacion_movimientos where conciliacion_id = v_id;

  insert into public.conciliacion_movimientos (conciliacion_id, asiento_linea_id)
  select v_id, x.id
  from unnest(v_lineas) as x (id);

  return v_id;
end;
$$;

-- ---------------------------------------------------------------------------
-- RPC: conciliar
-- ---------------------------------------------------------------------------

create or replace function public.conciliar_cuenta(p jsonb)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_rol text;
  v_cuenta public.cuentas%rowtype;
  v_desde date;
  v_hasta date;
  v_saldo numeric(14,2);
  v_gastos numeric(14,2);
  v_impuestos numeric(14,2);
  v_entradas numeric(14,2);
  v_cuenta_gastos uuid;
  v_cuenta_impuestos uuid;
  v_cuenta_entradas uuid;
  v_conciliacion_id uuid;
  v_lineas uuid[];
  v_lineas_asiento jsonb := '[]'::jsonb;
  v_asiento_id uuid;
  v_id uuid;
begin
  v_rol := public.rol_actual();
  if v_rol is null or v_rol not in ('admin', 'contador') then
    raise exception 'sin permiso' using errcode = '42501';
  end if;

  if p is null or jsonb_typeof(p) <> 'object' then
    raise exception 'datos de la conciliación requeridos' using errcode = '22023';
  end if;

  if nullif(p->>'cuenta_id', '') is null then
    raise exception 'selecciona la cuenta a conciliar' using errcode = '22023';
  end if;

  select * into v_cuenta
  from public.cuentas c
  where c.id = (p->>'cuenta_id')::uuid;

  if not found or not v_cuenta.es_caja_banco then
    raise exception 'la cuenta debe ser de caja o banco' using errcode = '22023';
  end if;

  if nullif(p->>'fecha_desde', '') is null or nullif(p->>'fecha_hasta', '') is null then
    raise exception 'el rango de fechas es obligatorio' using errcode = '22023';
  end if;

  v_desde := (p->>'fecha_desde')::date;
  v_hasta := (p->>'fecha_hasta')::date;

  if v_desde > v_hasta then
    raise exception 'el rango de fechas es inválido' using errcode = '22023';
  end if;

  if nullif(p->>'saldo_bancario', '') is null then
    raise exception 'el saldo bancario es obligatorio' using errcode = '22023';
  end if;

  v_saldo := round((p->>'saldo_bancario')::numeric, 2);

  v_gastos := round(coalesce(nullif(coalesce(p->>'gastos_bancarios', p->>'gastos'), '')::numeric, 0), 2);
  v_impuestos := round(coalesce(nullif(coalesce(p->>'impuestos_bancarios', p->>'impuestos'), '')::numeric, 0), 2);
  v_entradas := round(coalesce(nullif(coalesce(p->>'entradas_bancarias', p->>'entradas'), '')::numeric, 0), 2);

  if v_gastos < 0 or v_impuestos < 0 or v_entradas < 0 then
    raise exception 'los montos de la conciliación no pueden ser negativos'
      using errcode = '22023';
  end if;

  v_cuenta_gastos := public._cuenta_conciliacion(
    coalesce(p->>'cuenta_gastos_id', p->>'cuenta_gastos_bancarios_id'),
    'Gastos financieros',
    '6108',
    'gasto',
    'debito',
    '6'
  );

  v_cuenta_impuestos := public._cuenta_conciliacion(
    coalesce(p->>'cuenta_impuestos_id', p->>'cuenta_impuestos_bancarios_id'),
    'Gastos financieros',
    '6108',
    'gasto',
    'debito',
    '6'
  );

  v_cuenta_entradas := public._cuenta_conciliacion(
    coalesce(p->>'cuenta_entradas_id', p->>'cuenta_entradas_bancarias_id'),
    'Ingresos por intereses',
    '4103',
    'ingreso',
    'credito',
    '4'
  );

  v_conciliacion_id := nullif(coalesce(p->>'conciliacion_id', p->>'id'), '')::uuid;

  if v_conciliacion_id is not null then
    if not exists (
      select 1 from public.conciliaciones c
      where c.id = v_conciliacion_id
        and c.cuenta_id = v_cuenta.id
        and c.estado = 'borrador'
    ) then
      raise exception 'conciliación no encontrada o ya conciliada' using errcode = '22023';
    end if;
  else
    select c.id into v_conciliacion_id
    from public.conciliaciones c
    where c.cuenta_id = v_cuenta.id
      and c.estado = 'borrador'
    order by c.creado_en desc
    limit 1;
  end if;

  v_lineas := public._conciliacion_lineas(p->'lineas');

  if v_lineas is null or cardinality(v_lineas) = 0 then
    raise exception 'selecciona al menos un movimiento' using errcode = '22023';
  end if;

  perform public._validar_movimientos_conciliacion(
    v_cuenta.id, v_desde, v_hasta, v_lineas, v_conciliacion_id
  );

  v_id := public._guardar_conciliacion_cabecera(
    v_conciliacion_id,
    v_cuenta.id,
    v_desde,
    v_hasta,
    v_saldo,
    v_gastos,
    v_impuestos,
    v_entradas,
    v_cuenta_gastos,
    v_cuenta_impuestos,
    v_cuenta_entradas
  );

  delete from public.conciliacion_movimientos where conciliacion_id = v_id;

  insert into public.conciliacion_movimientos (conciliacion_id, asiento_linea_id)
  select v_id, x.id
  from unnest(v_lineas) as x (id);

  if v_gastos + v_impuestos + v_entradas > 0 then
    if v_gastos > 0 and v_impuestos > 0 and v_cuenta_gastos = v_cuenta_impuestos then
      v_lineas_asiento := v_lineas_asiento || jsonb_build_array(jsonb_build_object(
        'cuenta_id', v_cuenta_gastos,
        'debito', v_gastos + v_impuestos,
        'credito', 0,
        'descripcion', 'Gastos e impuestos bancarios'
      ));
    else
      if v_gastos > 0 then
        v_lineas_asiento := v_lineas_asiento || jsonb_build_array(jsonb_build_object(
          'cuenta_id', v_cuenta_gastos,
          'debito', v_gastos,
          'credito', 0,
          'descripcion', 'Gastos bancarios'
        ));
      end if;

      if v_impuestos > 0 then
        v_lineas_asiento := v_lineas_asiento || jsonb_build_array(jsonb_build_object(
          'cuenta_id', v_cuenta_impuestos,
          'debito', v_impuestos,
          'credito', 0,
          'descripcion', 'Impuestos bancarios'
        ));
      end if;
    end if;

    if v_entradas > 0 then
      v_lineas_asiento := v_lineas_asiento || jsonb_build_array(jsonb_build_object(
        'cuenta_id', v_cuenta.id,
        'debito', v_entradas,
        'credito', 0,
        'descripcion', 'Entradas bancarias'
      ));
    end if;

    if v_gastos + v_impuestos > 0 then
      v_lineas_asiento := v_lineas_asiento || jsonb_build_array(jsonb_build_object(
        'cuenta_id', v_cuenta.id,
        'debito', 0,
        'credito', v_gastos + v_impuestos,
        'descripcion', 'Cargos bancarios'
      ));
    end if;

    if v_entradas > 0 then
      v_lineas_asiento := v_lineas_asiento || jsonb_build_array(jsonb_build_object(
        'cuenta_id', v_cuenta_entradas,
        'debito', 0,
        'credito', v_entradas,
        'descripcion', 'Intereses ganados'
      ));
    end if;

    v_asiento_id := public._crear_asiento(
      v_hasta,
      'Conciliación bancaria ' || v_cuenta.nombre || ' del ' || v_desde || ' al ' || v_hasta,
      'conciliacion',
      v_id,
      v_lineas_asiento
    );
  end if;

  update public.conciliaciones
  set estado = 'conciliada',
      asiento_id = v_asiento_id,
      conciliado_en = now()
  where id = v_id;

  return v_id;
end;
$$;

-- ---------------------------------------------------------------------------
-- RLS y permisos
-- ---------------------------------------------------------------------------

alter table public.conciliaciones enable row level security;
alter table public.conciliacion_movimientos enable row level security;

revoke all on public.conciliaciones from public, anon, authenticated;
revoke all on public.conciliacion_movimientos from public, anon, authenticated;

grant select on public.conciliaciones to authenticated;
grant select on public.conciliacion_movimientos to authenticated;

drop policy if exists conciliaciones_lectura on public.conciliaciones;
create policy conciliaciones_lectura on public.conciliaciones
for select to authenticated
using ((select public.rol_actual()) is not null);

drop policy if exists conciliacion_movimientos_lectura on public.conciliacion_movimientos;
create policy conciliacion_movimientos_lectura on public.conciliacion_movimientos
for select to authenticated
using ((select public.rol_actual()) is not null);

revoke all on function public._validar_cuenta_conciliacion() from public, anon, authenticated;
revoke all on function public._validar_movimiento_conciliacion() from public, anon, authenticated;
revoke all on function public._cuenta_conciliacion(text, text, text, text, text, text) from public, anon, authenticated;
revoke all on function public._conciliacion_lineas(jsonb) from public, anon, authenticated;
revoke all on function public._validar_movimientos_conciliacion(uuid, date, date, uuid[], uuid) from public, anon, authenticated;
revoke all on function public._guardar_conciliacion_cabecera(uuid, uuid, date, date, numeric, numeric, numeric, numeric, uuid, uuid, uuid) from public, anon, authenticated;

revoke all on function public.guardar_borrador_conciliacion(jsonb) from public, anon, authenticated;
revoke all on function public.conciliar_cuenta(jsonb) from public, anon, authenticated;

grant execute on function public.guardar_borrador_conciliacion(jsonb) to authenticated;
grant execute on function public.conciliar_cuenta(jsonb) to authenticated;
