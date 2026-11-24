import { describe, expect, test } from "vitest";

import { filasTotalesNota } from "./totales-nota";

const NOTA_BASE = {
  subtotal: 323.1,
  itbis: 58.16,
  otros_impuestos: 0,
  propina: 0,
} as const;

describe("filasTotalesNota", () => {
  test("el Subtotal es bruto cuando hay Descuento y cuadra con el Total", () => {
    const filas = filasTotalesNota({ ...NOTA_BASE, descuento: 35.9 });

    expect(filas).toEqual([
      { etiqueta: "Subtotal", valor: 359 },
      { etiqueta: "Descuento", valor: 35.9 },
      { etiqueta: "ITBIS", valor: 58.16 },
    ]);

    // Subtotal bruto − Descuento + ITBIS = Total de la nota.
    const [subtotal, descuento, itbis] = filas.map((fila) => fila.valor);
    expect(Math.round(((subtotal ?? 0) - (descuento ?? 0) + (itbis ?? 0)) * 100) / 100).toBe(381.26);
  });

  test("sin descuento no muestra la fila Descuento", () => {
    expect(filasTotalesNota({ ...NOTA_BASE, descuento: 0 }).map((fila) => fila.etiqueta)).toEqual([
      "Subtotal",
      "ITBIS",
    ]);
  });

  test("muestra otros impuestos (CDT 2 %) y propina legal (10 %) solo cuando tienen monto", () => {
    const filas = filasTotalesNota({
      subtotal: 1000,
      descuento: 0,
      itbis: 180,
      otros_impuestos: 20,
      propina: 100,
    });

    expect(filas).toEqual([
      { etiqueta: "Subtotal", valor: 1000 },
      { etiqueta: "ITBIS", valor: 180 },
      { etiqueta: "Otros impuestos", valor: 20 },
      { etiqueta: "Propina", valor: 100 },
    ]);
    expect(filas.reduce((total, fila) => total + Math.round(fila.valor * 100), 0)).toBe(130000);
  });
});
