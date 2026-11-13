import { describe, expect, test } from "vitest";

import { filtrarPorNumero, precioConItbis, saldoCentavos, sumarCantidades } from "./ficha";

describe("precioConItbis", () => {
  test("calcula el precio con ITBIS en centavos", () => {
    expect(precioConItbis(100, 18)).toBe(118);
    expect(precioConItbis(2500.75, 16)).toBe(2900.87);
    expect(precioConItbis(99.99, 0)).toBe(99.99);
  });
});

describe("saldoCentavos", () => {
  test("resta total y pagado sin errores de flotantes", () => {
    expect(saldoCentavos(100.1, 0.05)).toBe(10005);
    expect(saldoCentavos(100, 100)).toBe(0);
    expect(saldoCentavos(100, 150)).toBe(0);
  });
});

describe("sumarCantidades", () => {
  test("suma cantidades en centésimas", () => {
    expect(sumarCantidades([0.1, 0.2])).toBe(0.3);
    expect(sumarCantidades([2, 3.5])).toBe(5.5);
    expect(sumarCantidades([])).toBe(0);
  });
});

describe("filtrarPorNumero", () => {
  const documentos = [
    { id: "1", numero: 12, ncf: "B0100000012" },
    { id: "2", numero: 3, ncf: "B0200000003" },
  ];

  test("filtra por número o NCF sin distinguir mayúsculas", () => {
    expect(filtrarPorNumero(documentos, "b02").map((documento) => documento.id)).toEqual(["2"]);
    expect(filtrarPorNumero(documentos, "12").map((documento) => documento.id)).toEqual(["1"]);
    expect(filtrarPorNumero(documentos, "B010").map((documento) => documento.id)).toEqual(["1"]);
  });

  test("devuelve todos los documentos con filtro vacío", () => {
    expect(filtrarPorNumero(documentos, "  ")).toEqual(documentos);
  });
});
