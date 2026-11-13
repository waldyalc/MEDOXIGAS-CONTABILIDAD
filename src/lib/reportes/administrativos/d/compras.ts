import { normalizarTexto } from "./texto";
import type { FilaCompra } from "./tipos";

export interface FiltrosCompras {
  proveedor: string;
}

export function filtrarCompras(filas: readonly FilaCompra[], filtros: FiltrosCompras): FilaCompra[] {
  const proveedor = normalizarTexto(filtros.proveedor);
  if (proveedor === "") return [...filas];

  return filas.filter((fila) => normalizarTexto(fila.contactoNombre).includes(proveedor));
}

export interface TotalesCompras {
  antesDeImpuestos: number;
  despuesDeImpuestos: number;
}

export function totalesCompras(filas: readonly FilaCompra[]): TotalesCompras {
  return filas.reduce<TotalesCompras>(
    (totales, fila) => ({
      antesDeImpuestos: totales.antesDeImpuestos + fila.subtotal,
      despuesDeImpuestos: totales.despuesDeImpuestos + fila.total,
    }),
    { antesDeImpuestos: 0, despuesDeImpuestos: 0 },
  );
}
