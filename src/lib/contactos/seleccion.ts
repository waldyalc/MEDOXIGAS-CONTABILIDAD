export const TAMANO_CONTACTOS = 25;

export type TipoBusquedaContacto = "cliente" | "proveedor" | "todos";

export interface ContactoBuscado {
  id: string;
  nombre: string;
  rnc_cedula: string | null;
  lista_precio_id?: string | null;
}

/** Tipos de contacto que entran en la búsqueda; `null` para todos (asientos). */
export function tiposContacto(tipo: TipoBusquedaContacto): readonly string[] | null {
  if (tipo === "todos") return null;
  return [tipo, "ambos"];
}

/**
 * Une la lista base con un contacto extra (el seleccionado o uno recién
 * creado) sin duplicar ids y manteniendo el orden alfabético.
 */
export function unirContactos(
  base: readonly ContactoBuscado[],
  extra: ContactoBuscado | null | undefined,
): ContactoBuscado[] {
  const mapa = new Map(base.map((contacto) => [contacto.id, contacto]));
  if (extra) mapa.set(extra.id, extra);

  return [...mapa.values()].sort((a, b) => a.nombre.localeCompare(b.nombre, "es"));
}
