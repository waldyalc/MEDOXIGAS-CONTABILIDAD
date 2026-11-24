export const TASAS_ITBIS = [0, 16, 18] as const;

export type TasaItbis = (typeof TASAS_ITBIS)[number];

export interface LineaEntrada {
  cantidad: number;
  precioCentavos: number;
  descuentoPct?: number | undefined;
  itbisTasa?: number | undefined;
}

export interface LineaCalculada {
  brutoCentavos: number;
  descuentoCentavos: number;
  subtotalCentavos: number;
  itbisCentavos: number;
  totalCentavos: number;
}

export interface TotalesFactura {
  subtotalCentavos: number;
  descuentoCentavos: number;
  itbisCentavos: number;
  totalCentavos: number;
}

export interface FacturaCalculada {
  lineas: LineaCalculada[];
  totales: TotalesFactura;
}

function limitarPorcentaje(valor: number | undefined) {
  if (valor == null || !Number.isFinite(valor)) return 0;
  return Math.min(100, Math.max(0, valor));
}

export function calcularLinea(linea: LineaEntrada): LineaCalculada {
  const cantidad = Number.isFinite(linea.cantidad) && linea.cantidad > 0 ? linea.cantidad : 0;
  const precioCentavos = Math.max(0, Math.round(linea.precioCentavos));
  const brutoCentavos = Math.round(cantidad * precioCentavos);
  const descuentoPct = limitarPorcentaje(linea.descuentoPct);
  const descuentoCentavos = Math.round((brutoCentavos * descuentoPct) / 100);
  const subtotalCentavos = brutoCentavos - descuentoCentavos;
  const itbisTasa = limitarPorcentaje(linea.itbisTasa);
  const itbisCentavos = Math.round((subtotalCentavos * itbisTasa) / 100);

  return {
    brutoCentavos,
    descuentoCentavos,
    subtotalCentavos,
    itbisCentavos,
    totalCentavos: subtotalCentavos + itbisCentavos,
  };
}

export function calcularTotales(lineas: LineaCalculada[]): TotalesFactura {
  return lineas.reduce<TotalesFactura>(
    (totales, linea) => ({
      subtotalCentavos: totales.subtotalCentavos + linea.brutoCentavos,
      descuentoCentavos: totales.descuentoCentavos + linea.descuentoCentavos,
      itbisCentavos: totales.itbisCentavos + linea.itbisCentavos,
      totalCentavos: totales.totalCentavos + linea.totalCentavos,
    }),
    { subtotalCentavos: 0, descuentoCentavos: 0, itbisCentavos: 0, totalCentavos: 0 },
  );
}

export function calcularFactura(lineas: LineaEntrada[]): FacturaCalculada {
  const calculadas = lineas.map(calcularLinea);
  return { lineas: calculadas, totales: calcularTotales(calculadas) };
}

export function parsearCantidad(valor: string | number | null | undefined): number {
  if (typeof valor === "number") return Number.isFinite(valor) && valor > 0 ? valor : 0;
  if (valor == null) return 0;
  const limpio = valor.trim().replace(/\s/g, "").replace(",", ".");
  if (!/^\d+(\.\d+)?$/.test(limpio)) return 0;
  const numero = Number(limpio);
  return Number.isFinite(numero) && numero > 0 ? numero : 0;
}

export function parsearCentavos(valor: string | number | null | undefined): number | null {
  if (typeof valor === "number") {
    if (!Number.isFinite(valor) || valor < 0) return null;
    return Math.round(valor * 100);
  }
  if (valor == null) return null;

  const limpio = valor.trim().replace(/\s/g, "").replace(/,/g, "");
  if (!/^(\d{1,15})(\.\d{1,2})?$/.test(limpio)) return null;

  const [entero = "0", decimales = ""] = limpio.split(".");
  return Number(entero) * 100 + Number(decimales.padEnd(2, "0"));
}

export function centavosAValor(centavos: number): number {
  return Number((Math.round(centavos) / 100).toFixed(2));
}

export function valorACentavos(valor: number): number {
  if (!Number.isFinite(valor) || valor < 0) return 0;
  return Math.round(valor * 100);
}

/**
 * Subtotal bruto que se muestra junto a la fila «Descuento». La base guarda el
 * subtotal ya neto (`bruto - descuento`), así que la vista debe devolverle el
 * descuento para que Subtotal + impuestos cuadre con el Total.
 */
export function subtotalBruto(subtotalNeto: number, descuento: number): number {
  return centavosAValor(valorACentavos(subtotalNeto) + valorACentavos(descuento));
}
