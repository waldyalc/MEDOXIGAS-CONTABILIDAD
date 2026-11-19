-- Persiste limite_credito (columna de 20261120120000) en las RPC de contactos.
-- Nulo = sin límite; se edita manualmente desde el formulario del contacto.

create or replace function public.crear_contacto(p jsonb)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_rol text;
  v_id uuid;
  v_tipo text;
  v_lista_id uuid;
  v_tipo_identificacion text;
  v_limite_credito text;
begin
  v_rol := public.rol_actual();
  if v_rol is null or v_rol not in ('admin', 'contador') then
    raise exception 'sin permiso' using errcode = '42501';
  end if;

  if p is null then
    raise exception 'datos del contacto requeridos' using errcode = '22023';
  end if;

  v_tipo := coalesce(nullif(p->>'tipo', ''), 'cliente');
  if v_tipo not in ('cliente', 'proveedor', 'ambos') then
    raise exception 'tipo de contacto invalido' using errcode = '22023';
  end if;

  v_tipo_identificacion := nullif(p->>'tipo_identificacion', '');
  if v_tipo_identificacion is not null
     and v_tipo_identificacion not in ('rnc', 'cedula', 'pasaporte') then
    raise exception 'tipo de identificacion invalido' using errcode = '22023';
  end if;

  if coalesce(trim(p->>'nombre'), '') = '' then
    raise exception 'el nombre del contacto es obligatorio' using errcode = '22023';
  end if;

  v_lista_id := nullif(p->>'lista_precio_id', '')::uuid;
  if v_lista_id is not null
     and not exists (select 1 from public.listas_precios lp where lp.id = v_lista_id and lp.activo) then
    raise exception 'lista de precios no encontrada' using errcode = '22023';
  end if;

  v_limite_credito := nullif(p->>'limite_credito', '');
  if v_limite_credito is not null and v_limite_credito !~ '^[0-9]{1,12}(\.[0-9]{1,2})?$' then
    raise exception 'limite de credito invalido' using errcode = '22023';
  end if;

  insert into public.contactos (
    tipo, nombre, rnc_cedula, telefono, correo, direccion, cuenta_cxc_id, cuenta_cxp_id,
    lista_precio_id, tipo_identificacion, municipio_provincia, limite_credito, activo
  )
  values (
    v_tipo,
    p->>'nombre',
    p->>'rnc_cedula',
    p->>'telefono',
    p->>'correo',
    p->>'direccion',
    nullif(p->>'cuenta_cxc_id', '')::uuid,
    nullif(p->>'cuenta_cxp_id', '')::uuid,
    v_lista_id,
    v_tipo_identificacion,
    nullif(p->>'municipio_provincia', ''),
    v_limite_credito::numeric(14,2),
    coalesce((p->>'activo')::boolean, true)
  )
  returning id into v_id;

  return v_id;
end;
$$;

create or replace function public.actualizar_contacto(p_id uuid, p jsonb)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_rol text;
  v_id uuid;
  v_tipo text;
  v_lista_id uuid;
  v_tipo_identificacion text;
  v_limite_credito text;
begin
  v_rol := public.rol_actual();
  if v_rol is null or v_rol not in ('admin', 'contador') then
    raise exception 'sin permiso' using errcode = '42501';
  end if;

  if p is null then
    raise exception 'datos del contacto requeridos' using errcode = '22023';
  end if;

  v_tipo := coalesce(nullif(p->>'tipo', ''), 'cliente');
  if v_tipo not in ('cliente', 'proveedor', 'ambos') then
    raise exception 'tipo de contacto invalido' using errcode = '22023';
  end if;

  if p ? 'tipo_identificacion' then
    v_tipo_identificacion := nullif(p->>'tipo_identificacion', '');
    if v_tipo_identificacion is not null
       and v_tipo_identificacion not in ('rnc', 'cedula', 'pasaporte') then
      raise exception 'tipo de identificacion invalido' using errcode = '22023';
    end if;
  end if;

  if p ? 'lista_precio_id' then
    v_lista_id := nullif(p->>'lista_precio_id', '')::uuid;
    if v_lista_id is not null
       and not exists (select 1 from public.listas_precios lp where lp.id = v_lista_id and lp.activo) then
      raise exception 'lista de precios no encontrada' using errcode = '22023';
    end if;
  end if;

  if p ? 'limite_credito' then
    v_limite_credito := nullif(p->>'limite_credito', '');
    if v_limite_credito is not null and v_limite_credito !~ '^[0-9]{1,12}(\.[0-9]{1,2})?$' then
      raise exception 'limite de credito invalido' using errcode = '22023';
    end if;
  end if;

  update public.contactos c
  set
    tipo = case when p ? 'tipo' then v_tipo else c.tipo end,
    nombre = case when p ? 'nombre' then p->>'nombre' else c.nombre end,
    rnc_cedula = case when p ? 'rnc_cedula' then p->>'rnc_cedula' else c.rnc_cedula end,
    telefono = case when p ? 'telefono' then p->>'telefono' else c.telefono end,
    correo = case when p ? 'correo' then p->>'correo' else c.correo end,
    direccion = case when p ? 'direccion' then p->>'direccion' else c.direccion end,
    cuenta_cxc_id = case when p ? 'cuenta_cxc_id' then nullif(p->>'cuenta_cxc_id', '')::uuid else c.cuenta_cxc_id end,
    cuenta_cxp_id = case when p ? 'cuenta_cxp_id' then nullif(p->>'cuenta_cxp_id', '')::uuid else c.cuenta_cxp_id end,
    lista_precio_id = case when p ? 'lista_precio_id' then v_lista_id else c.lista_precio_id end,
    tipo_identificacion = case when p ? 'tipo_identificacion' then v_tipo_identificacion else c.tipo_identificacion end,
    municipio_provincia = case when p ? 'municipio_provincia' then nullif(p->>'municipio_provincia', '') else c.municipio_provincia end,
    limite_credito = case when p ? 'limite_credito' then v_limite_credito::numeric(14,2) else c.limite_credito end,
    activo = case when p ? 'activo' then (p->>'activo')::boolean else c.activo end
  where c.id = p_id
  returning c.id into v_id;

  if v_id is null then
    raise exception 'contacto no encontrado' using errcode = '22023';
  end if;

  return v_id;
end;
$$;
