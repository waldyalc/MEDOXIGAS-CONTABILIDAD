-- ---------------------------------------------------------------------------
-- Activos fijos y depreciación en línea recta (aditivo)
--
-- · Catálogo: agrega las cuentas 12/1210/1211 (activos no corrientes, activo
--   fijo y depreciación acumulada), 6109 (gasto de depreciación) y 3202
--   (utilidad del ejercicio). ON CONFLICT DO NOTHING: no pisa nada existente.
--   No se tocan las claves de config_contable para no alterar el contrato.
-- · activos_fijos: ficha del activo con sus cuentas y vida útil en meses.
-- · activo_depreciaciones: una fila por mes depreciado (clave única
--   activo_id + periodo), que es lo que hace idempotente el botón.
-- · crear_activo_fijo: registra el activo y, si se pide, su asiento de compra
--   (Dr cuenta del activo / Cr cuentas por pagar).
-- · depreciar_activo: crea el asiento del mes (Dr gasto de depreciación /
--   Cr depreciación acumulada) al cierre del mes. Si el mes ya existe,
--   devuelve el asiento ya creado sin duplicarlo.
-- ---------------------------------------------------------------------------

-- ---------------------------------------------------------------------------
-- Catálogo de cuentas
-- ---------------------------------------------------------------------------

insert into public.cuentas (codigo, nombre, tipo, naturaleza, padre_id, acepta_movimientos, es_caja_banco, activa)
values ('12', 'Activos no corrientes', 'activo', 'debito', (select id from public.cuentas where codigo = '1'), false, false, true)
on conflict (codigo) do nothing;

insert into public.cuentas (codigo, nombre, tipo, naturaleza, padre_id, acepta_movimientos, es_caja_banco, activa)
values ('1210', 'Activos fijos', 'activo', 'debito', (select id from public.cuentas where codigo = '12'), true, false, true)
on conflict (codigo) do nothing;

insert into public.cuentas (codigo, nombre, tipo, naturaleza, padre_id, acepta_movimientos, es_caja_banco, activa)
values ('1211', 'Depreciación acumulada', 'activo', 'credito', (select id from public.cuentas where codigo = '12'), true, false, true)
on conflict (codigo) do nothing;

insert into public.cuentas (codigo, nombre, tipo, naturaleza, padre_id, acepta_movimientos, es_caja_banco, activa)
values ('6109', 'Gasto de depreciación', 'gasto', 'debito', (select id from public.cuentas where codigo = '6'), true, false, true)
on conflict (codigo) do nothing;

insert into public.cuentas (codigo, nombre, tipo, naturaleza, padre_id, acepta_movimientos, es_caja_banco, activa)
values ('3202', 'Utilidad del ejercicio', 'capital', 'credito', (select id from public.cuentas where codigo = '3'), true, false, true)
on conflict (codigo) do nothing;

-- ---------------------------------------------------------------------------
-- Tablas
-- ---------------------------------------------------------------------------

create table public.activos_fijos (
  id uuid primary key default gen_random_uuid(),
  nombre text not null,
  referencia text,
  tipo_activo text not null default 'otros_tangibles' check (tipo_activo in (
    'terrenos',
    'edificios',
    'maquinarias',
    'equipos_computacion',
    'equipos_oficina',
    'mobiliario',
    'equipos_transporte',
    'otros_tangibles',
    'intangible'
  )),
  proveedor_contacto_id uuid references public.contactos (id),
  fecha_adquisicion date not null default current_date,
  costo_unitario numeric(14,2) not null check (costo_unitario > 0),
  cantidad numeric(14,2) not null default 1 check (cantidad > 0),
  monto_total numeric(14,2) not null check (monto_total > 0),
  valor_residual numeric(14,2) not null default 0 check (valor_residual >= 0),
  cuenta_activo_id uuid not null references public.cuentas (id),
  cuenta_depreciacion_id uuid not null references public.cuentas (id),
  cuenta_gasto_id uuid not null references public.cuentas (id),
  fecha_inicio_depreciacion date not null default current_date,
  vida_util_meses int not null check (vida_util_meses > 0),
  asiento_id uuid references public.asientos (id),
  creado_por uuid default auth.uid(),
  creado_en timestamptz not null default now(),
  constraint activos_fijos_residual_menor check (valor_residual < monto_total)
);

create index activos_fijos_creado_en_idx on public.activos_fijos (creado_en);

create table public.activo_depreciaciones (
  id uuid primary key default gen_random_uuid(),
  activo_id uuid not null references public.activos_fijos (id),
  periodo date not null,
  monto numeric(14,2) not null check (monto > 0),
  asiento_id uuid not null references public.asientos (id),
  creado_por uuid default auth.uid(),
  creado_en timestamptz not null default now(),
  constraint activo_depreciaciones_periodo_unico unique (activo_id, periodo),
  constraint activo_depreciaciones_primer_dia check (periodo = date_trunc('month', periodo)::date)
);

create index activo_depreciaciones_activo_id_idx on public.activo_depreciaciones (activo_id);

-- ---------------------------------------------------------------------------
-- RPC: crear activo fijo
-- ---------------------------------------------------------------------------

create or replace function public.crear_activo_fijo(p jsonb)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_rol text;
  v_id uuid;
  v_nombre text;
  v_tipo text;
  v_proveedor_id uuid;
  v_fecha_adquisicion date;
  v_fecha_inicio date;
  v_costo numeric(14,2);
  v_cantidad numeric(14,2);
  v_monto_total numeric(14,2);
  v_residual numeric(14,2);
  v_cuenta_activo_id uuid;
  v_cuenta_depreciacion_id uuid;
  v_cuenta_gasto_id uuid;
  v_contrapartida_id uuid;
  v_cuenta public.cuentas%rowtype;
  v_vida_util numeric;
  v_periodo text;
  v_meses int;
  v_base numeric(14,2);
  v_mensual numeric(14,2);
  v_contabilizar boolean;
  v_asiento_id uuid;
begin
  v_rol := public.rol_actual();
  if v_rol is null or v_rol not in ('admin', 'contador') then
    raise exception 'sin permiso' using errcode = '42501';
  end if;

  if p is null or jsonb_typeof(p) <> 'object' then
    raise exception 'datos del activo requeridos' using errcode = '22023';
  end if;

  v_nombre := nullif(trim(p->>'nombre'), '');
  if v_nombre is null then
    raise exception 'el nombre del activo es obligatorio' using errcode = '22023';
  end if;

  v_tipo := coalesce(nullif(p->>'tipo_activo', ''), 'otros_tangibles');
  if v_tipo not in (
    'terrenos', 'edificios', 'maquinarias', 'equipos_computacion', 'equipos_oficina',
    'mobiliario', 'equipos_transporte', 'otros_tangibles', 'intangible'
  ) then
    raise exception 'tipo de activo inválido' using errcode = '22023';
  end if;

  v_proveedor_id := nullif(p->>'proveedor_contacto_id', '')::uuid;
  if v_proveedor_id is not null
     and not exists (select 1 from public.contactos c where c.id = v_proveedor_id) then
    raise exception 'proveedor no encontrado' using errcode = '22023';
  end if;

  v_fecha_adquisicion := coalesce(nullif(p->>'fecha_adquisicion', '')::date, current_date);
  v_fecha_inicio := coalesce(nullif(p->>'fecha_inicio_depreciacion', '')::date, v_fecha_adquisicion);

  v_costo := round(coalesce(nullif(p->>'costo_unitario', '')::numeric, nullif(p->>'costo', '')::numeric, 0), 2);
  if v_costo <= 0 then
    raise exception 'el costo de adquisición debe ser mayor que cero' using errcode = '22023';
  end if;

  v_cantidad := round(coalesce(nullif(p->>'cantidad', '')::numeric, 1), 2);
  if v_cantidad <= 0 then
    raise exception 'la cantidad debe ser mayor que cero' using errcode = '22023';
  end if;

  v_monto_total := round(coalesce(nullif(p->>'monto_total', '')::numeric, v_costo * v_cantidad), 2);
  if v_monto_total <= 0 then
    raise exception 'el monto total de inversión debe ser mayor que cero' using errcode = '22023';
  end if;

  v_residual := round(coalesce(nullif(p->>'valor_residual', '')::numeric, 0), 2);
  if v_residual < 0 then
    raise exception 'el valor residual no puede ser negativo' using errcode = '22023';
  end if;
  if v_residual >= v_monto_total then
    raise exception 'el valor residual debe ser menor que el monto total' using errcode = '22023';
  end if;

  v_cuenta_activo_id := coalesce(
    nullif(p->>'cuenta_activo_id', '')::uuid,
    (select c.id from public.cuentas c where c.codigo = '1210')
  );
  v_cuenta_depreciacion_id := coalesce(
    nullif(p->>'cuenta_depreciacion_id', '')::uuid,
    (select c.id from public.cuentas c where c.codigo = '1211')
  );
  v_cuenta_gasto_id := coalesce(
    nullif(p->>'cuenta_gasto_id', '')::uuid,
    (select c.id from public.cuentas c where c.codigo = '6109')
  );

  if v_cuenta_activo_id is null or v_cuenta_depreciacion_id is null or v_cuenta_gasto_id is null then
    raise exception 'faltan las cuentas contables del activo' using errcode = '22023';
  end if;

  if (select count(*) from public.cuentas c
      where c.id in (v_cuenta_activo_id, v_cuenta_depreciacion_id, v_cuenta_gasto_id)) <> 3 then
    raise exception 'las cuentas del activo deben existir y ser distintas' using errcode = '22023';
  end if;

  for v_cuenta in
    select c.* from public.cuentas c where c.id in (v_cuenta_activo_id, v_cuenta_depreciacion_id, v_cuenta_gasto_id)
  loop
    if not v_cuenta.activa then
      raise exception 'la cuenta % está inactiva', v_cuenta.codigo using errcode = '23514';
    end if;
    if not v_cuenta.acepta_movimientos then
      raise exception 'la cuenta % no acepta movimientos', v_cuenta.codigo using errcode = '23514';
    end if;
  end loop;

  select * into v_cuenta from public.cuentas c where c.id = v_cuenta_activo_id;
  if v_cuenta.tipo <> 'activo' or v_cuenta.naturaleza <> 'debito' then
    raise exception 'la cuenta del activo debe ser de tipo activo y naturaleza débito' using errcode = '23514';
  end if;

  select * into v_cuenta from public.cuentas c where c.id = v_cuenta_depreciacion_id;
  if v_cuenta.tipo <> 'activo' or v_cuenta.naturaleza <> 'credito' then
    raise exception 'la cuenta de depreciación acumulada debe ser de tipo activo y naturaleza crédito' using errcode = '23514';
  end if;

  select * into v_cuenta from public.cuentas c where c.id = v_cuenta_gasto_id;
  if v_cuenta.tipo not in ('gasto', 'costo') or v_cuenta.naturaleza <> 'debito' then
    raise exception 'la cuenta de gasto debe ser de tipo gasto o costo y naturaleza débito' using errcode = '23514';
  end if;

  if p ? 'vida_util_meses' then
    v_meses := round(coalesce(nullif(p->>'vida_util_meses', '')::numeric, 0))::int;
  else
    v_vida_util := round(coalesce(nullif(p->>'vida_util', '')::numeric, 1), 4);
    v_periodo := coalesce(nullif(p->>'periodo_depreciacion', ''), 'anual');
    if v_periodo = 'anual' then
      v_meses := round(v_vida_util * 12)::int;
    elsif v_periodo = 'mensual' then
      v_meses := round(v_vida_util)::int;
    else
      raise exception 'periodo de depreciación inválido' using errcode = '22023';
    end if;
  end if;

  if v_meses <= 0 then
    raise exception 'la vida útil debe ser mayor que cero' using errcode = '22023';
  end if;
  if v_meses > 1200 then
    raise exception 'la vida útil no puede pasar de 1200 meses' using errcode = '22023';
  end if;

  v_base := v_monto_total - v_residual;
  if v_base < v_meses * 0.01 then
    raise exception 'la base depreciable es menor que un centavo por mes; revisa el monto o la vida útil'
      using errcode = '22023';
  end if;

  v_mensual := round(v_base / v_meses, 2);
  if v_mensual * (v_meses - 1) >= v_base then
    v_mensual := trunc(v_base / v_meses, 2);
  end if;
  if v_mensual <= 0 then
    raise exception 'la depreciación mensual es cero; revisa el monto o la vida útil' using errcode = '22023';
  end if;

  insert into public.activos_fijos (
    nombre,
    referencia,
    tipo_activo,
    proveedor_contacto_id,
    fecha_adquisicion,
    costo_unitario,
    cantidad,
    monto_total,
    valor_residual,
    cuenta_activo_id,
    cuenta_depreciacion_id,
    cuenta_gasto_id,
    fecha_inicio_depreciacion,
    vida_util_meses,
    creado_por
  )
  values (
    v_nombre,
    nullif(trim(p->>'referencia'), ''),
    v_tipo,
    v_proveedor_id,
    v_fecha_adquisicion,
    v_costo,
    v_cantidad,
    v_monto_total,
    v_residual,
    v_cuenta_activo_id,
    v_cuenta_depreciacion_id,
    v_cuenta_gasto_id,
    v_fecha_inicio,
    v_meses,
    auth.uid()
  )
  returning id into v_id;

  v_contabilizar := coalesce((p->>'contabilizar_creacion')::boolean, true);

  if v_contabilizar then
    v_contrapartida_id := coalesce(
      nullif(p->>'cuenta_contrapartida_id', '')::uuid,
      public._cuenta_config('cxp')
    );

    select * into v_cuenta from public.cuentas c where c.id = v_contrapartida_id;
    if not found then
      raise exception 'la cuenta de contrapartida no existe' using errcode = '22023';
    end if;
    if not v_cuenta.activa or not v_cuenta.acepta_movimientos then
      raise exception 'la cuenta de contrapartida no acepta movimientos' using errcode = '23514';
    end if;

    v_asiento_id := public._crear_asiento(
      v_fecha_adquisicion,
      'Compra de activo fijo: ' || v_nombre,
      'manual',
      v_id,
      jsonb_build_array(
        jsonb_build_object(
          'cuenta_id', v_cuenta_activo_id,
          'contacto_id', v_proveedor_id,
          'descripcion', 'Activo fijo ' || v_nombre,
          'debito', v_monto_total,
          'credito', 0
        ),
        jsonb_build_object(
          'cuenta_id', v_contrapartida_id,
          'contacto_id', v_proveedor_id,
          'descripcion', 'Contrapartida de la compra',
          'debito', 0,
          'credito', v_monto_total
        )
      )
    );

    update public.activos_fijos a set asiento_id = v_asiento_id where a.id = v_id;
  end if;

  return v_id;
end;
$$;

-- ---------------------------------------------------------------------------
-- RPC: depreciar el siguiente periodo (o el periodo indicado)
-- ---------------------------------------------------------------------------

create or replace function public.depreciar_activo(p_activo_id uuid, p_periodo date default null)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_rol text;
  v_activo public.activos_fijos%rowtype;
  v_base numeric(14,2);
  v_mensual numeric(14,2);
  v_depreciados int;
  v_indice int;
  v_periodo date;
  v_inicio date;
  v_fecha date;
  v_monto numeric(14,2);
  v_asiento_id uuid;
  v_existente uuid;
begin
  v_rol := public.rol_actual();
  if v_rol is null or v_rol not in ('admin', 'contador') then
    raise exception 'sin permiso' using errcode = '42501';
  end if;

  if p_activo_id is null then
    raise exception 'el activo es obligatorio' using errcode = '22023';
  end if;

  perform pg_advisory_xact_lock(hashtext('activo_depreciacion_' || p_activo_id::text));

  select * into v_activo from public.activos_fijos a where a.id = p_activo_id for update;
  if not found then
    raise exception 'activo fijo no encontrado' using errcode = '22023';
  end if;

  v_inicio := date_trunc('month', v_activo.fecha_inicio_depreciacion)::date;
  v_base := v_activo.monto_total - v_activo.valor_residual;
  v_mensual := round(v_base / v_activo.vida_util_meses, 2);
  if v_mensual * (v_activo.vida_util_meses - 1) >= v_base then
    v_mensual := trunc(v_base / v_activo.vida_util_meses, 2);
  end if;

  select count(*) into v_depreciados
  from public.activo_depreciaciones d
  where d.activo_id = v_activo.id;

  if p_periodo is null then
    if v_depreciados >= v_activo.vida_util_meses then
      raise exception 'el activo ya está totalmente depreciado' using errcode = '23514';
    end if;

    v_periodo := (v_inicio + (v_depreciados || ' months')::interval)::date;
  else
    v_periodo := date_trunc('month', p_periodo)::date;

    select d.asiento_id into v_existente
    from public.activo_depreciaciones d
    where d.activo_id = v_activo.id and d.periodo = v_periodo;

    if v_existente is not null then
      return v_existente;
    end if;

    v_indice := (
      (extract(year from v_periodo)::int * 12 + extract(month from v_periodo)::int)
      - (extract(year from v_inicio)::int * 12 + extract(month from v_inicio)::int)
      + 1
    );

    if v_indice < 1 or v_indice > v_activo.vida_util_meses then
      raise exception 'el periodo % está fuera de la vida útil del activo', to_char(v_periodo, 'YYYY-MM')
        using errcode = '23514';
    end if;

    if v_indice <> v_depreciados + 1 then
      raise exception 'debes depreciar los periodos anteriores antes de %', to_char(v_periodo, 'YYYY-MM')
        using errcode = '23514';
    end if;
  end if;

  v_indice := v_depreciados + 1;

  if v_indice = v_activo.vida_util_meses then
    v_monto := v_base - v_mensual * (v_activo.vida_util_meses - 1);
  else
    v_monto := v_mensual;
  end if;

  if v_monto <= 0 then
    raise exception 'la depreciación del periodo es cero; revisa el monto o la vida útil' using errcode = '22023';
  end if;

  v_fecha := (v_periodo + interval '1 month - 1 day')::date;

  v_asiento_id := public._crear_asiento(
    v_fecha,
    'Depreciación de ' || v_activo.nombre || ' - ' || to_char(v_periodo, 'YYYY-MM'),
    'manual',
    v_activo.id,
    jsonb_build_array(
      jsonb_build_object(
        'cuenta_id', v_activo.cuenta_gasto_id,
        'descripcion', 'Gasto de depreciación ' || to_char(v_periodo, 'YYYY-MM'),
        'debito', v_monto,
        'credito', 0
      ),
      jsonb_build_object(
        'cuenta_id', v_activo.cuenta_depreciacion_id,
        'descripcion', 'Depreciación acumulada ' || to_char(v_periodo, 'YYYY-MM'),
        'debito', 0,
        'credito', v_monto
      )
    )
  );

  insert into public.activo_depreciaciones (activo_id, periodo, monto, asiento_id, creado_por)
  values (v_activo.id, v_periodo, v_monto, v_asiento_id, auth.uid());

  return v_asiento_id;
end;
$$;

-- ---------------------------------------------------------------------------
-- RLS y permisos
-- ---------------------------------------------------------------------------

alter table public.activos_fijos enable row level security;
alter table public.activo_depreciaciones enable row level security;

revoke all on public.activos_fijos from anon, authenticated;
revoke all on public.activo_depreciaciones from anon, authenticated;

grant select on public.activos_fijos to authenticated;
grant select on public.activo_depreciaciones to authenticated;

create policy activos_fijos_lectura on public.activos_fijos
  for select to authenticated
  using ((select public.rol_actual()) is not null);

create policy activo_depreciaciones_lectura on public.activo_depreciaciones
  for select to authenticated
  using ((select public.rol_actual()) is not null);

revoke all on function public.crear_activo_fijo(jsonb) from public, anon, authenticated;
revoke all on function public.depreciar_activo(uuid, date) from public, anon, authenticated;

grant execute on function public.crear_activo_fijo(jsonb) to authenticated;
grant execute on function public.depreciar_activo(uuid, date) to authenticated;
