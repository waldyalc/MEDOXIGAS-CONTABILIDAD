import { describe, expect, test } from "vitest";

import {
  COLUMNAS_IR3,
  COLUMNAS_SUIRPLUS,
  celdaCsv,
  csvIr3,
  csvSuirPlus,
  formatearDecimal,
  nombreArchivoTss,
  periodoReporte,
} from "./exportacion-tss";
import type { FilaTSS } from "./tipos";

const UUID = "11111111-1111-4111-8111-111111111111";

function fila(parcial: Partial<FilaTSS> = {}): FilaTSS {
  return {
    anio: 2026,
    mes: 11,
    empleado_id: UUID,
    empleado_nombre: "María Fernández",
    identificacion: "00112345678",
    clave_tss: "001",
    periodos: 1,
    dias_trabajados: "11.915",
    salario_base: "30000",
    base_sfs: "30000",
    base_afp: "30000",
    base_srl: "30000",
    base_infotep: "30000",
    base_isr: "30000",
    sfs_empleado: "912.00",
    afp_empleado: "861.00",
    isr: "0.00",
    sfs_empleador: "2127.00",
    afp_empleador: "2130.00",
    srl: "330.00",
    infotep: "300.00",
    total_deducciones: "1773.00",
    neto_pagar: "28227.00",
    ...parcial,
  };
}

describe("formato numérico", () => {
  test("fija dos decimales con punto", () => {
    expect(formatearDecimal("30000.5")).toBe("30000.50");
    expect(formatearDecimal("3")).toBe("3.00");
    expect(formatearDecimal("0.00")).toBe("0.00");
  });

  test("un valor no numérico cae a 0.00", () => {
    expect(formatearDecimal("abc")).toBe("0.00");
  });

  test("el periodo se escribe con mes de dos dígitos", () => {
    expect(periodoReporte(2026, 1)).toBe("2026-01");
    expect(periodoReporte(2026, 11)).toBe("2026-11");
  });
});

describe("celdaCsv", () => {
  test("deja pasar un valor simple", () => {
    expect(celdaCsv("María Fernández")).toBe("María Fernández");
  });

  test("encierra entre comillas el valor con coma", () => {
    expect(celdaCsv("Pérez, Juan")).toBe('"Pérez, Juan"');
  });

  test("duplica las comillas internas", () => {
    expect(celdaCsv('Juan "Chino" Pérez')).toBe('"Juan ""Chino"" Pérez"');
  });

  test("encierra el valor con salto de línea", () => {
    expect(celdaCsv("Juan\nPérez")).toBe('"Juan\nPérez"');
  });

  test("conserva los espacios de los extremos entre comillas", () => {
    expect(celdaCsv(" Juan ")).toBe('" Juan "');
  });

  test("un valor vacío queda vacío", () => {
    expect(celdaCsv("")).toBe("");
  });
});

describe("csvSuirPlus", () => {
  test("el encabezado tiene todas las columnas y el mismo orden", () => {
    const encabezado = csvSuirPlus([]).split(",");
    expect(encabezado).toEqual([...COLUMNAS_SUIRPLUS]);
    expect(encabezado).toContain("Clave TSS");
    expect(encabezado).toContain("Neto pagado");
  });

  test("sin filas devuelve solo el encabezado", () => {
    expect(csvSuirPlus([]).includes("\r\n")).toBe(false);
  });

  test("cada fila trae los montos con dos decimales", () => {
    const lineas = csvSuirPlus([fila()]).split("\r\n");
    expect(lineas).toHaveLength(2);

    const celdas = lineas[1]?.split(",") ?? [];
    expect(celdas).toHaveLength(COLUMNAS_SUIRPLUS.length);
    expect(celdas[0]).toBe("2026-11");
    expect(celdas[1]).toBe("María Fernández");
    expect(celdas[3]).toBe("001");
    expect(celdas[6]).toBe("30000.00");
    expect(celdas[11]).toBe("912.00");
    expect(celdas[18]).toBe("28227.00");
  });

  test("usa CRLF entre filas", () => {
    const csv = csvSuirPlus([fila(), fila({ empleado_nombre: "Ana Pérez" })]);
    expect(csv.split("\r\n")).toHaveLength(3);
    expect(csv.includes("\n") && !csv.includes("\r\n")).toBe(false);
  });

  test("cita el nombre con coma y no rompe las columnas", () => {
    const lineas = csvSuirPlus([fila({ empleado_nombre: "Pérez, Juan" })]).split("\r\n");
    expect(lineas[1]).toContain('"Pérez, Juan"');
  });

  test("la clave TSS vacía deja la celda vacía", () => {
    const celdas =
      csvSuirPlus([fila({ clave_tss: null })])
        .split("\r\n")[1]
        ?.split(",") ?? [];
    expect(celdas[3]).toBe("");
  });

  test("convierte los días a dos decimales", () => {
    const celdas =
      csvSuirPlus([fila({ dias_trabajados: "11.9" })])
        .split("\r\n")[1]
        ?.split(",") ?? [];
    expect(celdas[5]).toBe("11.90");
  });
});

describe("csvIr3", () => {
  test("el encabezado del IR-3 tiene base e ISR", () => {
    const encabezado = csvIr3([]).split(",");
    expect(encabezado).toEqual([...COLUMNAS_IR3]);
    expect(encabezado).toContain("Base ISR");
    expect(encabezado).toContain("ISR retenido");
  });

  test("la fila trae el ISR retenido y el neto", () => {
    const celdas =
      csvIr3([fila({ isr: "12105.37", base_isr: "100000" })])
        .split("\r\n")[1]
        ?.split(",") ?? [];
    expect(celdas[0]).toBe("2026-11");
    expect(celdas[5]).toBe("100000.00");
    expect(celdas[6]).toBe("12105.37");
    expect(celdas[7]).toBe("28227.00");
  });

  test("cita el nombre con comillas", () => {
    const csv = csvIr3([fila({ empleado_nombre: 'Juan "Chino" Pérez' })]);
    expect(csv).toContain('"Juan ""Chino"" Pérez"');
  });
});

describe("nombreArchivoTss", () => {
  test("nombra el archivo con el periodo", () => {
    expect(nombreArchivoTss(2026, 11, "suirplus")).toBe("suirplus-2026-11.csv");
    expect(nombreArchivoTss(2026, 1, "ir3")).toBe("ir3-2026-01.csv");
  });
});
