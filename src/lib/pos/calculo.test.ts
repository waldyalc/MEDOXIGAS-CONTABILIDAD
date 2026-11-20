import { describe, expect, test } from "vitest";

import {
  calcularLineaPOS,
  centavosATexto,
  centavosDeDecimal,
  compararMontos,
  precioConImpuesto,
  sumarMontos,
  sumarTotalesLineasPOS,
} from "./calculo";

describe("centavosDeDecimal", () => {
  test("convierte texto decimal a centavos exactos", () => {
    expect(centavosDeDecimal("236.00")).toBe(23600);
    expect(centavosDeDecimal("1500.5")).toBe(150050);
    expect(centavosDeDecimal("0")).toBe(0);
    expect(centavosDeDecimal("-6.25")).toBe(-625);
  });

  test("acepta separador de miles y redondea la tercera posición", () => {
    expect(centavosDeDecimal("1,500.25")).toBe(150025);
    expect(centavosDeDecimal("1.235")).toBe(124);
    expect(centavosDeDecimal("1.234")).toBe(123);
  });

  test("un texto inválido devuelve null", () => {
    expect(centavosDeDecimal("abc")).toBeNull();
    expect(centavosDeDecimal("")).toBeNull();
    expect(centavosDeDecimal(null)).toBeNull();
  });
});

describe("centavosATexto", () => {
  test("siempre imprime dos decimales", () => {
    expect(centavosATexto(23600)).toBe("236.00");
    expect(centavosATexto(5)).toBe("0.05");
    expect(centavosATexto(-625)).toBe("-6.25");
    expect(centavosATexto(0)).toBe("0.00");
  });
});

describe("sumarMontos", () => {
  test("suma exacta sin arrastrar float", () => {
    expect(sumarMontos(["0.10", "0.20"])).toBe("0.30");
    expect(sumarMontos(["1,500.25", "0.75"])).toBe("1501.00");
    expect(sumarMontos(["100", null, "abc"])).toBe("100.00");
  });
});

describe("compararMontos", () => {
  test("compara por centavos", () => {
    expect(compararMontos("100.00", "100")).toBe(0);
    expect(compararMontos("99.99", "100")).toBe(-1);
    expect(compararMontos("100.01", "100")).toBe(1);
  });
});

describe("calcularLineaPOS", () => {
  test("replica el motor: 2 × 100 con ITBIS 18 %", () => {
    const totales = calcularLineaPOS({ cantidad: "2", precio: "100", itbis_tasa: "18" });

    expect(totales.bruto).toBe("200.00");
    expect(totales.descuento).toBe("0.00");
    expect(totales.subtotal).toBe("200.00");
    expect(totales.itbis).toBe("36.00");
    expect(totales.total).toBe("236.00");
  });

  test("aplica el descuento porcentual sobre el bruto", () => {
    const totales = calcularLineaPOS({ cantidad: "2", precio: "100", descuento_pct: "5", itbis_tasa: "18" });

    expect(totales.descuento).toBe("10.00");
    expect(totales.subtotal).toBe("190.00");
    expect(totales.itbis).toBe("34.20");
    expect(totales.total).toBe("224.20");
  });

  test("cantidad fraccionaria de media unidad", () => {
    const totales = calcularLineaPOS({ cantidad: "0.5", precio: "100", itbis_tasa: "18" });

    expect(totales.subtotal).toBe("50.00");
    expect(totales.itbis).toBe("9.00");
    expect(totales.total).toBe("59.00");
  });

  test("redondea a dos decimales como Postgres", () => {
    const totales = calcularLineaPOS({ cantidad: "3", precio: "33.33", itbis_tasa: "18" });

    expect(totales.subtotal).toBe("99.99");
    expect(totales.itbis).toBe("18.00");
    expect(totales.total).toBe("117.99");
  });

  test("sin ITBIS el total es el subtotal", () => {
    const totales = calcularLineaPOS({ cantidad: "1", precio: "100", itbis_tasa: "0" });

    expect(totales.itbis).toBe("0.00");
    expect(totales.total).toBe("100.00");
  });
});

describe("sumarTotalesLineasPOS", () => {
  test("suma subtotal, descuento, ITBIS y total", () => {
    const primera = calcularLineaPOS({ cantidad: "2", precio: "100", itbis_tasa: "18" });
    const segunda = calcularLineaPOS({ cantidad: "1", precio: "59", itbis_tasa: "0" });

    expect(
      sumarTotalesLineasPOS([
        { subtotal: primera.subtotal, descuento: primera.descuento, itbis: primera.itbis, total: primera.total },
        { subtotal: segunda.subtotal, descuento: segunda.descuento, itbis: segunda.itbis, total: segunda.total },
      ]),
    ).toEqual({ subtotal: "259.00", descuento: "0.00", itbis: "36.00", total: "295.00" });
  });
});

describe("precioConImpuesto", () => {
  test("muestra el precio con ITBIS sin tocar el guardado", () => {
    expect(precioConImpuesto("100", "18")).toBe("118.00");
    expect(precioConImpuesto("100", "0")).toBe("100.00");
    expect(precioConImpuesto("33.33", "18")).toBe("39.33");
  });
});
