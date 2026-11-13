-- ---------------------------------------------------------------------------
-- Cotizaciones y remisiones (conduces)
--
-- Documentos comerciales sin asiento contable y sin movimiento de inventario.
-- Se convierten a factura con convertir_a_factura (ahí sí corre el motor).
--
-- · RLS como facturas: authenticated solo lee; escribe por RPC definer.
-- · Numeración propia por secuencia; no toca numeraciones de NCF.
-- · Migración aditiva y reintentable: no borra ni cambia datos existentes.
-- ---------------------------------------------------------------------------

create sequence if not exists public.cotizaciones_numero_seq;
create sequence if not exists public.remisiones_numero_seq;

create table if not exists public.cotizaciones (
  id uuid primary key default gen_random_uuid(),
  numero int not null unique default nextval('public.cotizaciones_numero_seq'),
  contacto_id uuid not null references public.contactos (id),
  fecha date not null default current_date,
  vencimiento date not null,
  subtotal numeric(14,2) not null default 0,
  descuento numeric(14,2) not null default 0,
  itbis numeric(14,2) not null default 0,
  total numeric(14,2) not null default 0,
  estado text not null default 'abierta' check (estado in ('abierta', 'convertida', 'anulada')),
  factura_id uuid references public.facturas (id),
  notas text,
  creado_por uuid default auth.uid(),
  creado_en timestamptz not null default now()
);

create table if not exists public.cotizacion_lineas (
  id uuid primary key default gen_random_uuid(),
  cotizacion_id uuid not null references public.cotizaciones (id) on delete cascade,
  producto_id uuid references public.productos (id),
  descripcion text not null default '',
  cantidad numeric(14,2) not null,
  precio numeric(14,2) not null default 0,
  descuento_pct numeric(5,2) not null default 0 check (descuento_pct between 0 and 100),
  itbis_tasa numeric(5,2) not null default 18,
  subtotal numeric(14,2) not null default 0,
  itbis numeric(14,2) not null default 0,
  total numeric(14,2) not null default 0
);

create table if not exists public.remisiones (
  id uuid primary key default gen_random_uuid(),
  numero int not null unique default nextval('public.remisiones_numero_seq'),
  contacto_id uuid not null references public.contactos (id),
  fecha date not null default current_date,
  vencimiento date not null,
  subtotal numeric(14,2) not null default 0,
  itbis numeric(14,2) not null default 0,
  total numeric(14,2) not null default 0,
  estado text not null default 'abierta' check (estado in ('abierta', 'convertida', 'anulada')),
  factura_id uuid references public.facturas (id),
  notas text,
  creado_por uuid default auth.uid(),
  creado_en timestamptz not null default now()
);

create table if not exists public.remision_lineas (
  id uuid primary key default gen_random_uuid(),
  remision_id uuid not null references public.remisiones (id) on delete cascade,
  producto_id uuid references public.productos (id),
  descripcion text not null default '',
  cantidad numeric(14,2) not null,
  precio numeric(14,2) not null default 0,
  descuento_pct numeric(5,2) not null default 0 check (descuento_pct between 0 and 100),
  itbis_tasa numeric(5,2) not null default 18,
  subtotal numeric(14,2) not null default 0,
  itbis numeric(14,2) not null default 0,
  total numeric(14,2) not null default 0
);

create index if not exists cotizaciones_contacto_id_idx on public.cotizaciones (contacto_id);
create index if not exists cotizaciones_fecha_idx on public.cotizaciones (fecha);
create index if not exists cotizaciones_estado_idx on public.cotizaciones (estado);
create index if not exists cotizaciones_factura_id_idx on public.cotizaciones (factura_id);
create index if not exists cotizacion_lineas_cotizacion_id_idx on public.cotizacion_lineas (cotizacion_id);
create index if not exists cotizacion_lineas_producto_id_idx on public.cotizacion_lineas (producto_id);

create index if not exists remisiones_contacto_id_idx on public.remisiones (contacto_id);
create index if not exists remisiones_fecha_idx on public.remisiones (fecha);
create index if not exists remisiones_estado_idx on public.remisiones (estado);
create index if not exists remisiones_factura_id_idx on public.remisiones (factura_id);
create index if not exists remision_lineas_remision_id_idx on public.remision_lineas (remision_id);
create index if not exists remision_lineas_producto_id_idx on public.remision_lineas (producto_id);

-- ---------------------------------------------------------------------------
-- Creación interna de cotizaciones y remisiones (mismo cálculo de líneas que
-- crear_factura, sin asiento ni inventario)
-- ---------------------------------------------------------------------------

create or replace function public._crear_documento_no_contable(p_tipo text, p jsonb)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_rol text;
  v_contacto public.contactos%rowtype;
  v_id uuid;
  v_fecha date;
  v_vencimiento date;
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
  v_bruto numeric(14,2);
  v_descuento numeric(14,2);
  v_subtotal numeric(14,2);
  v_itbis numeric(14,2);
  v_total numeric(14,2);
  v_subtotal_doc numeric(14,2) := 0;
  v_descuento_doc numeric(14,2) := 0;
  v_itbis_doc numeric(14,2) := 0;
  v_total_doc numeric(14,2) := 0;
begin
  v_rol := public.rol_actual();
  if v_rol is null or v_rol not in ('admin', 'contador') then
    raise exception 'sin permiso' using errcode = '42501';
  end if;

  if p_tipo is null or p_tipo not in ('cotizacion', 'remision') then
    raise exception 'tipo de documento inválido' using errcode = '22023';
  end if;

  if p is null then
    raise exception 'datos del documento requeridos' using errcode = '22023';
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

  v_fecha := coalesce((p->>'fecha')::date, current_date);
  v_vencimiento := coalesce((p->>'vencimiento')::date, v_fecha);
  if v_vencimiento < v_fecha then
    raise exception 'el vencimiento no puede ser anterior a la fecha' using errcode = '22023';
  end if;

  if p->'lineas' is null
     or jsonb_typeof(p->'lineas') <> 'array'
     or jsonb_array_length(p->'lineas') = 0 then
    raise exception 'el documento requiere al menos una línea' using errcode = '22023';
  end if;

  if p_tipo = 'cotizacion' then
    insert into public.cotizaciones (contacto_id, fecha, vencimiento, notas, creado_por)
    values (v_contacto.id, v_fecha, v_vencimiento, p->>'notas', auth.uid())
    returning id into v_id;
  else
    insert into public.remisiones (contacto_id, fecha, vencimiento, notas, creado_por)
    values (v_contacto.id, v_fecha, v_vencimiento, p->>'notas', auth.uid())
    returning id into v_id;
  end if;

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

    v_bruto := round(v_cantidad * v_precio, 2);
    v_descuento := round(v_bruto * v_descuento_pct / 100, 2);
    v_subtotal := round(v_bruto - v_descuento, 2);
    v_itbis := round(v_subtotal * v_itbis_tasa / 100, 2);
    v_total := round(v_subtotal + v_itbis, 2);

    if p_tipo = 'cotizacion' then
      insert into public.cotizacion_lineas (
        cotizacion_id, producto_id, descripcion, cantidad, precio, descuento_pct,
        itbis_tasa, subtotal, itbis, total
      )
      values (
        v_id, v_producto_id, v_descripcion, v_cantidad, v_precio, v_descuento_pct,
        v_itbis_tasa, v_subtotal, v_itbis, v_total
      );
    else
      insert into public.remision_lineas (
        remision_id, producto_id, descripcion, cantidad, precio, descuento_pct,
        itbis_tasa, subtotal, itbis, total
      )
      values (
        v_id, v_producto_id, v_descripcion, v_cantidad, v_precio, v_descuento_pct,
        v_itbis_tasa, v_subtotal, v_itbis, v_total
      );
    end if;

    v_subtotal_doc := v_subtotal_doc + v_subtotal;
    v_descuento_doc := v_descuento_doc + v_descuento;
    v_itbis_doc := v_itbis_doc + v_itbis;
    v_total_doc := v_total_doc + v_total;
  end loop;

  if v_total_doc <= 0 then
    raise exception 'el total del documento debe ser mayor a cero' using errcode = '22023';
  end if;

  if p_tipo = 'cotizacion' then
    update public.cotizaciones
    set subtotal = v_subtotal_doc,
        descuento = v_descuento_doc,
        itbis = v_itbis_doc,
        total = v_total_doc
    where id = v_id;
  else
    update public.remisiones
    set subtotal = v_subtotal_doc,
        itbis = v_itbis_doc,
        total = v_total_doc
    where id = v_id;
  end if;

  return v_id;
end;
$$;

create or replace function public.crear_cotizacion(p jsonb)
returns uuid
language sql
security definer
set search_path = ''
as $$
  select public._crear_documento_no_contable('cotizacion', p);
$$;

create or replace function public.crear_remision(p jsonb)
returns uuid
language sql
security definer
set search_path = ''
as $$
  select public._crear_documento_no_contable('remision', p);
$$;

-- ---------------------------------------------------------------------------
-- Conversión a factura: mismo contacto, fechas, notas y líneas
-- ---------------------------------------------------------------------------

create or replace function public.convertir_a_factura(p jsonb)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_rol text;
  v_tipo_doc text;
  v_id uuid;
  v_tipo_comprobante text;
  v_contacto_id uuid;
  v_fecha date;
  v_vencimiento date;
  v_notas text;
  v_lineas jsonb;
  v_factura_id uuid;
  v_cotizacion public.cotizaciones%rowtype;
  v_remision public.remisiones%rowtype;
begin
  v_rol := public.rol_actual();
  if v_rol is null or v_rol not in ('admin', 'contador') then
    raise exception 'sin permiso' using errcode = '42501';
  end if;

  if p is null then
    raise exception 'datos de la conversión requeridos' using errcode = '22023';
  end if;

  v_tipo_doc := coalesce(p->>'tipo', p->>'p_tipo');
  if v_tipo_doc is null or v_tipo_doc not in ('cotizacion', 'remision') then
    raise exception 'tipo de documento inválido' using errcode = '22023';
  end if;

  v_id := nullif(coalesce(p->>'id', p->>'p_id'), '')::uuid;
  if v_id is null then
    raise exception 'el documento es obligatorio' using errcode = '22023';
  end if;

  v_tipo_comprobante := coalesce(nullif(p->>'tipo_comprobante', ''), '01');
  if v_tipo_comprobante not in ('01', '02') then
    raise exception 'tipo de comprobante inválido' using errcode = '22023';
  end if;

  if v_tipo_doc = 'cotizacion' then
    select * into v_cotizacion
    from public.cotizaciones c
    where c.id = v_id
    for update;

    if not found then
      raise exception 'cotización no encontrada' using errcode = '22023';
    end if;
    if v_cotizacion.estado <> 'abierta' then
      raise exception 'la cotización no está abierta' using errcode = '22023';
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
    from public.cotizacion_lineas l
    where l.cotizacion_id = v_id;

    v_contacto_id := v_cotizacion.contacto_id;
    v_fecha := v_cotizacion.fecha;
    v_vencimiento := v_cotizacion.vencimiento;
    v_notas := v_cotizacion.notas;
  else
    select * into v_remision
    from public.remisiones r
    where r.id = v_id
    for update;

    if not found then
      raise exception 'remisión no encontrada' using errcode = '22023';
    end if;
    if v_remision.estado <> 'abierta' then
      raise exception 'la remisión no está abierta' using errcode = '22023';
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
    from public.remision_lineas l
    where l.remision_id = v_id;

    v_contacto_id := v_remision.contacto_id;
    v_fecha := v_remision.fecha;
    v_vencimiento := v_remision.vencimiento;
    v_notas := v_remision.notas;
  end if;

  if v_lineas is null or jsonb_array_length(v_lineas) = 0 then
    raise exception 'el documento no tiene líneas' using errcode = '22023';
  end if;

  v_factura_id := public.crear_factura(jsonb_build_object(
    'tipo_comprobante', v_tipo_comprobante,
    'contacto_id', v_contacto_id,
    'fecha', v_fecha,
    'vencimiento', v_vencimiento,
    'notas', v_notas,
    'lineas', v_lineas
  ));

  if v_tipo_doc = 'cotizacion' then
    update public.cotizaciones
    set estado = 'convertida', factura_id = v_factura_id
    where id = v_id;
  else
    update public.remisiones
    set estado = 'convertida', factura_id = v_factura_id
    where id = v_id;
  end if;

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
    'cotizaciones',
    'cotizacion_lineas',
    'remisiones',
    'remision_lineas'
  ] loop
    execute format('alter table public.%I enable row level security', v_tabla);
    execute format('revoke all on public.%I from anon', v_tabla);
    execute format('revoke all on public.%I from authenticated', v_tabla);
    execute format('grant select on public.%I to authenticated', v_tabla);

    if not exists (
      select 1
      from pg_catalog.pg_policies p
      where p.schemaname = 'public'
        and p.tablename = v_tabla
        and p.policyname = v_tabla || '_lectura'
    ) then
      execute format(
        'create policy %I on public.%I for select to authenticated using ((select public.rol_actual()) is not null)',
        v_tabla || '_lectura',
        v_tabla
      );
    end if;
  end loop;
end;
$$;

revoke all on sequence public.cotizaciones_numero_seq from anon, authenticated;
revoke all on sequence public.remisiones_numero_seq from anon, authenticated;

revoke all on function public._crear_documento_no_contable(text, jsonb) from public, anon, authenticated;
revoke all on function public.crear_cotizacion(jsonb) from public, anon, authenticated;
revoke all on function public.crear_remision(jsonb) from public, anon, authenticated;
revoke all on function public.convertir_a_factura(jsonb) from public, anon, authenticated;

grant execute on function public.crear_cotizacion(jsonb) to authenticated;
grant execute on function public.crear_remision(jsonb) to authenticated;
grant execute on function public.convertir_a_factura(jsonb) to authenticated;
