import { Workbook, type Worksheet } from "exceljs";
import { describe, expect, it } from "vitest";

import { formatearRd } from "../dinero";
import { tablaAExcel } from "./excel";
import {
  dineroAPesos,
  formatearFecha,
  formatearFechaHora,
  formatearPorcentaje,
  textoCelda,
  valorExcel,
} from "./formato";
import type { TablaReporte } from "./tipos";

const GENERADO_EN = new Date("2026-03-10T15:30:00Z");

const TABLA: TablaReporte = {
  titulo: "Cuentas por cobrar",
  subtitulo: "Fecha de corte: 31/01/2026",
  columnas: [
    { clave: "cliente", titulo: "Cliente", tipo: "texto" },
    { clave: "facturas", titulo: "Facturas", tipo: "texto" },
    { clave: "total", titulo: "Total", tipo: "dinero" },
    { clave: "vencido", titulo: "Vencido", tipo: "porcentaje" },
    { clave: "vence", titulo: "Vence", tipo: "fecha" },
  ],
  filas: [
    {
      celdas: {
        cliente: "Cliente Uno",
        facturas: 2,
        total: 123456,
        vencido: 12.5,
        vence: "2026-01-15",
      },
    },
    {
      celdas: {
        cliente: "Cliente Dos",
        facturas: 1,
        total: 20000,
        vencido: 0,
        vence: null,
      },
      nivel: 1,
    },
    {
      celdas: {
        cliente: "Subtotal",
        facturas: 3,
        total: 143456,
        vencido: 12.5,
        vence: null,
      },
      estilo: "subtotal",
    },
    {
      celdas: {
        cliente: "Total por cobrar",
        facturas: 3,
        total: 143456,
        vencido: 12.5,
        vence: null,
      },
      estilo: "total",
    },
  ],
};

async function exportarYLeer(tabla: TablaReporte): Promise<Worksheet> {
  const buffer = await tablaAExcel(tabla, GENERADO_EN);
  const libro = new Workbook();
  await libro.xlsx.load(buffer);
  const hoja = libro.getWorksheet("Reporte");

  if (!hoja) throw new Error("El libro no contiene la hoja Reporte");

  return hoja;
}

describe("tablaAExcel", () => {
  it("escribe encabezado, fechas y columnas", async () => {
    const hoja = await exportarYLeer(TABLA);

    expect(hoja.getCell("A1").value).toBe("MEDOXIGAS ALC, SRL");
    expect(hoja.getCell("A2").value).toBe("Cuentas por cobrar");
    expect(hoja.getCell("A3").value).toBe("Fecha de corte: 31/01/2026");
    expect(hoja.getCell("A4").value).toBe(`Generado: ${formatearFechaHora(GENERADO_EN)}`);
    expect(hoja.getCell("A5").value).toBeNull();

    expect(hoja.getCell("A6").value).toBe("Cliente");
    expect(hoja.getCell("B6").value).toBe("Facturas");
    expect(hoja.getCell("C6").value).toBe("Total");
    expect(hoja.getCell("D6").value).toBe("Vencido");
    expect(hoja.getCell("E6").value).toBe("Vence");
  });

  it("convierte dinero a pesos y aplica formatos numéricos", async () => {
    const hoja = await exportarYLeer(TABLA);

    expect(hoja.getCell("C7").value).toBe(1234.56);
    expect(hoja.getCell("C7").numFmt).toBe("#,##0.00");
    expect(hoja.getCell("D7").value).toBe(12.5);
    expect(hoja.getCell("D7").numFmt).toBe('0.00"%"');
    expect(hoja.getCell("E7").value).toBe("15/01/2026");
    expect(hoja.getCell("E8").value).toBeNull();
  });

  it("aplica negrita, borde e indentación por nivel", async () => {
    const hoja = await exportarYLeer(TABLA);

    expect(hoja.getCell("A8").alignment.indent).toBe(1);
    expect(hoja.getCell("A9").font.bold).toBe(true);
    expect(hoja.getCell("A10").font.bold).toBe(true);
    expect(hoja.getCell("A10").border.top?.style).toBe("thin");
  });
});

describe("formato", () => {
  it("convierte centavos y formatea dinero", () => {
    expect(dineroAPesos(123456)).toBe(1234.56);
    expect(textoCelda(123456, "dinero")).toBe(formatearRd(123456));
    expect(valorExcel(123456, "dinero")).toBe(1234.56);
  });

  it("formatea porcentajes con sufijo", () => {
    expect(formatearPorcentaje(12.5)).toMatch(/^12[.,]50 %$/);
    expect(textoCelda(12.5, "porcentaje")).toMatch(/^12[.,]50 %$/);
    expect(valorExcel(12.5, "porcentaje")).toBe(12.5);
  });

  it("formatea fechas ISO sin depender de la zona horaria", () => {
    expect(formatearFecha("2026-01-15")).toBe("15/01/2026");
    expect(formatearFecha("2026-01-15T23:30:00-04:00")).toBe("15/01/2026");
    expect(formatearFecha(null)).toBe("");
    expect(textoCelda("2026-01-15", "fecha")).toBe("15/01/2026");
    expect(valorExcel("2026-01-15", "fecha")).toBe("15/01/2026");
  });

  it("deja vacías las celdas nulas y respeta el texto", () => {
    expect(textoCelda(null, "texto")).toBe("");
    expect(textoCelda(3, "texto")).toBe("3");
    expect(valorExcel(null, "dinero")).toBeNull();
    expect(valorExcel("", "texto")).toBeNull();
    expect(valorExcel(3, "texto")).toBe(3);
  });
});
