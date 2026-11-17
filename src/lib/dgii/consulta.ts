/**
 * Consulta pública de RNC/Cédula de la DGII.
 *
 * La DGII no tiene API pública (lo confirmó en su centro de ayuda en septiembre
 * de 2026). El servicio SOAP histórico `/wsMovilDGII/WSMovilDGII.asmx` está
 * retirado: hoy responde 301 hacia la portada. La única vía oficial es el
 * formulario ASP.NET de consultas:
 *   https://dgii.gov.do/app/WebApps/ConsultasWeb2/ConsultasWeb/consultas/rnc.aspx
 *
 * La página devuelve Nombre/Razón Social, Nombre Comercial, Estado, actividad y
 * administración local. NO devuelve municipio, provincia ni dirección; esos
 * campos quedan en null hasta que la DGII los publique.
 *
 * Para no castigar el portal: se identifica con un User-Agent propio, cachea
 * 10 minutos los aciertos (2 los "no encontrado"), no reintenta, deduplica
 * solicitudes simultáneas del mismo número y se pausa 5 minutos si la DGII
 * responde 403.
 */

export type TipoDocumentoDgii = "rnc" | "cedula";

export interface DatosContribuyenteDgii {
  nombre: string;
  nombreComercial: string | null;
  municipioProvincia: string | null;
  direccion: string | null;
  estado: string | null;
}

export type CodigoErrorDgii = "documento_invalido" | "no_encontrado" | "sin_respuesta" | "red";

export type ResultadoConsultaDgii = { ok: true; datos: DatosContribuyenteDgii } | { ok: false; error: CodigoErrorDgii };

export type ResultadoParseoDgii =
  | { estado: "encontrado"; datos: DatosContribuyenteDgii }
  | { estado: "no_encontrado" }
  | { estado: "sin_respuesta" };

export const URL_CONSULTA_DGII = "https://dgii.gov.do/app/WebApps/ConsultasWeb2/ConsultasWeb/consultas/rnc.aspx";

export const TIEMPO_LIMITE_DGII_MS = 8000;

const AGENTE = "MedoxigasContabilidad/1.0 (+https://medoxigas-contabilidad.vercel.app)";
const CAMPO_NUMERO = "ctl00$cphMain$txtRNCCedula";
const CAMPO_BOTON = "ctl00$cphMain$btnBuscarPorRNC";
const CACHE_EXITOS_MS = 10 * 60 * 1000;
const CACHE_NO_ENCONTRADO_MS = 2 * 60 * 1000;
const BLOQUEO_MS = 5 * 60 * 1000;
const MAXIMO_CACHE = 200;

const LONGITUD: Record<TipoDocumentoDgii, number> = { rnc: 9, cedula: 11 };

interface EntradaCache {
  resultado: ResultadoConsultaDgii;
  expira: number;
}

const cache = new Map<string, EntradaCache>();
const enCurso = new Map<string, Promise<ResultadoConsultaDgii>>();
let bloqueadoHasta = 0;

export function normalizarDocumentoDgii(valor: string): string {
  return valor.replace(/\D/g, "");
}

export function validarDocumentoDgii(
  tipo: TipoDocumentoDgii,
  valor: string,
): { ok: true; numero: string } | { ok: false; error: "documento_invalido" } {
  const numero = normalizarDocumentoDgii(valor);
  if (numero.length !== LONGITUD[tipo]) return { ok: false, error: "documento_invalido" };
  return { ok: true, numero };
}

export interface CamposFormularioDgii {
  viewState: string;
  viewStateGenerator: string;
  eventValidation: string;
}

export function extraerCamposOcultos(html: string): CamposFormularioDgii | null {
  const viewState = valorOculto(html, "__VIEWSTATE");
  const eventValidation = valorOculto(html, "__EVENTVALIDATION");
  if (viewState === "" || eventValidation === "") return null;

  return {
    viewState,
    viewStateGenerator: valorOculto(html, "__VIEWSTATEGENERATOR"),
    eventValidation,
  };
}

export function construirFormularioDgii(campos: CamposFormularioDgii, numero: string): URLSearchParams {
  return new URLSearchParams({
    __EVENTTARGET: "",
    __EVENTARGUMENT: "",
    __VIEWSTATE: campos.viewState,
    __VIEWSTATEGENERATOR: campos.viewStateGenerator,
    __EVENTVALIDATION: campos.eventValidation,
    [CAMPO_NUMERO]: numero,
    [CAMPO_BOTON]: "BUSCAR",
  });
}

export function parsearRespuestaDgii(html: string): ResultadoParseoDgii {
  if (html.includes("no se encuentra inscrito")) return { estado: "no_encontrado" };

  const tabla = html.match(/<table[^>]*id="cphMain_dvDatosContribuyentes"[\s\S]*?<\/table>/i);
  if (!tabla?.[0]) return { estado: "sin_respuesta" };

  const campos = leerFilas(tabla[0]);
  const razonSocial = campos.get("nombre/razon social") ?? campos.get("razon social") ?? "";
  const nombreComercial = campos.get("nombre comercial") ?? "";
  const nombre = razonSocial === "" ? nombreComercial : razonSocial;
  if (nombre === "") return { estado: "no_encontrado" };

  return {
    estado: "encontrado",
    datos: {
      nombre,
      nombreComercial: nombreComercial === "" ? null : nombreComercial,
      municipioProvincia: primerValor(campos, ["municipio/provincia", "municipio", "provincia"]),
      direccion: primerValor(campos, ["direccion"]),
      estado: primerValor(campos, ["estado"]),
    },
  };
}

export async function consultarDgii(tipo: TipoDocumentoDgii, valor: string): Promise<ResultadoConsultaDgii> {
  const validacion = validarDocumentoDgii(tipo, valor);
  if (!validacion.ok) return validacion;

  const clave = `${tipo}:${validacion.numero}`;
  const guardado = cache.get(clave);
  if (guardado && guardado.expira > Date.now()) return guardado.resultado;

  const pendiente = enCurso.get(clave);
  if (pendiente !== undefined) return await pendiente;

  const consulta = consultarRemoto(clave, validacion.numero);
  enCurso.set(clave, consulta);
  try {
    return await consulta;
  } finally {
    enCurso.delete(clave);
  }
}

async function consultarRemoto(clave: string, numero: string): Promise<ResultadoConsultaDgii> {
  if (bloqueadoHasta > Date.now()) return { ok: false, error: "red" };

  const controlador = new AbortController();
  const temporizador = setTimeout(() => controlador.abort(), TIEMPO_LIMITE_DGII_MS);

  try {
    const pagina = await pedirFormulario(controlador.signal);
    const campos = extraerCamposOcultos(pagina.html);
    if (!campos) return { ok: false, error: "sin_respuesta" };

    const respuesta = await fetch(URL_CONSULTA_DGII, {
      method: "POST",
      cache: "no-store",
      signal: controlador.signal,
      headers: {
        "content-type": "application/x-www-form-urlencoded",
        accept: "text/html",
        "accept-language": "es-DO,es;q=0.9",
        origin: "https://dgii.gov.do",
        referer: URL_CONSULTA_DGII,
        "user-agent": AGENTE,
        ...(pagina.cookie === "" ? {} : { cookie: pagina.cookie }),
      },
      body: construirFormularioDgii(campos, numero),
    });
    if (!respuesta.ok) {
      if (respuesta.status === 403) {
        registrarBloqueo();
        return { ok: false, error: "red" };
      }
      return { ok: false, error: "sin_respuesta" };
    }

    const parseo = parsearRespuestaDgii(await respuesta.text());
    if (parseo.estado === "encontrado") {
      const resultado: ResultadoConsultaDgii = { ok: true, datos: parseo.datos };
      guardarEnCache(clave, resultado, CACHE_EXITOS_MS);
      return resultado;
    }
    if (parseo.estado === "no_encontrado") {
      const resultado: ResultadoConsultaDgii = { ok: false, error: "no_encontrado" };
      guardarEnCache(clave, resultado, CACHE_NO_ENCONTRADO_MS);
      return resultado;
    }
    return { ok: false, error: "sin_respuesta" };
  } catch (error) {
    if (controlador.signal.aborted) return { ok: false, error: "sin_respuesta" };
    console.error("No se pudo consultar la DGII", error);
    return { ok: false, error: "red" };
  } finally {
    clearTimeout(temporizador);
  }
}

async function pedirFormulario(senal: AbortSignal): Promise<{ html: string; cookie: string }> {
  const respuesta = await fetch(URL_CONSULTA_DGII, {
    cache: "no-store",
    signal: senal,
    headers: {
      accept: "text/html",
      "accept-language": "es-DO,es;q=0.9",
      "user-agent": AGENTE,
    },
  });
  if (respuesta.status === 403) {
    registrarBloqueo();
    throw new Error("La DGII bloqueó la consulta (403)");
  }
  if (!respuesta.ok) throw new Error(`La DGII respondió ${respuesta.status}`);
  return { html: await respuesta.text(), cookie: leerCookies(respuesta.headers) };
}

function registrarBloqueo() {
  if (bloqueadoHasta > Date.now()) return;
  bloqueadoHasta = Date.now() + BLOQUEO_MS;
  console.warn("La DGII bloqueó la consulta; se pausan las consultas por unos minutos.");
}

function leerCookies(cabeceras: Headers): string {
  const obtener = (cabeceras as Headers & { getSetCookie?: () => string[] }).getSetCookie;
  if (typeof obtener === "function") {
    return obtener
      .call(cabeceras)
      .map((cookie) => cookie.split(";")[0] ?? "")
      .filter((cookie) => cookie !== "")
      .join("; ");
  }
  return (cabeceras.get("set-cookie") ?? "").split(";")[0] ?? "";
}

function guardarEnCache(clave: string, resultado: ResultadoConsultaDgii, duracion: number) {
  if (cache.size >= MAXIMO_CACHE) {
    const masVieja = cache.keys().next().value;
    if (masVieja !== undefined) cache.delete(masVieja);
  }
  cache.set(clave, { resultado, expira: Date.now() + duracion });
}

function valorOculto(html: string, nombre: string): string {
  const etiquetas = html.match(/<input[^>]*>/gi) ?? [];
  for (const etiqueta of etiquetas) {
    if (!etiqueta.includes(`name="${nombre}"`)) continue;
    return etiqueta.match(/value="([^"]*)"/i)?.[1] ?? "";
  }
  return "";
}

function leerFilas(tabla: string): Map<string, string> {
  const campos = new Map<string, string>();
  for (const fila of tabla.matchAll(/<tr[^>]*>([\s\S]*?)<\/tr>/gi)) {
    const contenido = fila[1];
    if (!contenido) continue;
    const celdas = [...contenido.matchAll(/<t[dh][^>]*>([\s\S]*?)<\/t[dh]>/gi)].map((celda) =>
      textoPlano(celda[1] ?? ""),
    );
    const [etiqueta, valor] = celdas;
    if (!etiqueta || valor === undefined || valor === "") continue;
    campos.set(claveEtiqueta(etiqueta), valor);
  }
  return campos;
}

function primerValor(campos: Map<string, string>, llaves: string[]): string | null {
  for (const llave of llaves) {
    const valor = campos.get(llave);
    if (valor) return valor;
  }
  return null;
}

function claveEtiqueta(valor: string): string {
  return valor
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}

function textoPlano(fragmento: string): string {
  return decodificarEntidades(fragmento.replace(/<[^>]*>/g, " "))
    .replace(/\u00a0/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

const ENTIDADES: Record<string, string> = {
  amp: "&",
  lt: "<",
  gt: ">",
  quot: '"',
  apos: "'",
  nbsp: " ",
  aacute: "á",
  eacute: "é",
  iacute: "í",
  oacute: "ó",
  uacute: "ú",
  ntilde: "ñ",
  Aacute: "Á",
  Eacute: "É",
  Iacute: "Í",
  Oacute: "Ó",
  Uacute: "Ú",
  Ntilde: "Ñ",
};

function decodificarEntidades(valor: string): string {
  return valor.replace(/&(#x?[0-9a-fA-F]+|[a-zA-Z]+);/g, (original: string, codigo: string) => {
    if (codigo.startsWith("#")) {
      const hexadecimal = codigo[1] === "x" || codigo[1] === "X";
      const numero = Number.parseInt(codigo.slice(hexadecimal ? 2 : 1), hexadecimal ? 16 : 10);
      return Number.isFinite(numero) && numero > 0 && numero <= 0x10ffff ? String.fromCodePoint(numero) : original;
    }
    return ENTIDADES[codigo] ?? ENTIDADES[codigo.toLowerCase()] ?? original;
  });
}
