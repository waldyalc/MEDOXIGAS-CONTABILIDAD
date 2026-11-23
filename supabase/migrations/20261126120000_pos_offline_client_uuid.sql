-- POS 11: idempotencia de ventas/movimientos offline por client_uuid.
-- Migración aditiva. La RPC pos_sincronizar_operacion envuelve las RPC actuales
-- en una transacción y devuelve el resultado existente si el UUID se repite.

alter table public.facturas add column if not exists client_uuid uuid;
alter table public.pos_turno_movimientos add column if not exists client_uuid uuid;

create unique index if not exists facturas_pos_client_uuid_key
  on public.facturas (client_uuid) where client_uuid is not null;
create unique index if not exists pos_movimientos_client_uuid_key
  on public.pos_turno_movimientos (client_uuid) where client_uuid is not null;

create table if not exists public.pos_sync_operaciones (
  client_uuid uuid primary key,
  creado_por uuid not null references auth.users(id),
  terminal_id uuid not null references public.pos_terminales(id),
  turno_id uuid not null references public.pos_turnos(id),
  tipo text not null check (tipo in ('venta', 'movimiento')),
  payload jsonb not null,
  resultado jsonb not null,
  creado_en timestamptz not null default now()
);

alter table public.pos_sync_operaciones enable row level security;
revoke all on public.pos_sync_operaciones from anon, authenticated;
grant select on public.pos_sync_operaciones to authenticated;

do $$
begin
  if not exists (
    select 1 from pg_catalog.pg_policies
    where schemaname = 'public' and tablename = 'pos_sync_operaciones'
      and policyname = 'pos_sync_operaciones_lectura'
  ) then
    create policy pos_sync_operaciones_lectura on public.pos_sync_operaciones
      for select to authenticated
      using (creado_por = auth.uid() and public.rol_actual() in ('admin', 'contador'));
  end if;
end;
$$;

create or replace function public.pos_sincronizar_operacion(p jsonb)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uuid uuid;
  v_terminal_id uuid;
  v_turno_id uuid;
  v_tipo text;
  v_payload jsonb;
  v_resultado jsonb;
  v_guardado public.pos_sync_operaciones%rowtype;
  v_turno public.pos_turnos%rowtype;
begin
  if auth.uid() is null or public.rol_actual() is null
     or public.rol_actual() not in ('admin', 'contador') then
    raise exception 'sin permiso' using errcode = '42501';
  end if;

  v_uuid := nullif(p->>'client_uuid', '')::uuid;
  v_terminal_id := nullif(p->>'terminal_id', '')::uuid;
  v_turno_id := nullif(p->>'turno_id', '')::uuid;
  v_tipo := p->>'tipo';
  v_payload := p->'payload';
  if v_uuid is null or v_terminal_id is null or v_turno_id is null
     or v_tipo is null or v_tipo not in ('venta', 'movimiento')
     or v_payload is null or jsonb_typeof(v_payload) <> 'object' then
    raise exception 'operación de sincronización inválida' using errcode = '22023';
  end if;

  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(v_uuid::text, 0));
  select * into v_guardado from public.pos_sync_operaciones where client_uuid = v_uuid;
  if found then
    if v_guardado.creado_por <> auth.uid()
       or v_guardado.terminal_id <> v_terminal_id
       or v_guardado.turno_id <> v_turno_id
       or v_guardado.tipo <> v_tipo
       or v_guardado.payload <> v_payload then
      raise exception 'el identificador ya pertenece a otra operación' using errcode = '22023';
    end if;
    return v_guardado.resultado;
  end if;

  perform 1 from public.pos_terminales where id = v_terminal_id for share;
  if not found then
    raise exception 'la terminal no existe' using errcode = '22023';
  end if;
  select * into v_turno from public.pos_turnos where id = v_turno_id for update;
  if not found or v_turno.terminal_id <> v_terminal_id or v_turno.estado <> 'abierto' then
    raise exception 'el turno no existe, está cerrado o pertenece a otra terminal' using errcode = '22023';
  end if;

  if v_tipo = 'venta' then
    if nullif(v_payload->>'terminal_id', '')::uuid is distinct from v_terminal_id then
      raise exception 'la terminal de la venta no coincide' using errcode = '22023';
    end if;
    v_resultado := public.pos_completar_venta(
      (v_payload - 'fecha') || jsonb_build_object(
        'fecha', (now() at time zone 'America/Santo_Domingo')::date
      )
    );
    update public.facturas set client_uuid = v_uuid
      where id = (v_resultado->'factura'->>'id')::uuid and turno_id = v_turno_id;
  else
    if nullif(v_payload->>'turno_id', '')::uuid is distinct from v_turno_id then
      raise exception 'el turno del movimiento no coincide' using errcode = '22023';
    end if;
    v_resultado := public.pos_registrar_movimiento_turno(v_payload);
    update public.pos_turno_movimientos set client_uuid = v_uuid
      where id = (v_resultado->'movimiento'->>'id')::uuid and turno_id = v_turno_id;
  end if;
  if not found then
    raise exception 'la operación no devolvió un documento del turno esperado' using errcode = '22023';
  end if;

  insert into public.pos_sync_operaciones
    (client_uuid, creado_por, terminal_id, turno_id, tipo, payload, resultado)
  values
    (v_uuid, auth.uid(), v_terminal_id, v_turno_id, v_tipo, v_payload, v_resultado);
  return v_resultado;
end;
$$;

revoke all on function public.pos_sincronizar_operacion(jsonb) from public, anon;
grant execute on function public.pos_sincronizar_operacion(jsonb) to authenticated;
