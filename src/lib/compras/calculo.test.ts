import { describe, expect, it } from "vitest";

import { aCentavos, aNumero, calcularLinea, calcularTotales, desdeCentavos } from "./calculo";

describe("aCentavos", () => {
  it("convierte números y textos decimales a centavos enteros", () => {
    expect(aCentavos("100.25")).toBe(10025);
    expect(aCentavos("0.1")).toBe(10);
    expect(aCentavos(18)).toBe(1800);
  });

  it("acepta coma decimal y separador de miles", () => {
    expect(aCentavos("18,5")).toBe(1850);
    expect(aCentavos("1,234.56")).toBe(123456);
  });

  it("devuelve cero para valores vacíos o inválidos", () => {
    expect(aCentavos("")).toBe(0);
    expect(aCentavos(null)).toBe(0);
    expect(aCentavos("abc")).toBe(0);
  });
});

describe("calcularLinea", () => {
  it("calcula subtotal, ITBIS y total con redondeo por línea", () => {
    const linea = calcularLinea({ cantidad: "2", costo: "150.00", itbisTasa: "18" });

    expect(linea.subtotalCentavos).toBe(30000);
    expect(linea.itbisCentavos).toBe(5400);
    expect(linea.totalCentavos).toBe(35400);
  });

  it("redondea el subtotal al centavo cuando la cantidad tiene decimales", () => {
    const linea = calcularLinea({ cantidad: "1.5", costo: "10.01", itbisTasa: "0" });

    expect(linea.subtotalCentavos).toBe(1502);
    expect(linea.itbisCentavos).toBe(0);
    expect(linea.totalCentavos).toBe(1502);
  });

  it("aplica ITBIS 16 % sobre el subtotal", () => {
    const linea = calcularLinea({ cantidad: 1, costo: 99.99, itbisTasa: 16 });

    expect(linea.subtotalCentavos).toBe(9999);
    expect(linea.itbisCentavos).toBe(1600);
    expect(linea.totalCentavos).toBe(11599);
  });
});

describe("calcularTotales", () => {
  it("suma líneas con distintas tasas de ITBIS", () => {
    const totales = calcularTotales([
      { cantidad: "1", costo: "100", itbisTasa: "18" },
      { cantidad: "2", costo: "50", itbisTasa: "16" },
      { cantidad: "3", costo: "10", itbisTasa: "0" },
    ]);

    expect(totales.subtotalCentavos).toBe(23000);
    expect(totales.itbisCentavos).toBe(3400);
    expect(totales.totalCentavos).toBe(26400);
  });

  it("devuelve ceros cuando no hay líneas", () => {
    expect(calcularTotales([])).toEqual({ subtotalCentavos: 0, itbisCentavos: 0, totalCentavos: 0 });
  });
});

describe("conversión", () => {
  it("convierte centavos de vuelta a pesos", () => {
    expect(desdeCentavos(123456)).toBeCloseTo(1234.56, 2);
    expect(aNumero("1,234.56")).toBeCloseTo(1234.56, 2);
  });
});
