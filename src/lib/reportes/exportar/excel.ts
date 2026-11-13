import { type Cell, Workbook } from "exceljs";

import { formatearFechaHora, textoCelda, valorExcel } from "./formato";
import type { ColumnaReporte, FilaReporte, TablaReporte } from "./tipos";

const FILA_ENCABEZADOS = 6;
const PRIMERA_FILA_DATOS = 7;

const RELLENO_ENCABEZADO = "FFE8E8E8";
const RELLENO_GRUPO = "FFF2F2F2";

function esColumnaNumerica(columna: ColumnaReporte): boolean {
  return columna.tipo === "dinero" || columna.tipo === "porcentaje";
}

function anchoColumna(columna: ColumnaReporte, filas: readonly FilaReporte[]): number {
  const minimo = columna.tipo === "dinero" ? 16 : 12;
  const valores = filas.map((fila) => textoCelda(fila.celdas[columna.clave] ?? null, columna.tipo).length);
  const maximo = Math.max(minimo, columna.titulo.length + 2, ...valores);
  return Math.min(maximo, 48);
}

function aplicarEstiloFila(celda: Cell, fila: FilaReporte, esPrimeraColumna: boolean): void {
  if (fila.estilo === "grupo") {
    celda.font = { bold: true };
    celda.fill = { type: "pattern", pattern: "solid", fgColor: { argb: RELLENO_GRUPO } };
  }

  if (fila.estilo === "subtotal" || fila.estilo === "total") {
    celda.font = { bold: true };
  }

  if (fila.estilo === "total") {
    celda.border = { ...celda.border, top: { style: "thin" } };
  }

  if (esPrimeraColumna && fila.nivel != null && fila.nivel > 0) {
    celda.alignment = { ...celda.alignment, indent: fila.nivel };
  }
}

export async function tablaAExcel(tabla: TablaReporte, generadoEn: Date = new Date()): Promise<ArrayBuffer> {
  const libro = new Workbook();
  libro.creator = "MEDOXIGAS ALC, SRL";
  libro.created = generadoEn;
  libro.modified = generadoEn;

  const hoja = libro.addWorksheet("Reporte");
  const totalColumnas = Math.max(tabla.columnas.length, 1);

  hoja.columns = tabla.columnas.map((columna) => ({ width: anchoColumna(columna, tabla.filas) }));

  hoja.getCell(1, 1).value = "MEDOXIGAS ALC, SRL";
  hoja.getCell(1, 1).font = { bold: true, size: 14 };
  hoja.getCell(2, 1).value = tabla.titulo;
  hoja.getCell(2, 1).font = { bold: true, size: 12 };
  hoja.getCell(4, 1).value = `Generado: ${formatearFechaHora(generadoEn)}`;
  hoja.getCell(4, 1).font = { italic: true, color: { argb: "FF6B7280" } };

  if (tabla.subtitulo) {
    hoja.getCell(3, 1).value = tabla.subtitulo;
    hoja.getCell(3, 1).font = { color: { argb: "FF4B5563" } };
  }

  if (totalColumnas > 1) {
    for (const numeroFila of [1, 2, 3, 4]) {
      hoja.mergeCells(numeroFila, 1, numeroFila, totalColumnas);
    }
  }

  const filaEncabezados = hoja.getRow(FILA_ENCABEZADOS);
  tabla.columnas.forEach((columna, indice) => {
    const celda = filaEncabezados.getCell(indice + 1);
    celda.value = columna.titulo;
    celda.font = { bold: true };
    celda.fill = { type: "pattern", pattern: "solid", fgColor: { argb: RELLENO_ENCABEZADO } };
    celda.alignment = {
      vertical: "middle",
      horizontal: esColumnaNumerica(columna) ? "right" : "left",
    };
  });

  tabla.filas.forEach((fila, indiceFila) => {
    const filaHoja = hoja.getRow(PRIMERA_FILA_DATOS + indiceFila);

    tabla.columnas.forEach((columna, indiceColumna) => {
      const celda = filaHoja.getCell(indiceColumna + 1);
      celda.value = valorExcel(fila.celdas[columna.clave] ?? null, columna.tipo);

      if (columna.tipo === "dinero") {
        celda.numFmt = "#,##0.00";
      }

      if (columna.tipo === "porcentaje") {
        celda.numFmt = '0.00"%"';
      }

      celda.alignment = {
        vertical: "top",
        horizontal: esColumnaNumerica(columna) ? "right" : "left",
      };

      aplicarEstiloFila(celda, fila, indiceColumna === 0);
    });
  });

  hoja.views = [{ state: "frozen", ySplit: FILA_ENCABEZADOS }];

  return libro.xlsx.writeBuffer();
}
