import type {
  ResultadoEnvioExcelCaso,
  ResultadoExcelBase,
  ResultadoValidacionExcelCaso,
} from "@/app/(main)/dashboard/configuracion/facturacion-electronica/_components/ecf-portal-tipos";
import { getRol } from "@/lib/auth/rol";
import { consultarResultadoDgii, enviarEcfDgii, obtenerTokenDgii } from "@/lib/ecf/cliente-dgii";
import { cargarCredencialesEcfServidor } from "@/lib/ecf/config-servidor";
import { construirUrlQrDgii } from "@/lib/ecf/endpoints";
import { parsearExcelPruebasDgii } from "@/lib/ecf/excel-pruebas";
import { firmarXmlDsig } from "@/lib/ecf/firma";
import { leerCertificadoPkcs12 } from "@/lib/ecf/pkcs12";
import type { CasoExcelDgii, EstadoDgii, ParCertificadoEcf } from "@/lib/ecf/tipos";
import { validarXmlContraEsquemaDgii } from "@/lib/ecf/validador-xsd";
import { esElegibleRfce, formatearFechaHoraDgii, generarXmlEcf, generarXmlRfce } from "@/lib/ecf/xml";
import { createClient } from "@/lib/supabase/server";
import type { Database, Json } from "@/lib/supabase/types";

export const runtime = "nodejs";

const TAMANO_MAXIMO_EXCEL = 5 * 1024 * 1024;
const TAMANO_MAXIMO_CERTIFICADO = 2 * 1024 * 1024;

type ClienteSupabase = Awaited<ReturnType<typeof createClient>>;
type AmbientePruebas = "testecf" | "certecf";
type ModoEjecucion = "validar_local" | "enviar_testecf";

interface CredencialesResueltas {
  credenciales: ParCertificadoEcf;
  fuente: "formulario" | "variables_servidor" | "base_datos";
}

interface EnvioExistente {
  id: string;
  encf: string;
  intentos: number;
}

function jsonError(mensaje: string, status: number) {
  return Response.json({ ok: false, error: mensaje }, { status });
}

function textoForm(form: FormData, nombre: string): string {
  const valor = form.get(nombre);
  return typeof valor === "string" ? valor : "";
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

// biome-ignore lint/complexity/noExcessiveCognitiveComplexity: resuelve de forma explícita y segura las custodias permitidas (archivo puntual, certificado cifrado guardado en BD o PEM de servidor)
async function resolverCredenciales(
  supabase: ClienteSupabase,
  form: FormData,
  rnc: string,
): Promise<CredencialesResueltas | { error: string; status: number }> {
  const archivo = archivoForm(form, "certificadoP12");
  if (archivo) {
    if (!nombreConExtension(archivo.name, [".p12", ".pfx"])) {
      return { error: "El certificado para firmar debe ser un archivo .p12 o .pfx.", status: 400 };
    }
    if (archivo.size > TAMANO_MAXIMO_CERTIFICADO) {
      return { error: "El certificado para firmar no puede superar 2 MB.", status: 400 };
    }
    const contrasena = textoForm(form, "contrasenaP12");
    if (contrasena.length === 0) {
      return { error: "Debes escribir la contraseña del certificado .p12 para firmar el set real.", status: 400 };
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

  const desdeServidor = await cargarCredencialesEcfServidor(supabase, rnc);
  if (desdeServidor.ok) {
    return {
      credenciales: desdeServidor.credenciales,
      fuente: desdeServidor.origen === "env" ? "variables_servidor" : "base_datos",
    };
  }

  const certificadoPem = pemEnv(`ECF_CERT_PEM_${rnc}`);
  const clavePrivadaPem = pemEnv(`ECF_KEY_PEM_${rnc}`);
  if (certificadoPem && clavePrivadaPem) {
    return { credenciales: { certificadoPem, clavePrivadaPem }, fuente: "variables_servidor" };
  }
  if (certificadoPem || clavePrivadaPem) {
    return {
      error: `Las variables ECF_CERT_PEM_${rnc} y ECF_KEY_PEM_${rnc} deben estar configuradas juntas.`,
      status: 500,
    };
  }
  return {
    error: desdeServidor.error,
    status: desdeServidor.motivo === "sin_clave_maestra" ? 500 : 400,
  };
}

function estadoDesdeTexto(valor: string): EstadoDgii {
  const texto = valor
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase();
  if (texto.includes("aceptado") && texto.includes("condicional")) return "aceptado_condicional";
  if (texto.includes("aceptado")) return "aceptado";
  if (texto.includes("rechazado")) return "rechazado";
  return "en_proceso";
}

function serializarJson(valor: unknown): Json {
  return JSON.parse(JSON.stringify(valor)) as Json;
}

function baseResultado(caso: CasoExcelDgii): ResultadoExcelBase {
  return {
    casoPrueba: caso.casoPrueba,
    numeroFila: caso.numeroFila,
    encf: caso.documento.comprobante.encf,
    tipo: caso.documento.comprobante.tipo,
    montoTotal: caso.documento.totales.montoTotal,
    esRfce: esElegibleRfce(caso.documento),
    columnasNoReconocidas: caso.columnasNoReconocidas,
  };
}

function procesarValidacionLocal(caso: CasoExcelDgii): ResultadoValidacionExcelCaso {
  const errores: string[] = [];
  try {
    const xml = generarXmlEcf(caso.documento);
    const validacionEcf = validarXmlContraEsquemaDgii(xml, "ECF");
    errores.push(...validacionEcf.errores);
    if (esElegibleRfce(caso.documento)) {
      const rfce = generarXmlRfce(caso.documento, "000000");
      const validacionRfce = validarXmlContraEsquemaDgii(rfce, "RFCE");
      errores.push(...validacionRfce.errores.map((error) => `RFCE: ${error}`));
    }
  } catch (error) {
    errores.push(error instanceof Error ? error.message : "No se pudo construir el XML del caso");
  }
  return { ...baseResultado(caso), valido: errores.length === 0, errores };
}

async function guardarTrazabilidad(args: {
  supabase: ClienteSupabase;
  rncEmisor: string;
  ambiente: AmbientePruebas;
  resultado: ResultadoEnvioExcelCaso;
  fechaHoraFirma: string | null;
  respuesta: unknown;
  secuenciaUtilizada: boolean | null;
  existente: EnvioExistente | null;
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
    url_qr: args.resultado.urlQr,
    fecha_hora_firma: args.fechaHoraFirma,
    xml_firmado: args.resultado.xmlFirmado,
    xml_rfce: args.resultado.xmlRfce,
    respuesta_dgii: serializarJson(args.respuesta),
    mensajes: args.resultado.mensajes,
    secuencia_utilizada: args.secuenciaUtilizada,
    intentos: (args.existente?.intentos ?? 0) + 1,
    ultimo_intento_at: ahora,
  };

  const consulta = args.existente
    ? await args.supabase.from("ecf_envios").update(fila).eq("id", args.existente.id)
    : await args.supabase.from("ecf_envios").insert(fila);
  if (consulta.error) return { persistido: false, error: consulta.error.message };
  return { persistido: true, error: null };
}

// biome-ignore lint/complexity/noExcessiveCognitiveComplexity: coordina XSD, firma, RFCE, envío DGII, consulta y trazabilidad por cada caso sin ocultar errores
async function procesarEnvioCaso(args: {
  caso: CasoExcelDgii;
  ambiente: AmbientePruebas;
  rncEmisor: string;
  token: string;
  credenciales: ParCertificadoEcf;
  supabase: ClienteSupabase;
  existente: EnvioExistente | null;
}): Promise<ResultadoEnvioExcelCaso> {
  const inicio = Date.now();
  const base = baseResultado(args.caso);
  const fechaHoraFirma = args.caso.documento.comprobante.fechaHoraFirma ?? formatearFechaHoraDgii();
  const documento = {
    ...args.caso.documento,
    comprobante: { ...args.caso.documento.comprobante, fechaHoraFirma },
  };
  let resultado: ResultadoEnvioExcelCaso = {
    ...base,
    trackId: null,
    estado: "pendiente",
    codigoSeguridad: null,
    mensajes: [],
    urlQr: null,
    duracionMs: 0,
    xmlFirmado: null,
    xmlRfce: null,
    persistido: false,
    errorPersistencia: null,
  };
  let respuesta: unknown = {};
  let secuenciaUtilizada: boolean | null = null;

  try {
    const xml = generarXmlEcf(documento);
    const validacionEcf = validarXmlContraEsquemaDgii(xml, "ECF");
    if (!validacionEcf.valido) throw new Error(`XML e-CF inválido: ${validacionEcf.errores.join("; ")}`);
    const firmaEcf = firmarXmlDsig(xml, args.credenciales.clavePrivadaPem, args.credenciales.certificadoPem);
    const esRfce = esElegibleRfce(documento);
    let xmlEnvio = firmaEcf.xmlFirmado;
    let xmlRfce: string | null = null;
    if (esRfce) {
      const rfce = generarXmlRfce(documento, firmaEcf.codigoSeguridad);
      const validacionRfce = validarXmlContraEsquemaDgii(rfce, "RFCE");
      if (!validacionRfce.valido) throw new Error(`XML RFCE inválido: ${validacionRfce.errores.join("; ")}`);
      const firmaRfce = firmarXmlDsig(rfce, args.credenciales.clavePrivadaPem, args.credenciales.certificadoPem);
      xmlEnvio = firmaRfce.xmlFirmado;
      xmlRfce = firmaRfce.xmlFirmado;
    }

    const enviado = await enviarEcfDgii({
      ambiente: args.ambiente,
      token: args.token,
      nombreArchivo: `${args.rncEmisor}${documento.comprobante.encf}.xml`,
      xmlFirmado: xmlEnvio,
      esRfce,
      confirmarProduccion: false,
    });
    let estado: EstadoDgii = estadoDesdeTexto(enviado.estado);
    let mensajes = enviado.mensajes;
    respuesta = { recepcion: enviado };
    if (!esRfce && enviado.trackId) {
      const consulta = await consultarResultadoDgii({
        ambiente: args.ambiente,
        token: args.token,
        trackId: enviado.trackId,
        confirmarProduccion: false,
      });
      estado = consulta.estado;
      mensajes = consulta.mensajes.length > 0 ? consulta.mensajes : mensajes;
      secuenciaUtilizada = consulta.secuenciaUtilizada ?? null;
      respuesta = { recepcion: enviado, consulta };
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
            esRfce,
          })
        : null;

    resultado = {
      ...resultado,
      estado,
      trackId: enviado.trackId ?? null,
      codigoSeguridad: firmaEcf.codigoSeguridad,
      mensajes,
      urlQr,
      xmlFirmado: firmaEcf.xmlFirmado,
      xmlRfce,
      duracionMs: Date.now() - inicio,
    };
  } catch (error) {
    const mensaje = error instanceof Error ? error.message : "No se pudo enviar el caso a la DGII";
    respuesta = { error: mensaje };
    resultado = { ...resultado, estado: "error_red", mensajes: [mensaje], duracionMs: Date.now() - inicio };
  }

  const persistencia = await guardarTrazabilidad({
    supabase: args.supabase,
    rncEmisor: args.rncEmisor,
    ambiente: args.ambiente,
    resultado,
    fechaHoraFirma,
    respuesta,
    secuenciaUtilizada,
    existente: args.existente,
  });
  return {
    ...resultado,
    duracionMs: resultado.duracionMs || Date.now() - inicio,
    persistido: persistencia.persistido,
    errorPersistencia: persistencia.error,
  };
}

async function cargarEnviosExistentes(
  supabase: ClienteSupabase,
  rncEmisor: string,
  ambiente: AmbientePruebas,
  encfs: string[],
): Promise<Map<string, EnvioExistente>> {
  const mapa = new Map<string, EnvioExistente>();
  if (encfs.length === 0) return mapa;
  const { data, error } = await supabase
    .from("ecf_envios")
    .select("id, encf, intentos")
    .eq("rnc_emisor", rncEmisor)
    .eq("ambiente", ambiente)
    .eq("documento_tipo", "prueba")
    .in("encf", encfs)
    .returns<EnvioExistente[]>();
  if (error) throw new Error(`No se pudo leer la trazabilidad previa de pruebas: ${error.message}`);
  for (const fila of data ?? []) mapa.set(fila.encf, fila);
  return mapa;
}

// biome-ignore lint/complexity/noExcessiveCognitiveComplexity: el runner valida multipart, bloquea producción, parsea Excel, firma, envía y persiste trazabilidad fiscal por caso
export async function POST(request: Request) {
  const rol = await getRol();
  if (!rol) return jsonError("Debes iniciar sesión para ejecutar el Excel de pruebas DGII.", 401);
  if (rol !== "admin" && rol !== "contador") {
    return jsonError("Solo administradores y contadores pueden ejecutar el Excel de pruebas DGII.", 403);
  }

  let form: FormData;
  try {
    form = await request.formData();
  } catch {
    return jsonError("El cuerpo debe ser multipart/form-data.", 400);
  }

  const archivoExcel = archivoForm(form, "archivoExcel");
  const modo = textoForm(form, "modo") as ModoEjecucion;
  const ambienteTexto = textoForm(form, "ambiente").trim();
  const rncEmisor = textoForm(form, "rncEmisor").replace(/\D/g, "");
  const razonSocial = textoForm(form, "razonSocial").trim();

  if (!archivoExcel) return jsonError("Debes adjuntar el archivo Excel oficial de pruebas de la DGII.", 400);
  if (!nombreConExtension(archivoExcel.name, [".xlsx"])) {
    return jsonError("El archivo de pruebas debe tener extensión .xlsx.", 400);
  }
  if (archivoExcel.size > TAMANO_MAXIMO_EXCEL) return jsonError("El Excel de pruebas no puede superar 5 MB.", 400);
  if (modo !== "validar_local" && modo !== "enviar_testecf") {
    return jsonError("El modo debe ser validar_local o enviar_testecf.", 400);
  }
  if (ambienteTexto === "ecf" || ambienteTexto === "produccion") {
    return jsonError("El runner de pruebas Excel nunca puede apuntar a Producción (ecf); usa TesteCF o CerteCF.", 400);
  }
  if (ambienteTexto !== "testecf" && ambienteTexto !== "certecf") {
    return jsonError("El ambiente debe ser testecf o certecf.", 400);
  }
  const ambiente: AmbientePruebas = ambienteTexto;
  if (!/^\d{9}(\d{2})?$/.test(rncEmisor)) return jsonError("El RNC del emisor debe tener 9 u 11 dígitos.", 400);
  if (razonSocial === "") return jsonError("La razón social del emisor es obligatoria.", 400);

  let casos: CasoExcelDgii[];
  try {
    casos = await parsearExcelPruebasDgii(Buffer.from(await archivoExcel.arrayBuffer()));
  } catch (error) {
    return jsonError(error instanceof Error ? error.message : "El Excel de pruebas DGII no pudo leerse.", 400);
  }
  if (casos.length === 0) return jsonError("El Excel no contiene casos de prueba en filas con CasoPrueba.", 400);

  if (modo === "validar_local") {
    const resultados = casos.map(procesarValidacionLocal);
    const validos = resultados.filter((caso) => caso.valido).length;
    return Response.json({
      ok: true,
      modo,
      ambiente,
      rncEmisor,
      totalCasos: resultados.length,
      validos,
      invalidos: resultados.length - validos,
      casos: resultados,
    });
  }

  const emisoresDistintos = casos.filter((caso) => caso.documento.emisor.rnc.replace(/\D/g, "") !== rncEmisor);
  if (emisoresDistintos.length > 0) {
    const filas = emisoresDistintos.map((caso) => caso.numeroFila).join(", ");
    return jsonError(`El Excel tiene casos cuyo RNCEmisor no coincide con ${rncEmisor} (filas ${filas}).`, 400);
  }

  const supabase = await createClient();
  const credencialesResueltas = await resolverCredenciales(supabase, form, rncEmisor);
  if ("error" in credencialesResueltas) return jsonError(credencialesResueltas.error, credencialesResueltas.status);
  let token: string;
  try {
    const tokenDgii = await obtenerTokenDgii({
      ambiente,
      clavePrivadaPem: credencialesResueltas.credenciales.clavePrivadaPem,
      certificadoPem: credencialesResueltas.credenciales.certificadoPem,
      confirmarProduccion: false,
    });
    token = tokenDgii.token;
  } catch (error) {
    return jsonError(error instanceof Error ? error.message : "La DGII no pudo autenticar el certificado.", 502);
  }

  try {
    const encfs = [...new Set(casos.map((caso) => caso.documento.comprobante.encf))];
    const existentes = await cargarEnviosExistentes(supabase, rncEmisor, ambiente, encfs);
    const resultados: ResultadoEnvioExcelCaso[] = [];
    for (const caso of casos) {
      resultados.push(
        await procesarEnvioCaso({
          caso,
          ambiente,
          rncEmisor,
          token,
          credenciales: credencialesResueltas.credenciales,
          supabase,
          existente: existentes.get(caso.documento.comprobante.encf) ?? null,
        }),
      );
    }

    const aceptados = resultados.filter(
      (caso) => caso.estado === "aceptado" || caso.estado === "aceptado_condicional",
    ).length;
    const rechazados = resultados.filter((caso) => caso.estado === "rechazado").length;
    const errores = resultados.filter((caso) => caso.estado === "error_red").length;
    return Response.json({
      ok: true,
      modo,
      ambiente,
      rncEmisor,
      fuenteCredenciales: credencialesResueltas.fuente,
      totalCasos: resultados.length,
      aceptados,
      rechazados,
      errores,
      enProceso: resultados.length - aceptados - rechazados - errores,
      casos: resultados,
    });
  } catch (error) {
    return jsonError(error instanceof Error ? error.message : "No se pudo completar el envío real a la DGII.", 500);
  }
}
