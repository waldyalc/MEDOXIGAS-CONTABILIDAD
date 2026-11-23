-- ---------------------------------------------------------------------------
-- Dígito verificador del RNC con el algoritmo de la DGII.
--
-- Corrige `public._rnc_digito_valido` (20261124120000_config_dgii_rnc.sql),
-- que ponía los pesos [7,9,8,6,4,3,2] sobre los dígitos 2..8 e ignoraba el
-- primero. Por eso rechazaba RNC reales y válidos como 131712789 (FRINET
-- SRL) con «La comprobación del dígito verificador de la identificación: …
-- fue errónea», tanto al crear/editar contactos como en `empleados`.
--
-- Algoritmo correcto (RNC de 9 dígitos), el que asigna la DGII:
--   1. Pesos [7,9,8,6,5,4,3,2] sobre los PRIMEROS 8 dígitos.
--   2. resto = suma % 11.
--   3. dv = 11 - resto; si da 10 se usa 1 y si da 11 se usa 2.
--   4. Se compara con el noveno dígito.
--   131712789 → 134 → resto 2 → dv 9 ✓ (FRINET SRL está inscrito).
--
-- Comprobado contra el catálogo oficial de RNC de la DGII (DGII_RNC.TXT,
-- 21-11-2026): de sus 506,418 RNC de 9 dígitos, cada resto cae en un único
-- dígito verificador (resto 0 → 2 en 46,054 casos; resto 1 → 1 en 46,098).
--
-- La cédula (11 dígitos, Luhn) NO cambia: 293,405 de las 293,439 cédulas de
-- 11 dígitos del mismo catálogo cumplen ese cálculo (99.99 %).
--
-- Misma firma, así que los usos que ya existen (`crear_contacto`,
-- `actualizar_contacto`, `nomina_crear_empleado` y el CHECK de
-- `empleados.identificacion`) toman la corrección sin cambios. Migración
-- aditiva y reintentable: solo reemplaza el cuerpo de la función.
-- ---------------------------------------------------------------------------

create or replace function public._rnc_digito_valido(p_valor text)
returns boolean
language plpgsql
immutable
set search_path = ''
as $$
declare
  v_digitos text;
  v_pesos_rnc int[] := array[7, 9, 8, 6, 5, 4, 3, 2];
  v_pesos_cedula int[] := array[1, 2, 1, 2, 1, 2, 1, 2, 1, 2];
  v_suma int := 0;
  v_producto int;
  v_dv int;
  i int;
begin
  v_digitos := regexp_replace(coalesce(p_valor, ''), '[^0-9]', '', 'g');

  if length(v_digitos) = 9 then
    for i in 1..8 loop
      v_suma := v_suma + substr(v_digitos, i, 1)::int * v_pesos_rnc[i];
    end loop;

    -- Complemento módulo 11: 10 se convierte en 1 y 11 en 2, como asigna
    -- la DGII. Un `% 11` aquí dejaría el dv en 10 (nunca válido).
    v_dv := 11 - (v_suma % 11);
    if v_dv >= 10 then
      v_dv := v_dv - 9;
    end if;

    return v_dv = substr(v_digitos, 9, 1)::int;
  end if;

  if length(v_digitos) = 11 then
    for i in 1..10 loop
      v_producto := substr(v_digitos, i, 1)::int * v_pesos_cedula[i];
      if v_producto >= 10 then
        v_producto := v_producto - 9;
      end if;
      v_suma := v_suma + v_producto;
    end loop;

    v_dv := (10 - (v_suma % 10)) % 10;
    return v_dv = substr(v_digitos, 11, 1)::int;
  end if;

  return false;
end;
$$;

comment on function public._rnc_digito_valido(text) is
  'Dígito verificador DGII: RNC de 9 dígitos con pesos [7,9,8,6,5,4,3,2] sobre '
  'los primeros 8 (dv = 11 - resto; 10 → 1, 11 → 2) y cédula de 11 con Luhn. '
  'Cualquier otra longitud es inválida. Ignora guiones y espacios.';

-- `create or replace` conserva los privilegios; se repite el revoke para
-- dejar explícito que sigue siendo interna (solo la llaman funciones
-- `security definer`).
revoke all on function public._rnc_digito_valido(text)
  from public, anon, authenticated;
