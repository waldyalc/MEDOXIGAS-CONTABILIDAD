// Fuente: DGII, Instructivo de llenado y envío del Formato 606,
// Norma General 07-2018 (plantilla de 25 columnas vigente desde mayo 2018).
// El TXT va separado por pipes y se copia LITERAL del archivo real de Alegra
// (Prueba 4, docs/alegra/reporte-investigacion-inventario-fiscal):
//
//   606|131999999|202611|1
//   132000013|1|09|B0100000051||20261120||0.00|600.00|600.00|108.00|…
//
// El encabezado lleva 4 campos (sin total ni retención de renta), la fecha del
// comprobante va completa (AAAAMMDD) seguida de un campo vacío y la forma de
// pago es de 2 dígitos: 01 al contado, 04 a crédito, derivada del estado de
// pago (no hay campo manual en la factura).

import { fechaAAAAMMDD, soloDigitos, tipoIdentificacionCompra } from "../comun";
import type { DocumentoFiscal, FilaDgii } from "../tipos";
import type { FormatoDgii } from "./tipos";

export const FORMATO_606: FormatoDgii = {
  codigo: "606",
  nombre: "Reporte 606 — Compras de bienes y servicios",
  encabezado: [
    { clave: "codigo", nombre: "Código", largo: 3, tipo: "texto" },
    { clave: "rnc", nombre: "RNC o Cédula", largo: 11, tipo: "texto" },
    { clave: "periodo", nombre: "Periodo (AAAAMM)", largo: 6, tipo: "texto" },
    { clave: "cantidad", nombre: "Cantidad de Registros", largo: 12, tipo: "texto" },
  ],
  detalle: [
    { clave: "rnc", nombre: "RNC o Cédula", largo: 11, tipo: "texto" },
    { clave: "tipoId", nombre: "Tipo de identificación", largo: 1, tipo: "texto" },
    // Se toma de `cuentas.categoria_dgii` de la cuenta del renglón.
    { clave: "tipoBienes", nombre: "Tipo de bienes y servicios comprados", largo: 2, tipo: "texto" },
    { clave: "ncf", nombre: "NCF", largo: 19, tipo: "texto" },
    { clave: "ncfModificado", nombre: "NCF o documento modificado", largo: 19, tipo: "texto" },
    // Alegra escribe la fecha completa en la primera columna y deja la del día vacía.
    { clave: "fechaComprobante", nombre: "Fecha de comprobante (AAAAMMDD)", largo: 8, tipo: "texto" },
    { clave: "fechaComprobanteDia", nombre: "Fecha de comprobante (D)", largo: 2, tipo: "texto" },
    { clave: "fechaPago", nombre: "Fecha de pago (AAAAMMDD)", largo: 8, tipo: "texto" },
    { clave: "fechaPagoDia", nombre: "Fecha de pago (D)", largo: 2, tipo: "texto" },
    { clave: "montoServicios", nombre: "Monto facturado en servicios", largo: 12, tipo: "dinero" },
    { clave: "montoBienes", nombre: "Monto facturado en bienes", largo: 12, tipo: "dinero" },
    { clave: "totalMontoFacturado", nombre: "Total monto facturado", largo: 12, tipo: "dinero" },
    { clave: "itbisFacturado", nombre: "ITBIS facturado", largo: 12, tipo: "dinero" },
    { clave: "itbisRetenido", nombre: "ITBIS retenido", largo: 12, tipo: "dinero" },
    { clave: "itbisProporcionalidad", nombre: "ITBIS sujeto a proporcionalidad", largo: 12, tipo: "dinero" },
    { clave: "itbisCosto", nombre: "ITBIS llevado al costo", largo: 12, tipo: "dinero" },
    { clave: "itbisPorAdelantar", nombre: "ITBIS por adelantar", largo: 12, tipo: "dinero" },
    { clave: "itbisPercibido", nombre: "ITBIS percibido en compras", largo: 12, tipo: "dinero" },
    { clave: "tipoRetencionIsr", nombre: "Tipo de retención en ISR", largo: 1, tipo: "texto" },
    { clave: "montoRetencionRenta", nombre: "Monto retención renta", largo: 12, tipo: "dinero" },
    { clave: "isrPercibido", nombre: "ISR percibido en compras", largo: 12, tipo: "dinero" },
    { clave: "impuestoSelectivo", nombre: "Impuesto selectivo al consumo", largo: 12, tipo: "dinero" },
    { clave: "otrosImpuestos", nombre: "Otros impuestos/tasas", largo: 12, tipo: "dinero" },
    { clave: "propina", nombre: "Monto propina legal", largo: 12, tipo: "dinero" },
    { clave: "formaPago", nombre: "Forma de pago", largo: 2, tipo: "texto" },
  ],
  // El TXT de Alegra fusiona cada fecha en un solo campo AAAAMMDD (sin las
  // columnas "D" del Excel) y deja la fecha de pago vacía si no está pagada.
  columnasTexto: [
    "rnc",
    "tipoId",
    "tipoBienes",
    "ncf",
    "ncfModificado",
    "fechaComprobante",
    "fechaPago",
    "montoServicios",
    "montoBienes",
    "totalMontoFacturado",
    "itbisFacturado",
    "itbisRetenido",
    "itbisProporcionalidad",
    "itbisCosto",
    "itbisPorAdelantar",
    "itbisPercibido",
    "tipoRetencionIsr",
    "montoRetencionRenta",
    "isrPercibido",
    "impuestoSelectivo",
    "otrosImpuestos",
    "propina",
    "formaPago",
  ],
};

/** 01 contado (pagada), 04 a crédito, como lo deriva Alegra del estado de pago. */
export function formaPago606(documento: DocumentoFiscal): string {
  return documento.fechaPago != null && documento.fechaPago !== "" ? "01" : "04";
}

export function fila606(documento: DocumentoFiscal): FilaDgii {
  return {
    rnc: soloDigitos(documento.rnc),
    tipoId: tipoIdentificacionCompra(documento.rnc),
    tipoBienes: documento.tipoBienes ?? "",
    ncf: documento.ncf,
    ncfModificado: documento.ncfModificado ?? "",
    fechaComprobante: fechaAAAAMMDD(documento.fecha),
    fechaComprobanteDia: "",
    fechaPago: documento.fechaPago ? fechaAAAAMMDD(documento.fechaPago) : "",
    fechaPagoDia: "",
    montoServicios: documento.baseServicios,
    montoBienes: documento.baseBienes,
    totalMontoFacturado: documento.base,
    itbisFacturado: documento.itbis,
    itbisRetenido: 0,
    itbisProporcionalidad: 0,
    itbisCosto: 0,
    itbisPorAdelantar: documento.itbis,
    itbisPercibido: "",
    tipoRetencionIsr: "",
    montoRetencionRenta: 0,
    isrPercibido: "",
    impuestoSelectivo: 0,
    otrosImpuestos: documento.otrosImpuestos,
    propina: documento.propina,
    formaPago: formaPago606(documento),
  };
}

export function encabezado606(
  documentos: readonly DocumentoFiscal[],
  rnc: string | null | undefined,
  periodo: string,
): FilaDgii {
  return {
    codigo: "606",
    rnc: soloDigitos(rnc),
    periodo,
    cantidad: documentos.length,
  };
}
