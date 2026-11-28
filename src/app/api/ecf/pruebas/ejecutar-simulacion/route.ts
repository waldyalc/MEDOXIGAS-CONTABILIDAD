import type {
  ModoEjecucionSimulacionPaso4,
  ResultadoEnvioSimulacionPaso4Caso,
  ResultadoSimulacionPaso4Base,
  ResultadoValidacionSimulacionPaso4Caso,
} from "@/app/(main)/dashboard/configuracion/facturacion-electronica/_components/ecf-portal-tipos";
import { consultarResultadoFinalDgii } from "@/app/api/ecf/pruebas/ejecutar-excel/route";
import { getRol } from "@/lib/auth/rol";
import { enviarEcfDgii, obtenerTokenDgii } from "@/lib/ecf/cliente-dgii";
import { cargarCredencialesEcfServidor } from "@/lib/ecf/config-servidor";
import { construirUrlQrDgii } from "@/lib/ecf/endpoints";
import { firmarXmlDsig } from "@/lib/ecf/firma";
import { leerCertificadoPkcs12 } from "@/lib/ecf/pkcs12";
import {
  type CasoSimulacionPaso4,
  construirSetSimulacionPaso4,
  formatearFechaHoraRdActual,
  SECUENCIA_BASE_SIMULACION_DEFECTO,
  SECUENCIA_BASE_SIMULACION_MAX,
  SECUENCIA_BASE_SIMULACION_MIN,
  validarSetSimulacionPaso4Local,
} from "@/lib/ecf/simulacion-paso4";
import type { EstadoDgii, ParCertificadoEcf } from "@/lib/ecf/tipos";
import { validarXmlContraEsquemaDgii } from "@/lib/ecf/validador-xsd";
import { esElegibleRfce, generarXmlEcf, generarXmlRfce } from "@/lib/ecf/xml";
import { createClient } from "@/lib/supabase/server";
import type { Database, Json } from "@/lib/supabase/types";

export const runtime = "nodejs";

const TAMANO_MAXIMO_CERTIFICADO = 2 * 1024 * 1024;

type ClienteSupabase = Awaited<ReturnType<typeof createClient>>;
type AmbientePruebas = "testecf" | "certecf";

interface CredencialesResueltas {
  credenciales: ParCertificadoEcf;
  fuente: "formulario" | "variables_servidor" | "base_datos";
}

export interface EnvioSimulacionExistente {
  id: string;
  encf: string;
  intentos: number;
  estado: string;
  track_id: string | null;
  codigo_seguridad: string | null;
  fecha_hora_firma: string | null;
  url_qr: string | null;
  xml_firmado: string | null;
  xml_rfce: string | null;
  mensajes: string[] | null;
  secuencia_utilizada: boolean | null;
}

interface EntradaValidada {
  modo: ModoEjecucionSimulacionPaso4;
  ambiente: AmbientePruebas;
  rncEmisor: string;
  razonSocial: string;
  direccionEmisor?: string;
  telefonoEmisor?: string;
  correoEmisor?: string;
  secuenciaBase: number;
}

type ResultadoValidacionEntrada = EntradaValidada | { error: string; status: number };
type ResultadoCredenciales = CredencialesResueltas | { error: string; status: number };

function jsonError(mensaje: string, status: number) {
  return Response.json({ ok: false, error: mensaje }, { status });
}

function textoForm(form: FormData, nombre: string): string {
  const valor = form.get(nombre);
  return typeof valor === "string" ? valor : "";
}

function textoOpcionalForm(form: FormData, nombre: string): string | undefined {
  const limpio = textoForm(form, nombre).trim();
  return limpio === "" ? undefined : limpio;
}

function archivoForm(form: FormData, nombre: string): File | null {
  const valor = form.get(nombre);
  if (typeof valor !== "object" || valor === null) return null;
  if (!("arrayBuffer" in valor) || !("name" in valor) || !("size" in valor)) return null;
  const archivo = valor as File;
  return archivo.name !== "" && archivo.size > 0 ? archivo : null;
}

function nombreConExtension(nombre: string, extensiones: readonly string[]): boolean {
  const limpio = nombre.trim().toLowerCase();
  return extensiones.some((extension) => limpio.endsWith(extension));
}

function pemEnv(nombre: string): string | null {
  const valor = process.env[nombre]?.trim();
  return valor ? valor.replace(/\\n/g, "\n") : null;
}

function ambienteDesdeTexto(valor: string): AmbientePruebas | { error: string } {
  const ambiente = valor.trim();
  if (ambiente === "ecf" || ambiente === "produccion") {
    return {
      error: "El runner de simulación del Paso 4 nunca puede apuntar a Producción (ecf); usa TesteCF o CerteCF.",
    };
  }
  if (ambiente === "testecf" || ambiente === "certecf") return ambiente;
  return { error: "El ambiente debe ser testecf o certecf." };
}

function secuenciaBaseDesdeTexto(valor: string): number | { error: string } {
  const limpio = valor.trim();
  if (limpio === "") return SECUENCIA_BASE_SIMULACION_DEFECTO;
  if (!/^\d+$/.test(limpio)) {
    return { error: "La secuencia base debe ser un entero exacto expresado solo con dígitos." };
  }
  const secuencia = Number.parseInt(limpio, 10);
  if (
    !Number.isSafeInteger(secuencia) ||
    secuencia < SECUENCIA_BASE_SIMULACION_MIN ||
    secuencia > SECUENCIA_BASE_SIMULACION_MAX
  ) {
    return {
      error: `La secuencia base debe estar entre ${SECUENCIA_BASE_SIMULACION_MIN} y ${SECUENCIA_BASE_SIMULACION_MAX}.`,
    };
  }
  return secuencia;
}

function validarEntrada(form: FormData): ResultadoValidacionEntrada {
  const modo = textoForm(form, "modo");
  if (modo !== "validar_local" && modo !== "enviar_dgii") {
    return { error: "El modo debe ser validar_local o enviar_dgii.", status: 400 };
  }

  const ambiente = ambienteDesdeTexto(textoForm(form, "ambiente"));
  if (typeof ambiente === "object") return { error: ambiente.error, status: 400 };

  const rncEmisor = textoForm(form, "rncEmisor").trim();
  if (!/^\d{9}(\d{2})?$/.test(rncEmisor)) {
    return { error: "El RNC del emisor debe contener solo dígitos y tener 9 u 11 caracteres.", status: 400 };
  }

  const razonSocial = textoForm(form, "razonSocial").trim();
  if (razonSocial === "") return { error: "La razón social del emisor es obligatoria.", status: 400 };

  const secuenciaBase = secuenciaBaseDesdeTexto(textoForm(form, "secuenciaBase"));
  if (typeof secuenciaBase === "object") return { error: secuenciaBase.error, status: 400 };

  return {
    modo,
    ambiente,
    rncEmisor,
    razonSocial,
    direccionEmisor: textoOpcionalForm(form, "direccionEmisor"),
    telefonoEmisor: textoOpcionalForm(form, "telefonoEmisor"),
    correoEmisor: textoOpcionalForm(form, "correoEmisor"),
    secuenciaBase,
  };
}

async function credencialesDesdeFormulario(form: FormData): Promise<ResultadoCredenciales | null> {
  const archivo = archivoForm(form, "certificadoP12");
  if (!archivo) return null;
  if (!nombreConExtension(archivo.name, [".p12", ".pfx"])) {
    return { error: "El certificado para firmar debe ser un archivo .p12 o .pfx.", status: 400 };
  }
  if (archivo.size > TAMANO_MAXIMO_CERTIFICADO) {
    return { error: "El certificado para firmar no puede superar 2 MB.", status: 400 };
  }
  const contrasena = textoForm(form, "contrasenaP12");
  if (contrasena.length === 0) {
    return { error: "Debes escribir la contraseña del certificado .p12 para firmar la simulación.", status: 400 };
  }
  try {
    const leido = await leerCertificadoPkcs12(Buffer.from(await archivo.arrayBuffer()), contrasena);
    return {
      credenciales: { clavePrivadaPem: leido.clavePrivadaPem, certificadoPem: leido.certificadoPem },
      fuente: "formulario",
    };
  } catch (error) {
    return {
      error: error instanceof Error ? error.message : "El certificado PKCS#12 no pudo validarse.",
      status: 400,
    };
  }
}

async function resolverCredenciales(
  supabase: ClienteSupabase,
  form: FormData,
  rncEmisor: string,
): Promise<ResultadoCredenciales> {
  const desdeFormulario = await credencialesDesdeFormulario(form);
  if (desdeFormulario) return desdeFormulario;

  const desdeServidor = await cargarCredencialesEcfServidor(supabase, rncEmisor);
  if (desdeServidor.ok) {
    return {
      credenciales: desdeServidor.credenciales,
      fuente: desdeServidor.origen === "env" ? "variables_servidor" : "base_datos",
    };
  }

  const certificadoPem = pemEnv(`ECF_CERT_PEM_${rncEmisor}`);
  const clavePrivadaPem = pemEnv(`ECF_KEY_PEM_${rncEmisor}`);
  if (certificadoPem && clavePrivadaPem) {
    return { credenciales: { certificadoPem, clavePrivadaPem }, fuente: "variables_servidor" };
  }
  if (certificadoPem || clavePrivadaPem) {
    return {
      error: `Las variables ECF_CERT_PEM_${rncEmisor} y ECF_KEY_PEM_${rncEmisor} deben estar configuradas juntas.`,
      status: 500,
    };
  }
  return {
    error: desdeServidor.error,
    status: desdeServidor.motivo === "sin_clave_maestra" ? 500 : 400,
  };
}

function serializarJson(valor: unknown): Json {
  return JSON.parse(JSON.stringify(valor)) as Json;
}

function estadoDesdeTexto(valor: string): EstadoDgii {
  const texto = valor
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase();
  if (texto.includes("aceptado") && texto.includes("condicional")) return "aceptado_condicional";
  if (texto.includes("aceptado")) return "aceptado";
  if (texto.includes("rechazado")) return "rechazado";
  if (texto.includes("error")) return "error_red";
  return "en_proceso";
}

function nombreArchivoEcf(rncEmisor: string, encf: string): string {
  return `${rncEmisor}${encf}.xml`;
}

function baseResultado(caso: CasoSimulacionPaso4, rncEmisor: string): ResultadoSimulacionPaso4Base {
  const documento = caso.documento;
  return {
    numeroCaso: caso.numeroCaso,
    faseOrden: caso.faseOrden,
    categoria: caso.categoria,
    descripcion: caso.descripcion,
    encf: documento.comprobante.encf,
    tipo: documento.comprobante.tipo,
    montoTotal: documento.totales.montoTotal,
    esRfce: caso.esRfce,
    ncfModificado: documento.comprobante.ncfModificado ?? null,
    nombreArchivoEcf: nombreArchivoEcf(rncEmisor, documento.comprobante.encf),
  };
}

function casosValidadosParaRespuesta(
  casos: readonly CasoSimulacionPaso4[],
  validacion: ReturnType<typeof validarSetSimulacionPaso4Local>,
  rncEmisor: string,
): ResultadoValidacionSimulacionPaso4Caso[] {
  return casos.map((caso, indice) => {
    const validado = validacion.casos[indice];
    if (!validado) throw new Error(`La validación local no devolvió el caso ${caso.numeroCaso}`);
    return {
      ...validado,
      ncfModificado: caso.documento.comprobante.ncfModificado ?? null,
      nombreArchivoEcf: nombreArchivoEcf(rncEmisor, caso.documento.comprobante.encf),
    };
  });
}

async function cargarEnviosExistentes(
  supabase: ClienteSupabase,
  rncEmisor: string,
  ambiente: AmbientePruebas,
  encfs: string[],
): Promise<Map<string, EnvioSimulacionExistente>> {
  const mapa = new Map<string, EnvioSimulacionExistente>();
  if (encfs.length === 0) return mapa;
  const { data, error } = await supabase
    .from("ecf_envios")
    .select(
      "id, encf, intentos, estado, track_id, codigo_seguridad, fecha_hora_firma, url_qr, xml_firmado, xml_rfce, mensajes, secuencia_utilizada",
    )
    .eq("rnc_emisor", rncEmisor)
    .eq("ambiente", ambiente)
    .eq("documento_tipo", "prueba")
    .in("encf", encfs)
    .returns<EnvioSimulacionExistente[]>();
  if (error) throw new Error(`No se pudo leer la trazabilidad previa de simulación: ${error.message}`);
  for (const fila of data ?? []) mapa.set(fila.encf, fila);
  return mapa;
}

export function resultadoDesdeEnvioSimulacionAceptado(
  caso: CasoSimulacionPaso4,
  rncEmisor: string,
  existente: EnvioSimulacionExistente,
): ResultadoEnvioSimulacionPaso4Caso | null {
  if (existente.estado !== "aceptado" && existente.estado !== "aceptado_condicional") return null;
  if (existente.secuencia_utilizada === false) return null;
  if (existente.xml_firmado === null || existente.xml_firmado.trim() === "") return null;
  if (caso.esRfce && (existente.xml_rfce === null || existente.xml_rfce.trim() === "")) return null;
  return {
    ...baseResultado(caso, rncEmisor),
    trackId: existente.track_id,
    estado: existente.estado,
    codigoSeguridad: existente.codigo_seguridad,
    fechaHoraFirma: existente.fecha_hora_firma,
    mensajes:
      existente.mensajes && existente.mensajes.length > 0
        ? existente.mensajes
        : ["Ya aceptado previamente en DGII (conservado sin reenviar)"],
    urlQr: existente.url_qr,
    duracionMs: 0,
    xmlFirmado: existente.xml_firmado,
    xmlRfce: existente.xml_rfce,
    reutilizado: true,
    secuenciaUtilizada: existente.secuencia_utilizada,
    persistido: true,
    errorPersistencia: null,
  };
}

function resultadoReutilizado(
  caso: CasoSimulacionPaso4,
  rncEmisor: string,
  existentes: Map<string, EnvioSimulacionExistente>,
): ResultadoEnvioSimulacionPaso4Caso | null {
  const existente = existentes.get(caso.documento.comprobante.encf);
  return existente ? resultadoDesdeEnvioSimulacionAceptado(caso, rncEmisor, existente) : null;
}

async function guardarTrazabilidad(args: {
  supabase: ClienteSupabase;
  rncEmisor: string;
  ambiente: AmbientePruebas;
  resultado: ResultadoEnvioSimulacionPaso4Caso;
  respuesta: unknown;
  existente: EnvioSimulacionExistente | null;
}): Promise<{ persistido: boolean; error: string | null }> {
  const ahora = new Date().toISOString();
  const fila: Database["public"]["Tables"]["ecf_envios"]["Insert"] = {
    rnc_emisor: args.rncEmisor,
    documento_tipo: "prueba",
    documento_id: null,
    tipo_ecf: args.resultado.tipo,
    encf: args.resultado.encf,
    es_rfce: args.resultado.esRfce,
    ambiente: args.ambiente,
    estado: args.resultado.estado,
    track_id: args.resultado.trackId,
    codigo_seguridad: args.resultado.codigoSeguridad,
    fecha_hora_firma: args.resultado.fechaHoraFirma,
    url_qr: args.resultado.urlQr,
    xml_firmado: args.resultado.xmlFirmado,
    xml_rfce: args.resultado.xmlRfce,
    respuesta_dgii: serializarJson(args.respuesta),
    mensajes: args.resultado.mensajes,
    secuencia_utilizada: args.resultado.secuenciaUtilizada,
    intentos: (args.existente?.intentos ?? 0) + 1,
    ultimo_intento_at: ahora,
  };

  try {
    const consulta = args.existente
      ? await args.supabase.from("ecf_envios").update(fila).eq("id", args.existente.id)
      : await args.supabase.from("ecf_envios").insert(fila);
    if (consulta.error) return { persistido: false, error: consulta.error.message };
    return { persistido: true, error: null };
  } catch (error) {
    return {
      persistido: false,
      error: error instanceof Error ? error.message : "No se pudo guardar la trazabilidad de simulación.",
    };
  }
}

function esperarReintentoRed(ms: number): Promise<void> {
  return new Promise((resolver) => {
    setTimeout(resolver, ms);
  });
}

function esErrorRedTransitorio(error: unknown): boolean {
  if (!(error instanceof Error)) return false;
  const texto = error.message.toLowerCase();
  return (
    texto.includes("fetch failed") ||
    texto.includes("econnreset") ||
    texto.includes("etimedout") ||
    texto.includes("socket") ||
    texto.includes("network") ||
    texto.includes("und_err")
  );
}

async function enviarEcfDgiiConReintentoRed(
  args: Parameters<typeof enviarEcfDgii>[0],
  maxIntentos = 3,
): Promise<Awaited<ReturnType<typeof enviarEcfDgii>>> {
  let ultimoError: unknown;
  for (let intento = 1; intento <= maxIntentos; intento += 1) {
    try {
      return await enviarEcfDgii(args);
    } catch (error) {
      ultimoError = error;
      if (!esErrorRedTransitorio(error) || intento === maxIntentos) throw error;
      await esperarReintentoRed(intento * 1200);
    }
  }
  throw ultimoError;
}

// biome-ignore lint/complexity/noExcessiveCognitiveComplexity: coordina XSD, firma, RFCE, envío DGII, consulta y trazabilidad por cada caso sin ocultar errores
async function procesarEnvioCaso(args: {
  caso: CasoSimulacionPaso4;
  ambiente: AmbientePruebas;
  rncEmisor: string;
  token: string;
  credenciales: ParCertificadoEcf;
  supabase: ClienteSupabase;
  existente: EnvioSimulacionExistente | null;
}): Promise<ResultadoEnvioSimulacionPaso4Caso> {
  const inicio = Date.now();
  const base = baseResultado(args.caso, args.rncEmisor);
  const fechaHoraFirma = formatearFechaHoraRdActual();
  const documento = {
    ...args.caso.documento,
    comprobante: { ...args.caso.documento.comprobante, fechaHoraFirma },
  };
  let resultado: ResultadoEnvioSimulacionPaso4Caso = {
    ...base,
    trackId: null,
    estado: "pendiente",
    codigoSeguridad: null,
    fechaHoraFirma,
    mensajes: [],
    urlQr: null,
    duracionMs: 0,
    xmlFirmado: null,
    xmlRfce: null,
    reutilizado: false,
    secuenciaUtilizada: null,
    persistido: false,
    errorPersistencia: null,
  };
  let respuesta: unknown = {};
  let trackId: string | null = null;
  let codigoSeguridad: string | null = null;
  let xmlFirmado: string | null = null;
  let xmlRfce: string | null = null;
  let secuenciaUtilizada: boolean | null = null;

  try {
    const xml = generarXmlEcf(documento);
    const validacionEcf = validarXmlContraEsquemaDgii(xml, "ECF");
    if (!validacionEcf.valido) throw new Error(`XML e-CF inválido: ${validacionEcf.errores.join("; ")}`);
    const firmaEcf = firmarXmlDsig(xml, args.credenciales.clavePrivadaPem, args.credenciales.certificadoPem);
    codigoSeguridad = firmaEcf.codigoSeguridad;
    xmlFirmado = firmaEcf.xmlFirmado;
    let xmlEnvio = firmaEcf.xmlFirmado;

    if (args.caso.esRfce) {
      if (!esElegibleRfce(documento)) throw new Error("El caso RFCE no es elegible por tipo o monto");
      const rfce = generarXmlRfce(documento, firmaEcf.codigoSeguridad);
      const validacionRfce = validarXmlContraEsquemaDgii(rfce, "RFCE");
      if (!validacionRfce.valido) throw new Error(`XML RFCE inválido: ${validacionRfce.errores.join("; ")}`);
      const firmaRfce = firmarXmlDsig(rfce, args.credenciales.clavePrivadaPem, args.credenciales.certificadoPem);
      xmlEnvio = firmaRfce.xmlFirmado;
      xmlRfce = firmaRfce.xmlFirmado;
    }

    const enviado = await enviarEcfDgiiConReintentoRed({
      ambiente: args.ambiente,
      token: args.token,
      nombreArchivo: base.nombreArchivoEcf,
      xmlFirmado: xmlEnvio,
      esRfce: args.caso.esRfce,
      confirmarProduccion: false,
    });
    trackId = enviado.trackId ?? null;
    let estado: EstadoDgii = estadoDesdeTexto(enviado.estado);
    let mensajes = enviado.mensajes;
    respuesta = { recepcion: enviado };

    if (!args.caso.esRfce && enviado.trackId) {
      const consultaFinal = await consultarResultadoFinalDgii({
        ambiente: args.ambiente,
        token: args.token,
        trackId: enviado.trackId,
        maxIntentos: 8,
        esperaInicialMs: 1500,
      });
      const consulta = consultaFinal.consulta;
      estado = consulta.estado;
      mensajes = consulta.mensajes.length > 0 ? consulta.mensajes : mensajes;
      secuenciaUtilizada = consulta.secuenciaUtilizada ?? null;
      respuesta = {
        recepcion: enviado,
        consulta,
        intentosConsulta: consultaFinal.intentosConsulta,
        consultaAgotada: consultaFinal.agotado,
      };
    }

    const urlQr =
      estado === "aceptado" || estado === "aceptado_condicional"
        ? construirUrlQrDgii({
            ambiente: args.ambiente,
            rncEmisor: args.rncEmisor,
            rncComprador: documento.comprador.rnc ?? "",
            encf: documento.comprobante.encf,
            fechaEmision: documento.comprobante.fechaEmision,
            montoTotal: documento.totales.montoTotal.toFixed(2),
            fechaFirma: fechaHoraFirma,
            codigoSeguridad: firmaEcf.codigoSeguridad,
            esRfce: args.caso.esRfce,
          })
        : null;

    resultado = {
      ...resultado,
      estado,
      trackId,
      codigoSeguridad,
      mensajes,
      urlQr,
      xmlFirmado,
      xmlRfce,
      secuenciaUtilizada,
      duracionMs: Date.now() - inicio,
    };
  } catch (error) {
    const mensaje = error instanceof Error ? error.message : "No se pudo enviar el caso de simulación a la DGII";
    respuesta = { error: mensaje };
    resultado = {
      ...resultado,
      estado: "error_red",
      trackId,
      codigoSeguridad,
      mensajes: [mensaje],
      xmlFirmado,
      xmlRfce,
      secuenciaUtilizada,
      duracionMs: Date.now() - inicio,
    };
  }

  const persistencia = await guardarTrazabilidad({
    supabase: args.supabase,
    rncEmisor: args.rncEmisor,
    ambiente: args.ambiente,
    resultado,
    respuesta,
    existente: args.existente,
  });
  return {
    ...resultado,
    duracionMs: resultado.duracionMs || Date.now() - inicio,
    persistido: persistencia.persistido,
    errorPersistencia: persistencia.error,
  };
}

async function tokenParaCasosPendientes(args: {
  ambiente: AmbientePruebas;
  credenciales: ParCertificadoEcf;
}): Promise<{ token: string } | { error: string; status: number }> {
  try {
    const tokenDgii = await obtenerTokenDgii({
      ambiente: args.ambiente,
      clavePrivadaPem: args.credenciales.clavePrivadaPem,
      certificadoPem: args.credenciales.certificadoPem,
      confirmarProduccion: false,
    });
    return { token: tokenDgii.token };
  } catch (error) {
    return {
      error: error instanceof Error ? error.message : "La DGII no pudo autenticar el certificado del emisor.",
      status: 502,
    };
  }
}

function contarPorEstado(resultados: readonly ResultadoEnvioSimulacionPaso4Caso[]) {
  const aceptados = resultados.filter(
    (caso) => caso.estado === "aceptado" || caso.estado === "aceptado_condicional",
  ).length;
  const rechazados = resultados.filter((caso) => caso.estado === "rechazado").length;
  const errores = resultados.filter((caso) => caso.estado === "error_red").length;
  return {
    aceptados,
    rechazados,
    errores,
    enProceso: resultados.length - aceptados - rechazados - errores,
    reutilizados: resultados.filter((caso) => caso.reutilizado).length,
  };
}

// biome-ignore lint/complexity/noExcessiveCognitiveComplexity: orquesta idempotencia, credenciales diferidas, secuencia oficial y candado anti-reinicio en un único flujo auditable
async function ejecutarEnvioDgii(args: {
  form: FormData;
  casos: CasoSimulacionPaso4[];
  entrada: Omit<EntradaValidada, "modo"> & { modo: "enviar_dgii" };
}): Promise<Response> {
  const supabase = await createClient();
  const encfs = [...new Set(args.casos.map((caso) => caso.documento.comprobante.encf))];
  let existentes: Map<string, EnvioSimulacionExistente>;
  try {
    existentes = await cargarEnviosExistentes(supabase, args.entrada.rncEmisor, args.entrada.ambiente, encfs);
  } catch (error) {
    return jsonError(
      error instanceof Error ? error.message : "No se pudo leer la trazabilidad previa de simulación.",
      500,
    );
  }

  const hayCasosPendientes = args.casos.some(
    (caso) => resultadoReutilizado(caso, args.entrada.rncEmisor, existentes) === null,
  );
  let credencialesResueltas: CredencialesResueltas | null = null;
  let token: string | null = null;
  if (hayCasosPendientes) {
    const resueltas = await resolverCredenciales(supabase, args.form, args.entrada.rncEmisor);
    if ("error" in resueltas) return jsonError(resueltas.error, resueltas.status);
    credencialesResueltas = resueltas;
    const tokenResuelto = await tokenParaCasosPendientes({
      ambiente: args.entrada.ambiente,
      credenciales: credencialesResueltas.credenciales,
    });
    if ("error" in tokenResuelto) return jsonError(tokenResuelto.error, tokenResuelto.status);
    token = tokenResuelto.token;
  }

  try {
    const resultados: ResultadoEnvioSimulacionPaso4Caso[] = [];
    let detenidoPorRechazo = false;
    for (const caso of args.casos) {
      const reutilizado = resultadoReutilizado(caso, args.entrada.rncEmisor, existentes);
      if (reutilizado) {
        resultados.push(reutilizado);
        continue;
      }
      if (token === null || credencialesResueltas === null) {
        throw new Error("No se obtuvo token DGII para los casos de simulación pendientes.");
      }
      const resultado = await procesarEnvioCaso({
        caso,
        ambiente: args.entrada.ambiente,
        rncEmisor: args.entrada.rncEmisor,
        token,
        credenciales: credencialesResueltas.credenciales,
        supabase,
        existente: existentes.get(caso.documento.comprobante.encf) ?? null,
      });
      resultados.push(resultado);
      if (args.entrada.ambiente === "certecf" && resultado.estado === "rechazado") {
        detenidoPorRechazo = true;
        break;
      }
    }

    const conteos = contarPorEstado(resultados);
    return Response.json({
      ok: true,
      modo: "enviar_dgii",
      ambiente: args.entrada.ambiente,
      rncEmisor: args.entrada.rncEmisor,
      secuenciaBase: args.entrada.secuenciaBase,
      totalCasos: args.casos.length,
      ...conteos,
      detenidoPorRechazo,
      ...(credencialesResueltas ? { fuenteCredenciales: credencialesResueltas.fuente } : {}),
      casos: resultados,
    });
  } catch (error) {
    return jsonError(
      error instanceof Error ? error.message : "No se pudo completar la simulación real ante la DGII.",
      500,
    );
  }
}

export async function POST(request: Request) {
  const rol = await getRol();
  if (!rol) return jsonError("Debes iniciar sesión para ejecutar las pruebas de simulación e-CF.", 401);
  if (rol !== "admin" && rol !== "contador") {
    return jsonError("Solo administradores y contadores pueden ejecutar las pruebas de simulación e-CF.", 403);
  }

  let form: FormData;
  try {
    form = await request.formData();
  } catch {
    return jsonError("El cuerpo debe ser multipart/form-data.", 400);
  }

  const entrada = validarEntrada(form);
  if ("error" in entrada) return jsonError(entrada.error, entrada.status);

  let casos: CasoSimulacionPaso4[];
  try {
    casos = construirSetSimulacionPaso4({
      rncEmisor: entrada.rncEmisor,
      razonSocial: entrada.razonSocial,
      direccionEmisor: entrada.direccionEmisor,
      telefonoEmisor: entrada.telefonoEmisor,
      correoEmisor: entrada.correoEmisor,
      secuenciaBase: entrada.secuenciaBase,
    });
  } catch (error) {
    return jsonError(
      error instanceof Error ? error.message : "No se pudo construir el set de simulación del Paso 4.",
      400,
    );
  }

  if (entrada.modo === "validar_local") {
    const validacion = validarSetSimulacionPaso4Local(casos);
    return Response.json({
      ok: true,
      modo: "validar_local",
      ambiente: entrada.ambiente,
      rncEmisor: entrada.rncEmisor,
      secuenciaBase: entrada.secuenciaBase,
      totalCasos: validacion.totalCasos,
      validos: validacion.validos,
      invalidos: validacion.invalidos,
      erroresGlobales: validacion.erroresGlobales,
      casos: casosValidadosParaRespuesta(casos, validacion, entrada.rncEmisor),
    });
  }

  return ejecutarEnvioDgii({ form, casos, entrada: { ...entrada, modo: "enviar_dgii" } });
}
