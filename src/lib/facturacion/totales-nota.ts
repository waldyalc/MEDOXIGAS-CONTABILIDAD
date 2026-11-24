import { subtotalBruto } from "./calculo";

export interface FilaTotalNota {
  etiqueta: string;
  valor: number;
}

export interface TotalesNota {
  /** Subtotal neto guardado en la base (bruto − descuento). */
  subtotal: number;
  descuento?: number;
  itbis: number;
  otros_impuestos: number;
  propina: number;
}

/**
 * Filas del bloque de totales de una nota de crédito (B04) o de débito (B03),
 * en el mismo orden que la factura: Subtotal bruto, Descuento, ITBIS, otros
 * impuestos (CDT 2 %) y propina legal (10 %). Las filas de descuento e
 * impuestos solo aparecen cuando tienen monto, para que la suma de las filas
 * cuadre exactamente con el Total del documento.
 */
export function filasTotalesNota(nota: TotalesNota): FilaTotalNota[] {
  const descuento = nota.descuento ?? 0;
  const filas: FilaTotalNota[] = [{ etiqueta: "Subtotal", valor: subtotalBruto(nota.subtotal, descuento) }];

  if (descuento > 0) filas.push({ etiqueta: "Descuento", valor: descuento });

  filas.push({ etiqueta: "ITBIS", valor: nota.itbis });
  if (nota.otros_impuestos > 0) filas.push({ etiqueta: "Otros impuestos", valor: nota.otros_impuestos });
  if (nota.propina > 0) filas.push({ etiqueta: "Propina", valor: nota.propina });

  return filas;
}
