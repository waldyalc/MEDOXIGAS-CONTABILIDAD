import { describe, expect, test } from "vitest";

import type { FilaVentaCliente } from "./tipos";
import {
  calcularVentasPorCliente,
  filtrarClientes,
  mejoresPorIngresos,
  mejoresPorVentas,
  paginar,
  resumirClientes,
  totalPaginas,
} from "./ventas-cliente";

const CONSTRUCTORA: FilaVentaCliente = {
  facturaId: "f1",
  contactoId: "c1",
  contactoNombre: "Constructora Prueba SRL",
  subtotal: "14100.00",
  descuento: "0.00",
  itbis: "2538.00",
  total: "16638.00",
};

const MOSTRADOR: FilaVentaCliente = {
  facturaId: "f2",
  contactoId: "c2",
  contactoNombre: "Cliente mostrador",
  subtotal: "4400.00",
  descuento: "0.00",
  itbis: "792.00",
  total: "5192.00",
};

const FILAS: FilaVentaCliente[] = [CONSTRUCTORA, MOSTRADOR];

describe("calcularVentasPorCliente", () => {
  test("agrupa y totaliza los datos de la ferretería", () => {
    const resumen = calcularVentasPorCliente(FILAS);

    expect(resumen.clientes).toHaveLength(2);
    expect(resumen.clientes[0]?.contactoNombre).toBe("Constructora Prueba SRL");
    expect(resumen.clientes[0]?.numeroVentas).toBe(1);
    expect(resumen.clientes[0]?.subtotal).toBe(1410000);
    expect(resumen.clientes[0]?.antesImpuestos).toBe(1410000);
    expect(resumen.clientes[0]?.impuestos).toBe(253800);
    expect(resumen.clientes[0]?.despuesImpuestos).toBe(1663800);
    expect(resumen.totales.antesImpuestos).toBe(1850000);
    expect(resumen.totales.impuestos).toBe(333000);
    expect(resumen.totales.despuesImpuestos).toBe(2183000);
    expect(resumen.totales.devoluciones).toBe(0);
  });

  test("suma varias ventas del mismo cliente y descuenta del subtotal bruto", () => {
    const resumen = calcularVentasPorCliente([
      ...FILAS,
      {
        facturaId: "f3",
        contactoId: "c1",
        contactoNombre: "Constructora Prueba SRL",
        subtotal: "900.00",
        descuento: "100.00",
        itbis: "162.00",
        total: "1062.00",
      },
    ]);

    const constructora = resumen.clientes.find((cliente) => cliente.contactoId === "c1");
    expect(constructora?.numeroVentas).toBe(2);
    expect(constructora?.subtotal).toBe(1510000);
    expect(constructora?.descuentos).toBe(10000);
    expect(constructora?.antesImpuestos).toBe(1500000);
    expect(constructora?.impuestos).toBe(270000);
    expect(constructora?.despuesImpuestos).toBe(1770000);
  });

  test("ordena por ingresos de mayor a menor", () => {
    const resumen = calcularVentasPorCliente([
      { ...CONSTRUCTORA, facturaId: "a" },
      { ...MOSTRADOR, facturaId: "b" },
    ]);
    expect(resumen.clientes.map((cliente) => cliente.contactoId)).toEqual(["c1", "c2"]);
  });
});

describe("filtros y paginación", () => {
  test("busca sin importar tildes ni mayúsculas", () => {
    const resumen = calcularVentasPorCliente(FILAS);
    expect(filtrarClientes(resumen.clientes, "CONSTRUCTORA")).toHaveLength(1);
    expect(filtrarClientes(resumen.clientes, "  ")).toHaveLength(2);
  });

  test("resumir clientes filtrados recalcula totales", () => {
    const resumen = calcularVentasPorCliente(FILAS);
    const filtrados = filtrarClientes(resumen.clientes, "mostrador");
    const totales = resumirClientes(filtrados);

    expect(totales.antesImpuestos).toBe(440000);
    expect(totales.impuestos).toBe(79200);
    expect(totales.despuesImpuestos).toBe(519200);
  });

  test("mejores clientes por ingresos y por número de ventas", () => {
    const resumen = calcularVentasPorCliente([...FILAS, { ...MOSTRADOR, facturaId: "f3" }]);

    expect(mejoresPorIngresos(resumen.clientes)[0]?.contactoId).toBe("c1");
    expect(mejoresPorVentas(resumen.clientes)[0]?.contactoId).toBe("c2");
  });

  test("pagina de 10 en 10", () => {
    const filas = Array.from({ length: 12 }, (_, indice) => indice);
    expect(totalPaginas(12)).toBe(2);
    expect(paginar(filas, 1)).toHaveLength(10);
    expect(paginar(filas, 2)).toHaveLength(2);
    expect(paginar(filas, 3)).toHaveLength(0);
  });
});
