import { describe, expect, test } from "vitest";

import { agruparPorVendedor } from "./vendedor";

describe("agruparPorVendedor", () => {
  test("sin campo de vendedor no hay filas", () => {
    expect(agruparPorVendedor([])).toEqual([]);
    expect(
      agruparPorVendedor([
        { vendedor: null, subtotal: "100.00", itbis: "18.00", total: "118.00" },
        { vendedor: "  ", subtotal: "200.00", itbis: "36.00", total: "236.00" },
      ]),
    ).toEqual([]);
  });

  test("agrupa por vendedor cuando exista el campo", () => {
    const grupos = agruparPorVendedor([
      { vendedor: "Ana", subtotal: "14100.00", itbis: "2538.00", total: "16638.00" },
      { vendedor: "Luis", subtotal: "4400.00", itbis: "792.00", total: "5192.00" },
      { vendedor: "Ana", subtotal: "1000.00", itbis: "180.00", total: "1180.00" },
    ]);

    expect(grupos).toHaveLength(2);
    expect(grupos[0]).toEqual({
      vendedor: "Ana",
      numeroVentas: 2,
      antesImpuestos: 1510000,
      impuestos: 271800,
      despuesImpuestos: 1781800,
    });
    expect(grupos[1]?.vendedor).toBe("Luis");
  });
});
