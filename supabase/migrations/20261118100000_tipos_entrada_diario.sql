-- ---------------------------------------------------------------------------
-- Tipos de entrada de diario configurables (ALEGRA.md 11.2)
--
-- Migración aditiva y reintentable: no borra ni cambia datos existentes.
--
-- · public.tipos_entrada_diario: catálogo de tipos con su prefijo y su propio
--   consecutivo (como las numeraciones: el código del asiento es
--   prefijo-consecutivo, p. ej. AC-1). Se sembran los 13 tipos de Alegra.
-- · asientos.tipo_entrada_id / asientos.codigo: el asiento manual guarda el
--   tipo elegido y el código asignado. Los asientos automáticos (facturas,
--   pagos, anulaciones) quedan con codigo NULL: no llevan tipo de diario.
-- · crear_tipo_entrada_diario / actualizar_tipo_entrada_diario: alta y edición
--   (nombre, prefijo, activo) del catálogo; desactivar es activo = false.
-- · crear_asiento_manual conserva su firma (p jsonb) y su comportamiento: si
--   el payload trae tipo_entrada_id lo valida y le da el código del tipo; si
--   no lo trae, usa el tipo activo de prefijo 'AC' (Ajuste contable, el
--   default de Alegra). Si no hay tipo aplicable, el asiento se crea sin
--   código, como antes.
--
-- RLS: authenticated lee; las escrituras van solo por RPC (admin o contador).
-- ---------------------------------------------------------------------------

create table if not exists public.tipos_entrada_diario (
  id uuid primary key default gen_random_uuid(),
  nombre text not null,
  prefijo text not null unique,
  siguiente int not null default 1 check (siguiente >= 1),
  activo boolean not null default true,
  creado_en timestamptz not null default now()
);

insert into public.tipos_entrada_diario (nombre, prefijo)
select v.nombre, v.prefijo
from (
  values
    ('Ajuste contable', 'AC'),
    ('Ajustes por diferencia en tasa de bancos', 'DTB'),
    ('Amortizaciones', 'A'),
    ('Cierre de periodos contables', 'CA'),
    ('Cuentas por cobrar', 'CPC'),
    ('Cuentas por pagar', 'CPP'),
    ('Depreciaciones', 'D'),
    ('Impuestos', 'IMP'),
    ('Ingresos', 'ING'),
    ('Nómina', 'NO'),
    ('Provisiones', 'PV'),
    ('Retenciones', 'RET'),
    ('Saldos iniciales', 'SI')
) as v (nombre, prefijo)
where not exists (
  select 1 from public.tipos_entrada_diario t where t.prefijo = v.prefijo
);

alter table public.asientos
  add column if not exists tipo_entrada_id uuid references public.tipos_entrada_diario (id),
  add column if not exists codigo text;

create index if not exists asientos_tipo_entrada_id_idx on public.asientos (tipo_entrada_id);
create unique index if not exists asientos_codigo_unico
  on public.asientos (codigo)
  where codigo is not null;

-- ---------------------------------------------------------------------------
-- RPC: crear y actualizar tipos de entrada de diario
-- ---------------------------------------------------------------------------

create or replace function public.crear_tipo_entrada_diario(p jsonb)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_rol text;
  v_nombre text;
  v_prefijo text;
  v_id uuid;
begin
  v_rol := public.rol_actual();
  if v_rol is null or v_rol not in ('admin', 'contador') then
    raise exception 'sin permiso' using errcode = '42501';
  end if;

  if p is null then
    raise exception 'datos del tipo de entrada requeridos' using errcode = '22023';
  end if;

  v_nombre := trim(coalesce(p->>'nombre', ''));
  if v_nombre = '' then
    raise exception 'el nombre del tipo de entrada es obligatorio' using errcode = '22023';
  end if;

  v_prefijo := upper(trim(coalesce(p->>'prefijo', '')));
  if v_prefijo = '' then
    raise exception 'el prefijo del tipo de entrada es obligatorio' using errcode = '22023';
  end if;
  if v_prefijo !~ '^[A-Z][A-Z0-9]{0,9}$' then
    raise exception 'el prefijo usa solo letras y números, sin espacios (máx. 10)'
      using errcode = '22023';
  end if;

  if exists (
    select 1 from public.tipos_entrada_diario t where lower(t.prefijo) = lower(v_prefijo)
  ) then
    raise exception 'ya existe un tipo de entrada con ese prefijo' using errcode = '22023';
  end if;

  insert into public.tipos_entrada_diario (nombre, prefijo, activo)
  values (
    v_nombre,
    v_prefijo,
    coalesce((p->>'activo')::boolean, true)
  )
  returning id into v_id;

  return v_id;
end;
$$;

create or replace function public.actualizar_tipo_entrada_diario(p_id uuid, p jsonb)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_rol text;
  v_nombre text;
  v_prefijo text;
  v_tipo public.tipos_entrada_diario%rowtype;
  v_id uuid;
begin
  v_rol := public.rol_actual();
  if v_rol is null or v_rol not in ('admin', 'contador') then
    raise exception 'sin permiso' using errcode = '42501';
  end if;

  if p is null then
    raise exception 'datos del tipo de entrada requeridos' using errcode = '22023';
  end if;

  select * into v_tipo from public.tipos_entrada_diario t where t.id = p_id;
  if not found then
    raise exception 'tipo de entrada de diario no encontrado' using errcode = '22023';
  end if;

  if p ? 'nombre' then
    v_nombre := trim(coalesce(p->>'nombre', ''));
    if v_nombre = '' then
      raise exception 'el nombre del tipo de entrada es obligatorio' using errcode = '22023';
    end if;
  end if;

  if p ? 'prefijo' then
    v_prefijo := upper(trim(coalesce(p->>'prefijo', '')));
    if v_prefijo = '' then
      raise exception 'el prefijo del tipo de entrada es obligatorio' using errcode = '22023';
    end if;
    if v_prefijo !~ '^[A-Z][A-Z0-9]{0,9}$' then
      raise exception 'el prefijo usa solo letras y números, sin espacios (máx. 10)'
        using errcode = '22023';
    end if;
    if exists (
      select 1 from public.tipos_entrada_diario t
      where lower(t.prefijo) = lower(v_prefijo)
        and t.id <> p_id
    ) then
      raise exception 'ya existe un tipo de entrada con ese prefijo' using errcode = '22023';
    end if;
    -- Cambiar el prefijo de un tipo ya usado rompe la continuidad de su serie
    -- (los asientos viejos conservan su código y los nuevos saltarían al nuevo
    -- prefijo con el consecutivo que llevaba el viejo).
    if v_prefijo <> v_tipo.prefijo
       and exists (select 1 from public.asientos a where a.tipo_entrada_id = p_id) then
      raise exception 'no se puede cambiar el prefijo de un tipo con asientos' using errcode = '23514';
    end if;
  end if;

  update public.tipos_entrada_diario t
  set
    nombre = case when p ? 'nombre' then v_nombre else t.nombre end,
    prefijo = case when p ? 'prefijo' then v_prefijo else t.prefijo end,
    activo = case when p ? 'activo' then (p->>'activo')::boolean else t.activo end
  where t.id = p_id
  returning t.id into v_id;

  return v_id;
end;
$$;

-- ---------------------------------------------------------------------------
-- crear_asiento_manual: el asiento toma el código del tipo elegido
--
-- Misma firma y comportamiento que la versión de
-- 20261115201000_centros_costo.sql; se agrega la lectura opcional de
-- tipo_entrada_id y la asignación de asientos.codigo.
-- ---------------------------------------------------------------------------

create or replace function public.crear_asiento_manual(p jsonb)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_rol text;
  v_fecha date;
  v_descripcion text;
  v_lineas jsonb;
  v_linea jsonb;
  v_lineas_norm jsonb := '[]'::jsonb;
  v_cuenta public.cuentas%rowtype;
  v_cuenta_id uuid;
  v_contacto_id uuid;
  v_centro_costo_id uuid;
  v_tipo_id uuid;
  v_tipo public.tipos_entrada_diario%rowtype;
  v_codigo text;
  v_debito numeric(14,2);
  v_credito numeric(14,2);
  v_debitos numeric(14,2) := 0;
  v_creditos numeric(14,2) := 0;
  v_asiento_id uuid;
begin
  v_rol := public.rol_actual();
  if v_rol is null or v_rol not in ('admin', 'contador') then
    raise exception 'sin permiso' using errcode = '42501';
  end if;

  if p is null or jsonb_typeof(p) <> 'object' then
    raise exception 'datos del asiento requeridos' using errcode = '22023';
  end if;

  v_descripcion := nullif(trim(p->>'descripcion'), '');
  if v_descripcion is null then
    raise exception 'la descripción del asiento es obligatoria' using errcode = '22023';
  end if;

  v_fecha := coalesce((p->>'fecha')::date, current_date);

  -- Tipo de entrada: el elegido en el formulario o, si no viene, el tipo
  -- activo de prefijo 'AC' (Ajuste contable, el default de Alegra).
  v_tipo_id := nullif(p->>'tipo_entrada_id', '')::uuid;
  if v_tipo_id is not null then
    select * into v_tipo from public.tipos_entrada_diario t where t.id = v_tipo_id;
    if not found then
      raise exception 'tipo de entrada de diario no encontrado' using errcode = '22023';
    end if;
    if not v_tipo.activo then
      raise exception 'el tipo de entrada de diario % está inactivo', v_tipo.prefijo
        using errcode = '23514';
    end if;
  else
    select * into v_tipo
    from public.tipos_entrada_diario t
    where t.prefijo = 'AC' and t.activo;
    if found then
      v_tipo_id := v_tipo.id;
    end if;
  end if;

  v_lineas := p->'lineas';
  if v_lineas is null or jsonb_typeof(v_lineas) <> 'array' then
    raise exception 'las líneas del asiento son inválidas' using errcode = '22023';
  end if;

  if jsonb_array_length(v_lineas) < 2 then
    raise exception 'un asiento requiere al menos 2 líneas' using errcode = '23514';
  end if;

  for v_linea in select * from jsonb_array_elements(v_lineas) loop
    v_cuenta_id := nullif(v_linea->>'cuenta_id', '')::uuid;
    if v_cuenta_id is null then
      raise exception 'cada línea del asiento requiere una cuenta' using errcode = '22023';
    end if;

    v_contacto_id := nullif(v_linea->>'contacto_id', '')::uuid;
    if v_contacto_id is not null
       and not exists (select 1 from public.contactos c where c.id = v_contacto_id) then
      raise exception 'contacto no encontrado' using errcode = '22023';
    end if;

    v_centro_costo_id := nullif(v_linea->>'centro_costo_id', '')::uuid;
    if v_centro_costo_id is not null
       and not exists (select 1 from public.centros_costo c where c.id = v_centro_costo_id) then
      raise exception 'centro de costo no encontrado' using errcode = '22023';
    end if;

    select * into v_cuenta from public.cuentas c where c.id = v_cuenta_id;
    if not found then
      raise exception 'cuenta no encontrada' using errcode = '22023';
    end if;
    if not v_cuenta.activa then
      raise exception 'la cuenta % está inactiva', v_cuenta.codigo using errcode = '23514';
    end if;
    if not v_cuenta.acepta_movimientos then
      raise exception 'la cuenta % no acepta movimientos', v_cuenta.codigo using errcode = '23514';
    end if;

    v_debito := round(coalesce((v_linea->>'debito')::numeric, 0), 2);
    v_credito := round(coalesce((v_linea->>'credito')::numeric, 0), 2);

    if v_debito < 0 or v_credito < 0 then
      raise exception 'los montos del asiento no pueden ser negativos' using errcode = '22023';
    end if;

    if (v_debito = 0) = (v_credito = 0) then
      raise exception 'cada línea debe llevar débito o crédito, nunca ambos' using errcode = '23514';
    end if;

    v_debitos := v_debitos + v_debito;
    v_creditos := v_creditos + v_credito;

    v_lineas_norm := v_lineas_norm || jsonb_build_array(jsonb_build_object(
      'cuenta_id', v_cuenta_id,
      'contacto_id', v_contacto_id,
      'centro_costo_id', v_centro_costo_id,
      'descripcion', coalesce(nullif(trim(v_linea->>'descripcion'), ''), v_descripcion),
      'debito', v_debito,
      'credito', v_credito
    ));
  end loop;

  if v_debitos <> v_creditos then
    raise exception 'el asiento está descuadrado (débitos %, créditos %)', v_debitos, v_creditos
      using errcode = '23514';
  end if;

  v_asiento_id := public._crear_asiento(v_fecha, v_descripcion, 'manual', null, v_lineas_norm);

  -- El consecutivo del tipo sube en la misma transacción y el UPDATE bloquea
  -- la fila hasta el commit: dos asientos simultáneos no repiten código.
  -- returning da el valor ya incrementado; el usado es siguiente - 1.
  if v_tipo.id is not null then
    update public.tipos_entrada_diario t
    set siguiente = t.siguiente + 1
    where t.id = v_tipo.id
    returning t.prefijo || '-' || (t.siguiente - 1) into v_codigo;

    update public.asientos a
    set tipo_entrada_id = v_tipo.id, codigo = v_codigo
    where a.id = v_asiento_id;
  end if;

  return v_asiento_id;
end;
$$;

-- ---------------------------------------------------------------------------
-- RLS y permisos
-- ---------------------------------------------------------------------------

alter table public.tipos_entrada_diario enable row level security;

revoke all on public.tipos_entrada_diario from anon;
revoke all on public.tipos_entrada_diario from authenticated;
grant select on public.tipos_entrada_diario to authenticated;

drop policy if exists tipos_entrada_diario_lectura on public.tipos_entrada_diario;
create policy tipos_entrada_diario_lectura on public.tipos_entrada_diario
  for select to authenticated
  using ((select public.rol_actual()) is not null);

revoke all on function public.crear_tipo_entrada_diario(jsonb) from public, anon, authenticated;
revoke all on function public.actualizar_tipo_entrada_diario(uuid, jsonb) from public, anon, authenticated;
revoke all on function public.crear_asiento_manual(jsonb) from public, anon, authenticated;
grant execute on function public.crear_tipo_entrada_diario(jsonb) to authenticated;
grant execute on function public.actualizar_tipo_entrada_diario(uuid, jsonb) to authenticated;
grant execute on function public.crear_asiento_manual(jsonb) to authenticated;
