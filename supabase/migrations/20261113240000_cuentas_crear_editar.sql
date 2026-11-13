-- Catálogo de cuentas: crear y editar cuentas (solo aditivo).
--
-- Reglas:
--   · Escrituras solo por RPC security definer (admin/contador).
--   · No se puede borrar una cuenta: a propósito no hay política ni grant de
--     DELETE sobre public.cuentas (authenticated solo tiene SELECT).
--   · Si una cuenta ya tiene movimientos no se cambian código, tipo ni
--     naturaleza; el nombre y las banderas sí.

create or replace function public.crear_cuenta(p jsonb)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_rol text;
  v_id uuid;
  v_codigo text;
  v_nombre text;
  v_tipo text;
  v_naturaleza text;
  v_padre_id uuid;
  v_padre_tipo text;
begin
  v_rol := public.rol_actual();
  if v_rol is null or v_rol not in ('admin', 'contador') then
    raise exception 'sin permiso' using errcode = '42501';
  end if;

  if p is null then
    raise exception 'datos de la cuenta requeridos' using errcode = '22023';
  end if;

  v_codigo := upper(trim(coalesce(p->>'codigo', '')));
  if v_codigo = '' then
    raise exception 'el código de la cuenta es obligatorio' using errcode = '22023';
  end if;

  v_nombre := trim(coalesce(p->>'nombre', ''));
  if v_nombre = '' then
    raise exception 'el nombre de la cuenta es obligatorio' using errcode = '22023';
  end if;

  v_tipo := coalesce(nullif(p->>'tipo', ''), '');
  if v_tipo not in ('activo', 'pasivo', 'capital', 'ingreso', 'costo', 'gasto') then
    raise exception 'tipo de cuenta inválido' using errcode = '22023';
  end if;

  v_naturaleza := coalesce(nullif(p->>'naturaleza', ''), '');
  if v_naturaleza not in ('debito', 'credito') then
    raise exception 'naturaleza de cuenta inválida' using errcode = '22023';
  end if;

  v_padre_id := nullif(p->>'padre_id', '')::uuid;

  if v_padre_id is not null then
    select c.tipo into v_padre_tipo
    from public.cuentas c
    where c.id = v_padre_id;

    if v_padre_tipo is null then
      raise exception 'la cuenta padre no existe' using errcode = '22023';
    end if;

    if v_padre_tipo <> v_tipo then
      raise exception 'el tipo de la cuenta no coincide con el de la cuenta padre' using errcode = '22023';
    end if;
  end if;

  begin
    insert into public.cuentas (
      codigo, nombre, tipo, naturaleza, padre_id, acepta_movimientos, es_caja_banco, activa
    )
    values (
      v_codigo,
      v_nombre,
      v_tipo,
      v_naturaleza,
      v_padre_id,
      coalesce((p->>'acepta_movimientos')::boolean, true),
      coalesce((p->>'es_caja_banco')::boolean, false),
      coalesce((p->>'activa')::boolean, true)
    )
    returning id into v_id;
  exception when unique_violation then
    raise exception 'el código de la cuenta ya existe' using errcode = '23505';
  end;

  return v_id;
end;
$$;

create or replace function public.actualizar_cuenta(p jsonb)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_rol text;
  v_id uuid;
  v_cuenta public.cuentas%rowtype;
  v_codigo text;
  v_nombre text;
  v_tipo text;
  v_naturaleza text;
  v_padre_id uuid;
  v_padre_tipo text;
  v_movimientos boolean;
begin
  v_rol := public.rol_actual();
  if v_rol is null or v_rol not in ('admin', 'contador') then
    raise exception 'sin permiso' using errcode = '42501';
  end if;

  if p is null then
    raise exception 'datos de la cuenta requeridos' using errcode = '22023';
  end if;

  v_id := nullif(p->>'id', '')::uuid;
  if v_id is null then
    raise exception 'la cuenta es obligatoria' using errcode = '22023';
  end if;

  select * into v_cuenta
  from public.cuentas c
  where c.id = v_id;

  if not found then
    raise exception 'cuenta no encontrada' using errcode = '22023';
  end if;

  v_codigo := v_cuenta.codigo;
  if p ? 'codigo' then
    v_codigo := upper(trim(coalesce(p->>'codigo', '')));
    if v_codigo = '' then
      raise exception 'el código de la cuenta es obligatorio' using errcode = '22023';
    end if;
  end if;

  v_nombre := v_cuenta.nombre;
  if p ? 'nombre' then
    v_nombre := trim(coalesce(p->>'nombre', ''));
    if v_nombre = '' then
      raise exception 'el nombre de la cuenta es obligatorio' using errcode = '22023';
    end if;
  end if;

  v_tipo := coalesce(nullif(p->>'tipo', ''), v_cuenta.tipo);
  if v_tipo not in ('activo', 'pasivo', 'capital', 'ingreso', 'costo', 'gasto') then
    raise exception 'tipo de cuenta inválido' using errcode = '22023';
  end if;

  v_naturaleza := coalesce(nullif(p->>'naturaleza', ''), v_cuenta.naturaleza);
  if v_naturaleza not in ('debito', 'credito') then
    raise exception 'naturaleza de cuenta inválida' using errcode = '22023';
  end if;

  select exists (
    select 1 from public.asiento_lineas l where l.cuenta_id = v_id
  ) into v_movimientos;

  if v_movimientos then
    if v_codigo <> v_cuenta.codigo then
      raise exception 'no se puede cambiar el código de una cuenta con movimientos' using errcode = '22023';
    end if;

    if v_tipo <> v_cuenta.tipo then
      raise exception 'no se puede cambiar el tipo de una cuenta con movimientos' using errcode = '22023';
    end if;

    if v_naturaleza <> v_cuenta.naturaleza then
      raise exception 'no se puede cambiar la naturaleza de una cuenta con movimientos' using errcode = '22023';
    end if;
  end if;

  v_padre_id := case
    when p ? 'padre_id' then nullif(p->>'padre_id', '')::uuid
    else v_cuenta.padre_id
  end;

  if v_padre_id = v_id then
    raise exception 'una cuenta no puede ser su propia cuenta padre' using errcode = '22023';
  end if;

  if v_padre_id is not null then
    select c.tipo into v_padre_tipo
    from public.cuentas c
    where c.id = v_padre_id;

    if v_padre_tipo is null then
      raise exception 'la cuenta padre no existe' using errcode = '22023';
    end if;

    if v_padre_tipo <> v_tipo then
      raise exception 'el tipo de la cuenta no coincide con el de la cuenta padre' using errcode = '22023';
    end if;

    if exists (
      with recursive descendientes as (
        select c.id, c.padre_id
        from public.cuentas c
        where c.padre_id = v_id
        union all
        select h.id, h.padre_id
        from public.cuentas h
        join descendientes d on h.padre_id = d.id
      )
      select 1 from descendientes where id = v_padre_id
    ) then
      raise exception 'la cuenta padre no puede ser una cuenta descendiente' using errcode = '22023';
    end if;
  end if;

  begin
    update public.cuentas c
    set
      codigo = v_codigo,
      nombre = v_nombre,
      tipo = v_tipo,
      naturaleza = v_naturaleza,
      padre_id = v_padre_id,
      acepta_movimientos = case
        when p ? 'acepta_movimientos' then coalesce((p->>'acepta_movimientos')::boolean, c.acepta_movimientos)
        else c.acepta_movimientos
      end,
      es_caja_banco = case
        when p ? 'es_caja_banco' then coalesce((p->>'es_caja_banco')::boolean, c.es_caja_banco)
        else c.es_caja_banco
      end,
      activa = case
        when p ? 'activa' then coalesce((p->>'activa')::boolean, c.activa)
        else c.activa
      end
    where c.id = v_id;
  exception when unique_violation then
    raise exception 'el código de la cuenta ya existe' using errcode = '23505';
  end;

  return v_id;
end;
$$;

-- Sin política de DELETE a propósito: las cuentas no se borran desde la app.
revoke delete, insert, update on public.cuentas from anon, authenticated;

revoke all on function public.crear_cuenta(jsonb) from public, anon, authenticated;
revoke all on function public.actualizar_cuenta(jsonb) from public, anon, authenticated;

grant execute on function public.crear_cuenta(jsonb) to authenticated;
grant execute on function public.actualizar_cuenta(jsonb) to authenticated;
