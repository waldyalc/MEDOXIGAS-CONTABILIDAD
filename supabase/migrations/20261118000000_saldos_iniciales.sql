-- ---------------------------------------------------------------------------
-- Saldos iniciales del catálogo de cuentas (Alegra: catálogo → "Saldos iniciales")
--
-- Migración aditiva y reintentable:
--   · asientos.origen_tipo suma 'saldo_inicial': los asientos de carga inicial
--     quedan identificados (equivale al tipo "SI" de Alegra).
--   · Cuenta de patrimonio "Ajustes iniciales" bajo Capital (3): es la
--     contrapartida que la pantalla ofrece para cuadrar el registro. Si ya
--     existe una cuenta con ese nombre se reutiliza; si no, se crea con el
--     primer código libre después del mayor de sus hermanas (3101, 3201…).
--   · config_contable.ajustes_iniciales: el motor y la app la ubican por clave.
--   · registrar_saldos_iniciales(p jsonb): crea UN asiento 'saldo_inicial' con
--     una línea por cuenta cargada. Las líneas deben cuadrar (débitos =
--     créditos), como pide Alegra ("cuando se cumpla la ecuación patrimonial").
--     Idempotente por cuenta: una cuenta que ya tiene línea en un asiento
--     'saldo_inicial' no admite otra carga (salvo "Ajustes iniciales", que es
--     la contrapartida y puede repetir en registros posteriores). Las cuentas
--     de caja/banco se rechazan: su saldo inicial se carga desde Bancos, como
--     en Alegra, para no duplicar.
-- ---------------------------------------------------------------------------

do $$
declare
  v_nombre text;
begin
  select conname into v_nombre
  from pg_constraint
  where conrelid = 'public.asientos'::regclass
    and contype = 'c'
    and pg_get_constraintdef(oid) like '%origen_tipo%'
  limit 1;

  if v_nombre is not null then
    execute format('alter table public.asientos drop constraint %I', v_nombre);
  end if;
end;
$$;

alter table public.asientos
  add constraint asientos_origen_tipo_check check (origen_tipo in (
    'factura',
    'pago_recibido',
    'factura_proveedor',
    'pago_proveedor',
    'gasto_menor',
    'manual',
    'anulacion',
    'nota_credito_venta',
    'nota_credito_compra',
    'nota_debito',
    'transferencia',
    'deposito',
    'conciliacion',
    'ajuste_inventario',
    'saldo_inicial'
  ));

-- ---------------------------------------------------------------------------
-- Cuenta de contrapartida: "Ajustes iniciales" bajo Capital
-- ---------------------------------------------------------------------------

do $$
declare
  v_capital_id uuid;
  v_ajustes_id uuid;
  v_siguiente int;
  v_codigo text;
begin
  select c.id into v_ajustes_id
  from public.cuentas c
  where c.tipo = 'capital'
    and c.acepta_movimientos
    and c.activa
    and c.nombre = 'Ajustes iniciales'
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

    v_codigo := (coalesce(v_siguiente, 3000) + 100)::text;
    while exists (select 1 from public.cuentas c where c.codigo = v_codigo) loop
      v_codigo := (v_codigo::int + 1)::text;
    end loop;

    insert into public.cuentas (
      codigo, nombre, tipo, naturaleza, padre_id, acepta_movimientos
    )
    values (
      v_codigo, 'Ajustes iniciales', 'capital', 'credito', v_capital_id, true
    )
    returning id into v_ajustes_id;
  end if;

  insert into public.config_contable (clave, cuenta_id)
  values ('ajustes_iniciales', v_ajustes_id)
  on conflict (clave) do nothing;
end;
$$;

-- ---------------------------------------------------------------------------
-- RPC: registra los saldos iniciales en un solo asiento 'saldo_inicial'
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
