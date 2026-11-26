import type { ResultadoVerificacionXmlDsig } from "./firma";
import {
  canonicalizarXmlBasico,
  firmarXmlDsig,
  generarCertificadoPruebaAutocontenido,
  verificarFirmaXmlDsig,
} from "./firma";
import type { ParCertificadoEcf } from "./tipos";
import { escapeXml, generarXmlArecf } from "./xml";
import { createHmac, randomBytes, timingSafeEqual } from "node:crypto";

const RE_RNC = /^\d{9}(\d{2})?$/;
const RE_ENCF = /^E(31|32|33|34|41|43|44|45|46|47)\d{10}$/;
const VIGENCIA_SEMILLA_MS = 5 * 60 * 1000;
const VIGENCIA_TOKEN_MS = 60 * 60 * 1000;
const SECRETO_PRUEBA = "medoxigas-ecf-receptor-solo-pruebas";
const TIPOS_ECF_VALIDOS = new Set(["31", "32", "33", "34", "41", "43", "44", "45", "46", "47"]);
const certificadosPruebaPorRnc = new Map<string, ParCertificadoEcf>();

interface PayloadSelloReceptor {
  proposito: "semilla" | "token";
  rnc: string;
  nonce: string;
  expedidoMs: number;
  expiraMs: number;
}

export interface ResumenEcfRecibido {
  rncEmisor: string;
  razonSocialEmisor: string;
  tipoEcf: string;
  encf: string;
  fechaEmision: string;
  montoTotal: number;
  totalItbis: number;
  codigoSeguridad?: string;
  firmaValida: boolean;
}

export interface ResultadoRecepcionEcf {
  status: number;
  arecfXml: string;
  estadoArecf: "0" | "1";
  codigoMotivoNoRecibido?: "1" | "2" | "3" | "4";
  resumen?: ResumenEcfRecibido;
}

export interface ResultadoAprobacionComercialRecibida {
  ok: boolean;
  status: number;
  mensaje: string;
  datos?: {
    rncEmisor: string;
    rncComprador: string;
    encf: string;
    estado: "1" | "2";
    detalleMotivoRechazo?: string;
  };
}

interface DatosEcfXml {
  rncEmisor: string;
  razonSocialEmisor: string;
  tipoEcf: string;
  encf: string;
  fechaEmision: string;
  rncComprador: string;
  montoTotal: number;
  totalItbis: number;
  camposCompletos: boolean;
}

function esRnc(valor: string): boolean {
  return RE_RNC.test(valor);
}

function esEncf(valor: string): boolean {
  return RE_ENCF.test(valor);
}

function secretoReceptor(): string {
  const secreto = process.env.ECF_TOKEN_SECRET?.trim() ?? "";
  if (secreto !== "") return secreto;
  const clave = process.env.ECF_ENCRYPTION_KEY?.trim() ?? "";
  if (clave !== "") return clave;
  if (process.env.NODE_ENV === "test") return SECRETO_PRUEBA;
  throw new Error("Falta configurar ECF_TOKEN_SECRET o ECF_ENCRYPTION_KEY para el receptor e-CF");
}

function base64UrlTexto(texto: string): string {
  return Buffer.from(texto, "utf8").toString("base64url");
}

function firmarHmac(valor: string, secreto: string): string {
  return createHmac("sha256", secreto).update(valor, "utf8").digest("base64url");
}

function firmaCoincide(recibida: string, esperada: string): boolean {
  const izquierda = Buffer.from(recibida, "utf8");
  const derecha = Buffer.from(esperada, "utf8");
  return izquierda.length === derecha.length && timingSafeEqual(izquierda, derecha);
}

function crearSello(
  proposito: "semilla" | "token",
  rnc: string,
  vigenciaMs: number,
): { sello: string; expedidoMs: number; expiraMs: number } {
  const expedidoMs = Date.now();
  const expiraMs = expedidoMs + vigenciaMs;
  const payload: PayloadSelloReceptor = {
    proposito,
    rnc,
    nonce: randomBytes(24).toString("base64url"),
    expedidoMs,
    expiraMs,
  };
  const cuerpo = base64UrlTexto(JSON.stringify(payload));
  const firma = firmarHmac(`v1.${cuerpo}`, secretoReceptor());
  return { sello: `v1.${cuerpo}.${firma}`, expedidoMs, expiraMs };
}

function payloadValido(valor: unknown): PayloadSelloReceptor | null {
  if (typeof valor !== "object" || valor === null || Array.isArray(valor)) return null;
  const payload = valor as Record<string, unknown>;
  if (
    (payload.proposito !== "semilla" && payload.proposito !== "token") ||
    typeof payload.rnc !== "string" ||
    typeof payload.nonce !== "string" ||
    typeof payload.expedidoMs !== "number" ||
    typeof payload.expiraMs !== "number"
  ) {
    return null;
  }
  return {
    proposito: payload.proposito,
    rnc: payload.rnc,
    nonce: payload.nonce,
    expedidoMs: payload.expedidoMs,
    expiraMs: payload.expiraMs,
  };
}

function verificarSello(sello: string, proposito: "semilla" | "token", rnc: string): boolean {
  const partes = sello.split(".");
  if (partes.length !== 3 || partes[0] !== "v1") return false;
  const cuerpo = partes[1];
  const firma = partes[2];
  if (!cuerpo || !firma) return false;
  let secreto = "";
  try {
    secreto = secretoReceptor();
  } catch {
    return false;
  }
  if (!firmaCoincide(firma, firmarHmac(`v1.${cuerpo}`, secreto))) return false;
  try {
    const payload = payloadValido(JSON.parse(Buffer.from(cuerpo, "base64url").toString("utf8")));
    if (!payload || payload.proposito !== proposito || payload.rnc !== rnc) return false;
    const ahora = Date.now();
    return payload.expiraMs > ahora && payload.expedidoMs <= ahora + 60_000 && payload.expiraMs > payload.expedidoMs;
  } catch {
    return false;
  }
}

function fechaIsoOffsetRd(fechaMs: number): string {
  const rd = new Date(fechaMs - 4 * 60 * 60 * 1000);
  const pad = (valor: number) => String(valor).padStart(2, "0");
  return `${rd.getUTCFullYear()}-${pad(rd.getUTCMonth() + 1)}-${pad(rd.getUTCDate())}T${pad(rd.getUTCHours())}:${pad(rd.getUTCMinutes())}:${pad(rd.getUTCSeconds())}-04:00`;
}

function decodificarEntidadNumerica(entidad: string, codigo: string): string {
  const esHex = codigo.startsWith("#x");
  const numero = Number.parseInt(codigo.slice(esHex ? 2 : 1), esHex ? 16 : 10);
  if (!Number.isInteger(numero) || numero < 0 || numero > 0x10ffff) return entidad;
  return String.fromCodePoint(numero);
}

function decodificarEntidadesXml(texto: string): string {
  const entidades: Record<string, string> = { amp: "&", lt: "<", gt: ">", quot: `"`, apos: "'" };
  return texto.replace(/&(amp|lt|gt|quot|apos|#\d+|#x[0-9a-fA-F]+);/g, (entidad, codigo: string) => {
    return entidades[codigo] ?? decodificarEntidadNumerica(entidad, codigo);
  });
}

function escaparRegex(texto: string): string {
  return texto.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function extraerTextoEtiqueta(xml: string, nombre: string): string | null {
  const etiqueta = escaparRegex(nombre);
  const patron = new RegExp(
    `<(?:[A-Za-z_][\\w.-]*:)?${etiqueta}(?:\\s[^>]*)?>([\\s\\S]*?)<\\/(?:[A-Za-z_][\\w.-]*:)?${etiqueta}>`,
  );
  const valor = patron.exec(xml)?.[1];
  return valor === undefined ? null : decodificarEntidadesXml(valor).trim();
}

function raizXmlEs(xml: string, nombre: string): boolean {
  const etiqueta = escaparRegex(nombre);
  let inicio = xml.replace(/^\uFEFF/, "").trimStart();
  if (inicio.startsWith("<?xml")) {
    const finDeclaracion = inicio.indexOf("?>");
    if (finDeclaracion === -1) return false;
    inicio = inicio.slice(finDeclaracion + 2).trimStart();
  }
  const abre = new RegExp(`^<(?:[A-Za-z_][\\w.-]*:)?${etiqueta}(?:\\s[^>]*)?>`).test(inicio);
  const cierra = new RegExp(`<\\/(?:[A-Za-z_][\\w.-]*:)?${etiqueta}>\\s*$`).test(xml);
  return abre && cierra;
}

function xmlBienFormado(xml: string): boolean {
  try {
    canonicalizarXmlBasico(xml, true);
    return true;
  } catch {
    return false;
  }
}

function numeroEtiqueta(xml: string, nombre: string): number {
  const texto = extraerTextoEtiqueta(xml, nombre);
  if (texto === null || texto === "") return Number.NaN;
  return Number.parseFloat(texto);
}

function analizarEcf(xml: string): DatosEcfXml {
  const rncEmisor = extraerTextoEtiqueta(xml, "RNCEmisor") ?? "";
  const razonSocialEmisor = extraerTextoEtiqueta(xml, "RazonSocialEmisor") ?? "";
  const tipoEcf = extraerTextoEtiqueta(xml, "TipoeCF") ?? "";
  const encf = extraerTextoEtiqueta(xml, "eNCF") ?? "";
  const fechaEmision = extraerTextoEtiqueta(xml, "FechaEmision") ?? "";
  const rncComprador = extraerTextoEtiqueta(xml, "RNCComprador") ?? "";
  const montoTotal = numeroEtiqueta(xml, "MontoTotal");
  const totalItbis = numeroEtiqueta(xml, "TotalITBIS");
  const camposCompletos =
    esRnc(rncEmisor) &&
    razonSocialEmisor !== "" &&
    TIPOS_ECF_VALIDOS.has(tipoEcf) &&
    esEncf(encf) &&
    encf.slice(1, 3) === tipoEcf &&
    fechaEmision !== "" &&
    esRnc(rncComprador) &&
    Number.isFinite(montoTotal) &&
    Number.isFinite(totalItbis);
  return {
    rncEmisor,
    razonSocialEmisor,
    tipoEcf,
    encf,
    fechaEmision,
    rncComprador,
    montoTotal,
    totalItbis,
    camposCompletos,
  };
}

export function validarRncRuta(rnc: string): string | null {
  const limpio = rnc.trim();
  return esRnc(limpio) ? null : "El RNC de la ruta debe tener 9 u 11 dígitos";
}

export function emitirSemillaReceptor(rnc: string): { xml: string; valor: string; fecha: string } {
  const limpio = rnc.trim();
  if (!esRnc(limpio)) throw new Error("El RNC del receptor debe tener 9 u 11 dígitos");
  const sello = crearSello("semilla", limpio, VIGENCIA_SEMILLA_MS);
  const fecha = fechaIsoOffsetRd(sello.expedidoMs);
  const xml = `<?xml version="1.0" encoding="utf-8"?><SemillaModel><valor>${escapeXml(sello.sello)}</valor><fecha>${fecha}</fecha></SemillaModel>`;
  return { xml, valor: sello.sello, fecha };
}

export function validarSemillaFirmadaYCrearToken(
  xmlSemillaFirmada: string,
  rnc: string,
): { ok: true; token: string; expira: string; expedido: string } | { ok: false; error: string; status: number } {
  const limpio = rnc.trim();
  if (!esRnc(limpio)) return { ok: false, error: "El RNC de la ruta debe tener 9 u 11 dígitos", status: 400 };
  if (!raizXmlEs(xmlSemillaFirmada, "SemillaModel") || !xmlBienFormado(xmlSemillaFirmada)) {
    return { ok: false, error: "La semilla firmada no es un SemillaModel XML bien formado", status: 400 };
  }
  const valor = extraerTextoEtiqueta(xmlSemillaFirmada, "valor");
  const fecha = extraerTextoEtiqueta(xmlSemillaFirmada, "fecha");
  if (!valor || !fecha) return { ok: false, error: "La semilla firmada debe incluir valor y fecha", status: 400 };
  const firma = verificarFirmaXmlDsig(xmlSemillaFirmada);
  if (!firma.valida) {
    return {
      ok: false,
      error: `La firma XMLDSig de la semilla no es válida: ${firma.motivo ?? "firma rechazada"}`,
      status: 400,
    };
  }
  if (!verificarSello(valor, "semilla", limpio)) {
    return { ok: false, error: "La semilla no fue emitida para este RNC o ya expiró", status: 400 };
  }
  const token = crearSello("token", limpio, VIGENCIA_TOKEN_MS);
  return {
    ok: true,
    token: token.sello,
    expira: new Date(token.expiraMs).toISOString(),
    expedido: new Date(token.expedidoMs).toISOString(),
  };
}

export function verificarTokenReceptor(authorizationHeader: string | null, rnc: string): boolean {
  const limpio = rnc.trim();
  if (!esRnc(limpio) || !authorizationHeader) return false;
  const partes = authorizationHeader.trim().split(/\s+/);
  if (partes.length !== 2 || partes[0]?.toLowerCase() !== "bearer") return false;
  const token = partes[1];
  return token !== undefined && verificarSello(token, "token", limpio);
}

function codigoMotivoNoRecibido(
  datos: DatosEcfXml,
  estructuraValida: boolean,
  verificacion: ResultadoVerificacionXmlDsig,
  rncReceptor: string,
): "1" | "2" | "4" | undefined {
  if (!estructuraValida || !datos.camposCompletos) return "1";
  if (!verificacion.valida) return "2";
  if (datos.rncComprador !== rncReceptor) return "4";
  return undefined;
}

function firmarAcuseRecepcion(args: {
  datos: DatosEcfXml;
  estado: "0" | "1";
  codigoMotivo: "1" | "2" | "4" | undefined;
  rncReceptor: string;
  clavePrivadaPem: string;
  certificadoPem: string;
}): string {
  try {
    const acuse = generarXmlArecf({
      rncEmisor: args.datos.rncEmisor,
      rncComprador: esRnc(args.datos.rncComprador) ? args.datos.rncComprador : args.rncReceptor,
      encf: args.datos.encf,
      estado: args.estado,
      codigoMotivoNoRecibido: args.codigoMotivo,
      fechaHoraAcuseRecibo: new Date().toISOString(),
    });
    return firmarXmlDsig(acuse, args.clavePrivadaPem, args.certificadoPem).xmlFirmado;
  } catch {
    return "";
  }
}

function resumenRecepcion(
  datos: DatosEcfXml,
  verificacion: ResultadoVerificacionXmlDsig,
): ResumenEcfRecibido | undefined {
  const completo =
    esRnc(datos.rncEmisor) &&
    datos.razonSocialEmisor !== "" &&
    TIPOS_ECF_VALIDOS.has(datos.tipoEcf) &&
    esEncf(datos.encf) &&
    Number.isFinite(datos.montoTotal) &&
    Number.isFinite(datos.totalItbis);
  if (!completo) return undefined;
  return {
    rncEmisor: datos.rncEmisor,
    razonSocialEmisor: datos.razonSocialEmisor,
    tipoEcf: datos.tipoEcf,
    encf: datos.encf,
    fechaEmision: datos.fechaEmision,
    montoTotal: datos.montoTotal,
    totalItbis: datos.totalItbis,
    codigoSeguridad: verificacion.valida ? verificacion.codigoSeguridad : undefined,
    firmaValida: verificacion.valida,
  };
}

export function procesarRecepcionEcf(args: {
  rncReceptor: string;
  xmlCrudo: string;
  clavePrivadaPem: string;
  certificadoPem: string;
}): ResultadoRecepcionEcf {
  const rncReceptor = args.rncReceptor.trim();
  if (!esRnc(rncReceptor)) return { status: 400, arecfXml: "", estadoArecf: "1", codigoMotivoNoRecibido: "1" };

  const datos = analizarEcf(args.xmlCrudo);
  const estructuraValida = raizXmlEs(args.xmlCrudo, "ECF") && xmlBienFormado(args.xmlCrudo);
  const verificacion: ResultadoVerificacionXmlDsig = estructuraValida
    ? verificarFirmaXmlDsig(args.xmlCrudo)
    : { valida: false, motivo: "XML mal formado" };
  const codigoMotivo = codigoMotivoNoRecibido(datos, estructuraValida, verificacion, rncReceptor);
  const estado: "0" | "1" = codigoMotivo === undefined ? "0" : "1";
  const identificadoresValidos = esRnc(datos.rncEmisor) && esEncf(datos.encf);
  const arecfXml = identificadoresValidos
    ? firmarAcuseRecepcion({
        datos,
        estado,
        codigoMotivo,
        rncReceptor,
        clavePrivadaPem: args.clavePrivadaPem,
        certificadoPem: args.certificadoPem,
      })
    : "";
  if (identificadoresValidos && arecfXml === "") {
    return { status: 500, arecfXml: "", estadoArecf: estado, codigoMotivoNoRecibido: codigoMotivo };
  }

  return {
    status: arecfXml === "" ? 400 : 200,
    arecfXml,
    estadoArecf: estado,
    codigoMotivoNoRecibido: codigoMotivo,
    resumen: resumenRecepcion(datos, verificacion),
  };
}

interface DatosAprobacionXml {
  rncEmisor: string;
  rncComprador: string;
  encf: string;
  estado: "1" | "2" | null;
  detalleMotivoRechazo?: string;
}

function analizarAprobacionXml(xml: string): DatosAprobacionXml {
  const estadoTexto = extraerTextoEtiqueta(xml, "Estado") ?? "";
  return {
    rncEmisor: extraerTextoEtiqueta(xml, "RNCEmisor") ?? "",
    rncComprador: extraerTextoEtiqueta(xml, "RNCComprador") ?? "",
    encf: extraerTextoEtiqueta(xml, "eNCF") ?? "",
    estado: estadoTexto === "1" || estadoTexto === "2" ? estadoTexto : null,
    detalleMotivoRechazo: extraerTextoEtiqueta(xml, "DetalleMotivoRechazo") ?? undefined,
  };
}

function errorCamposAprobacion(datos: DatosAprobacionXml, rncReceptor: string): string | null {
  if (!esRnc(datos.rncEmisor) || !esRnc(datos.rncComprador) || !esEncf(datos.encf) || datos.estado === null) {
    return "El ACECF no cumple los campos mínimos del formato DGII";
  }
  if (datos.rncComprador !== rncReceptor) return "El RNCComprador del ACECF no corresponde con el RNC de la ruta";
  if (datos.estado === "2" && !datos.detalleMotivoRechazo?.trim()) {
    return "El rechazo comercial debe incluir DetalleMotivoRechazo";
  }
  return null;
}

export function procesarAprobacionComercialRecibida(args: {
  rncReceptor: string;
  xmlCrudo: string;
}): ResultadoAprobacionComercialRecibida {
  const rncReceptor = args.rncReceptor.trim();
  if (!esRnc(rncReceptor)) return { ok: false, status: 400, mensaje: "El RNC receptor de la ruta es inválido" };
  if (!raizXmlEs(args.xmlCrudo, "ACECF") || !xmlBienFormado(args.xmlCrudo)) {
    return { ok: false, status: 400, mensaje: "El XML recibido no es un ACECF bien formado" };
  }
  const firma = verificarFirmaXmlDsig(args.xmlCrudo);
  if (!firma.valida) {
    return {
      ok: false,
      status: 400,
      mensaje: `La firma XMLDSig del ACECF no es válida: ${firma.motivo ?? "firma rechazada"}`,
    };
  }
  const datos = analizarAprobacionXml(args.xmlCrudo);
  const error = errorCamposAprobacion(datos, rncReceptor);
  if (error !== null) return { ok: false, status: 400, mensaje: error };
  if (datos.estado === null)
    return { ok: false, status: 400, mensaje: "El ACECF no cumple los campos mínimos del formato DGII" };
  return {
    ok: true,
    status: 200,
    mensaje: datos.estado === "1" ? "Aprobación comercial recibida" : "Rechazo comercial recibido",
    datos: {
      rncEmisor: datos.rncEmisor,
      rncComprador: datos.rncComprador,
      encf: datos.encf,
      estado: datos.estado,
      detalleMotivoRechazo: datos.detalleMotivoRechazo,
    },
  };
}

function normalizarPem(valor: string): string {
  return valor.includes("\\n") ? valor.replace(/\\n/g, "\n") : valor;
}

export function resolverCredencialesFirmaRnc(rnc: string): ParCertificadoEcf | null {
  const limpio = rnc.trim();
  if (!esRnc(limpio)) return null;
  const certificado = process.env[`ECF_CERT_PEM_${limpio}`];
  const clave = process.env[`ECF_KEY_PEM_${limpio}`];
  if (certificado?.trim() && clave?.trim()) {
    return { certificadoPem: normalizarPem(certificado), clavePrivadaPem: normalizarPem(clave) };
  }
  if (process.env.ECF_ALLOW_TEST_SELF_SIGNED === "true" && process.env.NODE_ENV !== "production") {
    const existente = certificadosPruebaPorRnc.get(limpio);
    if (existente) return existente;
    const generado = generarCertificadoPruebaAutocontenido(limpio, `RECEPTOR DE PRUEBA ${limpio}`);
    certificadosPruebaPorRnc.set(limpio, generado);
    return generado;
  }
  return null;
}

export async function leerXmlMultipart(formData: FormData): Promise<string | null> {
  const entrada = formData.get("xml");
  if (typeof entrada === "string") return entrada === "" ? null : entrada;
  if (!entrada) return null;
  try {
    const bytes = await entrada.arrayBuffer();
    return new TextDecoder("utf-8", { fatal: true }).decode(bytes);
  } catch {
    return null;
  }
}
