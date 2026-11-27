import type {
  ModoEjecucionExcelAcecf,
  ResultadoAcecfBase,
  ResultadoEnvioAcecfCaso,
  ResultadoValidacionAcecfCaso,
} from "@/app/(main)/dashboard/configuracion/facturacion-electronica/_components/ecf-portal-tipos";
import { getRol } from "@/lib/auth/rol";
import { enviarAprobacionComercialDgii, obtenerTokenDgii } from "@/lib/ecf/cliente-dgii";
import { cargarCredencialesEcfServidor } from "@/lib/ecf/config-servidor";
import { parsearExcelAcecfDgii } from "@/lib/ecf/excel-acecf";
import { firmarXmlDsig } from "@/lib/ecf/firma";
import { leerCertificadoPkcs12 } from "@/lib/ecf/pkcs12";
import type { CasoExcelAcecfDgii, ParCertificadoEcf } from "@/lib/ecf/tipos";
import { validarXmlContraEsquemaDgii } from "@/lib/ecf/validador-xsd";
import { generarXmlAcecf } from "@/lib/ecf/xml";
import { createClient } from "@/lib/supabase/server";
import type { Database, Json } from "@/lib/supabase/types";

export const runtime = "nodejs";

const TAMANO_MAXIMO_EXCEL = 5 * 1024 * 1024;
const TAMANO_MAXIMO_CERTIFICADO = 2 * 1024 * 1024;

type ClienteSupabase = Awaited<ReturnType<typeof createClient>>;
type AmbientePruebas = "testecf" | "certecf";

interface CredencialesResueltas {
  credenciales: ParCertificadoEcf;
  fuente: "formulario" | "variables_servidor" | "base_datos";
}

export interface EnvioAcecfExistente {
  id: string;
  rnc_emisor: string;
  encf: string;
  intentos: number;
  estado: string;
  xml_firmado: string | null;
  mensajes: string[] | null;
  respuesta_dgii: Json | null;
}

interface EntradaValidada {
  archivoExcel: File;
  modo: ModoEjecucionExcelAcecf;
  ambiente: AmbientePruebas;
  rncComprador: string;
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

function errorArchivoExcel(archivo: File | null): string | null {
  if (!archivo) return "Debes adjuntar el archivo Excel oficial de aprobaciones comerciales ACECF.";
  if (!nombreConExtension(archivo.name, [".xlsx"])) return "El archivo ACECF debe tener extensión .xlsx.";
  if (archivo.size > TAMANO_MAXIMO_EXCEL) return "El Excel ACECF no puede superar 5 MB.";
  return null;
}

function ambienteDesdeTexto(valor: string): AmbientePruebas | { error: string } {
  const ambiente = valor.trim();
  if (ambiente === "ecf" || ambiente === "produccion") {
    return { error: "El runner ACECF de pruebas nunca puede apuntar a Producción (ecf); usa TesteCF o CerteCF." };
  }
  if (ambiente === "testecf" || ambiente === "certecf") return ambiente;
  return { error: "El ambiente debe ser testecf o certecf." };
}

function validarEntrada(form: FormData): ResultadoValidacionEntrada {
  const errorExcel = errorArchivoExcel(archivoForm(form, "archivoExcel"));
  if (errorExcel) return { error: errorExcel, status: 400 };

  const modo = textoForm(form, "modo");
  if (modo !== "validar_local" && modo !== "enviar_dgii") {
    return { error: "El modo debe ser validar_local o enviar_dgii.", status: 400 };
  }

  const ambiente = ambienteDesdeTexto(textoForm(form, "ambiente"));
  if (typeof ambiente === "object") return { error: ambiente.error, status: 400 };

  const rncComprador = textoForm(form, "rncComprador").replace(/\D/g, "");
  if (!/^\d{9}(\d{2})?$/.test(rncComprador)) {
    return { error: "El RNC del comprador debe tener 9 u 11 dígitos.", status: 400 };
  }

  const archivoExcel = archivoForm(form, "archivoExcel");
  if (!archivoExcel)
    return { error: "Debes adjuntar el archivo Excel oficial de aprobaciones comerciales ACECF.", status: 400 };
  return { archivoExcel, modo, ambiente, rncComprador };
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
    return { error: "Debes escribir la contraseña del certificado .p12 para firmar las aprobaciones.", status: 400 };
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
  rncComprador: string,
): Promise<ResultadoCredenciales> {
  const desdeFormulario = await credencialesDesdeFormulario(form);
  if (desdeFormulario) return desdeFormulario;

  const desdeServidor = await cargarCredencialesEcfServidor(supabase, rncComprador);
  if (desdeServidor.ok) {
    return {
      credenciales: desdeServidor.credenciales,
      fuente: desdeServidor.origen === "env" ? "variables_servidor" : "base_datos",
    };
  }

  const certificadoPem = pemEnv(`ECF_CERT_PEM_${rncComprador}`);
  const clavePrivadaPem = pemEnv(`ECF_KEY_PEM_${rncComprador}`);
  if (certificadoPem && clavePrivadaPem) {
    return { credenciales: { certificadoPem, clavePrivadaPem }, fuente: "variables_servidor" };
  }
  if (certificadoPem || clavePrivadaPem) {
    return {
      error: `Las variables ECF_CERT_PEM_${rncComprador} y ECF_KEY_PEM_${rncComprador} deben estar configuradas juntas.`,
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

function objetoRegistro(valor: unknown): Record<string, unknown> | null {
  if (typeof valor !== "object" || valor === null || Array.isArray(valor)) return null;
  return valor as Record<string, unknown>;
}

function rncPersistidoDesdeRespuesta(respuestaDgii: unknown): string | null {
  const respuesta = objetoRegistro(respuestaDgii);
  return typeof respuesta?.rncComprador === "string" ? respuesta.rncComprador.replace(/\D/g, "") : null;
}

export function esRegistroAcecfParaComprador(
  registro: Pick<EnvioAcecfExistente, "xml_firmado" | "respuesta_dgii">,
  rncCompradorEntrada: string,
): boolean {
  const rncComprador = rncCompradorEntrada.replace(/\D/g, "");
  const rncRespuesta = rncPersistidoDesdeRespuesta(registro.respuesta_dgii);
  if (rncRespuesta !== null && rncRespuesta !== rncComprador) return false;

  const respuesta = objetoRegistro(registro.respuesta_dgii);
  if (respuesta?.tipo === "acecf") return true;

  const xml = registro.xml_firmado ?? "";
  if (!xml.includes("<ACECF>")) return false;
  const rncXml = /<RNCComprador>(\d{9,11})<\/RNCComprador>/.exec(xml)?.[1] ?? null;
  return rncXml === null || rncXml === rncComprador;
}

function textoCampoRespuestaPersistida(respuestaDgii: unknown, campo: "codigo" | "estadoOriginal"): string | null {
  const raiz = objetoRegistro(respuestaDgii);
  const anidada = objetoRegistro(raiz?.respuesta);
  const valor = anidada?.[campo] ?? raiz?.[campo];
  return typeof valor === "string" && valor !== "" ? valor : null;
}

function fechaHoraAprobacionBase(caso: CasoExcelAcecfDgii): string {
  if (caso.fechaHoraAprobacionLiteral !== "") return caso.fechaHoraAprobacionLiteral;
  return caso.aprobacion.fechaHoraAprobacionComercial ?? "";
}

function baseResultadoAcecf(caso: CasoExcelAcecfDgii): ResultadoAcecfBase {
  return {
    numeroFila: caso.numeroFila,
    rncEmisor: caso.aprobacion.rncEmisor,
    rncComprador: caso.aprobacion.rncComprador,
    encf: caso.aprobacion.encf,
    fechaEmision: caso.fechaEmisionLiteral || caso.aprobacion.fechaEmision,
    montoTotal: caso.aprobacion.montoTotal,
    montoTotalTexto: caso.montoTotalTexto,
    estadoComercial: caso.aprobacion.estado,
    detalleMotivoRechazo: caso.aprobacion.detalleMotivoRechazo ?? null,
    fechaHoraAprobacionComercial: fechaHoraAprobacionBase(caso),
    nombreArchivoAcecf: caso.nombreArchivoAcecf,
  };
}

function procesarValidacionLocal(caso: CasoExcelAcecfDgii): ResultadoValidacionAcecfCaso {
  const errores: string[] = [];
  try {
    const xml = generarXmlAcecf(caso.aprobacion);
    errores.push(...validarXmlContraEsquemaDgii(xml, "ACECF").errores);
  } catch (error) {
    errores.push(error instanceof Error ? error.message : "No se pudo construir el XML ACECF del caso");
  }
  return { ...baseResultadoAcecf(caso), valido: errores.length === 0, errores };
}

export function tipoEcfDesdeEncf(encf: string): string {
  return encf.trim().slice(1, 3);
}

function claveEnvio(rncEmisor: string, encf: string): string {
  return `${rncEmisor}|${encf}`;
}

async function cargarEnviosExistentes(
  supabase: ClienteSupabase,
  ambiente: AmbientePruebas,
  rncEmisores: string[],
  encfs: string[],
): Promise<Map<string, EnvioAcecfExistente>> {
  const mapa = new Map<string, EnvioAcecfExistente>();
  if (rncEmisores.length === 0 || encfs.length === 0) return mapa;
  const { data, error } = await supabase
    .from("ecf_envios")
    .select("id, rnc_emisor, encf, intentos, estado, xml_firmado, mensajes, respuesta_dgii")
    .eq("ambiente", ambiente)
    .eq("documento_tipo", "prueba")
    .in("rnc_emisor", rncEmisores)
    .in("encf", encfs)
    .returns<EnvioAcecfExistente[]>();
  if (error) throw new Error(`No se pudo leer la trazabilidad previa de aprobaciones comerciales: ${error.message}`);
  for (const fila of data ?? []) mapa.set(claveEnvio(fila.rnc_emisor, fila.encf), fila);
  return mapa;
}

export function resultadoDesdeAcecfAceptado(
  caso: CasoExcelAcecfDgii,
  existente: EnvioAcecfExistente,
  rncComprador: string,
): ResultadoEnvioAcecfCaso | null {
  if (existente.estado !== "aceptado" && existente.estado !== "aceptado_condicional") return null;
  if (!esRegistroAcecfParaComprador(existente, rncComprador)) return null;
  return {
    ...baseResultadoAcecf(caso),
    codigo: textoCampoRespuestaPersistida(existente.respuesta_dgii, "codigo"),
    estado: existente.estado,
    estadoOriginal: textoCampoRespuestaPersistida(existente.respuesta_dgii, "estadoOriginal"),
    mensajes:
      existente.mensajes && existente.mensajes.length > 0
        ? existente.mensajes
        : ["Ya aceptado previamente en DGII como ACECF (conservado sin reenviar)"],
    duracionMs: 0,
    xmlFirmado: existente.xml_firmado,
    reutilizado: true,
    persistido: true,
    errorPersistencia: null,
  };
}

function resultadoReutilizado(
  caso: CasoExcelAcecfDgii,
  existentes: Map<string, EnvioAcecfExistente>,
  rncComprador: string,
): ResultadoEnvioAcecfCaso | null {
  const existente = existentes.get(claveEnvio(caso.aprobacion.rncEmisor, caso.aprobacion.encf));
  return existente ? resultadoDesdeAcecfAceptado(caso, existente, rncComprador) : null;
}

async function guardarTrazabilidad(args: {
  supabase: ClienteSupabase;
  ambiente: AmbientePruebas;
  caso: CasoExcelAcecfDgii;
  rncComprador: string;
  resultado: ResultadoEnvioAcecfCaso;
  codigoSeguridad: string | null;
  respuesta: unknown;
  existente: EnvioAcecfExistente | null;
}): Promise<{ persistido: boolean; error: string | null }> {
  if (args.existente && !esRegistroAcecfParaComprador(args.existente, args.rncComprador)) {
    return {
      persistido: false,
      error: `Ya existe una trazabilidad no ACECF para ${args.caso.aprobacion.rncEmisor}|${args.caso.aprobacion.encf}; se conservó sin sobrescribir para proteger la evidencia del Paso 2.`,
    };
  }

  const ahora = new Date().toISOString();
  const fila: Database["public"]["Tables"]["ecf_envios"]["Insert"] = {
    rnc_emisor: args.caso.aprobacion.rncEmisor,
    documento_tipo: "prueba",
    documento_id: null,
    tipo_ecf: tipoEcfDesdeEncf(args.caso.aprobacion.encf),
    encf: args.caso.aprobacion.encf,
    es_rfce: false,
    ambiente: args.ambiente,
    estado: args.resultado.estado,
    codigo_seguridad: args.codigoSeguridad,
    fecha_hora_firma: args.caso.fechaHoraAprobacionLiteral || null,
    xml_firmado: args.resultado.xmlFirmado,
    xml_rfce: null,
    respuesta_dgii: serializarJson({
      tipo: "acecf",
      rncComprador: args.rncComprador,
      nombreArchivoAcecf: args.caso.nombreArchivoAcecf,
      respuesta: args.respuesta,
    }),
    mensajes: args.resultado.mensajes,
    intentos: (args.existente?.intentos ?? 0) + 1,
    ultimo_intento_at: ahora,
  };

  const consulta = args.existente
    ? await args.supabase.from("ecf_envios").update(fila).eq("id", args.existente.id)
    : await args.supabase.from("ecf_envios").insert(fila);
  if (consulta.error) return { persistido: false, error: consulta.error.message };
  return { persistido: true, error: null };
}

async function procesarEnvioCaso(args: {
  caso: CasoExcelAcecfDgii;
  ambiente: AmbientePruebas;
  rncComprador: string;
  token: string;
  credenciales: ParCertificadoEcf;
  supabase: ClienteSupabase;
  existente: EnvioAcecfExistente | null;
}): Promise<ResultadoEnvioAcecfCaso> {
  const inicio = Date.now();
  let codigoSeguridad: string | null = null;
  let respuesta: unknown = {};
  let resultado: ResultadoEnvioAcecfCaso = {
    ...baseResultadoAcecf(args.caso),
    codigo: null,
    estado: "pendiente",
    estadoOriginal: null,
    mensajes: [],
    duracionMs: 0,
    xmlFirmado: null,
    reutilizado: false,
    persistido: false,
    errorPersistencia: null,
  };

  try {
    const xml = generarXmlAcecf(args.caso.aprobacion);
    const validacion = validarXmlContraEsquemaDgii(xml, "ACECF");
    if (!validacion.valido) throw new Error(`XML ACECF inválido: ${validacion.errores.join("; ")}`);
    const firma = firmarXmlDsig(xml, args.credenciales.clavePrivadaPem, args.credenciales.certificadoPem);
    codigoSeguridad = firma.codigoSeguridad;
    const enviado = await enviarAprobacionComercialDgii({
      ambiente: args.ambiente,
      token: args.token,
      nombreArchivo: args.caso.nombreArchivoAcecf,
      xmlFirmado: firma.xmlFirmado,
      confirmarProduccion: false,
    });
    respuesta = enviado;
    resultado = {
      ...resultado,
      codigo: enviado.codigo === "" ? null : enviado.codigo,
      estado: enviado.estado,
      estadoOriginal: enviado.estadoOriginal === "" ? null : enviado.estadoOriginal,
      mensajes: enviado.mensajes,
      xmlFirmado: firma.xmlFirmado,
      duracionMs: Date.now() - inicio,
    };
  } catch (error) {
    const mensaje = error instanceof Error ? error.message : "No se pudo enviar la aprobación comercial a la DGII";
    respuesta = { error: mensaje };
    resultado = { ...resultado, estado: "error_red", mensajes: [mensaje], duracionMs: Date.now() - inicio };
  }

  const persistencia = await guardarTrazabilidad({
    supabase: args.supabase,
    ambiente: args.ambiente,
    caso: args.caso,
    rncComprador: args.rncComprador,
    resultado,
    codigoSeguridad,
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

function filasConCompradorDistinto(casos: CasoExcelAcecfDgii[], rncComprador: string): number[] {
  return casos
    .filter((caso) => caso.aprobacion.rncComprador.replace(/\D/g, "") !== rncComprador)
    .map((caso) => caso.numeroFila);
}

async function tokenParaCasosPendientes(args: {
  casos: CasoExcelAcecfDgii[];
  existentes: Map<string, EnvioAcecfExistente>;
  rncComprador: string;
  ambiente: AmbientePruebas;
  credenciales: ParCertificadoEcf;
}): Promise<{ token: string | null } | { error: string; status: number }> {
  const hayPendientes = args.casos.some(
    (caso) => resultadoReutilizado(caso, args.existentes, args.rncComprador) === null,
  );
  if (!hayPendientes) return { token: null };
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
      error: error instanceof Error ? error.message : "La DGII no pudo autenticar el certificado del comprador.",
      status: 502,
    };
  }
}

async function procesarCasosEnvio(args: {
  casos: CasoExcelAcecfDgii[];
  existentes: Map<string, EnvioAcecfExistente>;
  rncComprador: string;
  ambiente: AmbientePruebas;
  token: string | null;
  credenciales: ParCertificadoEcf;
  supabase: ClienteSupabase;
}): Promise<ResultadoEnvioAcecfCaso[]> {
  const resultados: ResultadoEnvioAcecfCaso[] = [];
  for (const caso of args.casos) {
    const reutilizado = resultadoReutilizado(caso, args.existentes, args.rncComprador);
    if (reutilizado) {
      resultados.push(reutilizado);
      continue;
    }
    if (args.token === null) throw new Error("No se obtuvo token DGII para las aprobaciones pendientes.");
    resultados.push(
      await procesarEnvioCaso({
        caso,
        ambiente: args.ambiente,
        rncComprador: args.rncComprador,
        token: args.token,
        credenciales: args.credenciales,
        supabase: args.supabase,
        existente: args.existentes.get(claveEnvio(caso.aprobacion.rncEmisor, caso.aprobacion.encf)) ?? null,
      }),
    );
  }
  return resultados;
}

function resumenEnvioDesdeResultados(
  resultados: ResultadoEnvioAcecfCaso[],
  ambiente: AmbientePruebas,
  rncComprador: string,
  fuenteCredenciales: CredencialesResueltas["fuente"],
) {
  const aceptados = resultados.filter(
    (caso) => caso.estado === "aceptado" || caso.estado === "aceptado_condicional",
  ).length;
  const rechazados = resultados.filter((caso) => caso.estado === "rechazado").length;
  const errores = resultados.filter((caso) => caso.estado === "error_red").length;
  const reutilizados = resultados.filter((caso) => caso.reutilizado).length;
  return Response.json({
    ok: true,
    modo: "enviar_dgii",
    ambiente,
    rncComprador,
    totalCasos: resultados.length,
    aceptados,
    rechazados,
    errores,
    reutilizados,
    fuenteCredenciales,
    casos: resultados,
  });
}

async function ejecutarEnvioDgii(args: {
  form: FormData;
  casos: CasoExcelAcecfDgii[];
  ambiente: AmbientePruebas;
  rncComprador: string;
}): Promise<Response> {
  const filasDistintas = filasConCompradorDistinto(args.casos, args.rncComprador);
  if (filasDistintas.length > 0) {
    return jsonError(
      `El Excel ACECF tiene casos cuyo RNCComprador no coincide con ${args.rncComprador} (filas ${filasDistintas.join(", ")}).`,
      400,
    );
  }

  const supabase = await createClient();
  const credencialesResueltas = await resolverCredenciales(supabase, args.form, args.rncComprador);
  if ("error" in credencialesResueltas) return jsonError(credencialesResueltas.error, credencialesResueltas.status);

  const rncEmisores = [...new Set(args.casos.map((caso) => caso.aprobacion.rncEmisor))];
  const encfs = [...new Set(args.casos.map((caso) => caso.aprobacion.encf))];
  let existentes: Map<string, EnvioAcecfExistente>;
  try {
    existentes = await cargarEnviosExistentes(supabase, args.ambiente, rncEmisores, encfs);
  } catch (error) {
    return jsonError(
      error instanceof Error ? error.message : "No se pudo leer la trazabilidad previa de aprobaciones comerciales.",
      500,
    );
  }

  const tokenResuelto = await tokenParaCasosPendientes({
    casos: args.casos,
    existentes,
    rncComprador: args.rncComprador,
    ambiente: args.ambiente,
    credenciales: credencialesResueltas.credenciales,
  });
  if ("error" in tokenResuelto) return jsonError(tokenResuelto.error, tokenResuelto.status);

  try {
    const resultados = await procesarCasosEnvio({
      casos: args.casos,
      existentes,
      rncComprador: args.rncComprador,
      ambiente: args.ambiente,
      token: tokenResuelto.token,
      credenciales: credencialesResueltas.credenciales,
      supabase,
    });
    return resumenEnvioDesdeResultados(resultados, args.ambiente, args.rncComprador, credencialesResueltas.fuente);
  } catch (error) {
    return jsonError(error instanceof Error ? error.message : "No se pudo completar el envío ACECF a la DGII.", 500);
  }
}

export async function POST(request: Request) {
  const rol = await getRol();
  if (!rol) return jsonError("Debes iniciar sesión para ejecutar el Excel ACECF de pruebas DGII.", 401);
  if (rol !== "admin" && rol !== "contador") {
    return jsonError("Solo administradores y contadores pueden ejecutar el Excel ACECF de pruebas DGII.", 403);
  }

  let form: FormData;
  try {
    form = await request.formData();
  } catch {
    return jsonError("El cuerpo debe ser multipart/form-data.", 400);
  }

  const entrada = validarEntrada(form);
  if ("error" in entrada) return jsonError(entrada.error, entrada.status);

  let casos: CasoExcelAcecfDgii[];
  try {
    casos = await parsearExcelAcecfDgii(Buffer.from(await entrada.archivoExcel.arrayBuffer()));
  } catch (error) {
    return jsonError(error instanceof Error ? error.message : "El Excel ACECF de pruebas DGII no pudo leerse.", 400);
  }

  if (entrada.modo === "validar_local") {
    const resultados = casos.map(procesarValidacionLocal);
    const validos = resultados.filter((caso) => caso.valido).length;
    return Response.json({
      ok: true,
      modo: entrada.modo,
      ambiente: entrada.ambiente,
      rncComprador: entrada.rncComprador,
      totalCasos: resultados.length,
      validos,
      invalidos: resultados.length - validos,
      casos: resultados,
    });
  }

  return ejecutarEnvioDgii({
    form,
    casos,
    ambiente: entrada.ambiente,
    rncComprador: entrada.rncComprador,
  });
}
