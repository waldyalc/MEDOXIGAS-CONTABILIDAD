// Fuente: DGII, Instructivo de llenado y envío del Formato 607,
// Norma General 07-2018 (plantilla de 23 columnas vigente desde mayo 2018).
// Los largos son los del formato de envío oficial; el TXT va separado por pipes.

import { fechaAAAAMMDD, soloDigitos, tipoIdentificacionVenta } from "../comun";
import type { DocumentoFiscal, FilaDgii } from "../tipos";
import type { FormatoDgii } from "./tipos";

export const FORMATO_607: FormatoDgii = {
  codigo: "607",
  nombre: "Reporte 607 — Ventas de bienes y servicios",
  encabezado: [
    { clave: "rnc", nombre: "RNC o Cédula", largo: 11, tipo: "texto" },
    { clave: "periodo", nombre: "Periodo (AAAAMM)", largo: 6, tipo: "texto" },
    { clave: "cantidad", nombre: "Cantidad de Registros", largo: 12, tipo: "texto" },
    { clave: "totalMontoFacturado", nombre: "Total Monto Facturado", largo: 16, tipo: "dinero" },
  ],
  detalle: [
    { clave: "rnc", nombre: "RNC o Cédula", largo: 11, tipo: "texto" },
    // VERIFICAR con instructivo DGII: 3 = pasaporte/ID tributaria o consumidor final sin identificación.
    { clave: "tipoId", nombre: "Tipo Identificación", largo: 1, tipo: "texto" },
    { clave: "ncf", nombre: "Número Comprobante Fiscal", largo: 19, tipo: "texto" },
    { clave: "ncfModificado", nombre: "Número Comprobante Fiscal Modificado", largo: 19, tipo: "texto" },
    // VERIFICAR con instructivo DGII: 01 = ingresos por operaciones (no financieros).
    { clave: "tipoIngreso", nombre: "Tipo de Ingreso", largo: 2, tipo: "texto" },
    { clave: "fechaComprobante", nombre: "Fecha Comprobante (AAAAMMDD)", largo: 8, tipo: "texto" },
    { clave: "fechaRetencion", nombre: "Fecha de Retención (AAAAMMDD)", largo: 8, tipo: "texto" },
    { clave: "montoFacturado", nombre: "Monto Facturado", largo: 12, tipo: "dinero" },
    { clave: "itbisFacturado", nombre: "ITBIS Facturado", largo: 12, tipo: "dinero" },
    { clave: "itbisRetenido", nombre: "ITBIS Retenido por Terceros", largo: 12, tipo: "dinero" },
    { clave: "itbisPercibido", nombre: "ITBIS Percibido", largo: 12, tipo: "dinero" },
    { clave: "retencionRenta", nombre: "Retención Renta por Terceros", largo: 12, tipo: "dinero" },
    { clave: "isrPercibido", nombre: "ISR Percibido", largo: 12, tipo: "dinero" },
    { clave: "impuestoSelectivo", nombre: "Impuesto Selectivo al Consumo", largo: 12, tipo: "dinero" },
    { clave: "otrosImpuestos", nombre: "Otros Impuestos/Tasas", largo: 12, tipo: "dinero" },
    { clave: "propina", nombre: "Monto Propina Legal", largo: 12, tipo: "dinero" },
    { clave: "efectivo", nombre: "Efectivo", largo: 12, tipo: "dinero" },
    { clave: "transferencia", nombre: "Cheque/Transferencia/Depósito", largo: 12, tipo: "dinero" },
    { clave: "tarjeta", nombre: "Tarjeta Débito/Crédito", largo: 12, tipo: "dinero" },
    { clave: "credito", nombre: "Venta a Crédito", largo: 12, tipo: "dinero" },
    { clave: "bonos", nombre: "Bonos o Certificados de Regalo", largo: 12, tipo: "dinero" },
    { clave: "permuta", nombre: "Permuta", largo: 12, tipo: "dinero" },
    { clave: "otras", nombre: "Otras Formas de Venta", largo: 12, tipo: "dinero" },
  ],
};

export function fila607(documento: DocumentoFiscal): FilaDgii {
  const esDevolucion = documento.clase === "devolucion-venta";
  const signo = esDevolucion ? -1 : 1;

  return {
    rnc: soloDigitos(documento.rnc),
    tipoId: tipoIdentificacionVenta(documento.rnc),
    ncf: documento.ncf,
    ncfModificado: documento.ncfModificado ?? "",
    tipoIngreso: "01",
    fechaComprobante: fechaAAAAMMDD(documento.fecha),
    fechaRetencion: "",
    montoFacturado: documento.base * signo,
    itbisFacturado: documento.itbis * signo,
    itbisRetenido: 0,
    itbisPercibido: 0,
    retencionRenta: 0,
    isrPercibido: 0,
    impuestoSelectivo: 0,
    otrosImpuestos: 0,
    propina: 0,
    efectivo: documento.pagos.efectivo * signo,
    transferencia: documento.pagos.transferencia * signo,
    tarjeta: documento.pagos.tarjeta * signo,
    credito: documento.pagos.credito * signo,
    bonos: 0,
    permuta: 0,
    otras: documento.pagos.otras * signo,
  };
}

export function encabezado607(
  documentos: readonly DocumentoFiscal[],
  rnc: string | null | undefined,
  periodo: string,
): FilaDgii {
  const total = documentos.reduce(
    (suma, documento) => suma + (documento.clase === "devolucion-venta" ? -documento.base : documento.base),
    0,
  );

  return {
    rnc: soloDigitos(rnc),
    periodo,
    cantidad: documentos.length,
    totalMontoFacturado: total,
  };
}
