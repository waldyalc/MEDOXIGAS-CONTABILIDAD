import { describe, expect, test } from "vitest";

import { agruparCartas, type RetencionProveedor, resumirIr17, tablaIr17 } from "./ir17";

const FILAS: RetencionProveedor[] = [
  {
    id: "r1",
    contactoId: "proveedor-1",
    proveedor: "Honorarios SRL",
    rnc: "101010101",
    tipo: "isr",
    nombre: "ISR 10 % honorarios",
    base: 100000,
    monto: 10000,
    fecha: "2026-11-05",
    facturaNumero: 3,
    facturaNcf: "B0100000003",
  },
  {
    id: "r2",
    contactoId: "proveedor-1",
    proveedor: "Honorarios SRL",
    rnc: "101010101",
    tipo: "itbis",
    nombre: "ITBIS 30 %",
    base: 18000,
    monto: 5400,
    fecha: "2026-11-05",
    facturaNumero: 3,
    facturaNcf: "B0100000003",
  },
  {
    id: "r3",
    contactoId: "proveedor-2",
    proveedor: "Alquileres SA",
    rnc: null,
    tipo: "isr",
    nombre: "ISR 5 % alquileres",
    base: 50000,
    monto: 2500,
    fecha: "2026-11-10",
    facturaNumero: 4,
    facturaNcf: null,
  },
];

describe("resumen IR-17", () => {
  test("suma base y retenido por tipo", () => {
    expect(resumirIr17(FILAS)).toEqual([
      { tipo: "itbis", base: 18000, monto: 5400 },
      { tipo: "isr", base: 150000, monto: 12500 },
    ]);
  });

  test("sin filas devuelve los tipos en cero", () => {
    expect(resumirIr17([])).toEqual([
      { tipo: "itbis", base: 0, monto: 0 },
      { tipo: "isr", base: 0, monto: 0 },
    ]);
  });
});

describe("tabla IR-17", () => {
  test("arma las columnas y el total", () => {
    const tabla = tablaIr17(FILAS, "IR-17", "Noviembre 2026");

    expect(tabla.filas).toHaveLength(FILAS.length + 1);
    expect(tabla.filas.at(-1)?.celdas).toMatchObject({ proveedor: "Total", base: 1680, monto: 179 });
    expect(tabla.filas.at(-1)?.estilo).toBe("total");
  });
});

describe("cartas por proveedor", () => {
  test("agrupa y suma por proveedor", () => {
    const cartas = agruparCartas(FILAS);

    expect(cartas).toHaveLength(2);
    expect(cartas[0]).toMatchObject({
      proveedor: "Alquileres SA",
      totalMonto: 2500,
      totalIsr: 2500,
      totalItbis: 0,
    });
    expect(cartas[1]).toMatchObject({
      proveedor: "Honorarios SRL",
      totalMonto: 15400,
      totalItbis: 5400,
      totalIsr: 10000,
    });
  });

  test("sin filas no hay cartas", () => {
    expect(agruparCartas([])).toEqual([]);
  });
});
