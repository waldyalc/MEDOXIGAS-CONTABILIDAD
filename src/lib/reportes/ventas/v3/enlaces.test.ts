import { describe, expect, test } from "vitest";

import { urlEstadoCuentaCliente, urlVentasCliente, urlVentasVendedor } from "./enlaces";

describe("enlaces de reportes de ventas", () => {
  test("arma los filtros de ventas por cliente y vendedor", () => {
    expect(urlVentasCliente({ desde: "2026-11-01", hasta: "2026-11-30" })).toBe(
      "/dashboard/reportes/ventas-cliente?desde=2026-11-01&hasta=2026-11-30",
    );
    expect(urlVentasCliente({ desde: "2026-11-01", hasta: "2026-11-30", q: "Constructora", pagina: 2 })).toBe(
      "/dashboard/reportes/ventas-cliente?desde=2026-11-01&hasta=2026-11-30&q=Constructora&pagina=2",
    );
    expect(urlVentasVendedor({ desde: "2026-11-01", hasta: "2026-11-30", pagina: 1 })).toBe(
      "/dashboard/reportes/ventas-vendedor?desde=2026-11-01&hasta=2026-11-30",
    );
  });

  test("arma los filtros del estado de cuenta", () => {
    expect(
      urlEstadoCuentaCliente({
        cliente: "c1",
        corte: "2026-11-13",
        vencimiento: "1-30",
        documento: "B01",
      }),
    ).toBe("/dashboard/reportes/estado-cuenta-cliente?cliente=c1&corte=2026-11-13&vencimiento=1-30&documento=B01");
    expect(urlEstadoCuentaCliente({ cliente: "c1", corte: "2026-11-13", vencimiento: "todas", documento: "" })).toBe(
      "/dashboard/reportes/estado-cuenta-cliente?cliente=c1&corte=2026-11-13",
    );
  });
});
