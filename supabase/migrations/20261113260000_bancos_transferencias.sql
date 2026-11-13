-- ---------------------------------------------------------------------------
-- Bancos básico: transferencias entre cuentas de caja/banco y depósitos.
-- Migración aditiva: solo amplía el CHECK de asientos.origen_tipo y agrega RPC.
--
-- No hay tablas nuevas de transferencias ni depósitos: cada movimiento se
-- identifica por asientos.origen_tipo ('transferencia' o 'deposito') y sus
-- líneas. El origen_id del asiento queda null porque no existe documento aparte.
-- La conciliación bancaria queda fuera de esta entrega.
-- ---------------------------------------------------------------------------

-- Lista completa de orígenes de asiento (las demás tareas usarán estos mismos
-- valores). Se localiza el CHECK por su definición para no depender del nombre
-- autogenerado por Postgres.
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
    'deposito'
  ));

-- ---------------------------------------------------------------------------
-- Transferencia entre cuentas de caja o banco
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

  return v_asiento_id;
end;
$$;

-- ---------------------------------------------------------------------------
-- Depósito o aporte a una cuenta de caja o banco
-- ---------------------------------------------------------------------------

create or replace function public.registrar_deposito(p jsonb)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_rol text;
  v_destino public.cuentas%rowtype;
  v_contrapartida public.cuentas%rowtype;
  v_monto numeric(14,2);
  v_fecha date;
  v_descripcion text;
  v_asiento_id uuid;
begin
  v_rol := public.rol_actual();
  if v_rol is null or v_rol not in ('admin', 'contador') then
    raise exception 'sin permiso' using errcode = '42501';
  end if;

  if p is null then
    raise exception 'datos del depósito requeridos' using errcode = '22023';
  end if;

  if nullif(p->>'cuenta_destino_id', '') is null or nullif(p->>'cuenta_contrapartida_id', '') is null then
    raise exception 'selecciona la cuenta de destino y la contrapartida' using errcode = '22023';
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

  select * into v_contrapartida
  from public.cuentas c
  where c.id = (p->>'cuenta_contrapartida_id')::uuid
    and c.activa
    and c.acepta_movimientos;

  if not found then
    raise exception 'cuenta de contrapartida no encontrada o inactiva' using errcode = '22023';
  end if;

  if v_destino.id = v_contrapartida.id then
    raise exception 'la cuenta de destino y la contrapartida deben ser distintas' using errcode = '22023';
  end if;

  v_monto := round(coalesce((p->>'monto')::numeric, 0), 2);
  if v_monto <= 0 then
    raise exception 'el monto del depósito debe ser mayor a cero' using errcode = '22023';
  end if;

  v_fecha := coalesce((p->>'fecha')::date, current_date);
  v_descripcion := coalesce(
    nullif(trim(p->>'descripcion'), ''),
    nullif(trim(p->>'notas'), ''),
    'Depósito en ' || v_destino.nombre
  );

  v_asiento_id := public._crear_asiento(
    v_fecha,
    v_descripcion,
    'deposito',
    null,
    jsonb_build_array(
      jsonb_build_object(
        'cuenta_id', v_destino.id,
        'debito', v_monto,
        'credito', 0,
        'descripcion', 'Depósito en ' || v_destino.nombre
      ),
      jsonb_build_object(
        'cuenta_id', v_contrapartida.id,
        'debito', 0,
        'credito', v_monto,
        'descripcion', 'Contrapartida de depósito'
      )
    )
  );

  return v_asiento_id;
end;
$$;

revoke all on function public.transferir_entre_cuentas(jsonb) from public, anon, authenticated;
revoke all on function public.registrar_deposito(jsonb) from public, anon, authenticated;
grant execute on function public.transferir_entre_cuentas(jsonb) to authenticated;
grant execute on function public.registrar_deposito(jsonb) to authenticated;
