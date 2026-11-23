const PESOS_RNC = [7, 9, 8, 6, 5, 4, 3, 2] as const;
const PESOS_CEDULA = [1, 2, 1, 2, 1, 2, 1, 2, 1, 2] as const;

export const MENSAJE_CEDULA_INVALIDA = "La cédula no es válida: revisa el dígito verificador.";

/**
 * Dígito verificador DGII de un RNC (9 dígitos) o de una cédula (11).
 *
 * Espejo exacto de `_rnc_digito_valido` (migración 20261126130000), que la
 * base exige en `empleados.identificacion` y en los contactos:
 * - RNC: pesos [7,9,8,6,5,4,3,2] sobre los 8 primeros dígitos; dv = 11 - (suma
 *   % 11); si da 10 se usa 1 y si da 11 se usa 2. Se compara con el noveno
 *   dígito. Lo confirma el catálogo oficial de la DGII: de sus 506,418 RNC de
 *   9 dígitos, 46,054 con resto 0 llevan 2 y 46,098 con resto 1 llevan 1.
 * - Cédula: pesos [1,2,...] sobre los 10 primeros; producto >= 10 se le resta
 *   9; dv = (10 - suma % 10) % 10 contra el dígito 11 (99.99 % de las 293,439
 *   cédulas del catálogo de la DGII lo cumplen).
 * Cualquier otra longitud es inválida.
 */
export function digitoVerificadorValido(valor: string): boolean {
  const digitos = valor.replace(/[^0-9]/g, "");

  if (digitos.length === 9) {
    let suma = 0;
    for (const [i, peso] of PESOS_RNC.entries()) {
      suma += Number(digitos.charAt(i)) * peso;
    }
    let dv = 11 - (suma % 11);
    if (dv >= 10) dv -= 9;
    return dv === Number(digitos.charAt(8));
  }

  if (digitos.length === 11) {
    let suma = 0;
    for (const [i, peso] of PESOS_CEDULA.entries()) {
      let producto = Number(digitos.charAt(i)) * peso;
      if (producto >= 10) producto -= 9;
      suma += producto;
    }
    return (10 - (suma % 10)) % 10 === Number(digitos.charAt(10));
  }

  return false;
}

/** Cédula dominicana completa: 11 dígitos con el dígito verificador DGII. */
export function cedulaValida(valor: string): boolean {
  const digitos = valor.replace(/\D/g, "");
  return digitos.length === 11 && digitoVerificadorValido(digitos);
}
