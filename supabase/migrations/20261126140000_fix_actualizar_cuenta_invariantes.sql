-- ---------------------------------------------------------------------------
-- Catálogo de cuentas: candados de edición que faltaban
--
-- Migración aditiva y reintentable: solo redefine actualizar_cuenta con su
-- misma firma, grants y security definer. No toca datos.
--
-- Dos invariantes que la versión de 20261113240000 dejaba pasar:
--   · acepta_movimientos = false en una cuenta que YA tiene líneas: el asiento
--     sigue existiendo pero cerrar_resultados_anio la ignora y anular_documento
--     falla. Se rechaza el cambio (una cuenta ya agrupadora sigue siendo
--     editable en nombre y demás banderas).
--   · cambio de tipo en una cuenta con subcuentas hijas: el árbol queda con
--     hijas de otro tipo y los totales se corrompen. Se rechaza cuando alguna
--     hija directa tiene un tipo distinto al nuevo.
-- ---------------------------------------------------------------------------

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
  v_acepta_movimientos boolean;
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

  v_acepta_movimientos := case
    when p ? 'acepta_movimientos' then coalesce((p->>'acepta_movimientos')::boolean, v_cuenta.acepta_movimientos)
    else v_cuenta.acepta_movimientos
  end;

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

    -- cerrar_resultados_anio ignora las cuentas que no aceptan movimientos y
    -- anular_documento no puede revertir sus líneas: la cuenta quedaría con
    -- saldo en asiento_lineas pero fuera del cierre.
    if v_cuenta.acepta_movimientos and not v_acepta_movimientos then
      raise exception 'no se puede dejar de aceptar movimientos en una cuenta que ya tiene movimientos'
        using errcode = '22023';
    end if;
  end if;

  -- Cambiar el tipo de una cuenta agrupadora deja a sus subcuentas con otro
  -- tipo y corrompe los totales del árbol: se rechaza si alguna hija directa
  -- no comparte el tipo nuevo (el tipo de la hija siempre se valida contra su
  -- padre al crearla o editarla).
  if v_tipo <> v_cuenta.tipo and exists (
    select 1
    from public.cuentas c
    where c.padre_id = v_id
      and c.tipo <> v_tipo
  ) then
    raise exception 'no se puede cambiar el tipo de una cuenta con subcuentas de otro tipo' using errcode = '22023';
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
      acepta_movimientos = v_acepta_movimientos,
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

revoke all on function public.actualizar_cuenta(jsonb) from public, anon, authenticated;
grant execute on function public.actualizar_cuenta(jsonb) to authenticated;
