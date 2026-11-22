/**
 * Reglas puras de las pestañas de venta del POS. El provider las usa para
 * renombrar y eliminar; aquí no hay React para poder probarlas de verdad.
 */

export const LARGO_MAXIMO_NOMBRE_PESTANA = 30;

/** Id fijo de la primera pestaña: evita el desajuste de hidratación del SSR. */
export const ID_PESTANA_PRINCIPAL = "venta-principal";

export interface PestanaVentaBase {
  id: string;
  nombre: string;
  lineas: readonly unknown[];
}

/** La principal es siempre la primera pestaña y nunca se elimina. */
export function esPestanaPrincipal(pestanas: readonly PestanaVentaBase[], id: string): boolean {
  return pestanas[0]?.id === id;
}

/**
 * Enter/blur guardan el nombre limpio; vacío o solo espacios conserva el
 * anterior. Se recorta a 30 caracteres como el input.
 */
export function normalizarNombrePestana(nombre: string, anterior: string): string {
  const limpio = nombre.trim().slice(0, LARGO_MAXIMO_NOMBRE_PESTANA);
  return limpio === "" ? anterior : limpio;
}

export function renombrarPestanaEn<T extends PestanaVentaBase>(
  pestanas: readonly T[],
  id: string,
  nombre: string,
): T[] {
  return pestanas.map((pestana) =>
    pestana.id === id ? { ...pestana, nombre: normalizarNombrePestana(nombre, pestana.nombre) } : pestana,
  );
}

export interface ResultadoEliminarPestana<T> {
  pestanas: T[];
  activaId: string;
  eliminada: boolean;
}

/**
 * Elimina una pestaña extra y, si era la activa, activa su vecina anterior
 * (o la primera que quede). La principal (índice 0) no se elimina nunca y el
 * carrito nunca queda sin pestaña. Un id desconocido tampoco hace nada.
 */
export function eliminarPestanaDe<T extends PestanaVentaBase>(
  pestanas: readonly T[],
  activaId: string,
  id: string,
): ResultadoEliminarPestana<T> {
  const indice = pestanas.findIndex((pestana) => pestana.id === id);
  if (indice <= 0) return { pestanas: [...pestanas], activaId, eliminada: false };

  const restantes = pestanas.filter((pestana) => pestana.id !== id);
  const vecina = restantes[Math.max(0, indice - 1)] ?? restantes[0];
  if (!vecina) return { pestanas: [...pestanas], activaId, eliminada: false };

  return {
    pestanas: restantes,
    activaId: id === activaId ? vecina.id : activaId,
    eliminada: true,
  };
}
