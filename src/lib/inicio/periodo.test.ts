import { describe, expect, test } from "vitest";

import { etiquetaRango, opcionesPeriodo, parsearPeriodo, rangoPeriodo } from "./periodo";

describe("parsearPeriodo", () => {
  test("acepta los periodos de la URL", () => {
    expect(parsearPeriodo("mes")).toBe("mes");
    expect(parsearPeriodo("3m")).toBe("3m");
    expect(parsearPeriodo("6m")).toBe("6m");
  });

  test("usa Mes actual si falta o no es válido", () => {
    expect(parsearPeriodo(undefined)).toBe("mes");
    expect(parsearPeriodo("")).toBe("mes");
    expect(parsearPeriodo("12m")).toBe("mes");
    expect(parsearPeriodo(["6m", "3m"])).toBe("6m");
  });
});

describe("rangoPeriodo", () => {
  test("Mes actual va del día 1 a hoy", () => {
    expect(rangoPeriodo("mes", "2026-11-13")).toEqual({ desde: "2026-11-01", hasta: "2026-11-13" });
  });

  test("Últimos 3 meses incluyen el mes actual", () => {
    expect(rangoPeriodo("3m", "2026-11-13")).toEqual({ desde: "2026-09-01", hasta: "2026-11-13" });
  });

  test("Últimos 6 meses incluyen el mes actual", () => {
    expect(rangoPeriodo("6m", "2026-11-13")).toEqual({ desde: "2026-06-01", hasta: "2026-11-13" });
  });

  test("cruza el cambio de año", () => {
    expect(rangoPeriodo("3m", "2026-01-15")).toEqual({ desde: "2025-11-01", hasta: "2026-01-15" });
    expect(rangoPeriodo("6m", "2026-02-01")).toEqual({ desde: "2025-09-01", hasta: "2026-02-01" });
  });

  test("el primero de mes deja un solo día", () => {
    expect(rangoPeriodo("mes", "2026-12-01")).toEqual({ desde: "2026-12-01", hasta: "2026-12-01" });
  });
});

describe("opcionesPeriodo", () => {
  test("devuelve las tres opciones en orden con su rango en dd/mm/aaaa", () => {
    expect(opcionesPeriodo("2026-11-13")).toEqual([
      {
        id: "mes",
        etiqueta: "Mes actual",
        desde: "2026-11-01",
        hasta: "2026-11-13",
        rango: "01/11/2026 al 13/11/2026",
      },
      {
        id: "3m",
        etiqueta: "Últimos 3 meses",
        desde: "2026-09-01",
        hasta: "2026-11-13",
        rango: "01/09/2026 al 13/11/2026",
      },
      {
        id: "6m",
        etiqueta: "Últimos 6 meses",
        desde: "2026-06-01",
        hasta: "2026-11-13",
        rango: "01/06/2026 al 13/11/2026",
      },
    ]);
  });

  test("etiquetaRango usa dd/mm/aaaa", () => {
    expect(etiquetaRango("2026-01-05", "2026-02-09")).toBe("05/01/2026 al 09/02/2026");
  });
});
