-- ---------------------------------------------------------------------------
-- Plantillas de impresión por tipo de documento
--
-- Migración aditiva y reintentable. Guarda notas al pie, términos por defecto
-- y si se muestra el logo para factura, cotización y conduce. La factura es la
-- plantilla por defecto de cotización y conduce: la app usa sus valores cuando
-- esas plantillas no tienen notas ni términos propios.
-- RLS: authenticated lee; las escrituras van solo por RPC (admin o contador).
-- ---------------------------------------------------------------------------

create table if not exists public.plantillas_impresion (
  tipo_documento text primary key check (tipo_documento in ('factura', 'cotizacion', 'conduce')),
  notas_pie text,
  terminos text,
  mostrar_logo boolean not null default true,
  actualizado_en timestamptz not null default now()
);

insert into public.plantillas_impresion (tipo_documento, mostrar_logo)
values
  ('factura', true),
  ('cotizacion', true),
  ('conduce', true)
on conflict (tipo_documento) do nothing;

create or replace function public.guardar_plantilla_impresion(p jsonb)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_rol text;
  v_tipo text;
begin
  v_rol := public.rol_actual();
  if v_rol is null or v_rol not in ('admin', 'contador') then
    raise exception 'sin permiso' using errcode = '42501';
  end if;

  if p is null then
    raise exception 'datos de la plantilla requeridos' using errcode = '22023';
  end if;

  v_tipo := coalesce(nullif(trim(p->>'tipo_documento'), ''), '');
  if v_tipo not in ('factura', 'cotizacion', 'conduce') then
    raise exception 'tipo de documento inválido' using errcode = '22023';
  end if;

  insert into public.plantillas_impresion (tipo_documento, notas_pie, terminos, mostrar_logo, actualizado_en)
  values (
    v_tipo,
    nullif(trim(coalesce(p->>'notas_pie', '')), ''),
    nullif(trim(coalesce(p->>'terminos', '')), ''),
    coalesce((p->>'mostrar_logo')::boolean, true),
    now()
  )
  on conflict (tipo_documento) do update set
    notas_pie = excluded.notas_pie,
    terminos = excluded.terminos,
    mostrar_logo = excluded.mostrar_logo,
    actualizado_en = now();

  return v_tipo;
end;
$$;

-- ---------------------------------------------------------------------------
-- RLS y permisos
-- ---------------------------------------------------------------------------

alter table public.plantillas_impresion enable row level security;

revoke all on public.plantillas_impresion from anon;
revoke all on public.plantillas_impresion from authenticated;
grant select on public.plantillas_impresion to authenticated;

drop policy if exists plantillas_impresion_lectura on public.plantillas_impresion;
create policy plantillas_impresion_lectura on public.plantillas_impresion
  for select to authenticated
  using ((select public.rol_actual()) is not null);

revoke all on function public.guardar_plantilla_impresion(jsonb) from public, anon, authenticated;
grant execute on function public.guardar_plantilla_impresion(jsonb) to authenticated;
