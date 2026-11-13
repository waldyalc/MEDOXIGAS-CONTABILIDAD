import { describe, expect, it } from "vitest";

import { montoEnLetras } from "./numero-a-letras";

describe("montoEnLetras", () => {
  it("convierte cero", () => {
    expect(montoEnLetras(0)).toBe("Cero");
  });

  it("convierte uno", () => {
    expect(montoEnLetras(1)).toBe("Uno");
  });

  it("convierte quince", () => {
    expect(montoEnLetras(15)).toBe("Quince");
  });

  it("convierte veintiuno", () => {
    expect(montoEnLetras(21)).toBe("Veintiuno");
  });

  it("convierte cien exacto", () => {
    expect(montoEnLetras(100)).toBe("Cien");
  });

  it("convierte ciento uno", () => {
    expect(montoEnLetras(101)).toBe("Ciento uno");
  });

  it("convierte mil", () => {
    expect(montoEnLetras(1000)).toBe("Mil");
  });

  it("convierte mil uno", () => {
    expect(montoEnLetras(1001)).toBe("Mil uno");
  });

  it("convierte dieciséis mil seiscientos treinta y ocho", () => {
    expect(montoEnLetras(16638)).toBe("Dieciséis mil seiscientos treinta y ocho");
  });

  it("convierte un millón", () => {
    expect(montoEnLetras(1000000)).toBe("Un millón");
  });

  it("convierte millones con centavos", () => {
    expect(montoEnLetras(2500000.5)).toBe("Dos millones quinientos mil con 50/100");
  });

  it("apocopa veintiuno antes de mil", () => {
    expect(montoEnLetras(21000)).toBe("Veintiún mil");
  });

  it("convierte cien mil", () => {
    expect(montoEnLetras(100000)).toBe("Cien mil");
  });

  it("convierte mil millones", () => {
    expect(montoEnLetras(1000000000)).toBe("Mil millones");
  });

  it("convierte treinta y uno", () => {
    expect(montoEnLetras(31)).toBe("Treinta y uno");
  });

  it("apocopa veintiuno antes de millones", () => {
    expect(montoEnLetras(21000000)).toBe("Veintiún millones");
  });

  it("convierte centenas irregulares", () => {
    expect(montoEnLetras(500)).toBe("Quinientos");
    expect(montoEnLetras(700)).toBe("Setecientos");
    expect(montoEnLetras(900)).toBe("Novecientos");
  });

  it("convierte cien millones", () => {
    expect(montoEnLetras(100000000)).toBe("Cien millones");
  });

  it("apocopa ciento uno antes de mil", () => {
    expect(montoEnLetras(101000)).toBe("Ciento un mil");
  });

  it("convierte medio peso con centavos", () => {
    expect(montoEnLetras(0.5)).toBe("Cero con 50/100");
  });

  it("convierte mil doscientos treinta y cuatro con centavos", () => {
    expect(montoEnLetras(1234.56)).toBe("Mil doscientos treinta y cuatro con 56/100");
  });

  it("redondea a dos decimales con centavos enteros", () => {
    expect(montoEnLetras(1.239)).toBe("Uno con 24/100");
    expect(montoEnLetras(2.999)).toBe("Tres");
  });

  it("devuelve cero para montos negativos", () => {
    expect(montoEnLetras(-1)).toBe("Cero");
  });

  it("devuelve cero para montos no finitos", () => {
    expect(montoEnLetras(Number.NaN)).toBe("Cero");
    expect(montoEnLetras(Number.POSITIVE_INFINITY)).toBe("Cero");
    expect(montoEnLetras(Number.NEGATIVE_INFINITY)).toBe("Cero");
  });

  it("devuelve cero para enteros fuera del límite", () => {
    expect(montoEnLetras(1000000000000)).toBe("Cero");
  });
});
