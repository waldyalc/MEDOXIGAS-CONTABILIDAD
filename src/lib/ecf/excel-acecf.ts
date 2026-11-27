import ExcelJS from "exceljs";

import type { AprobacionComercialInput, CasoExcelAcecfDgii } from "./tipos";
import { normalizarMontoAcecfDgii } from "./xml";

const SENTINEL_VACIO = "#e";
const ENCABEZADOS_REQUERIDOS = ["RNCEmisor", "eNCF", "RNCComprador", "Estado"] as const;
const COLUMNAS_CONOCIDAS = new Set([
  "version",
  "rncemisor",
  "encf",
  "fechaemision",
  "montototal",
  "rnccomprador",
  "estado",
  "detallemotivorechazo",
  "fechahoraaprobacioncomercial",
]);

interface EncabezadoHoja {
  columna: number;
  nombre: string;
}

interface HojaAcecfCandidata {
  hoja: ExcelJS.Worksheet;
  encabezados: Map<string, EncabezadoHoja>;
}

type ValorPlanoCelda = string | number | boolean | Date | null;

function canonico(nombre: string): string {
  return nombre.trim().replace(/\s+/g, "").toLowerCase();
}

function limpiarTexto(valor: string): string {
  const recortado = valor.trim();
  return recortado.toLowerCase() === SENTINEL_VACIO ? "" : recortado;
}

function valorPlanoCelda(valor: ExcelJS.CellValue): ValorPlanoCelda {
  if (valor === null || valor === undefined) return null;
  if (typeof valor === "string" || typeof valor === "number" || typeof valor === "boolean" || valor instanceof Date) {
    return valor;
  }
  if ("richText" in valor) return valor.richText.map((parte) => parte.text).join("");
  if ("hyperlink" in valor) return valor.text;
  if ("formula" in valor || "sharedFormula" in valor) return valorPlanoCelda(valor.result ?? null);
  if ("error" in valor) return valor.error;
  return null;
}

function pad2(valor: number): string {
  return String(valor).padStart(2, "0");
}

function formatearFechaUtc(fecha: Date): string {
  return `${pad2(fecha.getUTCDate())}-${pad2(fecha.getUTCMonth() + 1)}-${String(fecha.getUTCFullYear()).padStart(4, "0")}`;
}

function formatearFechaHoraUtc(fecha: Date): string {
  return `${formatearFechaUtc(fecha)} ${pad2(fecha.getUTCHours())}:${pad2(fecha.getUTCMinutes())}:${pad2(fecha.getUTCSeconds())}`;
}

function textoDesdePlano(valor: ValorPlanoCelda): string {
  if (valor === null) return "";
  if (valor instanceof Date) return formatearFechaHoraUtc(valor);
  if (typeof valor === "boolean") return valor ? "TRUE" : "FALSE";
  return limpiarTexto(String(valor));
}

function textoCelda(celda: ExcelJS.Cell): string {
  return textoDesdePlano(valorPlanoCelda(celda.value));
}

function textoFechaCelda(celda: ExcelJS.Cell, conHora: boolean): string {
  const valor = valorPlanoCelda(celda.value);
  if (valor instanceof Date) return conHora ? formatearFechaHoraUtc(valor) : formatearFechaUtc(valor);
  return textoDesdePlano(valor);
}

function encabezadosDesdeHoja(hoja: ExcelJS.Worksheet): Map<string, EncabezadoHoja> {
  const encabezados = new Map<string, EncabezadoHoja>();
  hoja.getRow(1).eachCell({ includeEmpty: false }, (celda, numeroColumna) => {
    const nombre = textoCelda(celda);
    if (nombre === "") return;
    const clave = canonico(nombre);
    if (!encabezados.has(clave)) encabezados.set(clave, { columna: numeroColumna, nombre });
  });
  return encabezados;
}

function encabezadosCompletos(encabezados: Map<string, EncabezadoHoja>): boolean {
  return ENCABEZADOS_REQUERIDOS.every((nombre) => encabezados.has(canonico(nombre)));
}

function seleccionarHojaAcecf(libro: ExcelJS.Workbook): HojaAcecfCandidata {
  const evaluadas = libro.worksheets.map((hoja) => ({ hoja, encabezados: encabezadosDesdeHoja(hoja) }));
  if (evaluadas.length === 0) throw new Error("El Excel ACECF no contiene hojas");
  const esPreferida = (candidata: HojaAcecfCandidata): boolean => {
    const nombre = candidata.hoja.name.trim().toLowerCase();
    return nombre === "aceecf_generadas" || nombre === "acecf_generadas";
  };
  const preferida = evaluadas.find(esPreferida);
  if (preferida) return preferida;
  const otraValida = evaluadas.find((candidata) => encabezadosCompletos(candidata.encabezados));
  if (otraValida) return otraValida;
  const primera = evaluadas[0];
  if (!primera) throw new Error("El Excel ACECF no contiene hojas");
  return primera;
}

function asegurarEncabezados(encabezados: Map<string, EncabezadoHoja>): void {
  const faltantes = ENCABEZADOS_REQUERIDOS.filter((nombre) => !encabezados.has(canonico(nombre)));
  if (faltantes.length > 0) {
    throw new Error(`El Excel ACECF no tiene los encabezados obligatorios: ${faltantes.join(", ")}`);
  }
}

function columnasNoReconocidas(encabezados: Map<string, EncabezadoHoja>): string[] {
  const nombres = new Set<string>();
  for (const [clave, encabezado] of encabezados) {
    if (!COLUMNAS_CONOCIDAS.has(clave)) nombres.add(encabezado.nombre);
  }
  return [...nombres].sort();
}

function textoColumna(row: ExcelJS.Row, encabezados: Map<string, EncabezadoHoja>, nombre: string): string {
  const encabezado = encabezados.get(canonico(nombre));
  if (!encabezado) return "";
  return textoCelda(row.getCell(encabezado.columna));
}

function fechaColumna(
  row: ExcelJS.Row,
  encabezados: Map<string, EncabezadoHoja>,
  nombre: string,
  conHora: boolean,
): string {
  const encabezado = encabezados.get(canonico(nombre));
  if (!encabezado) return "";
  return textoFechaCelda(row.getCell(encabezado.columna), conHora);
}

function filaCompletamenteVacia(row: ExcelJS.Row): boolean {
  let vacia = true;
  row.eachCell({ includeEmpty: false }, (celda) => {
    if (textoCelda(celda) !== "") vacia = false;
  });
  return vacia;
}

function montoFila(texto: string, numeroFila: number): string {
  try {
    return normalizarMontoAcecfDgii(texto);
  } catch (error) {
    const detalle = error instanceof Error ? error.message : "valor no numérico";
    throw new Error(`La fila ${numeroFila} del Excel ACECF tiene MontoTotal inválido: ${detalle}`);
  }
}

function versionDgii(texto: string): string {
  return texto === "" || texto === "1" || texto === "1.0" ? "1.0" : texto;
}

function bufferDesdeEntrada(entrada: Buffer | ArrayBuffer | Uint8Array): Buffer {
  if (Buffer.isBuffer(entrada)) return entrada;
  if (entrada instanceof Uint8Array) return Buffer.from(entrada);
  return Buffer.from(entrada);
}

export function nombreArchivoAcecfDgii(rncComprador: string, encf: string): string {
  return `${rncComprador.replace(/\D/g, "")}${encf.trim().toUpperCase()}.xml`;
}

export async function parsearExcelAcecfDgii(buffer: Buffer | ArrayBuffer | Uint8Array): Promise<CasoExcelAcecfDgii[]> {
  const libro = new ExcelJS.Workbook();
  await libro.xlsx.load(bufferDesdeEntrada(buffer) as never);
  const { hoja, encabezados } = seleccionarHojaAcecf(libro);
  asegurarEncabezados(encabezados);
  const desconocidas = columnasNoReconocidas(encabezados);
  const casos: CasoExcelAcecfDgii[] = [];

  for (let numeroFila = 2; numeroFila <= hoja.rowCount; numeroFila += 1) {
    const row = hoja.getRow(numeroFila);
    if (filaCompletamenteVacia(row)) continue;

    const version = versionDgii(textoColumna(row, encabezados, "Version"));
    const rncEmisor = textoColumna(row, encabezados, "RNCEmisor");
    const encf = textoColumna(row, encabezados, "eNCF");
    const fechaEmision = fechaColumna(row, encabezados, "FechaEmision", false);
    const montoTotalTexto = montoFila(textoColumna(row, encabezados, "MontoTotal"), numeroFila);
    const rncComprador = textoColumna(row, encabezados, "RNCComprador");
    const estadoTexto = textoColumna(row, encabezados, "Estado");
    if (estadoTexto !== "1" && estadoTexto !== "2") {
      throw new Error(`La fila ${numeroFila} del Excel ACECF tiene Estado inválido: ${estadoTexto || "(vacío)"}`);
    }
    const motivo = textoColumna(row, encabezados, "DetalleMotivoRechazo");
    const fechaHora = fechaColumna(row, encabezados, "FechaHoraAprobacionComercial", true);

    const aprobacion: AprobacionComercialInput = {
      rncEmisor,
      rncComprador,
      encf,
      fechaEmision,
      montoTotal: Number(montoTotalTexto),
      montoTotalTexto,
      estado: estadoTexto,
    };
    if (motivo !== "") aprobacion.detalleMotivoRechazo = motivo;
    if (fechaHora !== "") aprobacion.fechaHoraAprobacionComercial = fechaHora;

    casos.push({
      numeroFila,
      version,
      aprobacion,
      montoTotalTexto,
      fechaEmisionLiteral: fechaEmision,
      fechaHoraAprobacionLiteral: fechaHora,
      nombreArchivoAcecf: nombreArchivoAcecfDgii(rncComprador, encf),
      columnasNoReconocidas: [...desconocidas],
    });
  }

  if (casos.length === 0) throw new Error("El Excel ACECF no contiene filas válidas de aprobación comercial");
  return casos;
}
