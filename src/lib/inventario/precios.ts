import { valorACentavos } from "@/lib/facturacion/calculo";

import type { ListaPrecio, PrecioLista } from "./tipos";

export function precioListaCentavos(precioBaseCentavos: number, tipo: ListaPrecio["tipo"], valor: number): number {
  if (!Number.isFinite(valor)) return precioBaseCentavos;

  if (tipo === "fijo") {
    return Math.max(0, Math.round(valor * 100));
  }

  const factor = 1 + valor / 100;
  return Math.max(0, Math.round(precioBaseCentavos * factor));
}

export function precioSugeridoCentavos(
  precioBase: number,
  listas: readonly Pick<ListaPrecio, "id" | "tipo">[],
  precios: readonly PrecioLista[],
  listaId: string | null,
): number {
  const precioBaseCentavos = valorACentavos(precioBase);
  if (!listaId) return precioBaseCentavos;

  const lista = listas.find((item) => item.id === listaId);
  const precio = precios.find((item) => item.lista_id === listaId);
  if (!lista || !precio) return precioBaseCentavos;

  return precioListaCentavos(precioBaseCentavos, lista.tipo, precio.precio);
}

export function etiquetaTipoLista(tipo: ListaPrecio["tipo"]): string {
  return tipo === "porcentaje" ? "Porcentaje sobre el precio" : "Valor fijo";
}
