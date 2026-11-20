import { describe, expect, test } from "vitest";

import { bloqueaCosto, costoCentavosDeLinea, costoDeLinea } from "./ajuste-formulario";

const producto = {
  id: "11111111-1111-4111-8111-111111111111",
  nombre: "Gas 25 lb",
  referencia: "G25",
  cantidad: 12,
  costo: 10667.35,
};

describe("bloqueaCosto", () => {
  test("solo la salida bloquea el costo (Alegra usa el promedio vigente)", () => {
    expect(bloqueaCosto("salida")).toBe(true);
    expect(bloqueaCosto("entrada")).toBe(false);
  });
});

describe("costoDeLinea", () => {
  test("la salida toma el costo promedio del producto e ignora lo tecleado", () => {
    expect(costoDeLinea("salida", producto, "999")).toBe("10667.35");
  });

  test("la salida sin producto deja el costo vacío", () => {
    expect(costoDeLinea("salida", null, "999")).toBe("");
  });

  test("la entrada conserva el costo editable", () => {
    expect(costoDeLinea("entrada", producto, "250.5")).toBe("250.5");
    expect(costoDeLinea("entrada", producto, "")).toBe("");
  });
});

describe("costoCentavosDeLinea", () => {
  test("la salida valida y envía el promedio aunque el estado tenga otro costo", () => {
    expect(costoCentavosDeLinea("salida", producto, "999")).toBe(1066735);
  });

  test("la salida sin producto no tiene costo válido", () => {
    expect(costoCentavosDeLinea("salida", null, "999")).toBeNull();
  });

  test("la entrada usa el costo escrito", () => {
    expect(costoCentavosDeLinea("entrada", producto, "250.50")).toBe(25050);
    expect(costoCentavosDeLinea("entrada", producto, "0")).toBe(0);
  });
});
