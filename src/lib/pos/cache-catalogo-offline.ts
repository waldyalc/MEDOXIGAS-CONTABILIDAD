import type { ProductoPOS } from "./tipos";

/**
 * Preparación del catálogo completo para vender sin conexión.
 *
 * El POS lee el catálogo por lotes de 50 (`buscarCatalogoPOS`). Antes, cada
 * lote se guardaba en IndexedDB, así que si la red caía a mitad de la descarga
 * el caché quedaba truncado y el cajero perdía productos al pasar a offline.
 * Aquí la descarga se acumula en memoria y **solo** se escribe cuando llega el
 * último lote: si algo falla, el catálogo completo anterior queda intacto.
 */

export interface CatalogoOffline {
  productos: ProductoPOS[];
  actualizado: string;
  completo: boolean;
}

export type RespuestaLoteCatalogo = { ok: true; data: ProductoPOS[] } | { ok: false; error: string };

export interface EntradaCatalogoOffline {
  /** Pide un lote por `offset` (0, 50, 100…), como la lectura paginada del POS. */
  obtenerLote: (offset: number, limit: number) => Promise<RespuestaLoteCatalogo>;
  /** Única escritura del catálogo; nunca se llama con la descarga incompleta. */
  guardar: (catalogo: CatalogoOffline) => Promise<void>;
  /** Tamaño del lote; el mismo que usa el catálogo en pantalla. */
  tamanoLote?: number;
  /** La pantalla que pidió la descarga sigue montada y con la misma lista. */
  sigueVigente?: () => boolean;
  ahora?: () => string;
}

/**
 * Recorre todo el catálogo por lotes y devuelve `true` solo si lo guardó
 * completo. Devuelve `false` —sin tocar `guardar`— si el servidor falla, si
 * `obtenerLote` lanza o si la pantalla dejó de estar vigente a mitad.
 */
export async function cargarCatalogoCompletoOffline({
  obtenerLote,
  guardar,
  tamanoLote = 50,
  sigueVigente = () => true,
  ahora = () => new Date().toISOString(),
}: EntradaCatalogoOffline): Promise<boolean> {
  const acumulados: ProductoPOS[] = [];

  for (let offset = 0; ; offset += tamanoLote) {
    if (!sigueVigente()) return false;

    let respuesta: RespuestaLoteCatalogo;
    try {
      respuesta = await obtenerLote(offset, tamanoLote);
    } catch {
      return false;
    }

    if (!respuesta.ok || !sigueVigente()) return false;

    acumulados.push(...respuesta.data);

    if (respuesta.data.length < tamanoLote) {
      await guardar({ productos: acumulados, actualizado: ahora(), completo: true });
      return true;
    }
  }
}
