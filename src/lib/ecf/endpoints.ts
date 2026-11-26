import type { AmbienteEcf } from "./tipos";

export interface EndpointsDgii {
  semilla: string;
  validarSemilla: string;
  recepcionEcf: string;
  recepcionRfce: string;
  consultaResultado: string;
  consultaEstado: string;
  anulacion: string;
  consultaTimbre: string;
  consultaTimbreRfce: string;
}

export interface UrlsServiciosPropios {
  semilla: string;
  validacionCertificado: string;
  recepcionEcf: string;
  aprobacionComercial: string;
}

export interface ParametrosQrDgii {
  ambiente: AmbienteEcf;
  rncEmisor: string;
  rncComprador: string;
  encf: string;
  fechaEmision: string;
  montoTotal: string | number;
  fechaFirma: string;
  codigoSeguridad: string;
  esRfce: boolean;
}

export function endpointsDgii(ambiente: AmbienteEcf): EndpointsDgii {
  return {
    semilla: `https://ecf.dgii.gov.do/${ambiente}/autenticacion/api/autenticacion/semilla`,
    validarSemilla: `https://ecf.dgii.gov.do/${ambiente}/autenticacion/api/autenticacion/validarsemilla`,
    recepcionEcf: `https://ecf.dgii.gov.do/${ambiente}/recepcion/api/facturaselectronicas`,
    recepcionRfce: `https://fc.dgii.gov.do/${ambiente}/recepcionfc/api/facturas/resumen`,
    consultaResultado: `https://ecf.dgii.gov.do/${ambiente}/consultaresultado/api/consultas/estado`,
    consultaEstado: `https://ecf.dgii.gov.do/${ambiente}/consultaestado/api/consultas/estado`,
    anulacion: `https://ecf.dgii.gov.do/${ambiente}/anulacionrangos/api/operaciones/anularrango`,
    consultaTimbre: `https://ecf.dgii.gov.do/${ambiente}/consultatimbre`,
    consultaTimbreRfce: `https://ecf.dgii.gov.do/${ambiente}/consultatimbrefc`,
  };
}

export const ENDPOINTS_DGII: Record<AmbienteEcf, EndpointsDgii> = {
  testecf: endpointsDgii("testecf"),
  certecf: endpointsDgii("certecf"),
  ecf: endpointsDgii("ecf"),
};

function parametro(nombre: string, valor: string | number): string {
  return `${nombre}=${encodeURIComponent(String(valor))}`;
}

export function construirUrlQrDgii(parametros: ParametrosQrDgii): string {
  const endpoints = endpointsDgii(parametros.ambiente);
  const base = parametros.esRfce ? endpoints.consultaTimbreRfce : endpoints.consultaTimbre;
  const query = [
    parametro("RncEmisor", parametros.rncEmisor),
    parametro("RncComprador", parametros.rncComprador),
    parametro("ENCF", parametros.encf),
    parametro("FechaEmision", parametros.fechaEmision),
    parametro("MontoTotal", parametros.montoTotal),
    parametro("FechaFirma", parametros.fechaFirma),
    parametro("CodigoSeguridad", parametros.codigoSeguridad),
  ].join("&");
  return `${base}?${query}`;
}

export function construirUrlsServiciosPropios(origenBase: string): UrlsServiciosPropios {
  const origen = origenBase.replace(/\/+$/, "");
  if (origen === "") throw new Error("El origen base de los servicios propios no puede estar vacío");
  return {
    semilla: `${origen}/fe/autenticacion/api/semilla`,
    validacionCertificado: `${origen}/fe/autenticacion/api/validacioncertificado`,
    recepcionEcf: `${origen}/fe/recepcion/api/ecf`,
    aprobacionComercial: `${origen}/fe/aprobacioncomercial/api/ecf`,
  };
}
