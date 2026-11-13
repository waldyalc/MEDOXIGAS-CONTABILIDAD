-- ---------------------------------------------------------------------------
-- Bancos: creación de cuentas de banco/caja desde el módulo Bancos.
-- Migración aditiva: agrega columnas opcionales, no toca datos existentes.
--
--   · cuentas.tipo_banco / cuentas.numero_cuenta: datos propios de la cuenta
--     de banco (el tipo contable sigue en cuentas.tipo).
--   · asientos.numeracion_ingreso / numeracion_egreso: numeración externa
--     opcional de una transferencia. No cambia las líneas del asiento.
--   · crear_cuenta_banco: crea la cuenta contable y, si el saldo inicial es
--     mayor a cero, el asiento Dr cuenta / Cr Ajustes iniciales en bancos.
--   · transferir_entre_cuentas: se reemplaza solo para guardar la numeración
--     opcional; el asiento sigue siendo Dr destino / Cr origen.
-- ---------------------------------------------------------------------------

alter table public.cuentas
  add column if not exists tipo_banco text,
  add column if not exists numero_cuenta text,
  add column if not exists descripcion text;

alter table public.cuentas
  add constraint cuentas_tipo_banco_check
  check (tipo_banco is null or tipo_banco in ('banco', 'efectivo', 'tarjeta'));

alter table public.asientos
  add column if not exists numeracion_ingreso text,
  add column if not exists numeracion_egreso text;

-- ---------------------------------------------------------------------------
-- Crear cuenta de banco o caja
-- ---------------------------------------------------------------------------

create or replace function public.crear_cuenta_banco(p jsonb)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_rol text;
  v_nombre text;
  v_tipo_banco text;
  v_numero_cuenta text;
  v_saldo_inicial numeric(14,2);
  v_fecha date;
  v_descripcion text;
  v_padre_id uuid;
  v_base int;
  v_siguiente int;
  v_codigo text;
  v_cuenta_id uuid;
  v_capital_id uuid;
  v_ajustes_id uuid;
begin
  v_rol := public.rol_actual();
  if v_rol is null or v_rol not in ('admin', 'contador') then
    raise exception 'sin permiso' using errcode = '42501';
  end if;

  if p is null then
    raise exception 'datos de la cuenta requeridos' using errcode = '22023';
  end if;

  v_nombre := trim(coalesce(p->>'nombre', ''));
  if v_nombre = '' then
    raise exception 'el nombre de la cuenta es obligatorio' using errcode = '22023';
  end if;

  v_tipo_banco := coalesce(nullif(trim(p->>'tipo_banco'), ''), 'banco');
  if v_tipo_banco not in ('banco', 'efectivo', 'tarjeta') then
    raise exception 'tipo de cuenta inválido' using errcode = '22023';
  end if;

  v_numero_cuenta := nullif(trim(coalesce(p->>'numero_cuenta', '')), '');

  v_saldo_inicial := round(coalesce(nullif(p->>'saldo_inicial', '')::numeric, 0), 2);
  if v_saldo_inicial < 0 then
    raise exception 'el saldo inicial no puede ser negativo' using errcode = '22023';
  end if;

  v_fecha := coalesce(nullif(p->>'fecha_saldo_inicial', '')::date, current_date);
  v_descripcion := nullif(trim(coalesce(p->>'descripcion', '')), '');

  -- Padre: el mismo de la cuenta de banco principal (1102) o, si no existe,
  -- el grupo de activos corrientes (11).
  select c.padre_id into v_padre_id
  from public.cuentas c
  where c.codigo = '1102';

  if v_padre_id is null then
    select c.id into v_padre_id
    from public.cuentas c
    where c.codigo = '11';
  end if;

  if v_padre_id is null then
    raise exception 'no existe el grupo de activos corrientes' using errcode = '22023';
  end if;

  select (c.codigo::int * 100) into v_base
  from public.cuentas c
  where c.id = v_padre_id;

  select max(c.codigo::int) into v_siguiente
  from public.cuentas c
  where c.padre_id = v_padre_id
    and c.codigo ~ '^[0-9]+$';

  v_codigo := (coalesce(v_siguiente, v_base) + 1)::text;

  insert into public.cuentas (
    codigo, nombre, tipo, naturaleza, padre_id,
    acepta_movimientos, es_caja_banco, activa, tipo_banco, numero_cuenta, descripcion
  )
  values (
    v_codigo, v_nombre, 'activo', 'debito', v_padre_id,
    true, true, true, v_tipo_banco, v_numero_cuenta, v_descripcion
  )
  returning id into v_cuenta_id;

  if v_saldo_inicial > 0 then
    -- Contrapartida de patrimonio: se reutiliza si ya existe; si no, se crea
    -- un código libre bajo Capital (3), por ejemplo 3301.
    select c.id into v_ajustes_id
    from public.cuentas c
    where c.nombre = 'Ajustes iniciales en bancos'
      and c.activa
      and c.acepta_movimientos
    order by c.codigo
    limit 1;

    if v_ajustes_id is null then
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

      v_codigo := ((coalesce(v_siguiente, 3000) / 100) * 100 + 101)::text;

      insert into public.cuentas (
        codigo, nombre, tipo, naturaleza, padre_id,
        acepta_movimientos, es_caja_banco, activa
      )
      values (
        v_codigo, 'Ajustes iniciales en bancos', 'capital', 'credito', v_capital_id,
        true, false, true
      )
      returning id into v_ajustes_id;
    end if;

    perform public._crear_asiento(
      v_fecha,
      coalesce(v_descripcion, 'Saldo inicial de ' || v_nombre),
      'deposito',
      null,
      jsonb_build_array(
        jsonb_build_object(
          'cuenta_id', v_cuenta_id,
          'debito', v_saldo_inicial,
          'credito', 0,
          'descripcion', 'Saldo inicial de ' || v_nombre
        ),
        jsonb_build_object(
          'cuenta_id', v_ajustes_id,
          'debito', 0,
          'credito', v_saldo_inicial,
          'descripcion', 'Ajustes iniciales en bancos'
        )
      )
    );
  end if;

  return v_cuenta_id;
end;
$$;

-- ---------------------------------------------------------------------------
-- Transferencia entre cuentas de caja o banco (con numeración opcional)
-- ---------------------------------------------------------------------------

create or replace function public.transferir_entre_cuentas(p jsonb)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_rol text;
  v_origen public.cuentas%rowtype;
  v_destino public.cuentas%rowtype;
  v_monto numeric(14,2);
  v_fecha date;
  v_descripcion text;
  v_numeracion_ingreso text;
  v_numeracion_egreso text;
  v_asiento_id uuid;
begin
  v_rol := public.rol_actual();
  if v_rol is null or v_rol not in ('admin', 'contador') then
    raise exception 'sin permiso' using errcode = '42501';
  end if;

  if p is null then
    raise exception 'datos de la transferencia requeridos' using errcode = '22023';
  end if;

  if nullif(p->>'cuenta_origen_id', '') is null or nullif(p->>'cuenta_destino_id', '') is null then
    raise exception 'selecciona la cuenta de origen y la de destino' using errcode = '22023';
  end if;

  select * into v_origen
  from public.cuentas c
  where c.id = (p->>'cuenta_origen_id')::uuid
    and c.activa
    and c.es_caja_banco
    and c.acepta_movimientos;

  if not found then
    raise exception 'cuenta de origen no encontrada o inactiva' using errcode = '22023';
  end if;

  select * into v_destino
  from public.cuentas c
  where c.id = (p->>'cuenta_destino_id')::uuid
    and c.activa
    and c.es_caja_banco
    and c.acepta_movimientos;

  if not found then
    raise exception 'cuenta de destino no encontrada o inactiva' using errcode = '22023';
  end if;

  if v_origen.id = v_destino.id then
    raise exception 'la cuenta de origen y destino deben ser distintas' using errcode = '22023';
  end if;

  v_monto := round(coalesce((p->>'monto')::numeric, 0), 2);
  if v_monto <= 0 then
    raise exception 'el monto de la transferencia debe ser mayor a cero' using errcode = '22023';
  end if;

  v_fecha := coalesce((p->>'fecha')::date, current_date);
  v_descripcion := coalesce(
    nullif(trim(p->>'descripcion'), ''),
    nullif(trim(p->>'notas'), ''),
    'Transferencia entre cuentas'
  );
  v_numeracion_ingreso := nullif(trim(coalesce(p->>'numeracion_ingreso', '')), '');
  v_numeracion_egreso := nullif(trim(coalesce(p->>'numeracion_egreso', '')), '');

  v_asiento_id := public._crear_asiento(
    v_fecha,
    v_descripcion,
    'transferencia',
    null,
    jsonb_build_array(
      jsonb_build_object(
        'cuenta_id', v_destino.id,
        'debito', v_monto,
        'credito', 0,
        'descripcion', 'Transferencia recibida de ' || v_origen.nombre
      ),
      jsonb_build_object(
        'cuenta_id', v_origen.id,
        'debito', 0,
        'credito', v_monto,
        'descripcion', 'Transferencia enviada a ' || v_destino.nombre
      )
    )
  );

  if v_numeracion_ingreso is not null or v_numeracion_egreso is not null then
    update public.asientos a
    set
      numeracion_ingreso = v_numeracion_ingreso,
      numeracion_egreso = v_numeracion_egreso
    where a.id = v_asiento_id;
  end if;

  return v_asiento_id;
end;
$$;

revoke all on function public.crear_cuenta_banco(jsonb) from public, anon, authenticated;
revoke all on function public.transferir_entre_cuentas(jsonb) from public, anon, authenticated;
grant execute on function public.crear_cuenta_banco(jsonb) to authenticated;
grant execute on function public.transferir_entre_cuentas(jsonb) to authenticated;
