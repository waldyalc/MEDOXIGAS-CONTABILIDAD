/**
 * Genera y verifica las 11 representaciones impresas PDF del Paso 5 CerteCF.
 *
 * Corre solo con archivos locales:
 *   pnpm ts-node -P tsconfig.scripts.json src/scripts/generar-ri-paso5.ts
 */

import {
  construirUrlQrDesdeRi,
  type DatosRi,
  parsearRepresentacionImpresaXml,
} from "../lib/ecf/representacion-impresa";
import { formatearMontoRi, generarPdfRepresentacionImpresa } from "../lib/ecf/representacion-impresa-pdf";
import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, statSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const DIRECTORIO_PASO4 = "/root/referencias/ecf-oxymat/paso4-simulacion-1201";
const DIRECTORIO_SALIDA = "/root/referencias/ecf-oxymat/paso5-ri-pdf";
const ARCHIVO_MANIFIESTO_PASO4 = join(DIRECTORIO_PASO4, "manifiesto-paso4-1201.json");
const ARCHIVO_MANIFIESTO_PASO5 = join(DIRECTORIO_SALIDA, "manifiesto-paso5.json");
const RNC_OXYMAT = "131488791";
const TAMANO_MINIMO_PDF = 2 * 1024;
const LIMITE_TOTAL_BYTES = 10 * 1024 * 1024;

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

function verificarTextoPdf(datos: DatosRi, rutaPdf: string, fallas: string[]): void {
  const texto = intentar(fallas, "pdftotext -layout", () => ejecutar("pdftotext", ["-layout", rutaPdf, "-"]));
  if (texto == null) return;
  const textoNormalizado = normalizarTextoPdf(texto);
  const esperados: string[] = [
    datos.encf,
    datos.tipoEcfNombre,
    datos.emisor.rnc,
    formatearMontoRi(datos.totales.montoTotal),
    datos.codigoSeguridad,
    datos.fechaHoraFirma,
  ];

  agregarEsperadoTexto(esperados, datos.comprador?.rnc);
  agregarEsperadoTexto(esperados, datos.comprador?.identificadorExtranjero);
  agregarEsperadoTexto(esperados, datos.comprador?.razonSocial);
  agregarEsperadoTexto(esperados, datos.informacionReferencia?.ncfModificado);
  for (const item of datos.items) agregarEsperadoTexto(esperados, item.nombreItem);

  for (const esperado of esperados) {
    if (!textoNormalizado.includes(normalizarTextoPdf(esperado))) {
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

function verificarQrPdf(rutaPdf: string, urlQr: string, temporal: string, fallas: string[]): string | null {
  const prefijo = join(temporal, "pagina-qr");
  const conversion = intentar(fallas, "pdftoppm -png -r 300", () =>
    ejecutar("pdftoppm", ["-png", "-r", "300", "-f", "1", "-singlefile", rutaPdf, prefijo]),
  );
  if (conversion == null) return null;

  const salida = intentar(fallas, "zbarimg --raw", () => ejecutar("zbarimg", ["--raw", `${prefijo}.png`]));
  if (salida == null) return null;
  const decodificado = salida.endsWith("\n") ? salida.slice(0, -1) : salida;
  if (decodificado !== urlQr) {
    fallas.push(`QR decodificado distinto del url_qr del manifiesto\nQR: ${decodificado}\nEsperado: ${urlQr}`);
  }
  return decodificado;
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

function verificarBloqueFiscalInferiorIzquierdo(rutaPdf: string, temporal: string, fallas: string[]): void {
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
  if (inicioCodigo.xMin < 50) {
    fallas.push(`bloque fiscal queda a menos de 2cm del borde izquierdo (xMin=${inicioCodigo.xMin.toFixed(2)})`);
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
    const qrDecodificado = verificarQrPdf(rutaPdf, urlQr, temporal, fallas);
    verificarBloqueFiscalInferiorIzquierdo(rutaPdf, temporal, fallas);

    return { qrDecodificado, paginas, bytes, fallas };
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

    const pdf = await generarPdfRepresentacionImpresa(datos);
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

  for (const slot of SLOTS_PASO5) {
    resultados.push(await procesarSlot(slot, manifiesto));
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
