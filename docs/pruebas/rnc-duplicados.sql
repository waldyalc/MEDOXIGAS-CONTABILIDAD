-- ---------------------------------------------------------------------------
-- RNC/cédula duplicados en contactos — SOLO LECTURA
--
-- Hallazgo de la investigación P4: en la base real hay 198 RNC/cédulas
-- repetidos y contactos.rnc_cedula NO tiene restricción de unicidad. Muchos
-- son ZZTEST, pero también pueden ser sucursales legítimas de la misma
-- empresa. Por eso NO se agrega un unique todavía: primero decide Contable.
--
-- Este archivo no escribe nada. Corre las consultas en el SQL Editor de
-- Supabase (o en local) y guarda el resultado con la decisión.
--
-- Decisión pendiente con Contable:
--   1. ¿Un RNC puede repetirse en varios contactos? (sucursales, nombres
--      comerciales, clientes y proveedores de la misma empresa...).
--   2. Si no puede, ¿se normaliza antes de comparar? (guiones, espacios,
--      mayúsculas; cédula de 11 y RNC de 9 dígitos).
--   3. ¿La regla aplica a todos los contactos o solo a los activos? ¿Y a los
--      que no tienen RNC/cédula?
--   4. ¿Qué se hace con los duplicados que ya existen? ¿Se unifican, se
--      renombran como sucursal o se dejan?
--   5. ¿La identidad fiscal se controla por RNC o por RNC + tipo de
--      identificación (RNC / cédula / pasaporte)?
--
-- Mientras no haya respuesta, un unique podría rechazar datos legítimos.
-- ---------------------------------------------------------------------------

-- 1) Resumen: contactos con RNC, grupos duplicados y filas involucradas.
--    Se excluyen los ZZTEST (nombre o RNC con ese prefijo) y los vacíos.
with contactos as (
  select
    c.id,
    c.nombre,
    c.tipo,
    c.activo,
    c.rnc_cedula,
    trim(c.rnc_cedula) as rnc,
    regexp_replace(coalesce(c.rnc_cedula, ''), '[^0-9]', '', 'g') as rnc_digitos
  from public.contactos c
  where c.rnc_cedula is not null
    and trim(c.rnc_cedula) <> ''
    and c.nombre not ilike 'ZZTEST%'
    and c.rnc_cedula not ilike 'ZZTEST%'
),
grupos as (
  select rnc, count(*) as contactos
  from contactos
  group by rnc
  having count(*) > 1
)
select
  (select count(*) from contactos) as contactos_con_rnc,
  (select count(*) from grupos) as rnc_duplicados,
  (select coalesce(sum(contactos), 0) from grupos) as contactos_en_grupos_duplicados,
  (select count(*) from contactos c join grupos g using (rnc) where c.activo) as contactos_activos_en_duplicados;

-- 2) Ejemplos: los grupos con más contactos y los nombres involucrados.
with contactos as (
  select
    c.id,
    c.nombre,
    c.tipo,
    c.activo,
    trim(c.rnc_cedula) as rnc
  from public.contactos c
  where c.rnc_cedula is not null
    and trim(c.rnc_cedula) <> ''
    and c.nombre not ilike 'ZZTEST%'
    and c.rnc_cedula not ilike 'ZZTEST%'
)
select
  c.rnc,
  count(*) as contactos,
  count(*) filter (where c.activo) as activos,
  string_agg(c.nombre, ' | ' order by c.nombre) as nombres,
  string_agg(distinct c.tipo, ', ' order by c.tipo) as tipos
from contactos c
group by c.rnc
having count(*) > 1
order by contactos desc, c.rnc
limit 30;

-- 3) El mismo análisis por dígitos: muestra los que solo difieren en
--    guiones/espacios/ceros. Si este conteo es mayor que el del punto 1,
--    normalizar el RNC antes de comparar es obligatorio.
with contactos as (
  select
    c.id,
    c.nombre,
    c.activo,
    regexp_replace(coalesce(c.rnc_cedula, ''), '[^0-9]', '', 'g') as rnc_digitos
  from public.contactos c
  where c.rnc_cedula is not null
    and trim(c.rnc_cedula) <> ''
    and c.nombre not ilike 'ZZTEST%'
    and c.rnc_cedula not ilike 'ZZTEST%'
)
select
  rnc_digitos,
  count(*) as contactos,
  count(*) filter (where activo) as activos,
  string_agg(nombre, ' | ' order by nombre) as nombres
from contactos
where rnc_digitos <> ''
group by rnc_digitos
having count(*) > 1
order by contactos desc, rnc_digitos
limit 30;

-- 4) Vista por contacto de un grupo puntual (cambia el RNC del final):
-- select c.id, c.nombre, c.tipo, c.activo, c.rnc_cedula, c.creado_en
-- from public.contactos c
-- where c.rnc_cedula = '101010101'
-- order by c.activo desc, c.nombre;

-- 5) ¿Cuánto del problema es ZZTEST? (solo para dimensionar)
select
  count(*) filter (where c.nombre ilike 'ZZTEST%' or c.rnc_cedula ilike 'ZZTEST%') as contactos_zztest,
  count(*) filter (where c.nombre not ilike 'ZZTEST%' and c.rnc_cedula not ilike 'ZZTEST%') as contactos_reales
from public.contactos c
where c.rnc_cedula is not null
  and trim(c.rnc_cedula) <> '';

-- ---------------------------------------------------------------------------
-- Qué haría falta para cerrar la decisión
--
-- 1. Correr el punto 1 con los ZZTEST ya borrados (o excluidos, como aquí).
-- 2. Contable define las respuestas de arriba y Waldy aprueba.
-- 3. Si la regla es "un RNC activo por contacto", la migración tendría que:
--    a) normalizar el valor (dígitos) en una columna nueva o en un índice;
--    b) resolver primero los duplicados existentes (unificar o marcar
--       sucursales);
--    c) crear un índice único PARCIAL, por ejemplo:
--       create unique index contactos_rnc_unico
--         on public.contactos ((regexp_replace(rnc_cedula, '[^0-9]', '', 'g')))
--         where activo and rnc_cedula is not null and trim(rnc_cedula) <> '';
--    d) traducir el error 23505 a un mensaje en español en crear_contacto y
--       actualizar_contacto.
-- Nada de eso se hace en esta tarea: falta la decisión de Contable.
-- ---------------------------------------------------------------------------
