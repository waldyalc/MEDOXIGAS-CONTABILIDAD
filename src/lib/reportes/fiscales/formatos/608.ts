// Fuente: DGII, Instructivo de llenado y envío del Formato 608,
// Norma General 07-2018 (detalle de 3 columnas: NCF, fecha y tipo de anulación).
// El TXT va separado por pipes.

import { fechaAAAAMMDD, soloDigitos } from "../comun";
import type { DocumentoFiscal, FilaDgii } from "../tipos";
import type { FormatoDgii } from "./tipos";

export const FORMATO_608: FormatoDgii = {
  codigo: "608",
  nombre: "Reporte 608 — Comprobantes fiscales anulados",
  encabezado: [
    { clave: "rnc", nombre: "RNC o Cédula", largo: 11, tipo: "texto" },
    { clave: "periodo", nombre: "Periodo (AAAAMM)", largo: 6, tipo: "texto" },
    { clave: "cantidad", nombre: "Cantidad de Registros", largo: 12, tipo: "texto" },
  ],
  detalle: [
    { clave: "ncf", nombre: "Número de Comprobante Fiscal", largo: 19, tipo: "texto" },
    { clave: "fechaComprobante", nombre: "Fecha de Comprobante (AAAAMMDD)", largo: 8, tipo: "texto" },
    { clave: "tipoAnulacion", nombre: "Tipo de Anulación", largo: 2, tipo: "texto" },
  ],
};

/** Documento fiscal con el código DGII del motivo de anulación, si se registró. */
export interface DocumentoAnulacion608 extends DocumentoFiscal {
  codigoAnulacion?: string | null;
}

/**
 * Tipo de anulación del 608. Alegra exporta el código en un solo dígito
 * ('06' → '6'), así que se quita el cero inicial del catálogo DGII.
 * Las anulaciones viejas sin motivo conservan 4 = corrección de la información.
 */
export function tipoAnulacion608(codigo: string | null | undefined): string {
  const digitos = (codigo ?? "").replace(/\D/g, "");
  if (digitos === "") return "4";
  return String(Number(digitos));
}

export function fila608(documento: DocumentoAnulacion608): FilaDgii {
  return {
    ncf: documento.ncf,
    // El 608 reporta la fecha del comprobante anulado, no la de la anulación.
    fechaComprobante: fechaAAAAMMDD(documento.fecha),
    tipoAnulacion: tipoAnulacion608(documento.codigoAnulacion),
  };
}

export function encabezado608(
  documentos: readonly DocumentoFiscal[],
  rnc: string | null | undefined,
  periodo: string,
): FilaDgii {
  return {
    rnc: soloDigitos(rnc),
    periodo,
    cantidad: documentos.length,
  };
}
