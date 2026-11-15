/**
 * Prepara un término para las búsquedas de PostgREST: quita las comillas y
 * barras que romperían el filtro lógico y deja el resto del texto tal cual.
 */
export function limpiarBusqueda(valor: string): string {
  return valor
    .replace(/["\\*]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 80);
}

/**
 * Patrón para un `.or()` de PostgREST. Va entre comillas dobles para que las
 * comas y los paréntesis del nombre no se confundan con la sintaxis del filtro.
 */
export function patronIlike(valor: string): string {
  return `"%${limpiarBusqueda(valor)}%"`;
}

/** Devuelve el número solo cuando el término es un entero (por ejemplo `#1258`). */
export function numeroBuscado(valor: string): number | null {
  const limpio = valor.trim().replace(/^#/, "");
  if (!/^\d{1,15}$/.test(limpio)) return null;

  const numero = Number(limpio);
  return Number.isSafeInteger(numero) ? numero : null;
}

const LIMITE_NUMERO_DOCUMENTO = 6;

/**
 * Número de documento (factura, compra o pago). Se limita a 6 dígitos para no
 * confundirlo con un RNC (9 u 11) o con los dígitos de un NCF.
 */
export function numeroDocumento(valor: string): number | null {
  const numero = numeroBuscado(valor);
  return numero != null && valor.trim().replace(/^#/, "").length <= LIMITE_NUMERO_DOCUMENTO ? numero : null;
}
