import type { AmbienteEcf } from "./tipos";

export interface EndpointsDgii {
  semilla: string;
  validarSemilla: string;
  recepcionEcf: string;
  recepcionRfce: string;
  consultaRfce: string;
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
    recepcionRfce: `https://fc.dgii.gov.do/${ambiente}/recepcionfc/api/recepcion/ecf`,
    consultaRfce: `https://fc.dgii.gov.do/${ambiente}/consultarfce/api/Consultas/Consulta`,
    consultaResultado: `https://ecf.dgii.gov.do/${ambiente}/consultaresultado/api/consultas/estado`,
    consultaEstado: `https://ecf.dgii.gov.do/${ambiente}/consultaestado/api/consultas/estado`,
    anulacion: `https://ecf.dgii.gov.do/${ambiente}/anulacionrangos/api/operaciones/anularrango`,
    consultaTimbre: `https://ecf.dgii.gov.do/${ambiente}/ConsultaTimbre`,
    consultaTimbreRfce: `https://fc.dgii.gov.do/${ambiente}/ConsultaTimbreFC`,
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
  if (parametros.esRfce) {
    const queryRfce = [
      parametro("RncEmisor", parametros.rncEmisor),
      parametro("ENCF", parametros.encf),
      parametro("MontoTotal", parametros.montoTotal),
      parametro("CodigoSeguridad", parametros.codigoSeguridad),
    ].join("&");
    return `${endpoints.consultaTimbreRfce}?${queryRfce}`;
  }
  const pares: string[] = [parametro("RncEmisor", parametros.rncEmisor)];
  if (parametros.rncComprador.trim() !== "") {
    pares.push(parametro("RncComprador", parametros.rncComprador.trim()));
  }
  pares.push(
    parametro("ENCF", parametros.encf),
    parametro("FechaEmision", parametros.fechaEmision),
    parametro("MontoTotal", parametros.montoTotal),
    parametro("FechaFirma", parametros.fechaFirma),
    parametro("CodigoSeguridad", parametros.codigoSeguridad),
  );
  return `${endpoints.consultaTimbre}?${pares.join("&")}`;
}

export function construirUrlsServiciosPropios(origenBase: string, rnc?: string): UrlsServiciosPropios {
  const origen = origenBase.replace(/\/+$/, "");
  if (origen === "") throw new Error("El origen base de los servicios propios no puede estar vacío");
  const rncLimpio = rnc?.replace(/\D/g, "") ?? "";
  const prefijo = rncLimpio !== "" ? `${origen}/api/ecf/${rncLimpio}` : origen;
  return {
    semilla: `${prefijo}/fe/autenticacion/api/semilla`,
    validacionCertificado: `${prefijo}/fe/autenticacion/api/validacioncertificado`,
    recepcionEcf: `${prefijo}/fe/recepcion/api/ecf`,
    aprobacionComercial: `${prefijo}/fe/aprobacioncomercial/api/ecf`,
  };
}
