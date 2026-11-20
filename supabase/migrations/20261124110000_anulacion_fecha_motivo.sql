-- ---------------------------------------------------------------------------
-- Anulación de documentos con fecha y motivo (como Alegra)
--
-- Hoy anular_documento solo dejaba estado = 'anulada' (y devolvía pagado y
-- retenido a 0 en facturas). El diálogo de Alegra pide además Fecha de
-- anulación y Motivo de anulación, y el reporte 608 de la DGII necesita el
-- tipo de anulación real (no un valor fijo). Esta migración persiste ambos.
--
-- · public.motivos_anulacion: catálogo fijo de 10 motivos (Alegra) con su
--   código oficial del 608. Se siembra aquí y se corrige por SQL, no desde la
--   app: authenticated solo puede leerlo (RLS, sin políticas de escritura).
-- · facturas / gastos_menores: fecha_anulacion y motivo_anulacion_id.
--   notas_credito_venta también gana las columnas para la trazabilidad futura;
--   el motor todavía no anula notas de crédito de venta.
-- · anular_documento gana p_info jsonb (default null). Si viene null, delega
--   tal cual en la versión vigente renombrada: compatibilidad total con las
--   llamadas existentes (tests, app y RPC internas).
--   Si viene, valida fecha (ISO, no futura), motivo (existe y está activo) y
--   que el tipo lo admita ('factura' o 'gasto_menor'), delega la anulación
--   real y después persiste fecha y motivo en el documento.
--
-- LÍMITE CONOCIDO: el asiento de reversa lo sigue fechando el motor base con
-- current_date; esta migración no toca esa lógica interna. La fecha capturada
-- es la del documento anulado (la que necesita el 608).
--
-- Migración aditiva: create table if not exists, add column if not exists y
-- siembra on conflict do nothing. No cambia datos existentes. La función sigue
-- el patrón de envoltura de 20261117200000: renombra la vigente y crea la nueva.
-- ---------------------------------------------------------------------------

-- ---------------------------------------------------------------------------
-- Catálogo de motivos de anulación (DGII, reporte 608)
-- ---------------------------------------------------------------------------

create table if not exists public.motivos_anulacion (
  id uuid primary key default gen_random_uuid(),
  nombre text not null unique,
  codigo_dgii text not null check (codigo_dgii in ('01', '02', '03', '04', '05', '06', '07', '08', '09', '10')),
  activo boolean not null default true,
  created_at timestamptz not null default now()
);

-- Nombres literales del diálogo de anulación de Alegra y código DGII oficial.
-- Discrepancia observada en Alegra (20-11-2026): exportó 'Devolución de productos' como 7;
-- decisión de Waldy: mapeo DGII oficial (Devolución = 06).
insert into public.motivos_anulacion (nombre, codigo_dgii)
values
  ('Deterioro de factura pre-impresa', '01'),
  ('Errores de impresión (factura pre-impresa)', '02'),
  ('Impresión defectuosa', '03'),
  ('Corrección de la información', '04'),
  ('Cambio de productos', '05'),
  ('Devolución de productos', '06'),
  ('Omisión de productos', '07'),
  ('Errores en secuencia de NCF', '08'),
  ('Por cese de operaciones', '09'),
  ('Pérdida o hurto de talonario(s)', '10')
on conflict (nombre) do nothing;

-- ---------------------------------------------------------------------------
-- Columnas de anulación en los documentos anulables
-- ---------------------------------------------------------------------------

alter table public.facturas
  add column if not exists fecha_anulacion date,
  add column if not exists motivo_anulacion_id uuid references public.motivos_anulacion (id);

alter table public.gastos_menores
  add column if not exists fecha_anulacion date,
  add column if not exists motivo_anulacion_id uuid references public.motivos_anulacion (id);

-- Trazabilidad futura: el motor todavía no anula notas de crédito de venta.
alter table public.notas_credito_venta
  add column if not exists fecha_anulacion date,
  add column if not exists motivo_anulacion_id uuid references public.motivos_anulacion (id);

-- ---------------------------------------------------------------------------
-- anular_documento: envuelve la versión vigente y persiste fecha y motivo
-- ---------------------------------------------------------------------------

alter function public.anular_documento(text, uuid)
  rename to _anular_documento_ajustes;

revoke all on function public._anular_documento_ajustes(text, uuid)
  from public, anon, authenticated;

create or replace function public.anular_documento(
  p_tipo text,
  p_id uuid,
  p_info jsonb default null
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_rol text;
  v_fecha_texto text;
  v_motivo_texto text;
  v_fecha date;
  v_motivo_id uuid;
  v_resultado uuid;
begin
  -- Compatibilidad total: sin p_info se comporta igual que antes.
  if p_info is null or jsonb_typeof(p_info) = 'null' then
    return public._anular_documento_ajustes(p_tipo, p_id);
  end if;

  v_rol := public.rol_actual();
  if v_rol is null or v_rol not in ('admin', 'contador') then
    raise exception 'sin permiso' using errcode = '42501';
  end if;

  if p_tipo is null or p_tipo not in ('factura', 'gasto_menor') then
    raise exception 'El tipo de documento no admite fecha y motivo de anulación.'
      using errcode = '22023';
  end if;

  v_fecha_texto := coalesce(
    nullif(p_info->>'fecha', ''),
    nullif(p_info->>'fecha_anulacion', '')
  );
  if v_fecha_texto is null or v_fecha_texto !~ '^\d{4}-\d{2}-\d{2}$' then
    raise exception 'La fecha de anulación no es válida.' using errcode = '22023';
  end if;

  begin
    v_fecha := v_fecha_texto::date;
  exception
    when others then
      raise exception 'La fecha de anulación no es válida.' using errcode = '22023';
  end;

  if v_fecha > current_date then
    raise exception 'La fecha de anulación no puede ser futura.' using errcode = '22023';
  end if;

  v_motivo_texto := coalesce(
    nullif(p_info->>'motivo', ''),
    nullif(p_info->>'motivo_anulacion_id', '')
  );
  if v_motivo_texto is null then
    raise exception 'El motivo de anulación no existe o está inactivo.' using errcode = '22023';
  end if;

  begin
    v_motivo_id := v_motivo_texto::uuid;
  exception
    when others then
      raise exception 'El motivo de anulación no existe o está inactivo.' using errcode = '22023';
  end;

  if not exists (
    select 1
    from public.motivos_anulacion m
    where m.id = v_motivo_id and m.activo
  ) then
    raise exception 'El motivo de anulación no existe o está inactivo.' using errcode = '22023';
  end if;

  -- Anulación real (estado, existencias y asiento de reversa): lógica vigente.
  v_resultado := public._anular_documento_ajustes(p_tipo, p_id);

  if p_tipo = 'factura' then
    update public.facturas
    set fecha_anulacion = v_fecha,
        motivo_anulacion_id = v_motivo_id
    where id = p_id;
  else
    update public.gastos_menores
    set fecha_anulacion = v_fecha,
        motivo_anulacion_id = v_motivo_id
    where id = p_id;
  end if;

  return v_resultado;
end;
$$;

-- ---------------------------------------------------------------------------
-- RLS y permisos
-- ---------------------------------------------------------------------------

alter table public.motivos_anulacion enable row level security;

revoke all on public.motivos_anulacion from anon;
revoke all on public.motivos_anulacion from authenticated;
grant select on public.motivos_anulacion to authenticated;

drop policy if exists motivos_anulacion_lectura on public.motivos_anulacion;
create policy motivos_anulacion_lectura on public.motivos_anulacion
  for select to authenticated
  using ((select public.rol_actual()) is not null);

revoke all on function public.anular_documento(text, uuid, jsonb)
  from public, anon, authenticated;
grant execute on function public.anular_documento(text, uuid, jsonb) to authenticated;
