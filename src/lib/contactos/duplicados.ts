import { normalizarBusqueda, normalizarNombre, normalizarRncCedula } from "./contactos";

/** Contacto mínimo para avisar de un posible duplicado al crearlo. */
export interface ContactoSimilar {
  id: string;
  nombre: string;
  rnc_cedula: string | null;
}

export type MotivoDuplicado = "rnc" | "nombre";

export interface DuplicadoContacto {
  contacto: ContactoSimilar;
  motivo: MotivoDuplicado;
}

/**
 * Nombre comparable: sin acentos, en minúsculas y con los espacios colapsados.
 * «José  Peña» y «JOSE PENA» devuelven lo mismo.
 */
export function nombreParaComparar(valor: string): string {
  return normalizarBusqueda(normalizarNombre(valor));
}

/** RNC o cédula comparable: solo los dígitos, sin guiones ni espacios. */
export function identificacionParaComparar(valor: string | null | undefined): string {
  return normalizarRncCedula(valor ?? "");
}

/** Indica por qué el contacto existente se parece al que se quiere crear. */
export function motivoDuplicado(
  existente: Pick<ContactoSimilar, "nombre" | "rnc_cedula">,
  nuevo: { nombre: string; rnc_cedula: string | null },
): MotivoDuplicado | null {
  const rncNuevo = identificacionParaComparar(nuevo.rnc_cedula);
  if (rncNuevo !== "" && identificacionParaComparar(existente.rnc_cedula) === rncNuevo) return "rnc";

  if (nombreParaComparar(existente.nombre) === nombreParaComparar(nuevo.nombre)) return "nombre";
  return null;
}

/** Primer contacto existente que choca con el RNC o con el nombre normalizado. */
export function buscarContactoSimilar(
  existentes: readonly ContactoSimilar[],
  nuevo: { nombre: string; rnc_cedula: string | null },
): DuplicadoContacto | null {
  for (const existente of existentes) {
    const motivo = motivoDuplicado(existente, nuevo);
    if (motivo) return { contacto: existente, motivo };
  }
  return null;
}
