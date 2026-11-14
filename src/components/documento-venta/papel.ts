import { aNumero } from "@/lib/facturacion/formato";

export type TipoPapel = "factura" | "cotizacion" | "conduce";

export interface LineaPapelCalculable {
  cantidad: number;
  itbis_tasa: number;
}

const monto = new Intl.NumberFormat("es-DO", {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

const precio = new Intl.NumberFormat("es-DO", {
  maximumFractionDigits: 2,
});

export function formatearMontoPapel(valor: number | string | null | undefined): string {
  return `RD$${monto.format(aNumero(valor))}`;
}

export function formatearPrecioPapel(valor: number | string | null | undefined): string {
  return `RD$${precio.format(aNumero(valor))}`;
}

export function totalItemsPapel(lineas: readonly LineaPapelCalculable[]): number {
  return lineas.reduce((total, linea) => total + aNumero(linea.cantidad), 0);
}

export function etiquetaItbisPapel(lineas: readonly LineaPapelCalculable[]): string {
  const tasas = [...new Set(lineas.map((linea) => linea.itbis_tasa).filter((tasa) => tasa > 0))];
  const unica = tasas.length === 1 ? tasas[0] : null;
  return unica == null ? "ITBIS" : `ITBIS (${unica.toFixed(2)}%)`;
}

export function nombreArchivoPapel(tipo: TipoPapel, numero: number | string, ncf: string | null = null): string {
  if (tipo === "factura") return `factura-${ncf?.trim() || numero}`;
  return `${tipo}-${numero}`;
}
