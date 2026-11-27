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
  casos: ResultadoEnvioExcelCaso[];
}

export type ResumenEjecucionExcelEcf = ResumenValidacionExcelEcf | ResumenEnvioExcelEcf;

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
