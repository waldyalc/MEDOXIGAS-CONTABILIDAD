import { describe, expect, it } from "vitest";

import {
  enmascararCuenta,
  etiquetaPeriodoCorta,
  formatearIdentificacion,
  formatoPorcentaje,
  periodosQueSeCruzan,
  sugerirPeriodo,
} from "./formato-nomina";

describe("formato y periodos de nómina", () => {
  it("sugiere la segunda quincena cuando hoy pasa del día 15", () => {
    expect(sugerirPeriodo("quincenal", "2026-11-20")).toEqual({
      frecuencia: "quincenal",
      inicio: "2026-11-16",
      fin: "2026-11-30",
      codigo: "2026-11-Q2",
    });
  });

  it("sugiere la primera quincena del 1 al 15", () => {
    expect(sugerirPeriodo("quincenal", "2026-11-05")).toEqual({
      frecuencia: "quincenal",
      inicio: "2026-11-01",
      fin: "2026-11-15",
      codigo: "2026-11-Q1",
    });
  });

  it("sugiere el mes completo y respeta los meses cortos y bisiestos", () => {
    expect(sugerirPeriodo("mensual", "2026-11-20").codigo).toBe("2026-11-M");
    expect(sugerirPeriodo("mensual", "2026-11-20").fin).toBe("2026-11-30");
    expect(sugerirPeriodo("mensual", "2028-02-10").fin).toBe("2028-02-29");
  });

  it("marca como cruzados solo los periodos no anulados que se solapan", () => {
    const periodos = [
      { fecha_inicio: "2026-11-01", fecha_fin: "2026-11-30", estado: "pagado" },
      { fecha_inicio: "2026-12-01", fecha_fin: "2026-12-15", estado: "anulado" },
      { fecha_inicio: "2027-01-01", fecha_fin: "2027-01-15", estado: "borrador" },
    ];
    const sugerido = sugerirPeriodo("quincenal", "2026-11-20");

    expect(periodosQueSeCruzan(periodos, sugerido)).toEqual([periodos[0]]);
  });

  it("formatea la cédula con la máscara dominicana y enmascara la cuenta", () => {
    expect(formatearIdentificacion("cedula", "00112345678")).toBe("001-1234567-8");
    expect(formatearIdentificacion("pasaporte", "AB123")).toBe("AB123");
    expect(enmascararCuenta("4100123456789")).toBe("•••• 6789");
    expect(enmascararCuenta(null)).toBe("—");
  });

  it("muestra los porcentajes con 2–3 decimales y el rango del periodo", () => {
    expect(formatoPorcentaje("3.040")).toBe("3.04 %");
    expect(formatoPorcentaje("23.830")).toBe("23.83 %");
    expect(etiquetaPeriodoCorta("2026-11-16", "2026-11-30")).toBe("16–30 nov 2026");
  });
});
