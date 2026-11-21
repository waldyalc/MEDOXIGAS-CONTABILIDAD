-- Nómina RD: cierra la escritura directa en los cuatro catálogos.
--
-- La migración 20261125130000 dejó `grant select, insert, update` y políticas
-- `*_admin_escritura` (FOR ALL) para que el admin editara los catálogos desde
-- la app. Desde 20261125140000 existen las RPC `security definer`
-- (`nomina_guardar_config_empresa`, `nomina_guardar_mapeo_contable`,
-- `nomina_guardar_parametros_rd`, `nomina_crear_concepto`,
-- `nomina_actualizar_concepto`), así que la escritura directa sobra: el admin
-- solo debe poder leer; toda mutación pasa por RPC con validaciones.
--
-- Aditiva e idempotente: no toca datos ni estructuras, solo privilegios y una
-- política. Se puede reaplicar sin efectos.

do $$
declare
  v_tabla text;
begin
  foreach v_tabla in array array[
    'nomina_parametros_rd',
    'nomina_config_empresa',
    'nomina_conceptos',
    'nomina_mapeo_contable'
  ] loop
    execute format('drop policy if exists %I on public.%I', v_tabla || '_admin_escritura', v_tabla);
    execute format('revoke insert, update, delete on public.%I from anon', v_tabla);
    execute format('revoke insert, update, delete on public.%I from authenticated', v_tabla);
    execute format('grant select on public.%I to authenticated', v_tabla);
    execute format('alter table public.%I enable row level security', v_tabla);
  end loop;
end;
$$;
