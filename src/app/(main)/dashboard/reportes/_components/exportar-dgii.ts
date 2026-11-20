import { Workbook } from "exceljs";

import { valorExcel } from "@/lib/reportes/exportar/formato";
import type { TablaReporte } from "@/lib/reportes/exportar/tipos";
import type { DocumentoExcluido } from "@/lib/reportes/fiscales/excluidos";

/**
 * Excel de un reporte DGII: una hoja con los renglones del reporte y, cuando
 * hay excluidos (606/607), la hoja "Documentos no incluidos" con el motivo,
 * como el archivo real de Alegra.
 */
export async function libroDgiiAExcel(
  tabla: TablaReporte,
  excluidos: readonly DocumentoExcluido[],
): Promise<ArrayBuffer> {
  const libro = new Workbook();
  libro.creator = "MEDOXIGAS ALC, SRL";
  libro.created = new Date();
  libro.modified = new Date();

  const hoja = libro.addWorksheet("Reporte");

  const titulo = hoja.addRow([tabla.titulo]);
  titulo.font = { bold: true, size: 13 };
  if (tabla.subtitulo) {
    const subtitulo = hoja.addRow([tabla.subtitulo]);
    subtitulo.font = { color: { argb: "FF4B5563" } };
  }
  hoja.addRow([]);

  const encabezados = hoja.addRow(tabla.columnas.map((columna) => columna.titulo));
  encabezados.font = { bold: true };
  encabezados.eachCell((celda) => {
    celda.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFE8E8E8" } };
  });

  for (const fila of tabla.filas) {
    const valores = tabla.columnas.map((columna) => valorExcel(fila.celdas[columna.clave] ?? null, columna.tipo));
    const filaExcel = hoja.addRow(valores);
    tabla.columnas.forEach((columna, indice) => {
      if (columna.tipo === "dinero") filaExcel.getCell(indice + 1).numFmt = "#,##0.00";
    });
  }

  tabla.columnas.forEach((columna, indice) => {
    hoja.getColumn(indice + 1).width = Math.min(48, Math.max(14, columna.titulo.length + 2));
  });

  if (excluidos.length > 0) {
    const hojaExcluidos = libro.addWorksheet("Documentos no incluidos");
    const encabezadosExcluidos = hojaExcluidos.addRow(["Número de documento", "Tipo de documento", "Motivo"]);
    encabezadosExcluidos.font = { bold: true };

    for (const excluido of excluidos) {
      hojaExcluidos.addRow([excluido.numero, excluido.tipo, excluido.motivo]);
    }

    hojaExcluidos.getColumn(1).width = 24;
    hojaExcluidos.getColumn(2).width = 24;
    hojaExcluidos.getColumn(3).width = 90;
  }

  return libro.xlsx.writeBuffer();
}
