-- ---------------------------------------------------------------------------
-- Busqueda global: arregla el desplazamiento en modo categoria.
--
-- La migracion 20261119100000 (plan B) corta cada rama en LIMIT 201 filas
-- ANTES de numerar rn: con desplazamiento >= 200 la ventana
-- (rn > desplazamiento) solo puede ver la fila 201, asi que pedir la pagina
-- 2 devolvia 1 sola fila en vez de las que quedaban.
--
-- Ademas el LIMIT se aplicaba SIN order by: el subconjunto traído era
-- arbitrario y cambiaba entre llamadas, así que dos páginas podían repetir
-- filas. Cada rama ahora ordena igual que la ventana rn antes de cortar:
-- rango, en_rango, cercanía de monto, fecha, numero e id.
--
-- El tope crece con la página pedida: greatest(desplazamiento +
-- limite + 1, 201). Sin desplazamiento el cap sigue siendo 201 (el rail
-- muestra "200+" igual que antes) y pedir páginas profundas sigue acotado.
--
-- Es SOLO un create or replace: no crea tablas, no toca datos ni politicas;
-- mismo contrato JSON ({grupos, total, hayMas, ms}) y mismos permisos.
-- ---------------------------------------------------------------------------

create or replace function public.buscar_global(p jsonb)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_entidad text;
  v_texto text;
  v_texto_like text;
  v_prefijo text;
  v_patron text;
  v_ncf text;
  v_numero int;
  v_identificacion text;
  v_desde date;
  v_hasta date;
  v_monto numeric;
  v_incluir_anulados boolean;
  v_limite int;
  v_desplazamiento int;
  v_inicio timestamptz;
  -- Forma del término, para las compuertas de rama (punto 4 del encabezado).
  v_parece_ncf boolean;      -- letra + 2 dígitos + 8 alfanuméricos
  v_parece_rnc boolean;      -- 9 a 11 dígitos (RNC, cédula o teléfono)
  v_hay_digitos boolean;     -- el texto lleva al menos un dígito
  v_solo_contactos boolean;  -- parece RNC y no hay señal de documento
begin
  -- Guard obligatorio: security definer salta RLS; sin perfil no se busca.
  if (select public.rol_actual()) is null then
    raise exception 'sin permiso' using errcode = '42501';
  end if;

  -- Parámetros defensivos: el borde de la app valida con zod, aquí no se
  -- confía en nada. Texto menor a 2 caracteres no busca (§3.5).
  v_entidad := case
    when p->>'entidad' = any(array[
      'contacto', 'producto', 'factura', 'nota_credito_venta', 'nota_debito_venta',
      'cotizacion', 'remision', 'factura_recurrente', 'pago_recibido',
      'factura_proveedor', 'nota_credito_compra', 'orden_compra', 'pago_proveedor',
      'gasto_menor', 'asiento', 'cuenta',
      'clientes', 'productos', 'facturacion', 'compras', 'documentos', 'otros'])
    then p->>'entidad' else null end;

  v_texto := case
    when char_length(btrim(coalesce(p->>'texto', ''))) >= 2
      then public.normalizar(btrim(p->>'texto'))
    else null end;

  -- Se escapan los comodines del LIKE para que % y _ del usuario busquen
  -- literal (v_texto, sin escapar, se usa para las igualdades exactas).
  v_texto_like := case when v_texto is null then null else
    replace(replace(replace(v_texto, '\', '\\'), '%', '\%'), '_', '\_') end;
  v_prefijo := case when v_texto_like is null then null else v_texto_like || '%' end;
  v_patron := case when v_texto_like is null then null else '%' || v_texto_like || '%' end;

  v_ncf := nullif(upper(btrim(coalesce(p->>'ncf', ''))), '');
  v_numero := case when coalesce(p->>'numero', '') ~ '^\d{1,6}$' then (p->>'numero')::int else null end;
  v_identificacion := nullif(regexp_replace(coalesce(p->>'identificacion', ''), '\D', '', 'g'), '');
  v_desde := case when p->>'desde' ~ '^\d{4}-\d{2}-\d{2}$' then (p->>'desde')::date else null end;
  v_hasta := case when p->>'hasta' ~ '^\d{4}-\d{2}-\d{2}$' then (p->>'hasta')::date else null end;
  v_monto := case when p->>'monto' ~ '^\d+(\.\d{1,2})?$' then (p->>'monto')::numeric else null end;
  v_incluir_anulados := case p->>'incluir_anulados' when 'false' then false else true end;

  -- Compuertas por forma del término (v_texto ya está normalizado: minúsculas
  -- y sin acentos, los dígitos no cambian).
  v_parece_ncf := v_texto is not null and v_texto ~ '^[a-z][0-9]{2}[a-z0-9]{8}$';
  v_parece_rnc := v_texto is not null and v_texto ~ '^[0-9]{9,11}$';
  v_hay_digitos := v_texto is not null and v_texto ~ '[0-9]';
  v_solo_contactos := v_parece_rnc
    and v_ncf is null and v_numero is null and v_identificacion is null;

  -- 4 por grupo en modo todos, 20 en modo categoría, tope duro 200 (§3.5).
  v_limite := greatest(least(coalesce(
    case when p->>'limite' ~ '^\d+$' then (p->>'limite')::int end,
    case when v_entidad is null then 4 else 20 end), 200), 1);

  -- El desplazamiento solo pagina en modo categoría.
  v_desplazamiento := case when v_entidad is null then 0 else
    greatest(coalesce(case when p->>'desplazamiento' ~ '^\d+$' then (p->>'desplazamiento')::int end, 0), 0)
  end;

  -- Sin ninguna señal que buscar no se toca la base.
  if v_texto is null and v_ncf is null and v_numero is null and v_identificacion is null then
    return jsonb_build_object('grupos', '[]'::jsonb, 'total', 0, 'hayMas', false, 'ms', 0);
  end if;

  v_inicio := clock_timestamp();

  return (
    with coincidencias as (

      -- 1 · contacto (primaria: se busca en modo "todos") --------------------
      select r.*
      from (select 1 as pasa
            where (v_entidad is null or v_entidad = 'contacto' or v_entidad = 'clientes')
              and (v_texto is not null or v_identificacion is not null)
              and not v_parece_ncf) g
      cross join lateral (
        select *
        from (
        select
          'contacto'::text as entidad,
          c.id,
          c.nombre as titulo,
          coalesce(nullif(c.rnc_cedula, ''), coalesce(c.telefono, '')) as subtitulo,
          to_jsonb(array[c.tipo]) as etiquetas,
          null::text as estado,
          (c.creado_en at time zone 'America/Santo_Domingo')::date as fecha,
          null::numeric as monto,
          null::int as numero,
          case
            when (v_identificacion is not null and c.rnc_cedula = v_identificacion)
              or (v_parece_rnc and c.rnc_cedula = v_texto)
              or (v_texto is not null and regexp_replace(c.telefono, '\D', '', 'g') = v_texto)
              then 1
            when v_texto is not null and public.normalizar(c.nombre) like v_prefijo then 2
            when v_texto is not null and public.normalizar(c.nombre) like v_patron then 3
            else 4
          end as rango
        from public.contactos c
        where g.pasa = 1
          and (
            (v_identificacion is not null and c.rnc_cedula = v_identificacion)
            or (v_parece_rnc and c.rnc_cedula = v_texto)
            or (v_texto is not null and (
              public.normalizar(c.nombre) like v_patron
              or public.normalizar(coalesce(c.correo, '')) like v_patron
              or public.normalizar(coalesce(c.municipio_provincia, '')) like v_patron
              or regexp_replace(c.telefono, '\D', '', 'g') like v_patron
            ))
          )
          and (v_entidad is null or (
            (v_desde is null or (c.creado_en at time zone 'America/Santo_Domingo')::date >= v_desde)
            and (v_hasta is null or (c.creado_en at time zone 'America/Santo_Domingo')::date <= v_hasta)
          ))
                ) s
        order by
          s.rango asc,
          (s.fecha >= coalesce(v_desde, '-infinity'::date)
            and s.fecha <= coalesce(v_hasta, 'infinity'::date)) desc nulls last,
          case when v_monto is null then 0 else abs(coalesce(s.monto, 0) - v_monto) end asc,
          s.fecha desc nulls last,
          s.numero desc nulls last,
          s.id asc
        limit greatest(v_desplazamiento + v_limite + 1, 201)
      ) r

      union all

      -- 2 · producto (primaria) -----------------------------------------------
      select r.*
      from (select 1 as pasa
            where (v_entidad is null or v_entidad = 'producto' or v_entidad = 'productos')
              and v_texto is not null
              and not v_parece_ncf
              and not v_parece_rnc) g
      cross join lateral (
        select *
        from (
        select
          'producto'::text as entidad,
          po.id,
          po.nombre as titulo,
          coalesce(po.referencia, '') as subtitulo,
          to_jsonb(array[po.tipo]) as etiquetas,
          null::text as estado,
          (po.creado_en at time zone 'America/Santo_Domingo')::date as fecha,
          po.precio as monto,
          null::int as numero,
          case
            when public.normalizar(coalesce(po.referencia, '')) = v_texto then 1
            when public.normalizar(po.nombre) like v_prefijo
              or public.normalizar(coalesce(po.referencia, '')) like v_prefijo then 2
            when public.normalizar(po.nombre) like v_patron
              or public.normalizar(coalesce(po.referencia, '')) like v_patron then 3
            else 4
          end as rango
        from public.productos po
        where g.pasa = 1
          and (
            public.normalizar(po.nombre) like v_patron
            or public.normalizar(coalesce(po.referencia, '')) like v_patron
            or public.normalizar(coalesce(po.descripcion, '')) like v_patron
          )
          and (v_entidad is null or (
            (v_desde is null or (po.creado_en at time zone 'America/Santo_Domingo')::date >= v_desde)
            and (v_hasta is null or (po.creado_en at time zone 'America/Santo_Domingo')::date <= v_hasta)
          ))
                ) s
        order by
          s.rango asc,
          (s.fecha >= coalesce(v_desde, '-infinity'::date)
            and s.fecha <= coalesce(v_hasta, 'infinity'::date)) desc nulls last,
          case when v_monto is null then 0 else abs(coalesce(s.monto, 0) - v_monto) end asc,
          s.fecha desc nulls last,
          s.numero desc nulls last,
          s.id asc
        limit greatest(v_desplazamiento + v_limite + 1, 201)
      ) r

      union all

      -- 3 · factura de venta (primaria) ---------------------------------------
      select r.*
      from (select 1 as pasa
            where (v_entidad is null or v_entidad = 'factura' or v_entidad = 'facturacion')
              and (v_texto is not null or v_ncf is not null or v_numero is not null or v_identificacion is not null)
              and not v_solo_contactos) g
      cross join lateral (
        select *
        from (
        select
          'factura'::text as entidad,
          f.id,
          f.ncf as titulo,
          ct.nombre as subtitulo,
          to_jsonb(array[f.tipo_comprobante]) as etiquetas,
          f.estado,
          f.fecha,
          f.total as monto,
          f.numero,
          case
            when (v_ncf is not null and f.ncf = v_ncf)
              or (v_numero is not null and f.numero = v_numero)
              then 1
            when v_hay_digitos and public.normalizar(f.ncf) like v_prefijo then 2
            when v_hay_digitos and public.normalizar(f.ncf) like v_patron then 3
            when public.normalizar(coalesce(f.notas, '')) like v_patron
              or public.normalizar(coalesce(f.terminos, '')) like v_patron
              or public.normalizar(coalesce(f.pie, '')) like v_patron then 4
            else 5
          end as rango
        from public.facturas f
        join public.contactos ct on ct.id = f.contacto_id
        where g.pasa = 1
          and (
            (v_ncf is not null and f.ncf = v_ncf)
            or (v_numero is not null and f.numero = v_numero)
            or (v_identificacion is not null and ct.rnc_cedula = v_identificacion)
            or (v_texto is not null and (
              (v_hay_digitos and public.normalizar(f.ncf) like v_patron)
              or public.normalizar(coalesce(f.notas, '')) like v_patron
              or public.normalizar(coalesce(f.terminos, '')) like v_patron
              or public.normalizar(coalesce(f.pie, '')) like v_patron
              or public.normalizar(ct.nombre) like v_patron
            ))
          )
          and (v_incluir_anulados or f.estado <> 'anulada')
          and (v_entidad is null or (
            (v_desde is null or f.fecha >= v_desde)
            and (v_hasta is null or f.fecha <= v_hasta)
          ))
                ) s
        order by
          s.rango asc,
          (s.fecha >= coalesce(v_desde, '-infinity'::date)
            and s.fecha <= coalesce(v_hasta, 'infinity'::date)) desc nulls last,
          case when v_monto is null then 0 else abs(coalesce(s.monto, 0) - v_monto) end asc,
          s.fecha desc nulls last,
          s.numero desc nulls last,
          s.id asc
        limit greatest(v_desplazamiento + v_limite + 1, 201)
      ) r

      union all

      -- 4 · nota de crédito de venta (primaria) -------------------------------
      select r.*
      from (select 1 as pasa
            where (v_entidad is null or v_entidad = 'nota_credito_venta' or v_entidad = 'facturacion')
              and (v_texto is not null or v_ncf is not null or v_numero is not null or v_identificacion is not null)
              and not v_solo_contactos) g
      cross join lateral (
        select *
        from (
        select
          'nota_credito_venta'::text as entidad,
          nc.id,
          nc.ncf as titulo,
          ct.nombre as subtitulo,
          '[]'::jsonb as etiquetas,
          nc.estado,
          nc.fecha,
          nc.total as monto,
          nc.numero,
          case
            when (v_ncf is not null and (nc.ncf = v_ncf or fa.ncf = v_ncf))
              or (v_numero is not null and nc.numero = v_numero)
              then 1
            when v_hay_digitos and public.normalizar(nc.ncf) like v_prefijo then 2
            when v_hay_digitos and public.normalizar(nc.ncf) like v_patron then 3
            when public.normalizar(coalesce(nc.notas, '')) like v_patron then 4
            else 5
          end as rango
        from public.notas_credito_venta nc
        join public.contactos ct on ct.id = nc.contacto_id
        left join public.facturas fa on fa.id = nc.factura_id
        where g.pasa = 1
          and (
            (v_ncf is not null and (nc.ncf = v_ncf or fa.ncf = v_ncf))
            or (v_numero is not null and nc.numero = v_numero)
            or (v_identificacion is not null and ct.rnc_cedula = v_identificacion)
            or (v_texto is not null and (
              (v_hay_digitos and public.normalizar(nc.ncf) like v_patron)
              or public.normalizar(coalesce(nc.notas, '')) like v_patron
              or (v_hay_digitos and fa.ncf is not null and public.normalizar(fa.ncf) like v_patron)
              or public.normalizar(ct.nombre) like v_patron
            ))
          )
          and (v_incluir_anulados or nc.estado <> 'anulada')
          and (v_entidad is null or (
            (v_desde is null or nc.fecha >= v_desde)
            and (v_hasta is null or nc.fecha <= v_hasta)
          ))
                ) s
        order by
          s.rango asc,
          (s.fecha >= coalesce(v_desde, '-infinity'::date)
            and s.fecha <= coalesce(v_hasta, 'infinity'::date)) desc nulls last,
          case when v_monto is null then 0 else abs(coalesce(s.monto, 0) - v_monto) end asc,
          s.fecha desc nulls last,
          s.numero desc nulls last,
          s.id asc
        limit greatest(v_desplazamiento + v_limite + 1, 201)
      ) r

      union all

      -- 5 · nota de débito de venta (solo con p.entidad) ------------------------
      select r.*
      from (select 1 as pasa
            where (v_entidad = 'nota_debito_venta' or v_entidad = 'facturacion')
              and (v_texto is not null or v_ncf is not null or v_numero is not null or v_identificacion is not null)
              and not v_solo_contactos) g
      cross join lateral (
        select *
        from (
        select
          'nota_debito_venta'::text as entidad,
          nd.id,
          nd.ncf as titulo,
          ct.nombre as subtitulo,
          '[]'::jsonb as etiquetas,
          nd.estado,
          nd.fecha,
          nd.total as monto,
          nd.numero,
          case
            when (v_ncf is not null and (nd.ncf = v_ncf or fa.ncf = v_ncf))
              or (v_numero is not null and nd.numero = v_numero)
              then 1
            when v_hay_digitos and public.normalizar(nd.ncf) like v_prefijo then 2
            when v_hay_digitos and public.normalizar(nd.ncf) like v_patron then 3
            when public.normalizar(coalesce(nd.notas, '')) like v_patron then 4
            else 5
          end as rango
        from public.notas_debito_venta nd
        join public.contactos ct on ct.id = nd.contacto_id
        left join public.facturas fa on fa.id = nd.factura_id
        where g.pasa = 1
          and (
            (v_ncf is not null and (nd.ncf = v_ncf or fa.ncf = v_ncf))
            or (v_numero is not null and nd.numero = v_numero)
            or (v_identificacion is not null and ct.rnc_cedula = v_identificacion)
            or (v_texto is not null and (
              (v_hay_digitos and public.normalizar(nd.ncf) like v_patron)
              or public.normalizar(coalesce(nd.notas, '')) like v_patron
              or (v_hay_digitos and fa.ncf is not null and public.normalizar(fa.ncf) like v_patron)
              or public.normalizar(ct.nombre) like v_patron
            ))
          )
          and (v_incluir_anulados or nd.estado <> 'anulada')
          and (v_entidad is null or (
            (v_desde is null or nd.fecha >= v_desde)
            and (v_hasta is null or nd.fecha <= v_hasta)
          ))
                ) s
        order by
          s.rango asc,
          (s.fecha >= coalesce(v_desde, '-infinity'::date)
            and s.fecha <= coalesce(v_hasta, 'infinity'::date)) desc nulls last,
          case when v_monto is null then 0 else abs(coalesce(s.monto, 0) - v_monto) end asc,
          s.fecha desc nulls last,
          s.numero desc nulls last,
          s.id asc
        limit greatest(v_desplazamiento + v_limite + 1, 201)
      ) r

      union all

      -- 6 · cotización (solo con p.entidad) --------------------------------------
      select r.*
      from (select 1 as pasa
            where (v_entidad = 'cotizacion' or v_entidad = 'facturacion')
              and (v_texto is not null or v_numero is not null or v_identificacion is not null)
              and not v_solo_contactos) g
      cross join lateral (
        select *
        from (
        select
          'cotizacion'::text as entidad,
          q.id,
          q.numero::text as titulo,
          ct.nombre as subtitulo,
          '[]'::jsonb as etiquetas,
          q.estado,
          q.fecha,
          q.total as monto,
          q.numero,
          case
            when v_numero is not null and q.numero = v_numero then 1
            when public.normalizar(coalesce(q.notas, '')) like v_patron then 4
            else 5
          end as rango
        from public.cotizaciones q
        join public.contactos ct on ct.id = q.contacto_id
        where g.pasa = 1
          and (
            (v_numero is not null and q.numero = v_numero)
            or (v_identificacion is not null and ct.rnc_cedula = v_identificacion)
            or (v_texto is not null and (
              public.normalizar(coalesce(q.notas, '')) like v_patron
              or public.normalizar(ct.nombre) like v_patron
            ))
          )
          and (v_incluir_anulados or q.estado <> 'anulada')
          and (v_entidad is null or (
            (v_desde is null or q.fecha >= v_desde)
            and (v_hasta is null or q.fecha <= v_hasta)
          ))
                ) s
        order by
          s.rango asc,
          (s.fecha >= coalesce(v_desde, '-infinity'::date)
            and s.fecha <= coalesce(v_hasta, 'infinity'::date)) desc nulls last,
          case when v_monto is null then 0 else abs(coalesce(s.monto, 0) - v_monto) end asc,
          s.fecha desc nulls last,
          s.numero desc nulls last,
          s.id asc
        limit greatest(v_desplazamiento + v_limite + 1, 201)
      ) r

      union all

      -- 7 · remisión / conduce (solo con p.entidad) ------------------------------
      select r.*
      from (select 1 as pasa
            where (v_entidad = 'remision' or v_entidad = 'facturacion')
              and (v_texto is not null or v_numero is not null or v_identificacion is not null)
              and not v_solo_contactos) g
      cross join lateral (
        select *
        from (
        select
          'remision'::text as entidad,
          rm.id,
          rm.numero::text as titulo,
          ct.nombre as subtitulo,
          '[]'::jsonb as etiquetas,
          rm.estado,
          rm.fecha,
          rm.total as monto,
          rm.numero,
          case
            when v_numero is not null and rm.numero = v_numero then 1
            when public.normalizar(coalesce(rm.notas, '')) like v_patron then 4
            else 5
          end as rango
        from public.remisiones rm
        join public.contactos ct on ct.id = rm.contacto_id
        where g.pasa = 1
          and (
            (v_numero is not null and rm.numero = v_numero)
            or (v_identificacion is not null and ct.rnc_cedula = v_identificacion)
            or (v_texto is not null and (
              public.normalizar(coalesce(rm.notas, '')) like v_patron
              or public.normalizar(ct.nombre) like v_patron
            ))
          )
          and (v_incluir_anulados or rm.estado <> 'anulada')
          and (v_entidad is null or (
            (v_desde is null or rm.fecha >= v_desde)
            and (v_hasta is null or rm.fecha <= v_hasta)
          ))
                ) s
        order by
          s.rango asc,
          (s.fecha >= coalesce(v_desde, '-infinity'::date)
            and s.fecha <= coalesce(v_hasta, 'infinity'::date)) desc nulls last,
          case when v_monto is null then 0 else abs(coalesce(s.monto, 0) - v_monto) end asc,
          s.fecha desc nulls last,
          s.numero desc nulls last,
          s.id asc
        limit greatest(v_desplazamiento + v_limite + 1, 201)
      ) r

      union all

      -- 8 · factura recurrente / plantilla (solo con p.entidad) -------------------
      select r.*
      from (select 1 as pasa
            where (v_entidad = 'factura_recurrente' or v_entidad = 'facturacion')
              and (v_texto is not null or v_numero is not null or v_identificacion is not null)
              and not v_solo_contactos) g
      cross join lateral (
        select *
        from (
        select
          'factura_recurrente'::text as entidad,
          fr.id,
          fr.numero::text as titulo,
          ct.nombre as subtitulo,
          to_jsonb(array[
            'cada ' || fr.frecuencia_meses::text
            || case when fr.frecuencia_meses = 1 then ' mes' else ' meses' end
          ]) as etiquetas,
          null::text as estado,
          fr.fecha_inicio as fecha,
          null::numeric as monto,
          fr.numero,
          case
            when v_numero is not null and fr.numero = v_numero then 1
            when public.normalizar(coalesce(fr.notas, '')) like v_patron
              or public.normalizar(coalesce(fr.terminos, '')) like v_patron
              or public.normalizar(coalesce(fr.pie, '')) like v_patron then 4
            else 5
          end as rango
        from public.facturas_recurrentes fr
        join public.contactos ct on ct.id = fr.contacto_id
        where g.pasa = 1
          and (
            (v_numero is not null and fr.numero = v_numero)
            or (v_identificacion is not null and ct.rnc_cedula = v_identificacion)
            or (v_texto is not null and (
              public.normalizar(coalesce(fr.notas, '')) like v_patron
              or public.normalizar(coalesce(fr.terminos, '')) like v_patron
              or public.normalizar(coalesce(fr.pie, '')) like v_patron
              or public.normalizar(ct.nombre) like v_patron
            ))
          )
          and (v_entidad is null or (
            (v_desde is null or fr.fecha_inicio >= v_desde)
            and (v_hasta is null or fr.fecha_inicio <= v_hasta)
          ))
                ) s
        order by
          s.rango asc,
          (s.fecha >= coalesce(v_desde, '-infinity'::date)
            and s.fecha <= coalesce(v_hasta, 'infinity'::date)) desc nulls last,
          case when v_monto is null then 0 else abs(coalesce(s.monto, 0) - v_monto) end asc,
          s.fecha desc nulls last,
          s.numero desc nulls last,
          s.id asc
        limit greatest(v_desplazamiento + v_limite + 1, 201)
      ) r

      union all

      -- 9 · pago recibido (primaria) --------------------------------------------
      select r.*
      from (select 1 as pasa
            where (v_entidad is null or v_entidad = 'pago_recibido' or v_entidad = 'facturacion')
              and (v_texto is not null or v_numero is not null or v_ncf is not null or v_identificacion is not null)
              and not v_solo_contactos) g
      cross join lateral (
        select *
        from (
        select
          'pago_recibido'::text as entidad,
          pr.id,
          pr.numero::text as titulo,
          ct.nombre as subtitulo,
          to_jsonb(array[pr.metodo]) as etiquetas,
          pr.estado,
          pr.fecha,
          pr.monto,
          pr.numero,
          case
            when v_numero is not null and pr.numero = v_numero then 1
            when public.normalizar(coalesce(pr.notas, '')) like v_patron then 4
            else 5
          end as rango
        from public.pagos_recibidos pr
        join public.contactos ct on ct.id = pr.contacto_id
        left join public.facturas fa on fa.id = pr.factura_id
        where g.pasa = 1
          and (
            (v_numero is not null and pr.numero = v_numero)
            or (v_identificacion is not null and ct.rnc_cedula = v_identificacion)
            or (v_ncf is not null and (
              fa.ncf = v_ncf
              or pr.id in (
                select pa.pago_id
                from public.pago_recibido_aplicaciones pa
                join public.facturas fa2 on fa2.id = pa.factura_id
                where fa2.ncf = v_ncf
              )
            ))
            or (v_texto is not null and (
              public.normalizar(coalesce(pr.notas, '')) like v_patron
              or (v_hay_digitos and fa.ncf is not null and public.normalizar(fa.ncf) like v_patron)
              or public.normalizar(ct.nombre) like v_patron
            ))
          )
          and (v_incluir_anulados or pr.estado <> 'anulado')
          and (v_entidad is null or (
            (v_desde is null or pr.fecha >= v_desde)
            and (v_hasta is null or pr.fecha <= v_hasta)
          ))
                ) s
        order by
          s.rango asc,
          (s.fecha >= coalesce(v_desde, '-infinity'::date)
            and s.fecha <= coalesce(v_hasta, 'infinity'::date)) desc nulls last,
          case when v_monto is null then 0 else abs(coalesce(s.monto, 0) - v_monto) end asc,
          s.fecha desc nulls last,
          s.numero desc nulls last,
          s.id asc
        limit greatest(v_desplazamiento + v_limite + 1, 201)
      ) r

      union all

      -- 10 · factura de proveedor / compra (primaria) -----------------------------
      select r.*
      from (select 1 as pasa
            where (v_entidad is null or v_entidad = 'factura_proveedor' or v_entidad = 'compras')
              and (v_texto is not null or v_ncf is not null or v_numero is not null or v_identificacion is not null)
              and not v_solo_contactos) g
      cross join lateral (
        select *
        from (
        select
          'factura_proveedor'::text as entidad,
          fp.id,
          fp.numero::text as titulo,
          ct.nombre as subtitulo,
          '[]'::jsonb as etiquetas,
          fp.estado,
          fp.fecha,
          fp.total as monto,
          fp.numero,
          case
            when (v_ncf is not null and fp.ncf = v_ncf)
              or (v_numero is not null and fp.numero = v_numero)
              then 1
            when v_hay_digitos and public.normalizar(coalesce(fp.ncf, '')) like v_prefijo then 2
            when v_hay_digitos and public.normalizar(coalesce(fp.ncf, '')) like v_patron then 3
            when public.normalizar(coalesce(fp.notas, '')) like v_patron then 4
            else 5
          end as rango
        from public.facturas_proveedor fp
        join public.contactos ct on ct.id = fp.contacto_id
        where g.pasa = 1
          and (
            (v_ncf is not null and fp.ncf = v_ncf)
            or (v_numero is not null and fp.numero = v_numero)
            or (v_identificacion is not null and ct.rnc_cedula = v_identificacion)
            or (v_texto is not null and (
              (v_hay_digitos and public.normalizar(coalesce(fp.ncf, '')) like v_patron)
              or public.normalizar(coalesce(fp.notas, '')) like v_patron
              or public.normalizar(ct.nombre) like v_patron
            ))
          )
          and (v_incluir_anulados or fp.estado <> 'anulada')
          and (v_entidad is null or (
            (v_desde is null or fp.fecha >= v_desde)
            and (v_hasta is null or fp.fecha <= v_hasta)
          ))
                ) s
        order by
          s.rango asc,
          (s.fecha >= coalesce(v_desde, '-infinity'::date)
            and s.fecha <= coalesce(v_hasta, 'infinity'::date)) desc nulls last,
          case when v_monto is null then 0 else abs(coalesce(s.monto, 0) - v_monto) end asc,
          s.fecha desc nulls last,
          s.numero desc nulls last,
          s.id asc
        limit greatest(v_desplazamiento + v_limite + 1, 201)
      ) r

      union all

      -- 11 · nota de crédito de compra (solo con p.entidad) ------------------------
      select r.*
      from (select 1 as pasa
            where (v_entidad = 'nota_credito_compra' or v_entidad = 'compras')
              and (v_texto is not null or v_ncf is not null or v_numero is not null or v_identificacion is not null)
              and not v_solo_contactos) g
      cross join lateral (
        select *
        from (
        select
          'nota_credito_compra'::text as entidad,
          ncc.id,
          ncc.ncf as titulo,
          ct.nombre as subtitulo,
          '[]'::jsonb as etiquetas,
          ncc.estado,
          ncc.fecha,
          ncc.total as monto,
          ncc.numero,
          case
            when (v_ncf is not null and (ncc.ncf = v_ncf or fp.ncf = v_ncf))
              or (v_numero is not null and ncc.numero = v_numero)
              then 1
            when v_hay_digitos and public.normalizar(ncc.ncf) like v_prefijo then 2
            when v_hay_digitos and public.normalizar(ncc.ncf) like v_patron then 3
            when public.normalizar(coalesce(ncc.notas, '')) like v_patron then 4
            else 5
          end as rango
        from public.notas_credito_compra ncc
        join public.contactos ct on ct.id = ncc.contacto_id
        left join public.facturas_proveedor fp on fp.id = ncc.factura_proveedor_id
        where g.pasa = 1
          and (
            (v_ncf is not null and (ncc.ncf = v_ncf or fp.ncf = v_ncf))
            or (v_numero is not null and ncc.numero = v_numero)
            or (v_identificacion is not null and ct.rnc_cedula = v_identificacion)
            or (v_texto is not null and (
              (v_hay_digitos and public.normalizar(ncc.ncf) like v_patron)
              or public.normalizar(coalesce(ncc.notas, '')) like v_patron
              or (v_hay_digitos and fp.ncf is not null and public.normalizar(coalesce(fp.ncf, '')) like v_patron)
              or public.normalizar(ct.nombre) like v_patron
            ))
          )
          and (v_incluir_anulados or ncc.estado <> 'anulada')
          and (v_entidad is null or (
            (v_desde is null or ncc.fecha >= v_desde)
            and (v_hasta is null or ncc.fecha <= v_hasta)
          ))
                ) s
        order by
          s.rango asc,
          (s.fecha >= coalesce(v_desde, '-infinity'::date)
            and s.fecha <= coalesce(v_hasta, 'infinity'::date)) desc nulls last,
          case when v_monto is null then 0 else abs(coalesce(s.monto, 0) - v_monto) end asc,
          s.fecha desc nulls last,
          s.numero desc nulls last,
          s.id asc
        limit greatest(v_desplazamiento + v_limite + 1, 201)
      ) r

      union all

      -- 12 · orden de compra (solo con p.entidad) -----------------------------------
      select r.*
      from (select 1 as pasa
            where (v_entidad = 'orden_compra' or v_entidad = 'compras')
              and (v_texto is not null or v_numero is not null or v_identificacion is not null)
              and not v_solo_contactos) g
      cross join lateral (
        select *
        from (
        select
          'orden_compra'::text as entidad,
          oc.id,
          oc.numero::text as titulo,
          ct.nombre as subtitulo,
          '[]'::jsonb as etiquetas,
          oc.estado,
          oc.fecha,
          oc.total as monto,
          oc.numero,
          case
            when v_numero is not null and oc.numero = v_numero then 1
            when public.normalizar(coalesce(oc.notas, '')) like v_patron
              or public.normalizar(coalesce(oc.terminos, '')) like v_patron then 4
            else 5
          end as rango
        from public.ordenes_compra oc
        join public.contactos ct on ct.id = oc.contacto_id
        where g.pasa = 1
          and (
            (v_numero is not null and oc.numero = v_numero)
            or (v_identificacion is not null and ct.rnc_cedula = v_identificacion)
            or (v_texto is not null and (
              public.normalizar(coalesce(oc.notas, '')) like v_patron
              or public.normalizar(coalesce(oc.terminos, '')) like v_patron
              or public.normalizar(ct.nombre) like v_patron
            ))
          )
          and (v_incluir_anulados or oc.estado <> 'anulada')
          and (v_entidad is null or (
            (v_desde is null or oc.fecha >= v_desde)
            and (v_hasta is null or oc.fecha <= v_hasta)
          ))
                ) s
        order by
          s.rango asc,
          (s.fecha >= coalesce(v_desde, '-infinity'::date)
            and s.fecha <= coalesce(v_hasta, 'infinity'::date)) desc nulls last,
          case when v_monto is null then 0 else abs(coalesce(s.monto, 0) - v_monto) end asc,
          s.fecha desc nulls last,
          s.numero desc nulls last,
          s.id asc
        limit greatest(v_desplazamiento + v_limite + 1, 201)
      ) r

      union all

      -- 13 · pago a proveedor (solo con p.entidad) -------------------------------------
      select r.*
      from (select 1 as pasa
            where (v_entidad = 'pago_proveedor' or v_entidad = 'compras')
              and (v_texto is not null or v_numero is not null or v_ncf is not null or v_identificacion is not null)
              and not v_solo_contactos) g
      cross join lateral (
        select *
        from (
        select
          'pago_proveedor'::text as entidad,
          pp.id,
          pp.numero::text as titulo,
          ct.nombre as subtitulo,
          to_jsonb(array[pp.metodo]) as etiquetas,
          pp.estado,
          pp.fecha,
          pp.monto,
          pp.numero,
          case
            when v_numero is not null and pp.numero = v_numero then 1
            when public.normalizar(coalesce(pp.notas, '')) like v_patron then 4
            else 5
          end as rango
        from public.pagos_proveedor pp
        join public.contactos ct on ct.id = pp.contacto_id
        left join public.facturas_proveedor fp on fp.id = pp.factura_proveedor_id
        where g.pasa = 1
          and (
            (v_numero is not null and pp.numero = v_numero)
            or (v_identificacion is not null and ct.rnc_cedula = v_identificacion)
            or (v_ncf is not null and (
              fp.ncf = v_ncf
              or pp.id in (
                select pa.pago_id
                from public.pago_proveedor_aplicaciones pa
                join public.facturas_proveedor fp2 on fp2.id = pa.factura_proveedor_id
                where fp2.ncf = v_ncf
              )
            ))
            or (v_texto is not null and (
              public.normalizar(coalesce(pp.notas, '')) like v_patron
              or (v_hay_digitos and fp.ncf is not null and public.normalizar(coalesce(fp.ncf, '')) like v_patron)
              or public.normalizar(ct.nombre) like v_patron
            ))
          )
          and (v_incluir_anulados or pp.estado <> 'anulado')
          and (v_entidad is null or (
            (v_desde is null or pp.fecha >= v_desde)
            and (v_hasta is null or pp.fecha <= v_hasta)
          ))
                ) s
        order by
          s.rango asc,
          (s.fecha >= coalesce(v_desde, '-infinity'::date)
            and s.fecha <= coalesce(v_hasta, 'infinity'::date)) desc nulls last,
          case when v_monto is null then 0 else abs(coalesce(s.monto, 0) - v_monto) end asc,
          s.fecha desc nulls last,
          s.numero desc nulls last,
          s.id asc
        limit greatest(v_desplazamiento + v_limite + 1, 201)
      ) r

      union all

      -- 14 · gasto menor (primaria) ------------------------------------------------
      select r.*
      from (select 1 as pasa
            where (v_entidad is null or v_entidad = 'gasto_menor' or v_entidad = 'compras')
              and (v_texto is not null or v_ncf is not null or v_numero is not null or v_identificacion is not null)
              and not v_solo_contactos) g
      cross join lateral (
        select *
        from (
        select
          'gasto_menor'::text as entidad,
          gm.id,
          coalesce(gm.ncf, gm.numero::text) as titulo,
          gm.descripcion as subtitulo,
          '[]'::jsonb as etiquetas,
          gm.estado,
          gm.fecha,
          gm.total as monto,
          gm.numero,
          case
            when (v_ncf is not null and gm.ncf = v_ncf)
              or (v_numero is not null and gm.numero = v_numero)
              then 1
            when public.normalizar(gm.descripcion) like v_patron then 4
            else 5
          end as rango
        from public.gastos_menores gm
        left join public.contactos ct on ct.id = gm.contacto_id
        where g.pasa = 1
          and (
            (v_ncf is not null and gm.ncf = v_ncf)
            or (v_numero is not null and gm.numero = v_numero)
            or (v_identificacion is not null and ct.rnc_cedula = v_identificacion)
            or (v_texto is not null and (
              public.normalizar(gm.descripcion) like v_patron
              or (v_hay_digitos and gm.ncf is not null and public.normalizar(gm.ncf) like v_patron)
              or (ct.nombre is not null and public.normalizar(ct.nombre) like v_patron)
            ))
          )
          and (v_incluir_anulados or gm.estado <> 'anulado')
          and (v_entidad is null or (
            (v_desde is null or gm.fecha >= v_desde)
            and (v_hasta is null or gm.fecha <= v_hasta)
          ))
                ) s
        order by
          s.rango asc,
          (s.fecha >= coalesce(v_desde, '-infinity'::date)
            and s.fecha <= coalesce(v_hasta, 'infinity'::date)) desc nulls last,
          case when v_monto is null then 0 else abs(coalesce(s.monto, 0) - v_monto) end asc,
          s.fecha desc nulls last,
          s.numero desc nulls last,
          s.id asc
        limit greatest(v_desplazamiento + v_limite + 1, 201)
      ) r

      union all

      -- 15 · asiento (primaria) -----------------------------------------------------
      -- Los EXISTS por fila de la versión anterior pasan a IN no correlacionado:
      -- el subplan (asiento_lineas JOIN contactos) se evalúa una sola vez y cada
      -- asiento hace una búsqueda hash; antes eran ~32.000 sondas indexadas.
      select r.*
      from (select 1 as pasa
            where (v_entidad is null or v_entidad = 'asiento' or v_entidad = 'otros')
              and (v_texto is not null or v_numero is not null or v_identificacion is not null)
              and not v_parece_ncf
              and not v_solo_contactos) g
      cross join lateral (
        select *
        from (
        select
          'asiento'::text as entidad,
          a.id,
          a.numero::text as titulo,
          a.descripcion as subtitulo,
          to_jsonb(array[a.origen_tipo]) as etiquetas,
          null::text as estado,
          a.fecha,
          a.total as monto,
          a.numero,
          case
            when v_numero is not null and a.numero = v_numero then 1
            when v_texto is not null and public.normalizar(a.descripcion) like v_patron then 4
            else 5
          end as rango
        from public.asientos a
        where g.pasa = 1
          and (
            (v_numero is not null and a.numero = v_numero)
            or (v_texto is not null and public.normalizar(a.descripcion) like v_patron)
            or (v_identificacion is not null and a.id in (
              select al.asiento_id
              from public.asiento_lineas al
              join public.contactos ct on ct.id = al.contacto_id
              where ct.rnc_cedula = v_identificacion
            ))
            or (v_texto is not null and a.id in (
              select al.asiento_id
              from public.asiento_lineas al
              join public.contactos ct on ct.id = al.contacto_id
              where public.normalizar(ct.nombre) like v_patron
            ))
          )
          and (v_entidad is null or (
            (v_desde is null or a.fecha >= v_desde)
            and (v_hasta is null or a.fecha <= v_hasta)
          ))
                ) s
        order by
          s.rango asc,
          (s.fecha >= coalesce(v_desde, '-infinity'::date)
            and s.fecha <= coalesce(v_hasta, 'infinity'::date)) desc nulls last,
          case when v_monto is null then 0 else abs(coalesce(s.monto, 0) - v_monto) end asc,
          s.fecha desc nulls last,
          s.numero desc nulls last,
          s.id asc
        limit greatest(v_desplazamiento + v_limite + 1, 201)
      ) r

      union all

      -- 16 · cuenta contable (solo con p.entidad) ---------------------------------------
      select r.*
      from (select 1 as pasa
            where (v_entidad = 'cuenta' or v_entidad = 'otros')
              and v_texto is not null
              and not v_parece_ncf
              and not v_parece_rnc) g
      cross join lateral (
        select *
        from (
        select
          'cuenta'::text as entidad,
          cu.id,
          cu.codigo as titulo,
          cu.nombre as subtitulo,
          to_jsonb(array[cu.tipo]) as etiquetas,
          null::text as estado,
          null::date as fecha,
          null::numeric as monto,
          null::int as numero,
          case
            when public.normalizar(cu.codigo) = v_texto then 1
            when public.normalizar(cu.codigo) like v_prefijo
              or public.normalizar(cu.nombre) like v_prefijo then 2
            when public.normalizar(cu.nombre) like v_patron
              or public.normalizar(cu.codigo) like v_patron then 3
            else 4
          end as rango
        from public.cuentas cu
        where g.pasa = 1
          and (
            public.normalizar(cu.codigo) like v_patron
            or public.normalizar(cu.nombre) like v_patron
          )
          -- La cuenta no tiene fecha: con rango de fechas no devuelve filas
          -- (igual que la versión anterior, que la filtraba fuera).
          and (v_desde is null and v_hasta is null)
                ) s
        order by
          s.rango asc,
          (s.fecha >= coalesce(v_desde, '-infinity'::date)
            and s.fecha <= coalesce(v_hasta, 'infinity'::date)) desc nulls last,
          case when v_monto is null then 0 else abs(coalesce(s.monto, 0) - v_monto) end asc,
          s.fecha desc nulls last,
          s.numero desc nulls last,
          s.id asc
        limit greatest(v_desplazamiento + v_limite + 1, 201)
      ) r
    ),

    -- Los conteos heredan el tope de las ramas: cada entidad cuenta como
    -- máximo 201 filas y nunca se recorren millones (§3.5 plan B). El rail
    -- muestra "200+" cuando una entidad llega al tope.
    conteos as (
      select entidad, count(*) as total
      from coincidencias
      group by entidad
    ),

    filas as (
      select f.entidad, f.id, f.titulo, f.subtitulo, f.etiquetas, f.estado,
             f.fecha, f.monto, f.numero, f.rango,
             row_number() over (
               partition by f.entidad
               order by f.rango asc,
                 (f.fecha >= coalesce(v_desde, '-infinity'::date)
                   and f.fecha <= coalesce(v_hasta, 'infinity'::date)) desc nulls last,
                 case when v_monto is null then 0 else abs(coalesce(f.monto, 0) - v_monto) end asc,
                 f.fecha desc nulls last,
                 f.numero desc nulls last,
                 f.id asc
             ) as rn
      from coincidencias f
    )

    select jsonb_build_object(
      'grupos', (
        select coalesce(jsonb_agg(
          jsonb_build_object(
            'grupo', m.grupo,
            'entidad', cc.entidad,
            'total', cc.total,
            'resultados', (
              select coalesce(jsonb_agg(
                jsonb_build_object(
                  'entidad', r.entidad,
                  'id', r.id::text,
                  'titulo', r.titulo,
                  'subtitulo', r.subtitulo,
                  'etiquetas', r.etiquetas,
                  'estado', r.estado,
                  'fecha', r.fecha::text,
                  'monto', r.monto::text,
                  'rango', r.rango
                ) order by r.rn
              ), '[]'::jsonb)
              from filas r
              where r.entidad = cc.entidad
                and r.rn > v_desplazamiento
                and r.rn <= v_desplazamiento + v_limite
            )
          ) order by m.orden_grupo, m.orden_entidad
        ), '[]'::jsonb)
        from conteos cc
        join (values
          ('contacto',           'clientes',    1, 1),
          ('producto',           'productos',   2, 2),
          ('factura',            'facturacion', 3, 3),
          ('nota_credito_venta', 'facturacion', 3, 4),
          ('nota_debito_venta',  'facturacion', 3, 5),
          ('cotizacion',         'facturacion', 3, 6),
          ('remision',           'facturacion', 3, 7),
          ('factura_recurrente', 'facturacion', 3, 8),
          ('pago_recibido',      'facturacion', 3, 9),
          ('factura_proveedor',  'compras',     4, 10),
          ('nota_credito_compra','compras',     4, 11),
          ('orden_compra',       'compras',     4, 12),
          ('pago_proveedor',     'compras',     4, 13),
          ('gasto_menor',        'compras',     4, 14),
          ('asiento',            'otros',       5, 15),
          ('cuenta',             'otros',       5, 16)
        ) as m(entidad, grupo, orden_grupo, orden_entidad) on m.entidad = cc.entidad
      ),
      'total', (select coalesce(sum(cc.total), 0) from conteos cc),
      'hayMas', (
        select v_entidad is not null
          and exists (
            select 1 from filas r
            where r.rn > v_desplazamiento + v_limite
          )
      ),
      'ms', (round(extract(epoch from (clock_timestamp() - v_inicio)) * 1000))::int
    )
  );
end;
$$;

-- ---------------------------------------------------------------------------
-- Permisos (§3.7): ni public ni anon; solo authenticated con perfil.
-- ---------------------------------------------------------------------------

revoke all on function public.buscar_global(jsonb) from public, anon;
grant execute on function public.buscar_global(jsonb) to authenticated;
