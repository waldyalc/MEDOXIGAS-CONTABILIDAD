-- ---------------------------------------------------------------------------
-- Facturas de venta recurrentes
--
-- Migración aditiva y reintentable: no borra ni cambia datos existentes.
-- · Plantilla con cliente, comprobante, fecha de inicio, vigencia, frecuencia
--   (meses), plazo de pago y líneas.
-- · RPC crear_factura_recurrente (admin/contador) para guardar la plantilla.
-- · RPC generar_factura_recurrente (admin/contador, idempotente): genera la
--   factura del periodo vigente a partir de la plantilla llamando al motor
--   (crear_factura) y registra el periodo en factura_recurrente_generaciones.
--   Si ese periodo ya se generó, devuelve la misma factura. No hay cron.
-- ---------------------------------------------------------------------------

create sequence if not exists public.facturas_recurrentes_numero_seq;

create table if not exists public.facturas_recurrentes (
  id uuid primary key default gen_random_uuid(),
  numero int not null unique default nextval('public.facturas_recurrentes_numero_seq'),
  contacto_id uuid not null references public.contactos (id),
  tipo_comprobante text not null default '02' check (tipo_comprobante in ('01', '02', '14', '15', '16')),
  fecha_inicio date not null default current_date,
  vigencia_hasta date,
  frecuencia_meses int not null default 1 check (frecuencia_meses between 1 and 60),
  plazo_dias int not null default 0 check (plazo_dias between 0 and 365),
  notas text,
  terminos text,
  pie text,
  creado_por uuid default auth.uid(),
  creado_en timestamptz not null default now(),
  check (vigencia_hasta is null or vigencia_hasta >= fecha_inicio)
);

create table if not exists public.factura_recurrente_lineas (
  id uuid primary key default gen_random_uuid(),
  recurrente_id uuid not null references public.facturas_recurrentes (id) on delete cascade,
  producto_id uuid references public.productos (id),
  descripcion text not null default '',
  cantidad numeric(14,2) not null check (cantidad > 0),
  precio numeric(14,2) not null default 0,
  descuento_pct numeric(5,2) not null default 0 check (descuento_pct between 0 and 100),
  itbis_tasa numeric(5,2) not null default 18
);

create table if not exists public.factura_recurrente_generaciones (
  id uuid primary key default gen_random_uuid(),
  recurrente_id uuid not null references public.facturas_recurrentes (id),
  periodo date not null,
  factura_id uuid not null references public.facturas (id),
  creado_por uuid default auth.uid(),
  creado_en timestamptz not null default now(),
  unique (recurrente_id, periodo)
);

create index if not exists facturas_recurrentes_contacto_id_idx on public.facturas_recurrentes (contacto_id);
create index if not exists factura_recurrente_lineas_recurrente_id_idx on public.factura_recurrente_lineas (recurrente_id);
create index if not exists factura_recurrente_lineas_producto_id_idx on public.factura_recurrente_lineas (producto_id);
create index if not exists factura_recurrente_generaciones_recurrente_id_idx
  on public.factura_recurrente_generaciones (recurrente_id);
create index if not exists factura_recurrente_generaciones_factura_id_idx
  on public.factura_recurrente_generaciones (factura_id);

-- ---------------------------------------------------------------------------
-- RPC: crear la plantilla
-- ---------------------------------------------------------------------------

create or replace function public.crear_factura_recurrente(p jsonb)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_rol text;
  v_contacto public.contactos%rowtype;
  v_recurrente_id uuid;
  v_tipo text;
  v_fecha_inicio date;
  v_vigencia_hasta date;
  v_frecuencia int;
  v_plazo int;
  v_linea jsonb;
  v_producto_id uuid;
  v_producto_nombre text;
  v_producto_precio numeric(14,2);
  v_producto_itbis numeric(5,2);
  v_cantidad numeric(14,2);
  v_precio numeric(14,2);
  v_descuento_pct numeric(5,2);
  v_itbis_tasa numeric(5,2);
  v_descripcion text;
begin
  v_rol := public.rol_actual();
  if v_rol is null or v_rol not in ('admin', 'contador') then
    raise exception 'sin permiso' using errcode = '42501';
  end if;

  if p is null or nullif(p->>'contacto_id', '') is null then
    raise exception 'el contacto es obligatorio' using errcode = '22023';
  end if;

  select * into v_contacto
  from public.contactos c
  where c.id = (p->>'contacto_id')::uuid and c.activo;

  if not found then
    raise exception 'contacto no encontrado' using errcode = '22023';
  end if;

  v_tipo := coalesce(nullif(p->>'tipo_comprobante', ''), '02');
  if v_tipo not in ('01', '02', '14', '15', '16') then
    raise exception 'tipo de comprobante inválido' using errcode = '22023';
  end if;

  v_fecha_inicio := coalesce((p->>'fecha_inicio')::date, current_date);
  v_vigencia_hasta := nullif(p->>'vigencia_hasta', '')::date;
  if v_vigencia_hasta is not null and v_vigencia_hasta < v_fecha_inicio then
    raise exception 'la vigencia no puede ser anterior a la fecha de inicio' using errcode = '22023';
  end if;

  v_frecuencia := coalesce((p->>'frecuencia_meses')::int, 1);
  if v_frecuencia < 1 or v_frecuencia > 60 then
    raise exception 'la frecuencia debe estar entre 1 y 60 meses' using errcode = '22023';
  end if;

  v_plazo := coalesce((p->>'plazo_dias')::int, 0);
  if v_plazo < 0 or v_plazo > 365 then
    raise exception 'el plazo de pago debe estar entre 0 y 365 días' using errcode = '22023';
  end if;

  if p->'lineas' is null
     or jsonb_typeof(p->'lineas') <> 'array'
     or jsonb_array_length(p->'lineas') = 0 then
    raise exception 'la factura recurrente requiere al menos una línea' using errcode = '22023';
  end if;

  insert into public.facturas_recurrentes (
    contacto_id, tipo_comprobante, fecha_inicio, vigencia_hasta, frecuencia_meses,
    plazo_dias, notas, terminos, pie, creado_por
  )
  values (
    v_contacto.id, v_tipo, v_fecha_inicio, v_vigencia_hasta, v_frecuencia,
    v_plazo, p->>'notas', p->>'terminos', p->>'pie', auth.uid()
  )
  returning id into v_recurrente_id;

  for v_linea in select * from jsonb_array_elements(p->'lineas') loop
    v_producto_id := nullif(v_linea->>'producto_id', '')::uuid;
    v_producto_nombre := null;
    v_producto_precio := null;
    v_producto_itbis := null;

    if v_producto_id is not null then
      select pr.nombre, pr.precio, pr.itbis_tasa
      into v_producto_nombre, v_producto_precio, v_producto_itbis
      from public.productos pr
      where pr.id = v_producto_id and pr.activo;

      if not found then
        raise exception 'producto no encontrado' using errcode = '22023';
      end if;
    end if;

    v_cantidad := round(coalesce((v_linea->>'cantidad')::numeric, 0), 2);
    if v_cantidad <= 0 then
      raise exception 'la cantidad debe ser mayor a cero' using errcode = '22023';
    end if;

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
    if v_descripcion = '' then
      raise exception 'cada línea requiere un producto o una descripción' using errcode = '22023';
    end if;

    insert into public.factura_recurrente_lineas (
      recurrente_id, producto_id, descripcion, cantidad, precio, descuento_pct, itbis_tasa
    )
    values (
      v_recurrente_id, v_producto_id, v_descripcion, v_cantidad, v_precio, v_descuento_pct, v_itbis_tasa
    );
  end loop;

  return v_recurrente_id;
end;
$$;

-- ---------------------------------------------------------------------------
-- RPC: generar la factura del periodo vigente (idempotente por periodo)
-- ---------------------------------------------------------------------------

create or replace function public.generar_factura_recurrente(p_recurrente_id uuid, p_fecha date default null)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_rol text;
  v_recurrente public.facturas_recurrentes%rowtype;
  v_hoy date;
  v_meses int;
  v_periodo date;
  v_generacion public.factura_recurrente_generaciones%rowtype;
  v_lineas jsonb;
  v_factura_id uuid;
  v_vencimiento date;
begin
  v_rol := public.rol_actual();
  if v_rol is null or v_rol not in ('admin', 'contador') then
    raise exception 'sin permiso' using errcode = '42501';
  end if;

  if p_recurrente_id is null then
    raise exception 'la factura recurrente es obligatoria' using errcode = '22023';
  end if;

  select * into v_recurrente
  from public.facturas_recurrentes fr
  where fr.id = p_recurrente_id
  for update;

  if not found then
    raise exception 'factura recurrente no encontrada' using errcode = '22023';
  end if;

  v_hoy := coalesce(p_fecha, current_date);
  if v_hoy < v_recurrente.fecha_inicio then
    raise exception 'la recurrencia comienza el %', v_recurrente.fecha_inicio using errcode = '22023';
  end if;

  -- Periodo más reciente, contado en meses completos desde la fecha de inicio.
  v_meses := (extract(year from v_hoy)::int - extract(year from v_recurrente.fecha_inicio)::int) * 12
           + (extract(month from v_hoy)::int - extract(month from v_recurrente.fecha_inicio)::int);
  v_periodo := (v_recurrente.fecha_inicio + make_interval(months => v_meses))::date;
  while v_periodo > v_hoy loop
    v_meses := v_meses - 1;
    v_periodo := (v_recurrente.fecha_inicio + make_interval(months => v_meses))::date;
  end loop;

  -- Si la vigencia ya pasó, se genera el último periodo dentro de ella.
  if v_recurrente.vigencia_hasta is not null then
    while v_periodo > v_recurrente.vigencia_hasta loop
      v_meses := v_meses - 1;
      v_periodo := (v_recurrente.fecha_inicio + make_interval(months => v_meses))::date;
    end loop;
  end if;

  if v_periodo < v_recurrente.fecha_inicio then
    raise exception 'la recurrencia no tiene periodos por generar' using errcode = '22023';
  end if;

  select * into v_generacion
  from public.factura_recurrente_generaciones g
  where g.recurrente_id = v_recurrente.id and g.periodo = v_periodo;

  if found then
    return v_generacion.factura_id;
  end if;

  select jsonb_agg(jsonb_build_object(
    'producto_id', l.producto_id,
    'descripcion', l.descripcion,
    'cantidad', l.cantidad,
    'precio', l.precio,
    'descuento_pct', l.descuento_pct,
    'itbis_tasa', l.itbis_tasa
  ) order by l.id)
  into v_lineas
  from public.factura_recurrente_lineas l
  where l.recurrente_id = v_recurrente.id;

  if v_lineas is null or jsonb_array_length(v_lineas) = 0 then
    raise exception 'la plantilla no tiene líneas' using errcode = '22023';
  end if;

  v_vencimiento := v_periodo + v_recurrente.plazo_dias;

  v_factura_id := public.crear_factura(jsonb_build_object(
    'tipo_comprobante', v_recurrente.tipo_comprobante,
    'contacto_id', v_recurrente.contacto_id,
    'fecha', v_periodo,
    'vencimiento', v_vencimiento,
    'notas', v_recurrente.notas,
    'terminos', v_recurrente.terminos,
    'pie', v_recurrente.pie,
    'lineas', v_lineas
  ));

  insert into public.factura_recurrente_generaciones (recurrente_id, periodo, factura_id)
  values (v_recurrente.id, v_periodo, v_factura_id);

  return v_factura_id;
end;
$$;

-- ---------------------------------------------------------------------------
-- RLS y permisos
-- ---------------------------------------------------------------------------

do $$
declare
  v_tabla text;
begin
  foreach v_tabla in array array[
    'facturas_recurrentes',
    'factura_recurrente_lineas',
    'factura_recurrente_generaciones'
  ] loop
    execute format('alter table public.%I enable row level security', v_tabla);
    execute format('revoke all on public.%I from anon', v_tabla);
    execute format('revoke all on public.%I from authenticated', v_tabla);
    execute format('grant select on public.%I to authenticated', v_tabla);
    execute format('drop policy if exists %I on public.%I', v_tabla || '_lectura', v_tabla);
    execute format(
      'create policy %I on public.%I for select to authenticated using ((select public.rol_actual()) is not null)',
      v_tabla || '_lectura',
      v_tabla
    );
  end loop;
end;
$$;

revoke all on sequence public.facturas_recurrentes_numero_seq from anon, authenticated;

revoke all on function public.crear_factura_recurrente(jsonb) from public, anon, authenticated;
revoke all on function public.generar_factura_recurrente(uuid, date) from public, anon, authenticated;
grant execute on function public.crear_factura_recurrente(jsonb) to authenticated;
grant execute on function public.generar_factura_recurrente(uuid, date) to authenticated;
