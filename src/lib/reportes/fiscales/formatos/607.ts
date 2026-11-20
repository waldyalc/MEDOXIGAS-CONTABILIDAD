// Fuente: DGII, Instructivo de llenado y envío del Formato 607,
// Norma General 07-2018 (plantilla vigente desde mayo 2018) y el archivo real
// de Alegra (Prueba 4, docs/alegra/reporte-investigacion-inventario-fiscal):
//
//   607|131999999|202611|3
//   402123455|1|B0100000002||1|20261120|20261120|800.00|144.00|43.20|…
//
// El encabezado lleva 4 campos (sin "Total monto facturado"), el tipo de
// ingreso va a 1 dígito y las notas de crédito se reportan en POSITIVO (el
// neteo solo se ve en el resumen en pantalla). El TXT no lleva la columna
// "Monto facturado por exportaciones", que sí aparece en el Excel de Alegra.

import { fechaAAAAMMDD, soloDigitos, tipoIdentificacionVenta } from "../comun";
import type { DocumentoFiscal, FilaDgii } from "../tipos";
import type { FormatoDgii } from "./tipos";

export const FORMATO_607: FormatoDgii = {
  codigo: "607",
  nombre: "Reporte 607 — Ventas de bienes y servicios",
  encabezado: [
    { clave: "codigo", nombre: "Código", largo: 3, tipo: "texto" },
    { clave: "rnc", nombre: "RNC o Cédula", largo: 11, tipo: "texto" },
    { clave: "periodo", nombre: "Periodo (AAAAMM)", largo: 6, tipo: "texto" },
    { clave: "cantidad", nombre: "Cantidad de Registros", largo: 12, tipo: "texto" },
  ],
  detalle: [
    { clave: "rnc", nombre: "RNC o Cédula", largo: 11, tipo: "texto" },
    { clave: "tipoId", nombre: "Tipo de identificación", largo: 1, tipo: "texto" },
    { clave: "ncf", nombre: "Número de comprobante fiscal", largo: 19, tipo: "texto" },
    { clave: "ncfModificado", nombre: "Número de comprobante fiscal modificado", largo: 19, tipo: "texto" },
    { clave: "tipoIngreso", nombre: "Tipo de ingreso", largo: 1, tipo: "texto" },
    { clave: "fechaComprobante", nombre: "Fecha de comprobante (AAAAMMDD)", largo: 8, tipo: "texto" },
    { clave: "fechaRetencion", nombre: "Fecha de retención (AAAAMMDD)", largo: 8, tipo: "texto" },
    { clave: "montoFacturado", nombre: "Monto facturado", largo: 12, tipo: "dinero" },
    { clave: "itbisFacturado", nombre: "ITBIS facturado", largo: 12, tipo: "dinero" },
    { clave: "itbisRetenido", nombre: "ITBIS retenido por terceros", largo: 12, tipo: "dinero" },
    { clave: "itbisPercibido", nombre: "ITBIS percibido", largo: 12, tipo: "dinero" },
    { clave: "retencionRenta", nombre: "Retención de renta por terceros", largo: 12, tipo: "dinero" },
    { clave: "isrPercibido", nombre: "ISR percibido", largo: 12, tipo: "dinero" },
    { clave: "impuestoSelectivo", nombre: "Impuesto selectivo al consumo", largo: 12, tipo: "dinero" },
    { clave: "otrosImpuestos", nombre: "Otros impuestos/tasas", largo: 12, tipo: "dinero" },
    { clave: "propina", nombre: "Monto propina legal", largo: 12, tipo: "dinero" },
    { clave: "efectivo", nombre: "Efectivo", largo: 12, tipo: "dinero" },
    { clave: "transferencia", nombre: "Cheque/Transferencia/Depósito", largo: 12, tipo: "dinero" },
    { clave: "tarjeta", nombre: "Tarjeta débito/crédito", largo: 12, tipo: "dinero" },
    { clave: "credito", nombre: "Venta a crédito", largo: 12, tipo: "dinero" },
    { clave: "bonos", nombre: "Bonos o certificados de regalo", largo: 12, tipo: "dinero" },
    { clave: "permuta", nombre: "Permuta", largo: 12, tipo: "dinero" },
    { clave: "otras", nombre: "Otras formas de venta", largo: 12, tipo: "dinero" },
    { clave: "montoExportaciones", nombre: "Monto facturado por exportaciones", largo: 12, tipo: "dinero" },
  ],
  // El TXT real de Alegra termina en "Otras formas de venta"; exportaciones
  // solo va en la tabla/Excel.
  columnasTexto: [
    "rnc",
    "tipoId",
    "ncf",
    "ncfModificado",
    "tipoIngreso",
    "fechaComprobante",
    "fechaRetencion",
    "montoFacturado",
    "itbisFacturado",
    "itbisRetenido",
    "itbisPercibido",
    "retencionRenta",
    "isrPercibido",
    "impuestoSelectivo",
    "otrosImpuestos",
    "propina",
    "efectivo",
    "transferencia",
    "tarjeta",
    "credito",
    "bonos",
    "permuta",
    "otras",
  ],
};

export function fila607(documento: DocumentoFiscal): FilaDgii {
  return {
    rnc: soloDigitos(documento.rnc),
    tipoId: tipoIdentificacionVenta(documento.rnc),
    ncf: documento.ncf,
    ncfModificado: documento.ncfModificado ?? "",
    tipoIngreso: documento.tipoIngreso ?? "1",
    fechaComprobante: fechaAAAAMMDD(documento.fecha),
    fechaRetencion: documento.fechaRetencion ? fechaAAAAMMDD(documento.fechaRetencion) : "",
    // Siempre en positivo: la nota de crédito netea solo en el resumen.
    montoFacturado: documento.base,
    itbisFacturado: documento.itbis,
    itbisRetenido: documento.itbisRetenido ?? 0,
    itbisPercibido: 0,
    retencionRenta: documento.retencionRenta ?? 0,
    isrPercibido: 0,
    impuestoSelectivo: 0,
    otrosImpuestos: documento.otrosImpuestos,
    propina: documento.propina,
    efectivo: documento.pagos.efectivo,
    transferencia: documento.pagos.transferencia,
    tarjeta: documento.pagos.tarjeta,
    credito: documento.pagos.credito,
    bonos: 0,
    permuta: 0,
    otras: documento.pagos.otras,
    montoExportaciones: 0,
  };
}

export function encabezado607(
  documentos: readonly DocumentoFiscal[],
  rnc: string | null | undefined,
  periodo: string,
): FilaDgii {
  return {
    codigo: "607",
    rnc: soloDigitos(rnc),
    periodo,
    cantidad: documentos.length,
  };
}
