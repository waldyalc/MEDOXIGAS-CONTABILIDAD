-- e-CF DGII: RPC seguras para guardar certificados cifrados y leer secretos de firma.
--
-- Migración aditiva y reintentable. No modifica datos existentes ni abre SELECT
-- directo sobre `cert_cifrado` / `cert_pass_cifrada`: la escritura la controla
-- solo `admin` y la lectura del secreto queda detrás de una RPC security definer
-- limitada a `admin`/`contador` para uso exclusivo del servidor de firma.

create or replace function public.guardar_ecf_certificado(
  p_rnc text,
  p_razon_social text,
  p_ambiente text default 'testecf',
  p_activo boolean default false,
  p_dominio_base text default null,
  p_cert_cifrado text default null,
  p_cert_pass_cifrada text default null,
  p_cert_titular text default null,
  p_cert_numero_serie text default null,
  p_cert_valido_hasta timestamptz default null,
  p_cert_huella_sha256 text default null
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_resultado jsonb;
begin
  if public.rol_actual() is distinct from 'admin' then
    raise exception 'Solo administradores pueden configurar certificados e-CF' using errcode = '42501';
  end if;

  if (p_cert_cifrado is null) is distinct from (p_cert_pass_cifrada is null) then
    raise exception 'El certificado cifrado y su contraseña cifrada deben guardarse juntos' using errcode = '22023';
  end if;

  insert into public.ecf_config as destino (
    rnc,
    razon_social,
    ambiente,
    activo,
    dominio_base,
    cert_cifrado,
    cert_pass_cifrada,
    cert_titular,
    cert_numero_serie,
    cert_valido_hasta,
    cert_huella_sha256,
    updated_at,
    updated_by
  ) values (
    btrim(p_rnc),
    btrim(p_razon_social),
    coalesce(p_ambiente, 'testecf'),
    coalesce(p_activo, false),
    nullif(btrim(p_dominio_base), ''),
    nullif(btrim(p_cert_cifrado), ''),
    nullif(btrim(p_cert_pass_cifrada), ''),
    nullif(btrim(p_cert_titular), ''),
    nullif(btrim(p_cert_numero_serie), ''),
    p_cert_valido_hasta,
    nullif(btrim(p_cert_huella_sha256), ''),
    now(),
    auth.uid()
  )
  on conflict (rnc) do update set
    razon_social = excluded.razon_social,
    ambiente = excluded.ambiente,
    activo = excluded.activo,
    dominio_base = excluded.dominio_base,
    cert_cifrado = coalesce(excluded.cert_cifrado, destino.cert_cifrado),
    cert_pass_cifrada = coalesce(excluded.cert_pass_cifrada, destino.cert_pass_cifrada),
    cert_titular = coalesce(excluded.cert_titular, destino.cert_titular),
    cert_numero_serie = coalesce(excluded.cert_numero_serie, destino.cert_numero_serie),
    cert_valido_hasta = coalesce(excluded.cert_valido_hasta, destino.cert_valido_hasta),
    cert_huella_sha256 = coalesce(excluded.cert_huella_sha256, destino.cert_huella_sha256),
    updated_at = now(),
    updated_by = auth.uid()
  returning jsonb_build_object(
    'rnc', destino.rnc,
    'razon_social', destino.razon_social,
    'ambiente', destino.ambiente,
    'activo', destino.activo,
    'dominio_base', destino.dominio_base,
    'cert_titular', destino.cert_titular,
    'cert_numero_serie', destino.cert_numero_serie,
    'cert_valido_hasta', destino.cert_valido_hasta,
    'cert_huella_sha256', destino.cert_huella_sha256,
    'tiene_certificado', destino.cert_cifrado is not null and destino.cert_pass_cifrada is not null,
    'updated_at', destino.updated_at
  ) into v_resultado;

  return v_resultado;
end;
$$;

comment on function public.guardar_ecf_certificado(text, text, text, boolean, text, text, text, text, text, timestamptz, text)
  is 'Guarda configuración e-CF y certificado cifrado por RNC; retorna solo metadatos no sensibles.';

revoke all on function public.guardar_ecf_certificado(text, text, text, boolean, text, text, text, text, text, timestamptz, text)
  from public, anon, authenticated;
grant execute on function public.guardar_ecf_certificado(text, text, text, boolean, text, text, text, text, text, timestamptz, text)
  to authenticated;

create or replace function public.obtener_ecf_secreto_firma(p_rnc text)
returns table (
  rnc text,
  razon_social text,
  ambiente text,
  activo boolean,
  cert_cifrado text,
  cert_pass_cifrada text
)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if public.rol_actual() is null or public.rol_actual() not in ('admin', 'contador') then
    raise exception 'Sin permisos para firmar comprobantes electrónicos' using errcode = '42501';
  end if;

  return query
  select
    c.rnc,
    c.razon_social,
    c.ambiente,
    c.activo,
    c.cert_cifrado,
    c.cert_pass_cifrada
  from public.ecf_config c
  where c.rnc = btrim(p_rnc);
end;
$$;

comment on function public.obtener_ecf_secreto_firma(text)
  is 'Devuelve el secreto cifrado de firma e-CF solo a admin/contador para que el servidor lo descifre en memoria.';

revoke all on function public.obtener_ecf_secreto_firma(text)
  from public, anon, authenticated;
grant execute on function public.obtener_ecf_secreto_firma(text)
  to authenticated;
