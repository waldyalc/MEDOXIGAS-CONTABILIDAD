export type AmbienteEcfServidor = "testecf" | "certecf" | "ecf";
export type ModoEjecucionExcelEcf = "validar_local" | "enviar_testecf";

export interface FilaConfigEcf {
  rnc: string;
  razon_social: string;
  ambiente: string;
  activo: boolean;
  dominio_base: string | null;
  cert_titular: string | null;
  cert_numero_serie: string | null;
  cert_valido_hasta: string | null;
  cert_huella_sha256: string | null;
}

export interface ConfiguracionEcfPublica {
  rnc: string;
  razonSocial: string;
  ambiente: AmbienteEcfServidor;
  activo: boolean;
  dominioBase: string | null;
  certTitular: string | null;
  certNumeroSerie: string | null;
  certValidoHasta: string | null;
  certHuellaSha256: string | null;
  vigente: boolean;
  diasRestantes: number | null;
}

export interface ResultadoExcelBase {
  casoPrueba: string;
  numeroFila: number;
  encf: string;
  tipo: string;
  montoTotal: number;
  esRfce: boolean;
  columnasNoReconocidas: string[];
}

export interface ResultadoValidacionExcelCaso extends ResultadoExcelBase {
  valido: boolean;
  errores: string[];
}

export interface ResultadoEnvioExcelCaso extends ResultadoExcelBase {
  trackId: string | null;
  estado: string;
  codigoSeguridad: string | null;
  mensajes: string[];
  urlQr: string | null;
  duracionMs: number;
  xmlFirmado: string | null;
  xmlRfce: string | null;
  nombreArchivoEcf?: string;
  persistido: boolean;
  errorPersistencia: string | null;
}

export interface ResumenValidacionExcelEcf {
  modo: "validar_local";
  ambiente: Exclude<AmbienteEcfServidor, "ecf">;
  rncEmisor: string;
  totalCasos: number;
  validos: number;
  invalidos: number;
  casos: ResultadoValidacionExcelCaso[];
}

export interface ResumenEnvioExcelEcf {
  modo: "enviar_testecf";
  ambiente: Exclude<AmbienteEcfServidor, "ecf">;
  rncEmisor: string;
  totalCasos: number;
  aceptados: number;
  rechazados: number;
  errores: number;
  enProceso: number;
  fuenteCredenciales?: "formulario" | "variables_servidor" | "base_datos";
  casos: ResultadoEnvioExcelCaso[];
}

export type ResumenEjecucionExcelEcf = ResumenValidacionExcelEcf | ResumenEnvioExcelEcf;

export type ModoEjecucionSimulacionPaso4 = "validar_local" | "enviar_dgii";

export type FaseOrdenPaso4 = 1 | 2 | 3;

export type CategoriaSimulacionPaso4 =
  | "31"
  | "32_mayor_250k"
  | "32_rfce"
  | "33"
  | "34"
  | "41"
  | "43"
  | "44"
  | "45"
  | "46"
  | "47";

export interface ResultadoSimulacionPaso4Base {
  numeroCaso: number;
  faseOrden: FaseOrdenPaso4;
  categoria: CategoriaSimulacionPaso4;
  descripcion: string;
  encf: string;
  tipo: string;
  montoTotal: number;
  esRfce: boolean;
  ncfModificado: string | null;
  nombreArchivoEcf: string;
}

export interface ResultadoValidacionSimulacionPaso4Caso extends ResultadoSimulacionPaso4Base {
  valido: boolean;
  errores: string[];
}

export interface ResultadoEnvioSimulacionPaso4Caso extends ResultadoSimulacionPaso4Base {
  trackId: string | null;
  estado: string;
  codigoSeguridad: string | null;
  fechaHoraFirma: string | null;
  mensajes: string[];
  urlQr: string | null;
  duracionMs: number;
  xmlFirmado: string | null;
  xmlRfce: string | null;
  reutilizado: boolean;
  secuenciaUtilizada: boolean | null;
  persistido: boolean;
  errorPersistencia: string | null;
}

export interface ResumenValidacionSimulacionPaso4 {
  modo: "validar_local";
  ambiente: Exclude<AmbienteEcfServidor, "ecf">;
  rncEmisor: string;
  secuenciaBase: number;
  totalCasos: number;
  validos: number;
  invalidos: number;
  erroresGlobales: string[];
  casos: ResultadoValidacionSimulacionPaso4Caso[];
}

export interface ResumenEnvioSimulacionPaso4 {
  modo: "enviar_dgii";
  ambiente: Exclude<AmbienteEcfServidor, "ecf">;
  rncEmisor: string;
  secuenciaBase: number;
  totalCasos: number;
  aceptados: number;
  rechazados: number;
  errores: number;
  enProceso: number;
  reutilizados: number;
  detenidoPorRechazo: boolean;
  fuenteCredenciales?: "formulario" | "variables_servidor" | "base_datos";
  casos: ResultadoEnvioSimulacionPaso4Caso[];
}

export type ResumenEjecucionSimulacionPaso4 = ResumenValidacionSimulacionPaso4 | ResumenEnvioSimulacionPaso4;

export type ModoEjecucionExcelAcecf = "validar_local" | "enviar_dgii";

export interface ResultadoAcecfBase {
  numeroFila: number;
  rncEmisor: string;
  rncComprador: string;
  encf: string;
  fechaEmision: string;
  montoTotal: number;
  montoTotalTexto: string;
  estadoComercial: "1" | "2";
  detalleMotivoRechazo: string | null;
  fechaHoraAprobacionComercial: string;
  nombreArchivoAcecf: string;
}

export interface ResultadoValidacionAcecfCaso extends ResultadoAcecfBase {
  valido: boolean;
  errores: string[];
}

export interface ResultadoEnvioAcecfCaso extends ResultadoAcecfBase {
  codigo: string | null;
  estado: string;
  estadoOriginal: string | null;
  mensajes: string[];
  duracionMs: number;
  xmlFirmado: string | null;
  reutilizado: boolean;
  persistido: boolean;
  errorPersistencia: string | null;
}

export interface ResumenValidacionAcecf {
  modo: "validar_local";
  ambiente: Exclude<AmbienteEcfServidor, "ecf">;
  rncComprador: string;
  totalCasos: number;
  validos: number;
  invalidos: number;
  casos: ResultadoValidacionAcecfCaso[];
}

export interface ResumenEnvioAcecf {
  modo: "enviar_dgii";
  ambiente: Exclude<AmbienteEcfServidor, "ecf">;
  rncComprador: string;
  totalCasos: number;
  aceptados: number;
  rechazados: number;
  errores: number;
  reutilizados: number;
  fuenteCredenciales?: "formulario" | "variables_servidor" | "base_datos";
  casos: ResultadoEnvioAcecfCaso[];
}

export type ResumenEjecucionExcelAcecf = ResumenValidacionAcecf | ResumenEnvioAcecf;

export function ambienteEcfServidorValido(valor: string): valor is AmbienteEcfServidor {
  return valor === "testecf" || valor === "certecf" || valor === "ecf";
}

export function configuracionEcfPublicaDesdeFila(fila: FilaConfigEcf, ahora = new Date()): ConfiguracionEcfPublica {
  const validoHasta = fila.cert_valido_hasta;
  const tiempoValidoHasta = validoHasta ? new Date(validoHasta).getTime() : Number.NaN;
  const tieneFechaValida = Number.isFinite(tiempoValidoHasta);
  const milisegundosDia = 24 * 60 * 60 * 1000;
  return {
    rnc: fila.rnc,
    razonSocial: fila.razon_social,
    ambiente: ambienteEcfServidorValido(fila.ambiente) ? fila.ambiente : "testecf",
    activo: fila.activo,
    dominioBase: fila.dominio_base,
    certTitular: fila.cert_titular,
    certNumeroSerie: fila.cert_numero_serie,
    certValidoHasta: validoHasta,
    certHuellaSha256: fila.cert_huella_sha256,
    vigente: tieneFechaValida && tiempoValidoHasta >= ahora.getTime(),
    diasRestantes: tieneFechaValida ? Math.ceil((tiempoValidoHasta - ahora.getTime()) / milisegundosDia) : null,
  };
}
