import { describe, expect, test } from "vitest";

import {
  elegirCuentaGastoPorDefecto,
  elegirCuentaPagoPorDefecto,
  etiquetaCuenta,
  filtrarCuentasCajaBanco,
  filtrarCuentasGasto,
} from "./seleccion";
import type { CuentaContable } from "./tipos";

function cuenta(parcial: Partial<CuentaContable> & Pick<CuentaContable, "id" | "codigo">): CuentaContable {
  return {
    nombre: `Cuenta ${parcial.codigo}`,
    tipo: "gasto",
    acepta_movimientos: true,
    activa: true,
    es_caja_banco: false,
    ...parcial,
  };
}

const cuentas: CuentaContable[] = [
  cuenta({ id: "g1", codigo: "6102", nombre: "Gastos de caja menor" }),
  cuenta({ id: "g2", codigo: "6101", nombre: "Gastos generales" }),
  cuenta({ id: "g3", codigo: "6103", tipo: "gasto", activa: false }),
  cuenta({ id: "g4", codigo: "6104", acepta_movimientos: false }),
  cuenta({ id: "g5", codigo: "1101", tipo: "activo" }),
  cuenta({ id: "c1", codigo: "1106", tipo: "activo", es_caja_banco: true }),
  cuenta({ id: "c2", codigo: "1101", tipo: "activo", es_caja_banco: true }),
  cuenta({ id: "c3", codigo: "1102", tipo: "activo", es_caja_banco: true, activa: false }),
];

describe("filtros de cuentas", () => {
  test("solo cuentas de gasto activas que aceptan movimientos", () => {
    expect(filtrarCuentasGasto(cuentas).map((item) => item.id)).toEqual(["g1", "g2"]);
  });

  test("solo cuentas de caja o banco activas que aceptan movimientos", () => {
    expect(filtrarCuentasCajaBanco(cuentas).map((item) => item.id)).toEqual(["c1", "c2"]);
  });

  test("los filtros devuelven id, código y nombre", () => {
    expect(filtrarCuentasGasto(cuentas)[1]).toEqual({ id: "g2", codigo: "6101", nombre: "Gastos generales" });
    expect(filtrarCuentasCajaBanco(cuentas)[0]).toEqual({ id: "c1", codigo: "1106", nombre: "Cuenta 1106" });
  });
});

describe("cuentas por defecto", () => {
  test("la cuenta de gasto por defecto es la 6101", () => {
    expect(elegirCuentaGastoPorDefecto(filtrarCuentasGasto(cuentas))?.id).toBe("g2");
  });

  test("sin 6101 usa la primera cuenta de gasto", () => {
    const sin6101 = filtrarCuentasGasto(cuentas).filter((item) => item.codigo !== "6101");
    expect(elegirCuentaGastoPorDefecto(sin6101)?.id).toBe("g1");
  });

  test("la cuenta de pago por defecto es la 1106", () => {
    expect(elegirCuentaPagoPorDefecto(filtrarCuentasCajaBanco(cuentas))?.id).toBe("c1");
  });

  test("sin 1106 usa la 1101", () => {
    const sin1106 = filtrarCuentasCajaBanco(cuentas).filter((item) => item.codigo !== "1106");
    expect(elegirCuentaPagoPorDefecto(sin1106)?.id).toBe("c2");
  });

  test("sin 1106 ni 1101 usa la primera y con lista vacía devuelve null", () => {
    const otras = [
      cuenta({ id: "c4", codigo: "1103", tipo: "activo", es_caja_banco: true }),
      cuenta({ id: "c5", codigo: "1104", tipo: "activo", es_caja_banco: true }),
    ];
    expect(elegirCuentaPagoPorDefecto(otras)?.id).toBe("c4");
    expect(elegirCuentaPagoPorDefecto([])).toBeNull();
  });
});

describe("etiquetaCuenta", () => {
  test("muestra código y nombre separados por un espacio", () => {
    expect(etiquetaCuenta({ codigo: "6101", nombre: "Gastos generales" })).toBe("6101 Gastos generales");
  });
});
