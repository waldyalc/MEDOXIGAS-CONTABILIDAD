-- ---------------------------------------------------------------------------
-- Crear numeraciones desde la app (RPC crear_numeracion)
--
-- Migración aditiva y reintentable: no borra ni cambia datos existentes.
-- Hasta ahora las series solo se sembraban por migración y solo se podían
-- editar; esta RPC permite darlas de alta desde Contabilidad → Numeraciones.
--
-- Reglas:
--   · tipo_comprobante en la lista del sistema ('01','02','03','04','13',
--     '14','15','16') o '00' para una numeración sin NCF (consecutivo libre,
--     p. ej. documentos internos que no emiten comprobante fiscal).
--   · En los tipos fiscales el prefijo queda fijo en 'B' || tipo_comprobante:
--     la DGII fija el prefijo por tipo, no lo elige el usuario. En '00' el
--     prefijo lo escribe el usuario (letras/números, sin los reservados
--     B##/E## de los comprobantes fiscales).
--   · Una sola serie por (tipo_comprobante, prefijo): las RPC que consumen
--     numeraciones toman la activa con el id más bajo, así que una segunda
--     fila del mismo tipo y prefijo nunca se usaría. Para ampliar un rango
--     autorizado se edita la serie existente (siguiente/hasta/vence).
--   · La tabla no tiene columna `preferida`: no aplica una marca de
--     preferida (ver docs/dominio-ncf-manual.md).
-- ---------------------------------------------------------------------------

create or replace function public.crear_numeracion(p jsonb)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_rol text;
  v_tipo text;
  v_nombre text;
  v_prefijo text;
  v_siguiente int;
  v_hasta int;
  v_vence date;
  v_activa boolean;
  v_id uuid;
begin
  v_rol := public.rol_actual();
  if v_rol is null or v_rol not in ('admin', 'contador') then
    raise exception 'sin permiso' using errcode = '42501';
  end if;

  if p is null then
    raise exception 'datos de la numeración requeridos' using errcode = '22023';
  end if;

  v_tipo := p->>'tipo_comprobante';
  if v_tipo is null or v_tipo not in ('01', '02', '03', '04', '13', '14', '15', '16', '00') then
    raise exception 'tipo de documento inválido' using errcode = '22023';
  end if;

  v_nombre := trim(coalesce(p->>'nombre', ''));
  if v_nombre = '' then
    raise exception 'el nombre de la numeración es obligatorio' using errcode = '22023';
  end if;

  if v_tipo = '00' then
    v_prefijo := upper(trim(coalesce(p->>'prefijo', '')));
    if v_prefijo = '' then
      raise exception 'el prefijo es obligatorio' using errcode = '22023';
    end if;
    if v_prefijo !~ '^[A-Z0-9]{1,10}$' then
      raise exception 'el prefijo solo admite letras y números (máximo 10)' using errcode = '22023';
    end if;
    if v_prefijo ~ '^[BE][0-9][0-9]$' then
      raise exception 'ese prefijo está reservado para comprobantes fiscales' using errcode = '22023';
    end if;
  else
    v_prefijo := 'B' || v_tipo;
  end if;

  v_siguiente := coalesce(nullif(p->>'siguiente', '')::int, 1);
  if v_siguiente < 1 then
    raise exception 'el siguiente debe ser mayor o igual a 1' using errcode = '22023';
  end if;

  v_hasta := nullif(p->>'hasta', '')::int;
  if v_hasta is not null and v_hasta < 1 then
    raise exception 'el hasta debe ser mayor o igual a 1' using errcode = '22023';
  end if;

  if v_hasta is not null and v_siguiente > v_hasta then
    raise exception 'el siguiente no puede ser mayor que el hasta' using errcode = '22023';
  end if;

  v_vence := nullif(p->>'vence', '')::date;
  v_activa := coalesce((p->>'activa')::boolean, true);

  if exists (
    select 1
    from public.numeraciones n
    where n.tipo_comprobante = v_tipo and n.prefijo = v_prefijo
  ) then
    raise exception 'ya existe una numeración para ese tipo y prefijo' using errcode = '22023';
  end if;

  insert into public.numeraciones (tipo_comprobante, nombre, prefijo, siguiente, hasta, vence, activa)
  values (v_tipo, v_nombre, v_prefijo, v_siguiente, v_hasta, v_vence, v_activa)
  returning id into v_id;

  return v_id;
end;
$$;

revoke all on function public.crear_numeracion(jsonb) from public, anon, authenticated;
grant execute on function public.crear_numeracion(jsonb) to authenticated;
