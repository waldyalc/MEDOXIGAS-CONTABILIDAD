/**
 * Favoritos del catálogo del POS.
 *
 * `productos.favorito_pos` es el favorito global que se marca en Inventario.
 * El POS agrega una capa local por navegador para que el cajero marque con la
 * estrella sin escribir en la base: el valor local manda (true marca y false
 * desmarca un favorito global) y se guarda en `localStorage`.
 */

export const CLAVE_FAVORITOS_POS = "pos:favoritos:v1";

export type FavoritosPOS = Record<string, boolean>;

type AlmacenLectura = Pick<Storage, "getItem">;
type AlmacenEscritura = Pick<Storage, "setItem">;

/** Lee sin confiar en el contenido: JSON inválido o valores raros devuelven `{}`. */
export function leerFavoritosPOS(almacen: AlmacenLectura | null | undefined): FavoritosPOS {
  try {
    const crudo = almacen?.getItem(CLAVE_FAVORITOS_POS);
    if (!crudo) return {};

    const datos: unknown = JSON.parse(crudo);
    if (datos === null || typeof datos !== "object" || Array.isArray(datos)) return {};

    const favoritos: FavoritosPOS = {};
    for (const [productoId, valor] of Object.entries(datos)) {
      if (productoId.trim() !== "" && typeof valor === "boolean") favoritos[productoId] = valor;
    }
    return favoritos;
  } catch {
    return {};
  }
}

export function guardarFavoritosPOS(almacen: AlmacenEscritura | null | undefined, favoritos: FavoritosPOS): void {
  try {
    almacen?.setItem(CLAVE_FAVORITOS_POS, JSON.stringify(favoritos));
  } catch {
    // Modo privado o cuota llena: el favorito vive en memoria mientras dure la sesión.
  }
}

/** El valor local pisa al global; un producto sin marca local usa `favorito_pos`. */
export function esFavoritoPOS(
  favoritos: FavoritosPOS,
  producto: { producto_id: string; favorito_pos: boolean },
): boolean {
  return favoritos[producto.producto_id] ?? producto.favorito_pos;
}

export function alternarFavoritoPOS(
  favoritos: FavoritosPOS,
  producto: { producto_id: string; favorito_pos: boolean },
): FavoritosPOS {
  return { ...favoritos, [producto.producto_id]: !esFavoritoPOS(favoritos, producto) };
}

/** Filtro «Favoritos» del catálogo: solo lo marcado (local o global). */
export function filtrarFavoritosPOS<T extends { producto_id: string; favorito_pos: boolean }>(
  productos: T[],
  favoritos: FavoritosPOS,
): T[] {
  return productos.filter((producto) => esFavoritoPOS(favoritos, producto));
}
