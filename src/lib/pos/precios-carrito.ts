import type { UnidadPos } from "@/lib/inventario/ferreteria/tipos";
import type { Decimal } from "@/lib/pos/tipos";

export interface LineaPreciosPOS {
  productoId: string | null;
  unidadId: string | null;
  precio: Decimal;
  precioBase: Decimal | null;
  precioManual: boolean;
  unidades: UnidadPos[];
}

export interface ProductoPrecioPOS {
  producto_id: string;
  precio: Decimal;
  unidades: UnidadPos[];
}

/**
 * Al cambiar la lista de precios, actualiza las líneas no manuales del
 * carrito con los productos que trajo el catálogo. La unidad base toma
 * `producto.precio`; una presentación toma el `precio` de su unidad. Siempre
 * refresca `unidades` para que el selector de la línea ofrezca los precios
 * de la lista nueva. Lo que el catálogo no cubrió (paginación, filtros) lo
 * resuelve la RPC al cobrar: `lineasPayload` solo envía precio si es manual.
 */
export function preciosDeListaALineas<T extends LineaPreciosPOS>(
  lineas: readonly T[],
  productos: readonly ProductoPrecioPOS[],
): T[] {
  const porId = new Map(productos.map((producto) => [producto.producto_id, producto]));
  return lineas.map((linea) => {
    if (linea.precioManual || !linea.productoId) return linea;
    const producto = porId.get(linea.productoId);
    if (!producto) return linea;
    const unidades = producto.unidades ?? [];
    if (linea.unidadId !== null) {
      const unidad = unidades.find((candidata) => candidata.id === linea.unidadId);
      return unidad ? { ...linea, precio: unidad.precio, unidades } : { ...linea, unidades };
    }
    return { ...linea, precio: producto.precio, precioBase: producto.precio, unidades };
  });
}
