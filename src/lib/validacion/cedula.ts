const PESOS_RNC = [7, 9, 8, 6, 4, 3, 2] as const;
const PESOS_CEDULA = [1, 2, 1, 2, 1, 2, 1, 2, 1, 2] as const;

export const MENSAJE_CEDULA_INVALIDA = "La cédula no es válida: revisa el dígito verificador.";

/**
 * Dígito verificador DGII de un RNC (9 dígitos) o de una cédula (11).
 *
 * Espejo exacto de `_rnc_digito_valido` (migración 20261124120000), que la
 * base exige en `empleados.identificacion` y en los contactos:
 * - RNC: pesos [7,9,8,6,4,3,2] sobre los dígitos en posiciones 2..8 (el primero
 *   no se pondera); dv = (11 - suma % 11) % 11 contra el noveno dígito.
 * - Cédula: pesos [1,2,...] sobre los 10 primeros; producto >= 10 se le resta
 *   9; dv = (10 - suma % 10) % 10 contra el dígito 11.
 * Cualquier otra longitud es inválida.
 */
export function digitoVerificadorValido(valor: string): boolean {
  const digitos = valor.replace(/[^0-9]/g, "");

  if (digitos.length === 9) {
    let suma = 0;
    for (let i = 0; i < 7; i += 1) {
      suma += Number(digitos.charAt(i + 1)) * PESOS_RNC[i];
    }
    return (11 - (suma % 11)) % 11 === Number(digitos.charAt(8));
  }

  if (digitos.length === 11) {
    let suma = 0;
    for (let i = 0; i < 10; i += 1) {
      let producto = Number(digitos.charAt(i)) * PESOS_CEDULA[i];
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
