import { describe, expect, test } from "vitest";

import { formatoDia, formatoEje, formatoEntero, formatoFechaHora, formatoKg, formatoMpa, formatoPct } from "./formato";

describe("formato es-DO", () => {
  test("miles con coma: 22,820", () => {
    expect(formatoEntero(22820)).toBe("22,820");
    expect(formatoEntero(0)).toBe("0");
  });

  test("kg con unidad", () => {
    expect(formatoKg(22820)).toBe("22,820 kg");
    expect(formatoKg(3920)).toBe("3,920 kg");
  });

  test("porcentaje con 2 decimales y signo de %", () => {
    expect(formatoPct(3.92)).toBe("3.92 %");
    expect(formatoPct(-2.81)).toBe("-2.81 %");
  });

  test("presión con 2 decimales y MPa", () => {
    expect(formatoMpa(1.55)).toBe("1.55 MPa");
  });

  test("nulos, indefinidos y NaN dan raya", () => {
    expect(formatoEntero(null)).toBe("—");
    expect(formatoKg(undefined)).toBe("—");
    expect(formatoPct(Number.NaN)).toBe("—");
    expect(formatoMpa(null)).toBe("—");
  });
});

describe("fechas en America/Santo_Domingo", () => {
  test("fecha y hora con zona RD (UTC−4)", () => {
    const texto = formatoFechaHora("2026-10-28T16:30:00Z");
    expect(texto).toContain("28 oct 2026");
    expect(texto).toContain("12:30");
  });

  test("texto inválido o vacío da raya", () => {
    expect(formatoFechaHora(null)).toBe("—");
    expect(formatoFechaHora("no-fecha")).toBe("—");
  });

  test("eje de gráfico con día y hora", () => {
    const texto = formatoEje("2026-10-28T16:30:00Z");
    expect(texto).toContain("28 oct");
    expect(texto).toContain("12:30");
  });

  test("día en formato dd/mm/aaaa", () => {
    expect(formatoDia("2026-10-28")).toBe("28/10/2026");
    expect(formatoDia("2026-01-05")).toBe("05/01/2026");
    expect(formatoDia(null)).toBe("—");
    expect(formatoDia(undefined)).toBe("—");
  });
});
