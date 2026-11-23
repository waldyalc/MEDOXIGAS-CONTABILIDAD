-- Verificación de la migración aplicada (POS 10 — encabezado del ticket 80 mm):
-- empresa.sucursal y empresa.regimen para el encabezado estilo Alegra.
--
-- APLICADA. La migración real vive en
-- supabase/migrations/20261126121000_empresa_sucursal_regimen.sql y ya está
-- registrada en supabase_migrations.schema_migrations del proyecto
-- ljfdhrnvlsfaweuvnqxz (es la última versión aplicada). El código envía
-- sucursal/regimen en el JSON de actualizar_empresa y esta versión los guarda.
-- Este archivo queda como verificación reproducible dentro de BEGIN/ROLLBACK:
-- no aplica nada al ejecutarlo.

begin;

alter table public.empresa
  add column if not exists sucursal text null,
  add column if not exists regimen text null;

create or replace function public.actualizar_empresa(p jsonb)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_rol text;
  v_nombre text;
begin
  v_rol := public.rol_actual();
  if v_rol is null or v_rol <> 'admin' then
    raise exception 'sin permiso' using errcode = '42501';
  end if;

  if p is null then
    raise exception 'datos de la empresa requeridos' using errcode = '22023';
  end if;

  v_nombre := trim(coalesce(p->>'nombre', ''));
  if v_nombre = '' then
    raise exception 'el nombre de la empresa es obligatorio' using errcode = '22023';
  end if;

  update public.empresa
  set nombre = v_nombre,
      rnc = nullif(trim(coalesce(p->>'rnc', '')), ''),
      sucursal = nullif(trim(coalesce(p->>'sucursal', '')), ''),
      regimen = nullif(trim(coalesce(p->>'regimen', '')), ''),
      direccion = nullif(trim(coalesce(p->>'direccion', '')), ''),
      telefono = nullif(trim(coalesce(p->>'telefono', '')), ''),
      correo = nullif(trim(coalesce(p->>'correo', '')), ''),
      logo_url = nullif(trim(coalesce(p->>'logo_url', '')), '')
  where id = 1;
end;
$$;

-- Verificación dentro de la transacción (debe listar las dos columnas y la
-- función actualizada; con ROLLBACK no queda nada aplicado).
select column_name, data_type
  from information_schema.columns
 where table_schema = 'public'
   and table_name = 'empresa'
   and column_name in ('sucursal', 'regimen')
 order by column_name;

rollback;
