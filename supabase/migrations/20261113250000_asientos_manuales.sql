-- ---------------------------------------------------------------------------
-- Asientos manuales
--
-- RPC aditiva para registrar un asiento que no nace de un documento. Reutiliza
-- public._crear_asiento con origen_tipo 'manual' y valida el cuadre, las líneas
-- y las cuentas antes de insertar. No cambia tablas ni funciones existentes.
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

  return v_asiento_id;
end;
$$;

revoke all on function public.crear_asiento_manual(jsonb) from public, anon, authenticated;
grant execute on function public.crear_asiento_manual(jsonb) to authenticated;
