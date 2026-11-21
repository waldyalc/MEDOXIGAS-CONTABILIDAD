import { describe, expect, it } from "vitest";

import {
  cantidadACentavos,
  centavosADecimal,
  decimalACentavos,
  diferenciaCentavos,
  type LineaConteoFormulario,
  textoDiferencia,
  totalesConteo,
} from "./tipos-conteo";

function linea(contada: string, sistema = "10.00"): LineaConteoFormulario {
  return {
    producto_id: "11111111-1111-4111-8111-111111111111",
    nombre: "Gas 25 lb",
    referencia: "G25",
    sistema,
    contada,
    nota: "",
  };
}

describe("cantidades del conteo físico", () => {
  it("acepta coma o punto y devuelve centésimas enteras", () => {
    expect(cantidadACentavos("12")).toBe(1200);
    expect(cantidadACentavos("12.5")).toBe(1250);
    expect(cantidadACentavos("12,5")).toBe(1250);
    expect(cantidadACentavos("0")).toBe(0);
  });

  it("distingue vacío o inválido (null) de una cantidad real", () => {
    expect(cantidadACentavos("")).toBeNull();
    expect(cantidadACentavos("   ")).toBeNull();
    expect(cantidadACentavos("12.505")).toBeNull();
    expect(cantidadACentavos("-1")).toBeNull();
    expect(cantidadACentavos("abc")).toBeNull();
  });

  it("envía la cantidad contada como texto decimal de dos posiciones", () => {
    expect(centavosADecimal(1250)).toBe("12.50");
    expect(centavosADecimal(0)).toBe("0.00");
    expect(centavosADecimal(-500)).toBe("0.00");
  });

  it("lee la cantidad del sistema sin perder el signo negativo", () => {
    expect(decimalACentavos("10.5")).toBe(1050);
    expect(decimalACentavos("-2.25")).toBe(-225);
    expect(decimalACentavos("0")).toBe(0);
  });

  it("calcula la diferencia en pantalla: contada menos sistema", () => {
    expect(diferenciaCentavos(linea("12", "10.00"))).toBe(200);
    expect(diferenciaCentavos(linea("7.5", "10.00"))).toBe(-250);
    expect(diferenciaCentavos(linea("10", "10.00"))).toBe(0);
    expect(diferenciaCentavos(linea("", "10.00"))).toBeNull();
  });

  it("resume entradas, salidas y líneas con diferencia", () => {
    const totales = totalesConteo([linea("12", "10.00"), linea("8", "10.00"), linea("4", "4.00"), linea("", "3")]);

    expect(totales).toEqual({
      lineas: 4,
      conDiferencia: 2,
      entradasCentavos: 200,
      salidasCentavos: -200,
      diferenciaCentavos: 0,
    });
  });

  it("pinta el signo de la diferencia", () => {
    expect(textoDiferencia(200)).toBe("+2");
    expect(textoDiferencia(-250)).toBe("-2.5");
    expect(textoDiferencia(0)).toBe("0");
  });
});
