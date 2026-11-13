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
    // VERIFICAR con instructivo DGII: el sistema no guarda el motivo; se usa 4 = corrección de la información.
    { clave: "tipoAnulacion", nombre: "Tipo de Anulación", largo: 2, tipo: "texto" },
  ],
};

export function fila608(documento: DocumentoFiscal): FilaDgii {
  return {
    ncf: documento.ncf,
    fechaComprobante: fechaAAAAMMDD(documento.fecha),
    tipoAnulacion: "4",
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
