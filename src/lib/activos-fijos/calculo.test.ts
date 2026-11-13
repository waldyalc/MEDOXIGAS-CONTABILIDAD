import { describe, expect, it } from "vitest";

import {
  baseDepreciable,
  construirDepreciacion,
  desplazarMes,
  etiquetaMes,
  normalizarMes,
  siguientePendiente,
  sumarDepreciado,
  ultimoDiaDelMes,
} from "./calculo";

describe("construirDepreciacion", () => {
  it("reparte un monto exacto en cuotas mensuales iguales", () => {
    const periodos = construirDepreciacion({
      montoTotalCentavos: 12_000_000,
      valorResidualCentavos: 0,
      vidaUtilMeses: 12,
      fechaInicio: "2026-01-15",
    });

    expect(periodos).toHaveLength(12);
    expect(periodos[0]?.montoCentavos).toBe(1_000_000);
    expect(periodos[11]?.montoCentavos).toBe(1_000_000);
    expect(sumarDepreciado(periodos)).toBe(12_000_000);
  });

  it("descuenta el valor residual de la base depreciable", () => {
    const periodos = construirDepreciacion({
      montoTotalCentavos: 80_000_000,
      valorResidualCentavos: 5_000_000,
      vidaUtilMeses: 60,
      fechaInicio: "2026-11-13",
    });

    expect(periodos).toHaveLength(60);
    expect(periodos[0]?.montoCentavos).toBe(1_250_000);
    expect(sumarDepreciado(periodos)).toBe(75_000_000);
  });

  it("hace que el último mes absorba el redondeo (800,000 en 5 años)", () => {
    const periodos = construirDepreciacion({
      montoTotalCentavos: 80_000_000,
      valorResidualCentavos: 0,
      vidaUtilMeses: 60,
      fechaInicio: "2026-11-13",
    });

    expect(periodos[0]?.montoCentavos).toBe(1_333_333);
    expect(periodos[59]?.montoCentavos).toBe(1_333_353);
    expect(sumarDepreciado(periodos)).toBe(80_000_000);
  });

  it("empieza en el mes de la fecha de inicio y cruza de año", () => {
    const periodos = construirDepreciacion({
      montoTotalCentavos: 1_200_000,
      valorResidualCentavos: 0,
      vidaUtilMeses: 3,
      fechaInicio: "2026-11-30",
    });

    expect(periodos.map((periodo) => periodo.periodo)).toEqual(["2026-11-01", "2026-12-01", "2027-01-01"]);
    expect(periodos[0]?.fecha).toBe("2026-11-30");
    expect(periodos[1]?.fecha).toBe("2026-12-31");
    expect(periodos[2]?.fecha).toBe("2027-01-31");
  });

  it("no genera periodos si no hay base depreciable", () => {
    expect(
      construirDepreciacion({
        montoTotalCentavos: 100_000,
        valorResidualCentavos: 100_000,
        vidaUtilMeses: 12,
        fechaInicio: "2026-01-01",
      }),
    ).toEqual([]);

    expect(
      construirDepreciacion({
        montoTotalCentavos: 100_000,
        valorResidualCentavos: 0,
        vidaUtilMeses: 0,
        fechaInicio: "2026-01-01",
      }),
    ).toEqual([]);
  });

  it("no genera cuotas de cero centavos", () => {
    const periodos = construirDepreciacion({
      montoTotalCentavos: 5,
      valorResidualCentavos: 0,
      vidaUtilMeses: 7,
      fechaInicio: "2026-01-01",
    });

    expect(periodos).toEqual([]);
  });
});

describe("baseDepreciable", () => {
  it("resta el residual y nunca baja de cero", () => {
    expect(baseDepreciable({ montoTotalCentavos: 80_000_000, valorResidualCentavos: 5_000_000 })).toBe(75_000_000);
    expect(baseDepreciable({ montoTotalCentavos: 100, valorResidualCentavos: 500 })).toBe(0);
  });
});

describe("siguientePendiente", () => {
  const periodos = construirDepreciacion({
    montoTotalCentavos: 300_000,
    valorResidualCentavos: 0,
    vidaUtilMeses: 3,
    fechaInicio: "2026-01-01",
  });

  it("devuelve el primer mes no depreciado", () => {
    expect(siguientePendiente(periodos, [])?.periodo).toBe("2026-01-01");
    expect(siguientePendiente(periodos, ["2026-01-01"])?.periodo).toBe("2026-02-01");
  });

  it("devuelve null cuando ya se depreció todo", () => {
    expect(siguientePendiente(periodos, ["2026-01-01", "2026-02-01", "2026-03-01"])).toBeNull();
  });
});

describe("utilidades de mes", () => {
  it("normaliza fechas al primer día del mes", () => {
    expect(normalizarMes("2026-11-13")).toBe("2026-11-01");
    expect(normalizarMes("2026-11-01")).toBe("2026-11-01");
  });

  it("calcula el último día incluso en año bisiesto", () => {
    expect(ultimoDiaDelMes("2028-02-01")).toBe("2028-02-29");
    expect(ultimoDiaDelMes("2026-12-01")).toBe("2026-12-31");
  });

  it("desplaza meses entre años", () => {
    expect(desplazarMes("2026-12-01", 1)).toBe("2027-01-01");
    expect(desplazarMes("2026-01-01", -1)).toBe("2025-12-01");
    expect(desplazarMes("2026-01-01", 25)).toBe("2028-02-01");
  });

  it("etiqueta el mes en español", () => {
    expect(etiquetaMes("2026-11-01")).toBe("noviembre de 2026");
    expect(etiquetaMes("2026-01-01")).toBe("enero de 2026");
  });
});
