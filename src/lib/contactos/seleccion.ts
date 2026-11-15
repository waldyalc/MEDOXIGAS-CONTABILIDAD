export const TAMANO_CONTACTOS = 25;

export interface ContactoBuscado {
  id: string;
  nombre: string;
  rnc_cedula: string | null;
  lista_precio_id?: string | null;
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
