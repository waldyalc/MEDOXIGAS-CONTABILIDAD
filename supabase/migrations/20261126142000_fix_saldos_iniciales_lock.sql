-- ---------------------------------------------------------------------------
-- Saldos iniciales: serializa registrar_saldos_iniciales por transacción
--
-- Migración aditiva y reintentable: solo redefine registrar_saldos_iniciales
-- con su misma firma, grants y security definer. No toca datos.
--
-- Sin lock, dos envíos simultáneos para la misma cuenta pasaban los dos el
-- chequeo de existencia de asiento 'saldo_inicial' y duplicaban el saldo. El
-- lock de transacción se toma antes de validar y se libera al confirmar o
-- revertir, igual que cierre_resultados_anio y depreciar_activo.
-- ---------------------------------------------------------------------------

create or replace function public.registrar_saldos_iniciales(p jsonb)
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
  v_debito numeric(14,2);
  v_credito numeric(14,2);
  v_debitos numeric(14,2) := 0;
  v_creditos numeric(14,2) := 0;
  v_vistas uuid[] := '{}';
  v_ajustes_id uuid;
  v_asiento_id uuid;
begin
  v_rol := public.rol_actual();
  if v_rol is null or v_rol not in ('admin', 'contador') then
    raise exception 'sin permiso' using errcode = '42501';
  end if;

  if p is null or jsonb_typeof(p) <> 'object' then
    raise exception 'datos de los saldos requeridos' using errcode = '22023';
  end if;

  v_fecha := coalesce(nullif(p->>'fecha', '')::date, current_date);
  v_descripcion := coalesce(nullif(trim(p->>'descripcion'), ''), 'Saldos iniciales');

  v_lineas := p->'lineas';
  if v_lineas is null or jsonb_typeof(v_lineas) <> 'array' then
    raise exception 'las líneas de saldos son inválidas' using errcode = '22023';
  end if;

  if jsonb_array_length(v_lineas) < 1 then
    raise exception 'carga al menos un saldo inicial' using errcode = '22023';
  end if;

  -- La contrapartida se identifica por config: queda exenta del chequeo de
  -- duplicados porque puede aparecer en varios registros de saldos iniciales.
  select c.cuenta_id into v_ajustes_id
  from public.config_contable c
  where c.clave = 'ajustes_iniciales';

  -- Serializa el chequeo de duplicados y el insert del asiento: dos envíos
  -- simultáneos del mismo saldo no pueden pasar los dos el exists().
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtext('saldos_iniciales'));

  for v_linea in select * from jsonb_array_elements(v_lineas) loop
    v_cuenta_id := nullif(v_linea->>'cuenta_id', '')::uuid;
    if v_cuenta_id is null then
      raise exception 'cada línea requiere una cuenta' using errcode = '22023';
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
    if v_cuenta.es_caja_banco then
      raise exception 'el saldo inicial de la cuenta % se registra desde Bancos', v_cuenta.codigo
        using errcode = '23514';
    end if;

    if v_cuenta_id = any(v_vistas) then
      raise exception 'la cuenta % está repetida en el registro', v_cuenta.codigo using errcode = '22023';
    end if;
    v_vistas := v_vistas || v_cuenta_id;

    if v_cuenta_id is distinct from v_ajustes_id and exists (
      select 1
      from public.asientos a
      join public.asiento_lineas l on l.asiento_id = a.id
      where a.origen_tipo = 'saldo_inicial'
        and l.cuenta_id = v_cuenta_id
    ) then
      raise exception 'la cuenta % ya tiene un saldo inicial registrado', v_cuenta.codigo
        using errcode = '23514';
    end if;

    v_debito := round(coalesce((v_linea->>'debito')::numeric, 0), 2);
    v_credito := round(coalesce((v_linea->>'credito')::numeric, 0), 2);

    if v_debito < 0 or v_credito < 0 then
      raise exception 'los montos no pueden ser negativos' using errcode = '22023';
    end if;

    if (v_debito = 0) = (v_credito = 0) then
      raise exception 'cada línea debe llevar débito o crédito, nunca ambos' using errcode = '23514';
    end if;

    v_debitos := v_debitos + v_debito;
    v_creditos := v_creditos + v_credito;

    v_lineas_norm := v_lineas_norm || jsonb_build_array(jsonb_build_object(
      'cuenta_id', v_cuenta_id,
      'descripcion', coalesce(nullif(trim(v_linea->>'descripcion'), ''), v_descripcion),
      'debito', v_debito,
      'credito', v_credito
    ));
  end loop;

  if v_debitos <> v_creditos then
    raise exception 'el registro de saldos iniciales está descuadrado (débitos %, créditos %)',
      v_debitos, v_creditos using errcode = '23514';
  end if;

  v_asiento_id := public._crear_asiento(v_fecha, v_descripcion, 'saldo_inicial', null, v_lineas_norm);

  return v_asiento_id;
end;
$$;

revoke all on function public.registrar_saldos_iniciales(jsonb) from public, anon, authenticated;
grant execute on function public.registrar_saldos_iniciales(jsonb) to authenticated;
