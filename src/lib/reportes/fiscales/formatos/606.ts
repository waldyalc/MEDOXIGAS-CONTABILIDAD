// Fuente: DGII, Instructivo de llenado y envío del Formato 606,
// Norma General 07-2018 (plantilla de 25 columnas vigente desde mayo 2018).
// Los largos son los del formato de envío oficial; el TXT va separado por pipes.

import { diaDeFecha, fechaAAAAMM, soloDigitos, tipoIdentificacionCompra } from "../comun";
import type { DocumentoFiscal, FilaDgii } from "../tipos";
import type { FormatoDgii } from "./tipos";

export const FORMATO_606: FormatoDgii = {
  codigo: "606",
  nombre: "Reporte 606 — Compras de bienes y servicios",
  encabezado: [
    { clave: "rnc", nombre: "RNC o Cédula", largo: 11, tipo: "texto" },
    { clave: "periodo", nombre: "Periodo (AAAAMM)", largo: 6, tipo: "texto" },
    { clave: "cantidad", nombre: "Cantidad de Registros", largo: 12, tipo: "texto" },
    { clave: "totalMontoFacturado", nombre: "Total Monto Facturado", largo: 16, tipo: "dinero" },
    { clave: "retencionRenta", nombre: "Retención Renta", largo: 12, tipo: "dinero" },
  ],
  detalle: [
    { clave: "rnc", nombre: "RNC o Cédula", largo: 11, tipo: "texto" },
    // VERIFICAR con instructivo DGII: el 606 solo documenta RNC (1) y cédula (2).
    { clave: "tipoId", nombre: "Tipo Id", largo: 1, tipo: "texto" },
    // VERIFICAR con instructivo DGII: clasificación por defecto (09 costo / 02 servicios).
    { clave: "tipoBienes", nombre: "Tipo Bienes y Servicios Comprados", largo: 2, tipo: "texto" },
    { clave: "ncf", nombre: "NCF", largo: 19, tipo: "texto" },
    { clave: "ncfModificado", nombre: "NCF o Documento Modificado", largo: 19, tipo: "texto" },
    // VERIFICAR con instructivo DGII: la plantilla separa AAAAMM y DD.
    { clave: "fechaComprobante", nombre: "Fecha Comprobante (AAAAMM)", largo: 6, tipo: "texto" },
    { clave: "fechaComprobanteDia", nombre: "Fecha Comprobante Día (DD)", largo: 2, tipo: "texto" },
    { clave: "fechaPago", nombre: "Fecha Pago (AAAAMM)", largo: 6, tipo: "texto" },
    { clave: "fechaPagoDia", nombre: "Fecha Pago Día (DD)", largo: 2, tipo: "texto" },
    { clave: "montoServicios", nombre: "Monto Facturado en Servicios", largo: 12, tipo: "dinero" },
    { clave: "montoBienes", nombre: "Monto Facturado en Bienes", largo: 12, tipo: "dinero" },
    { clave: "totalMontoFacturado", nombre: "Total Monto Facturado", largo: 12, tipo: "dinero" },
    { clave: "itbisFacturado", nombre: "ITBIS Facturado", largo: 12, tipo: "dinero" },
    { clave: "itbisRetenido", nombre: "ITBIS Retenido", largo: 12, tipo: "dinero" },
    { clave: "itbisProporcionalidad", nombre: "ITBIS sujeto a Proporcionalidad (Art. 349)", largo: 12, tipo: "dinero" },
    { clave: "itbisCosto", nombre: "ITBIS llevado al Costo", largo: 12, tipo: "dinero" },
    { clave: "itbisPorAdelantar", nombre: "ITBIS por Adelantar", largo: 12, tipo: "dinero" },
    { clave: "itbisPercibido", nombre: "ITBIS percibido en Compras", largo: 12, tipo: "dinero" },
    // VERIFICAR con instructivo DGII: largo del código de retención de ISR.
    { clave: "tipoRetencionIsr", nombre: "Tipo de Retención en ISR", largo: 1, tipo: "texto" },
    { clave: "montoRetencionRenta", nombre: "Monto Retención Renta", largo: 12, tipo: "dinero" },
    { clave: "isrPercibido", nombre: "ISR Percibido en Compras", largo: 12, tipo: "dinero" },
    { clave: "impuestoSelectivo", nombre: "Impuesto Selectivo al Consumo", largo: 12, tipo: "dinero" },
    { clave: "otrosImpuestos", nombre: "Otros Impuestos/Tasas", largo: 12, tipo: "dinero" },
    { clave: "propina", nombre: "Monto Propina Legal", largo: 12, tipo: "dinero" },
    // VERIFICAR con instructivo DGII: forma de pago por defecto (4 = compra a crédito).
    { clave: "formaPago", nombre: "Forma de Pago", largo: 2, tipo: "texto" },
  ],
};

export function fila606(documento: DocumentoFiscal): FilaDgii {
  return {
    rnc: soloDigitos(documento.rnc),
    tipoId: tipoIdentificacionCompra(documento.rnc),
    tipoBienes: documento.baseBienes > 0 ? "09" : "02",
    ncf: documento.ncf,
    ncfModificado: documento.ncfModificado ?? "",
    fechaComprobante: fechaAAAAMM(documento.fecha),
    fechaComprobanteDia: diaDeFecha(documento.fecha),
    fechaPago: "",
    fechaPagoDia: "",
    montoServicios: documento.baseServicios,
    montoBienes: documento.baseBienes,
    totalMontoFacturado: documento.base,
    itbisFacturado: documento.itbis,
    itbisRetenido: 0,
    itbisProporcionalidad: 0,
    itbisCosto: 0,
    itbisPorAdelantar: documento.itbis,
    itbisPercibido: 0,
    tipoRetencionIsr: "",
    montoRetencionRenta: 0,
    isrPercibido: 0,
    impuestoSelectivo: 0,
    otrosImpuestos: 0,
    propina: 0,
    formaPago: documento.clase === "gasto" ? "1" : "4",
  };
}

export function encabezado606(
  documentos: readonly DocumentoFiscal[],
  rnc: string | null | undefined,
  periodo: string,
): FilaDgii {
  const total = documentos.reduce((suma, documento) => suma + documento.base, 0);

  return {
    rnc: soloDigitos(rnc),
    periodo,
    cantidad: documentos.length,
    totalMontoFacturado: total,
    retencionRenta: 0,
  };
}
