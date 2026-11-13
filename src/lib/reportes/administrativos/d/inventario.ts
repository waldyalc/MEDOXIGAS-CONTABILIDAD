import { normalizarTexto } from "./texto";
import type { FilaInventario } from "./tipos";

export interface FiltrosInventario {
  producto: string;
  referencia: string;
}

/**
 * Cantidad a una fecha pasada. La existencia actual ya incluye todas las
 * compras y ventas; las compras posteriores se restan y las ventas
 * posteriores se suman para reconstruir la existencia de esa fecha.
 */
export function cantidadALaFecha(
  cantidadActual: number,
  ventasPosteriores: number,
  comprasPosteriores: number,
): number {
  return cantidadActual - comprasPosteriores + ventasPosteriores;
}

export function filtrarInventario(filas: readonly FilaInventario[], filtros: FiltrosInventario): FilaInventario[] {
  const producto = normalizarTexto(filtros.producto);
  const referencia = normalizarTexto(filtros.referencia);

  return filas.filter((fila) => {
    if (producto !== "" && !normalizarTexto(fila.nombre).includes(producto)) return false;
    if (referencia !== "" && !normalizarTexto(fila.referencia ?? "").includes(referencia)) return false;
    return true;
  });
}

export function totalInventario(filas: readonly FilaInventario[]): number {
  return filas.reduce((total, fila) => total + fila.total, 0);
}

export function calcularTotalLinea(cantidad: number, costoCentavos: number): number {
  return Math.round(cantidad * costoCentavos);
}
