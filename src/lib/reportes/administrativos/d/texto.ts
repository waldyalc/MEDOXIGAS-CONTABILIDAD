const DIACRITICOS = /[\u0300-\u036f]/g;

/** Texto en minúsculas, sin tildes y sin espacios exteriores para comparar filtros. */
export function normalizarTexto(texto: string): string {
  return texto.normalize("NFD").replace(DIACRITICOS, "").toLowerCase().trim();
}
