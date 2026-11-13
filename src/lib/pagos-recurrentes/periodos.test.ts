import { describe, expect, it } from "vitest";

import { periodoDelPlan, siguientePeriodo, sumarMeses } from "./periodos";

describe("sumarMeses", () => {
  it("ajusta al último día del mes como Postgres", () => {
    expect(sumarMeses("2026-01-31", 1)).toBe("2026-02-28");
    expect(sumarMeses("2026-03-31", 1)).toBe("2026-04-30");
    expect(sumarMeses("2024-01-31", 1)).toBe("2024-02-29");
    expect(sumarMeses("2026-12-15", 1)).toBe("2027-01-15");
  });
});

describe("periodoDelPlan", () => {
  it("devuelve el periodo del mes en curso", () => {
    expect(periodoDelPlan({ fechaInicio: "2026-09-01", frecuenciaMeses: 1, vigenciaHasta: null }, "2026-11-14")).toBe(
      "2026-11-01",
    );
  });

  it("no devuelve nada si la plantilla empieza en el futuro", () => {
    expect(
      periodoDelPlan({ fechaInicio: "2026-12-01", frecuenciaMeses: 1, vigenciaHasta: null }, "2026-11-14"),
    ).toBeNull();
  });

  it("respeta la frecuencia en meses", () => {
    expect(periodoDelPlan({ fechaInicio: "2026-01-15", frecuenciaMeses: 2, vigenciaHasta: null }, "2026-11-14")).toBe(
      "2026-09-15",
    );
  });

  it("no devuelve nada fuera de vigencia", () => {
    expect(
      periodoDelPlan({ fechaInicio: "2026-09-01", frecuenciaMeses: 1, vigenciaHasta: "2026-10-31" }, "2026-11-14"),
    ).toBeNull();
  });
});

describe("siguientePeriodo", () => {
  it("calcula la próxima fecha de pago", () => {
    expect(siguientePeriodo({ fechaInicio: "2026-09-01", frecuenciaMeses: 1, vigenciaHasta: null }, "2026-11-14")).toBe(
      "2026-12-01",
    );
  });

  it("incluye hoy cuando es la fecha de pago", () => {
    expect(siguientePeriodo({ fechaInicio: "2026-11-14", frecuenciaMeses: 1, vigenciaHasta: null }, "2026-11-14")).toBe(
      "2026-11-14",
    );
  });

  it("no devuelve nada si la vigencia terminó", () => {
    expect(
      siguientePeriodo({ fechaInicio: "2026-09-01", frecuenciaMeses: 1, vigenciaHasta: "2026-10-31" }, "2026-11-14"),
    ).toBeNull();
  });
});
