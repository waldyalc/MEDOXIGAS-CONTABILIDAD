import { endpointsDgii } from "./endpoints";
import { firmarXmlDsig } from "./firma";
import type { AmbienteEcf, EstadoDgii } from "./tipos";

export type FetchEcf = (url: string, init?: RequestInit) => Promise<Response>;

export interface TokenDgii {
  token: string;
  expira: string;
}

export interface ResultadoEnvioDgii {
  trackId?: string;
  codigo: string;
  estado: string;
  mensajes: string[];
}

export interface ResultadoConsultaDgii {
  trackId?: string;
  codigo?: string;
  estado: EstadoDgii;
  estadoOriginal: string;
  mensajes: string[];
  rnc?: string;
  encf?: string;
  secuenciaUtilizada?: boolean;
  fechaRecepcion?: string;
}

export interface ObtenerTokenDgiiArgs {
  ambiente: AmbienteEcf;
  clavePrivadaPem: string;
  certificadoPem: string;
  fetchFn?: FetchEcf;
  confirmarProduccion?: boolean;
}

export interface EnviarEcfDgiiArgs {
  ambiente: AmbienteEcf;
  token: string;
  nombreArchivo: string;
  xmlFirmado: string;
  esRfce: boolean;
  fetchFn?: FetchEcf;
  confirmarProduccion?: boolean;
}

export interface EnviarAprobacionComercialDgiiArgs {
  ambiente: AmbienteEcf;
  token: string;
  nombreArchivo: string;
  xmlFirmado: string;
  fetchFn?: FetchEcf;
  confirmarProduccion?: boolean;
}

export interface ResultadoAprobacionComercialDgii {
  codigo: string;
  estado: EstadoDgii;
  estadoOriginal: string;
  mensajes: string[];
}

export interface ConsultarResultadoDgiiArgs {
  ambiente: AmbienteEcf;
  token: string;
  trackId: string;
  fetchFn?: FetchEcf;
  confirmarProduccion?: boolean;
}

function fetchPorDefecto(url: string, init?: RequestInit): Promise<Response> {
  return fetch(url, init);
}

function asegurarAmbientePermitido(ambiente: AmbienteEcf, confirmarProduccion?: boolean): void {
  if (ambiente === "ecf" && confirmarProduccion !== true) {
    throw new Error("El envío al ambiente productivo e-CF de DGII requiere confirmarProduccion: true");
  }
}

async function leerCuerpo(response: Response): Promise<Record<string, unknown>> {
  const texto = await response.text();
  if (texto.trim() === "") return {};
  try {
    const json: unknown = JSON.parse(texto);
    if (typeof json === "object" && json !== null && !Array.isArray(json)) return json as Record<string, unknown>;
  } catch {
    return { xml: texto };
  }
  return { valor: texto };
}

function campoTexto(cuerpo: Record<string, unknown>, ...nombres: string[]): string | undefined {
  for (const nombre of nombres) {
    const valor = cuerpo[nombre];
    if (typeof valor === "string" && valor !== "") return valor;
    if (typeof valor === "number") return String(valor);
  }
  return undefined;
}

function campoBooleano(cuerpo: Record<string, unknown>, nombre: string): boolean | undefined {
  const valor = cuerpo[nombre];
  if (typeof valor === "boolean") return valor;
  if (typeof valor === "string") return valor.toLowerCase() === "true";
  return undefined;
}

function mensajesDesde(valor: unknown): string[] {
  if (typeof valor === "string") return valor.trim() === "" ? [] : [valor];
  if (!Array.isArray(valor)) return [];
  return valor
    .map((mensaje) => {
      if (typeof mensaje === "string") return mensaje;
      if (typeof mensaje === "object" && mensaje !== null) {
        const texto = (mensaje as Record<string, unknown>).valor;
        if (typeof texto === "string") return texto;
      }
      return "";
    })
    .filter((mensaje) => mensaje !== "");
}

function mensajesCuerpo(cuerpo: Record<string, unknown>): string[] {
  const mensajes = mensajesDesde(cuerpo.mensajes);
  if (mensajes.length > 0) return mensajes;
  return mensajesDesde(cuerpo.mensaje ?? cuerpo.error ?? cuerpo.errores ?? cuerpo.xml);
}

function formConXml(xml: string, nombreArchivo: string): FormData {
  const form = new FormData();
  form.append("xml", new Blob([xml], { type: "text/xml" }), nombreArchivo);
  return form;
}

function errorDgii(prefijo: string, response: Response, cuerpo: Record<string, unknown>): Error {
  const mensajes = mensajesCuerpo(cuerpo);
  const detalle = mensajes.length > 0 ? `: ${mensajes.join("; ")}` : "";
  return new Error(`${prefijo} (HTTP ${response.status})${detalle}`);
}

export async function obtenerTokenDgii(args: ObtenerTokenDgiiArgs): Promise<TokenDgii> {
  asegurarAmbientePermitido(args.ambiente, args.confirmarProduccion);
  const fetchFn = args.fetchFn ?? fetchPorDefecto;
  const endpoints = endpointsDgii(args.ambiente);
  const respuestaSemilla = await fetchFn(endpoints.semilla, { method: "GET", headers: { accept: "application/xml" } });
  if (!respuestaSemilla.ok) {
    const cuerpo = await leerCuerpo(respuestaSemilla);
    throw errorDgii("DGII no entregó la semilla", respuestaSemilla, cuerpo);
  }
  const semillaXml = await respuestaSemilla.text();
  const semillaFirmada = firmarXmlDsig(semillaXml, args.clavePrivadaPem, args.certificadoPem);
  const respuestaToken = await fetchFn(endpoints.validarSemilla, {
    method: "POST",
    headers: { accept: "application/json" },
    body: formConXml(semillaFirmada.xmlFirmado, "semilla-firmada.xml"),
  });
  const cuerpo = await leerCuerpo(respuestaToken);
  if (!respuestaToken.ok) throw errorDgii("DGII rechazó la semilla firmada", respuestaToken, cuerpo);
  const token = campoTexto(cuerpo, "token", "access_token", "accessToken");
  const expira = campoTexto(cuerpo, "expira", "expiration", "expirationDate", "fechaExpiracion");
  if (!token || !expira) throw new Error("DGII respondió sin token o sin fecha de expiración");
  return { token, expira };
}

export async function enviarEcfDgii(args: EnviarEcfDgiiArgs): Promise<ResultadoEnvioDgii> {
  asegurarAmbientePermitido(args.ambiente, args.confirmarProduccion);
  const fetchFn = args.fetchFn ?? fetchPorDefecto;
  const endpoints = endpointsDgii(args.ambiente);
  const url = args.esRfce ? endpoints.recepcionRfce : endpoints.recepcionEcf;
  const response = await fetchFn(url, {
    method: "POST",
    headers: { accept: "application/json", Authorization: `Bearer ${args.token}` },
    body: formConXml(args.xmlFirmado, args.nombreArchivo),
  });
  const cuerpo = await leerCuerpo(response);
  const mensajes = mensajesCuerpo(cuerpo);
  const codigo = campoTexto(cuerpo, "codigo", "code") ?? (response.ok ? "" : String(response.status));
  const estado = campoTexto(cuerpo, "estado", "status") ?? (response.ok ? "Recibido" : "Error");
  const trackId = campoTexto(cuerpo, "trackId", "trackid", "track_id");
  if (!response.ok && codigo === String(response.status) && estado === "Error" && mensajes.length === 0) {
    throw errorDgii("DGII rechazó la recepción del documento", response, cuerpo);
  }
  return { trackId, codigo, estado, mensajes };
}

function normalizarEstadoDgii(estadoOriginal: string, codigo?: string): EstadoDgii {
  const texto = estadoOriginal
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase();
  if (texto.includes("aceptado") && texto.includes("condicional")) return "aceptado_condicional";
  if (texto.includes("aceptado")) return "aceptado";
  if (texto.includes("rechazado")) return "rechazado";
  if (texto.includes("proceso") || texto.includes("procesando")) return "en_proceso";
  if (codigo === "1") return "aceptado";
  return "pendiente";
}

function normalizarEstadoAprobacionComercial(estadoOriginal: string, codigo: string): EstadoDgii {
  const texto = estadoOriginal
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase();
  if (codigo === "2" || codigo === "02" || texto.includes("rechazad")) return "rechazado";
  const textoAprobado =
    !texto.includes("rechazad") &&
    (texto.includes("aprobada") || texto.includes("aprobado") || texto.includes("aceptado"));
  if (codigo === "1" || textoAprobado) return "aceptado";
  return "pendiente";
}

function estructuraAprobacionComercialReconocible(
  cuerpo: Record<string, unknown>,
  codigo: string,
  estadoOriginal: string,
): boolean {
  if (codigo !== "" || estadoOriginal !== "") return true;
  return mensajesDesde(cuerpo.mensaje ?? cuerpo.mensajes).length > 0;
}

export async function enviarAprobacionComercialDgii(
  args: EnviarAprobacionComercialDgiiArgs,
): Promise<ResultadoAprobacionComercialDgii> {
  asegurarAmbientePermitido(args.ambiente, args.confirmarProduccion);
  const fetchFn = args.fetchFn ?? fetchPorDefecto;
  const endpoints = endpointsDgii(args.ambiente);
  const response = await fetchFn(endpoints.aprobacionComercial, {
    method: "POST",
    headers: { accept: "application/json", Authorization: `Bearer ${args.token}` },
    body: formConXml(args.xmlFirmado, args.nombreArchivo),
  });
  const cuerpo = await leerCuerpo(response);
  const codigo = campoTexto(cuerpo, "codigo", "code") ?? "";
  const estadoOriginal = campoTexto(cuerpo, "estado", "status") ?? "";
  if (!response.ok && !estructuraAprobacionComercialReconocible(cuerpo, codigo, estadoOriginal)) {
    throw errorDgii("DGII rechazó la aprobación comercial", response, cuerpo);
  }
  return {
    codigo,
    estado: normalizarEstadoAprobacionComercial(estadoOriginal, codigo),
    estadoOriginal,
    mensajes: mensajesCuerpo(cuerpo),
  };
}

export async function consultarResultadoDgii(args: ConsultarResultadoDgiiArgs): Promise<ResultadoConsultaDgii> {
  asegurarAmbientePermitido(args.ambiente, args.confirmarProduccion);
  const fetchFn = args.fetchFn ?? fetchPorDefecto;
  const endpoints = endpointsDgii(args.ambiente);
  const url = `${endpoints.consultaResultado}?trackid=${encodeURIComponent(args.trackId)}`;
  try {
    const response = await fetchFn(url, {
      method: "GET",
      headers: { accept: "application/json", Authorization: `Bearer ${args.token}` },
    });
    const cuerpo = await leerCuerpo(response);
    if (!response.ok) throw errorDgii("DGII no pudo consultar el resultado", response, cuerpo);
    const estadoOriginal = campoTexto(cuerpo, "estado", "status") ?? "";
    const codigo = campoTexto(cuerpo, "codigo", "code");
    return {
      trackId: campoTexto(cuerpo, "trackId", "trackid", "track_id") ?? args.trackId,
      codigo,
      estado: normalizarEstadoDgii(estadoOriginal, codigo),
      estadoOriginal,
      mensajes: mensajesCuerpo(cuerpo),
      rnc: campoTexto(cuerpo, "rnc", "rncEmisor"),
      encf: campoTexto(cuerpo, "encf", "eNCF"),
      secuenciaUtilizada: campoBooleano(cuerpo, "secuenciaUtilizada"),
      fechaRecepcion: campoTexto(cuerpo, "fechaRecepcion"),
    };
  } catch (error) {
    return {
      estado: "error_red",
      estadoOriginal: "Error de red o de servicio DGII",
      mensajes: [error instanceof Error ? error.message : "No se pudo consultar el estado en DGII"],
    };
  }
}
