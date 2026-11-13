import { describe, expect, test } from "vitest";

import {
  type CuentaResumen,
  filtrarPorNumero,
  precioConItbis,
  resolverCuentasFicha,
  saldoCentavos,
  sumarCantidades,
} from "./ficha";

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

describe("resolverCuentasFicha", () => {
  const cuentas = new Map<string, CuentaResumen>([
    ["propia", { id: "propia", codigo: "4105", nombre: "Ingresos propios" }],
    ["ventas", { id: "ventas", codigo: "4101", nombre: "Ventas" }],
    ["ventas_servicios", { id: "ventas_servicios", codigo: "4102", nombre: "Ventas de servicios" }],
    ["inventario", { id: "inventario", codigo: "1104", nombre: "Inventario de mercancía" }],
    ["costo_ventas", { id: "costo_ventas", codigo: "5101", nombre: "Costo de ventas" }],
  ]);
  const configuracion = new Map([
    ["ventas", "ventas"],
    ["ventas_servicios", "ventas_servicios"],
    ["inventario", "inventario"],
    ["costo_ventas", "costo_ventas"],
  ]);
  const sinCuentasPropias = {
    cuentaIngresoId: null,
    cuentaInventarioId: null,
    cuentaCostoId: null,
  };

  test("usa la cuenta propia cuando está definida", () => {
    const resultado = resolverCuentasFicha(
      { tipo: "producto", inventariable: true, ...sinCuentasPropias, cuentaIngresoId: "propia" },
      configuracion,
      cuentas,
    );

    expect(resultado.ingreso?.cuenta.id).toBe("propia");
    expect(resultado.ingreso?.porDefecto).toBe(false);
  });

  test("producto inventariable usa las cuentas por defecto", () => {
    const resultado = resolverCuentasFicha(
      { tipo: "producto", inventariable: true, ...sinCuentasPropias },
      configuracion,
      cuentas,
    );

    expect(resultado.ingreso?.cuenta.id).toBe("ventas");
    expect(resultado.inventario?.cuenta.id).toBe("inventario");
    expect(resultado.costo?.cuenta.id).toBe("costo_ventas");
    expect(resultado.ingreso?.porDefecto).toBe(true);
  });

  test("servicio usa ventas de servicios y no inventario", () => {
    const resultado = resolverCuentasFicha(
      { tipo: "servicio", inventariable: false, ...sinCuentasPropias },
      configuracion,
      cuentas,
    );

    expect(resultado.ingreso?.cuenta.id).toBe("ventas_servicios");
    expect(resultado.inventario).toBeNull();
    expect(resultado.costo?.cuenta.id).toBe("costo_ventas");
  });

  test("producto no inventariable no cae en inventario", () => {
    const resultado = resolverCuentasFicha(
      { tipo: "producto", inventariable: false, ...sinCuentasPropias },
      configuracion,
      cuentas,
    );

    expect(resultado.inventario).toBeNull();
  });

  test("sin cuenta configurada devuelve null", () => {
    const resultado = resolverCuentasFicha(
      { tipo: "producto", inventariable: true, ...sinCuentasPropias },
      new Map(),
      cuentas,
    );

    expect(resultado.ingreso).toBeNull();
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
