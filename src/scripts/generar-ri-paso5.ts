/**
 * Genera y verifica las 11 representaciones impresas PDF del Paso 5 CerteCF.
 *
 * Las RI se renderizan con las plantillas reales del sistema (DocumentoPapel
 * de ventas y los documentos de nota de débito/crédito, copiados de Alegra)
 * impresas a PDF vía Chromium — no hay ningún PDF inventado.
 *
 * Corre solo con archivos locales:
 *   pnpm ts-node -P tsconfig.scripts.json src/scripts/generar-ri-paso5.ts
 */

import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, statSync, writeFileSync } from "node:fs";
import Module from "node:module";
import { tmpdir } from "node:os";
import path, { join } from "node:path";

/**
 * Las plantillas y la tubería de impresión importan con el alias `@/` (como
 * todo el código de la app). ts-node no resuelve paths de tsconfig en runtime,
 * así que instalamos un resolvedor mínimo `@/ → src/` ANTES de cargarlas; los
 * requires de la app quedan diferidos a continuación, ya con el alias activo.
 */
type ResolverNombre = (request: string, parent: unknown, isMain: boolean, options?: unknown) => string;
const moduloInterno = Module as unknown as { _resolveFilename: ResolverNombre };
const resolverOriginal = moduloInterno._resolveFilename.bind(Module);
moduloInterno._resolveFilename = (request, parent, isMain, options) => {
  const ajustado = request.startsWith("@/") ? path.resolve("src", request.slice(2)) : request;
  return resolverOriginal(ajustado, parent, isMain, options);
};

const { construirUrlQrDesdeRi, parsearRepresentacionImpresaXml } =
  // biome-ignore lint/style/noCommonJs: carga diferida obligatoria — el alias @/ debe parchearse antes de importar las plantillas
  require("../lib/ecf/representacion-impresa") as typeof import("../lib/ecf/representacion-impresa");
const { elementoRepresentacionImpresa } =
  // biome-ignore lint/style/noCommonJs: carga diferida obligatoria — el alias @/ debe parchearse antes de importar las plantillas
  require("../lib/ecf/representacion-impresa-plantillas") as typeof import("../lib/ecf/representacion-impresa-plantillas");
const { cerrarNavegadorPapel, renderizarPapelPdf } =
  // biome-ignore lint/style/noCommonJs: carga diferida obligatoria — el alias @/ debe parchearse antes de importar las plantillas
  require("../lib/impresion/renderizar-papel-pdf") as typeof import("../lib/impresion/renderizar-papel-pdf");

type DatosRi = import("../lib/ecf/representacion-impresa").DatosRi;

const DIRECTORIO_PASO4 = "/root/referencias/ecf-oxymat/paso4-simulacion-1201";
const DIRECTORIO_SALIDA = "/root/referencias/ecf-oxymat/paso5-ri-pdf";
const ARCHIVO_MANIFIESTO_PASO4 = join(DIRECTORIO_PASO4, "manifiesto-paso4-1201.json");
const ARCHIVO_MANIFIESTO_PASO5 = join(DIRECTORIO_SALIDA, "manifiesto-paso5.json");
const RNC_OXYMAT = "131488791";
const TAMANO_MINIMO_PDF = 2 * 1024;
const LIMITE_TOTAL_BYTES = 10 * 1024 * 1024;

const formatoMontoRd = new Intl.NumberFormat("es-DO", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

interface SlotPaso5 {
  slot: string;
  encf: string;
}

const SLOTS_PASO5: SlotPaso5[] = [
  { slot: "31", encf: "E310000001201" },
  { slot: "32>=250mil", encf: "E320000001201" },
  { slot: "33", encf: "E330000001201" },
  { slot: "34", encf: "E340000001201" },
  { slot: "41", encf: "E410000001201" },
  { slot: "43", encf: "E430000001201" },
  { slot: "44", encf: "E440000001201" },
  { slot: "45", encf: "E450000001201" },
  { slot: "46", encf: "E460000001201" },
  { slot: "47", encf: "E470000001201" },
  { slot: "32<250mil", encf: "E320000001203" },
];

interface EntradaManifiestoPaso4 {
  encf: string;
  tipoEcf: string | null;
  esRfce: boolean | null;
  estado: string | null;
  codigoSeguridad: string | null;
  fechaHoraFirma: string | null;
  urlQr: string | null;
}

interface ResultadoPaso5 {
  slot: string;
  encf: string;
  archivo: string;
  xmlOrigen: string;
  urlQr: string | null;
  qrDecodificado: string | null;
  paginas: number | null;
  bytes: number;
  pass: boolean;
  fallas: string[];
}

interface VerificacionPdf {
  qrDecodificado: string | null;
  xMinQrPx: number | null;
  paginas: number | null;
  bytes: number;
  fallas: string[];
}

interface PalabraBBox {
  texto: string;
  xMin: number;
  yMin: number;
}

function mensajeError(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

function ejecutar(comando: string, args: string[]): string {
  return execFileSync(comando, args, {
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
  });
}

function intentar<T>(fallas: string[], etiqueta: string, accion: () => T): T | null {
  try {
    return accion();
  } catch (error) {
    fallas.push(`${etiqueta}: ${mensajeError(error)}`);
    return null;
  }
}

function normalizarTextoPdf(texto: string): string {
  return texto.normalize("NFC").replace(/\s+/g, " ").trim();
}

/**
 * Texto sin ningún espacio en blanco. El texto tipográfico del PDF no codifica
 * los espacios de forma semántica: poppler los infiere por posición y a veces
 * los pierde o inserta saltos dentro de un token cuando la celda envuelve
 * ("0-15" cortado al final de línea). Comparar sin espacios verifica los
 * caracteres exactos del literal en orden, que es lo que acredita la DGII.
 */
function compactarTexto(texto: string): string {
  return texto.normalize("NFC").replace(/\s+/g, "");
}

function textoCampo(registro: Record<string, unknown>, campo: string): string | null {
  const valor = registro[campo];
  return typeof valor === "string" ? valor : null;
}

function booleanCampo(registro: Record<string, unknown>, campo: string): boolean | null {
  const valor = registro[campo];
  return typeof valor === "boolean" ? valor : null;
}

function leerManifiestoPaso4(): Map<string, EntradaManifiestoPaso4> {
  const crudo: unknown = JSON.parse(readFileSync(ARCHIVO_MANIFIESTO_PASO4, "utf8"));
  if (!Array.isArray(crudo)) throw new Error("El manifiesto del Paso 4 no es un arreglo JSON");

  const mapa = new Map<string, EntradaManifiestoPaso4>();
  for (const valor of crudo) {
    if (typeof valor !== "object" || valor === null)
      throw new Error("El manifiesto del Paso 4 contiene una entrada inválida");
    const registro = valor as Record<string, unknown>;
    const encf = textoCampo(registro, "encf");
    if (!encf) throw new Error("El manifiesto del Paso 4 contiene una entrada sin encf");
    mapa.set(encf, {
      encf,
      tipoEcf: textoCampo(registro, "tipo_ecf"),
      esRfce: booleanCampo(registro, "es_rfce"),
      estado: textoCampo(registro, "estado"),
      codigoSeguridad: textoCampo(registro, "codigo_seguridad"),
      fechaHoraFirma: textoCampo(registro, "fecha_hora_firma"),
      urlQr: textoCampo(registro, "url_qr"),
    });
  }
  return mapa;
}

function validarContraManifiesto(datos: DatosRi, entrada: EntradaManifiestoPaso4): string {
  if (entrada.estado !== "aceptado") throw new Error(`${datos.encf}: el manifiesto no está en estado aceptado`);
  if (entrada.tipoEcf !== datos.tipoEcf) {
    throw new Error(
      `${datos.encf}: tipo_ecf del manifiesto (${entrada.tipoEcf ?? "ausente"}) difiere del XML (${datos.tipoEcf})`,
    );
  }
  if (!entrada.codigoSeguridad) throw new Error(`${datos.encf}: el manifiesto no tiene codigo_seguridad`);
  if (entrada.codigoSeguridad !== datos.codigoSeguridad) {
    throw new Error(
      `${datos.encf}: codigo_seguridad del manifiesto (${entrada.codigoSeguridad}) difiere del XML (${datos.codigoSeguridad})`,
    );
  }
  if (entrada.fechaHoraFirma && entrada.fechaHoraFirma !== datos.fechaHoraFirma) {
    throw new Error(
      `${datos.encf}: fecha_hora_firma del manifiesto (${entrada.fechaHoraFirma}) difiere del XML (${datos.fechaHoraFirma})`,
    );
  }
  if (!entrada.urlQr) throw new Error(`${datos.encf}: el manifiesto no tiene url_qr`);

  const urlDerivada = construirUrlQrDesdeRi(datos, {
    ambiente: "certecf",
    esRfce: entrada.esRfce === true,
  });
  if (entrada.urlQr !== urlDerivada) {
    throw new Error(
      `${datos.encf}: url_qr del manifiesto difiere de la derivada del XML\nXML: ${urlDerivada}\nManifiesto: ${entrada.urlQr}`,
    );
  }
  return entrada.urlQr;
}

function agregarEsperadoTexto(esperados: string[], valor: string | null | undefined): void {
  if (valor != null && valor.trim() !== "") esperados.push(valor);
}

/**
 * Candado 1 — literales del XML en el texto del PDF. Se extrae con
 * `pdftotext -raw` (orden del flujo de contenido): las plantillas reales
 * envuelven las descripciones largas dentro de su celda y el flujo las
 * mantiene contiguas, mientras que `-layout` las intercala con las demás
 * columnas. `-raw` además no inventa ni borra caracteres — el modo por
 * defecto de poppler trata el "-" al final de línea como guion blando de
 * división y lo elimina ("0-15" → "015"); sus únicos artefactos son los
 * espacios, que la comparación sin espacios neutraliza.
 */
function verificarTextoPdf(datos: DatosRi, rutaPdf: string, fallas: string[]): void {
  const texto = intentar(fallas, "pdftotext -raw", () => ejecutar("pdftotext", ["-raw", rutaPdf, "-"]));
  if (texto == null) return;
  const textoNormalizado = compactarTexto(texto);
  const esperados: string[] = [
    datos.encf,
    datos.tipoEcfNombre,
    datos.emisor.rnc,
    formatoMontoRd.format(datos.totales.montoTotal),
    datos.codigoSeguridad,
    datos.fechaHoraFirma,
  ];

  agregarEsperadoTexto(esperados, datos.comprador?.rnc);
  agregarEsperadoTexto(esperados, datos.comprador?.identificadorExtranjero);
  agregarEsperadoTexto(esperados, datos.comprador?.razonSocial);
  agregarEsperadoTexto(esperados, datos.informacionReferencia?.ncfModificado);
  for (const item of datos.items) agregarEsperadoTexto(esperados, item.nombreItem);

  // Candados fiscales extendidos: los subtotales/totales exactos del XML deben
  // imprimirse (la RI los pasa, no los recomputa), con sus marcas normativas.
  const totales = datos.totales;
  const esperarMonto = (monto: number | null) => {
    if (monto != null) esperados.push(formatoMontoRd.format(monto));
  };
  esperarMonto(totales.montoGravadoTotal);
  esperarMonto(totales.montoGravadoI1);
  esperarMonto(totales.montoGravadoI2);
  esperarMonto(totales.montoGravadoI3);
  esperarMonto(totales.totalItbis);
  esperarMonto(totales.totalItbisRetenido && totales.totalItbisRetenido > 0 ? totales.totalItbisRetenido : null);
  esperarMonto(totales.totalIsrRetencion && totales.totalIsrRetencion > 0 ? totales.totalIsrRetencion : null);
  if ((totales.montoExento ?? 0) > 0) {
    esperados.push(formatoMontoRd.format(totales.montoExento ?? 0));
    esperados.push("SUBTOTAL EXENTO");
  }
  if (datos.items.some((item) => item.indicadorFacturacion === "4")) esperados.push("(E)");
  agregarEsperadoTexto(esperados, datos.emisor.sucursal);
  if (datos.fechaVencimientoSecuencia) {
    const partes = datos.fechaVencimientoSecuencia.match(/^(\d{2})-(\d{2})-(\d{4})/);
    if (partes) esperados.push(`${partes[1]}/${partes[2]}/${partes[3]}`);
  }
  if (datos.comprador?.identificadorExtranjero && !datos.comprador.rnc) esperados.push("Identificador extranjero");

  for (const esperado of esperados) {
    if (!textoNormalizado.includes(compactarTexto(esperado))) {
      fallas.push(`texto PDF no contiene literal esperado: ${esperado}`);
    }
  }
}

function verificarPdfInfo(rutaPdf: string, fallas: string[]): number | null {
  const salida = intentar(fallas, "pdfinfo", () => ejecutar("pdfinfo", [rutaPdf]));
  if (salida == null) return null;
  const paginasTexto = salida.match(/^Pages:\s+(\d+)\s*$/m)?.[1];
  if (!paginasTexto) {
    fallas.push("pdfinfo no reportó Pages");
    return null;
  }
  const paginas = Number(paginasTexto);
  if (!Number.isInteger(paginas) || paginas < 1) {
    fallas.push(`pdfinfo reportó un número de páginas inválido: ${paginasTexto}`);
    return null;
  }
  return paginas;
}

function verificarQpdf(rutaPdf: string, fallas: string[]): void {
  const salida = intentar(fallas, "qpdf --check", () => ejecutar("qpdf", ["--check", rutaPdf]));
  if (salida == null) return;
  if (!normalizarTextoPdf(salida).toLowerCase().includes("no syntax or stream encoding errors")) {
    fallas.push("qpdf --check no confirmó ausencia de errores de sintaxis/streams");
  }
}

interface LecturaQr {
  decodificado: string | null;
  xMinPx: number | null;
}

/**
 * Lee el QR con `zbarimg --xml` sobre el PNG a 300 dpi: además del contenido
 * decodificado entrega el polígono detectado, cuya x mínima acredita la
 * posición real del QR (los módulos arrancan dentro de la zona silenciosa, así
 * que si incluso ellos están a ≥ 2 cm del borde, el QR cumple de sobra).
 */
function leerQrXml(rutaPng: string): LecturaQr | null {
  try {
    const salida = ejecutar("zbarimg", ["--xml", rutaPng]);
    const decodificado = salida.match(/<data><!\[CDATA\[([\s\S]*?)\]\]><\/data>/)?.[1] ?? null;
    const poligono = salida.match(/<polygon points='([^']+)'/)?.[1];
    let xMinPx: number | null = null;
    if (poligono) {
      const xs = [...poligono.matchAll(/\+(\d+),\+\d+/g)].map((m) => Number(m[1]));
      if (xs.length > 0) xMinPx = Math.min(...xs);
    }
    return { decodificado, xMinPx };
  } catch {
    return null;
  }
}

function verificarQrPdf(
  rutaPdf: string,
  urlQr: string,
  temporal: string,
  fallas: string[],
): { qrDecodificado: string | null; xMinQrPx: number | null } {
  const vacio = { qrDecodificado: null, xMinQrPx: null };
  const prefijo = join(temporal, "pagina-qr");
  const conversion = intentar(fallas, "pdftoppm -png -r 300", () =>
    ejecutar("pdftoppm", ["-png", "-r", "300", "-f", "1", "-singlefile", rutaPdf, prefijo]),
  );
  if (conversion == null) return vacio;

  const lectura = leerQrXml(`${prefijo}.png`);
  if (!lectura?.decodificado) {
    fallas.push("zbarimg no decodificó ningún QR en la página 1");
    return vacio;
  }
  const decodificado = lectura.decodificado;
  if (decodificado !== urlQr) {
    fallas.push(`QR decodificado distinto del url_qr del manifiesto\nQR: ${decodificado}\nEsperado: ${urlQr}`);
  }
  return { qrDecodificado: decodificado, xMinQrPx: lectura.xMinPx };
}

function atributoNumerico(atributos: string, nombre: string): number | null {
  const valor = atributos.match(new RegExp(`${nombre}="([^"]+)"`))?.[1];
  if (valor == null) return null;
  const numero = Number(valor);
  return Number.isFinite(numero) ? numero : null;
}

function decodificarTextoXml(texto: string): string {
  return texto
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&amp;/g, "&");
}

function extraerPalabrasBBox(xml: string): PalabraBBox[] {
  const palabras: PalabraBBox[] = [];
  const regex = /<word\s+([^>]*)>([\s\S]*?)<\/word>/g;
  for (const coincidencia of xml.matchAll(regex)) {
    const atributos = coincidencia[1] ?? "";
    const xMin = atributoNumerico(atributos, "xMin");
    const yMin = atributoNumerico(atributos, "yMin");
    if (xMin == null || yMin == null) continue;
    palabras.push({ texto: decodificarTextoXml(coincidencia[2] ?? ""), xMin, yMin });
  }
  return palabras;
}

/** Candado 4 — el QR queda abajo-izquierda y arranca a ≥ 2 cm (56.69 pt) del borde, medido en su polígono real detectado por zbarimg. */
function verificarBloqueFiscalInferiorIzquierdo(
  rutaPdf: string,
  temporal: string,
  fallas: string[],
  xMinQrPx: number | null,
): void {
  if (xMinQrPx == null) {
    fallas.push("zbarimg no reportó el polígono del QR para medir su posición");
  } else {
    const inicioQrPt = (xMinQrPx * 72) / 300;
    if (inicioQrPt < 56.69) {
      fallas.push(`el QR arranca a menos de 2cm del borde izquierdo (${inicioQrPt.toFixed(2)}pt < 56.69pt)`);
    }
  }
  const salidaXml = join(temporal, "bbox-layout.xml");
  const conversion = intentar(fallas, "pdftotext -bbox-layout", () =>
    ejecutar("pdftotext", ["-bbox-layout", rutaPdf, salidaXml]),
  );
  if (conversion == null) return;

  const palabras = extraerPalabrasBBox(readFileSync(salidaXml, "utf8"));
  let inicioCodigo: PalabraBBox | null = null;
  for (let indice = 0; indice < palabras.length - 2; indice++) {
    const palabraCodigo = palabras[indice];
    const palabraDe = palabras[indice + 1];
    const palabraSeguridad = palabras[indice + 2];
    if (!palabraCodigo || !palabraDe || !palabraSeguridad) continue;
    if (
      palabraCodigo.texto === "Código" &&
      palabraDe.texto === "de" &&
      palabraSeguridad.texto.startsWith("seguridad")
    ) {
      inicioCodigo = palabraCodigo;
      break;
    }
  }

  if (!inicioCodigo) {
    fallas.push("bbox-layout no encontró el texto 'Código de seguridad'");
    return;
  }
  if (inicioCodigo.xMin >= 306) {
    fallas.push(`bloque fiscal no está en el cuadrante izquierdo (xMin=${inicioCodigo.xMin.toFixed(2)})`);
  }
  if (inicioCodigo.yMin <= 396) {
    fallas.push(`bloque fiscal no está en la mitad inferior de la página (yMin=${inicioCodigo.yMin.toFixed(2)})`);
  }
}

function verificarPdf(datos: DatosRi, rutaPdf: string, urlQr: string): VerificacionPdf {
  const fallas: string[] = [];
  const temporal = mkdtempSync(join(tmpdir(), "ri-paso5-"));
  try {
    const bytes = statSync(rutaPdf).size;
    if (bytes <= TAMANO_MINIMO_PDF) fallas.push(`PDF demasiado pequeño: ${bytes} bytes`);
    if (!readFileSync(rutaPdf).subarray(0, 4).toString().startsWith("%PDF")) {
      fallas.push("El archivo no empieza con la cabecera %PDF");
    }

    const paginas = verificarPdfInfo(rutaPdf, fallas);
    verificarQpdf(rutaPdf, fallas);
    verificarTextoPdf(datos, rutaPdf, fallas);
    const lecturaQr = verificarQrPdf(rutaPdf, urlQr, temporal, fallas);
    verificarBloqueFiscalInferiorIzquierdo(rutaPdf, temporal, fallas, lecturaQr.xMinQrPx);

    return { qrDecodificado: lecturaQr.qrDecodificado, xMinQrPx: lecturaQr.xMinQrPx, paginas, bytes, fallas };
  } finally {
    rmSync(temporal, { recursive: true, force: true });
  }
}

function resultadoBase(slot: SlotPaso5): ResultadoPaso5 {
  const baseXml = `${RNC_OXYMAT}${slot.encf}`;
  return {
    slot: slot.slot,
    encf: slot.encf,
    archivo: `${baseXml}.pdf`,
    xmlOrigen: join(DIRECTORIO_PASO4, `${baseXml}.xml`),
    urlQr: null,
    qrDecodificado: null,
    paginas: null,
    bytes: 0,
    pass: false,
    fallas: [],
  };
}

async function procesarSlot(slot: SlotPaso5, manifiesto: Map<string, EntradaManifiestoPaso4>): Promise<ResultadoPaso5> {
  const resultado = resultadoBase(slot);
  try {
    const entrada = manifiesto.get(slot.encf);
    if (!entrada) throw new Error(`${slot.encf}: no existe en el manifiesto del Paso 4`);
    if (!existsSync(resultado.xmlOrigen)) throw new Error(`No existe el XML origen: ${resultado.xmlOrigen}`);

    const datos = parsearRepresentacionImpresaXml(readFileSync(resultado.xmlOrigen, "utf8"));
    if (datos.encf !== slot.encf) throw new Error(`El XML contiene ${datos.encf}, pero el slot esperaba ${slot.encf}`);
    const urlQr = validarContraManifiesto(datos, entrada);
    datos.urlQr = urlQr;
    resultado.urlQr = urlQr;

    const pdf = await renderizarPapelPdf(elementoRepresentacionImpresa(datos));
    const rutaPdf = join(DIRECTORIO_SALIDA, resultado.archivo);
    writeFileSync(rutaPdf, pdf);

    const verificacion = verificarPdf(datos, rutaPdf, urlQr);
    resultado.qrDecodificado = verificacion.qrDecodificado;
    resultado.paginas = verificacion.paginas;
    resultado.bytes = verificacion.bytes;
    resultado.fallas.push(...verificacion.fallas);
  } catch (error) {
    resultado.fallas.push(mensajeError(error));
  }
  resultado.pass = resultado.fallas.length === 0;
  return resultado;
}

function escribirManifiestoPaso5(resultados: ResultadoPaso5[]): void {
  const contenido = resultados.map((resultado) => ({
    archivo: resultado.archivo,
    slot: resultado.slot,
    encf: resultado.encf,
    xml_origen: resultado.xmlOrigen,
    url_qr: resultado.urlQr,
    qr_decodificado: resultado.qrDecodificado,
    paginas: resultado.paginas,
    bytes: resultado.bytes,
  }));
  writeFileSync(ARCHIVO_MANIFIESTO_PASO5, `${JSON.stringify(contenido, null, 2)}\n`);
}

function imprimirTabla(resultados: ResultadoPaso5[], totalBytes: number): void {
  console.log("\nPDF Paso 5 RI — verificación automática");
  console.log(`${"slot".padEnd(11)} ${"encf".padEnd(14)} ${"páginas".padStart(7)} ${"bytes".padStart(9)} estado`);
  for (const resultado of resultados) {
    const paginas = resultado.paginas == null ? "-" : String(resultado.paginas);
    console.log(
      `${resultado.slot.padEnd(11)} ${resultado.encf.padEnd(14)} ${paginas.padStart(7)} ${String(resultado.bytes).padStart(9)} ${resultado.pass ? "PASS" : "FAIL"}`,
    );
  }
  console.log(
    `${"TOTAL".padEnd(11)} ${"".padEnd(14)} ${"".padStart(7)} ${String(totalBytes).padStart(9)} ${totalBytes <= LIMITE_TOTAL_BYTES ? "PASS" : "FAIL"}`,
  );
}

function imprimirFallas(resultados: ResultadoPaso5[]): void {
  for (const resultado of resultados) {
    if (resultado.pass) continue;
    console.error(`\nFAIL ${resultado.encf} (${resultado.slot}):`);
    for (const falla of resultado.fallas) console.error(`  - ${falla}`);
  }
}

async function main(): Promise<void> {
  mkdirSync(DIRECTORIO_SALIDA, { recursive: true });
  const manifiesto = leerManifiestoPaso4();
  const resultados: ResultadoPaso5[] = [];

  try {
    for (const slot of SLOTS_PASO5) {
      resultados.push(await procesarSlot(slot, manifiesto));
    }
  } finally {
    await cerrarNavegadorPapel();
  }

  const totalBytes = resultados.reduce((total, resultado) => total + resultado.bytes, 0);
  escribirManifiestoPaso5(resultados);
  imprimirTabla(resultados, totalBytes);
  imprimirFallas(resultados);
  console.log(`\nManifiesto Paso 5: ${ARCHIVO_MANIFIESTO_PASO5}`);
  console.log(`Tamaño total: ${totalBytes} bytes (límite ${LIMITE_TOTAL_BYTES} bytes)`);

  const fallidos = resultados.filter((resultado) => !resultado.pass).length;
  if (fallidos > 0 || totalBytes > LIMITE_TOTAL_BYTES) {
    console.error(`Paso 5 RI PDF: FAIL (${SLOTS_PASO5.length - fallidos}/${SLOTS_PASO5.length} PDFs en PASS)`);
    process.exit(1);
  }
  console.log(`Paso 5 RI PDF: PASS (${SLOTS_PASO5.length}/${SLOTS_PASO5.length} PDFs en PASS)`);
}

main().catch((error) => {
  console.error(`generar-ri-paso5: ${mensajeError(error)}`);
  process.exit(1);
});
