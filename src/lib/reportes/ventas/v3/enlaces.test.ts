import { describe, expect, test } from "vitest";

import {
  urlContacto,
  urlEstadoCuentaCliente,
  urlFacturaProveedor,
  urlFacturaVenta,
  urlGastoMenor,
  urlMovimientoCuenta,
  urlPagoProveedor,
  urlPagoRecibido,
  urlProducto,
  urlVentasCliente,
  urlVentasVendedor,
} from "./enlaces";

describe("enlaces a fichas y documentos", () => {
  test("arma las rutas de las fichas", () => {
    expect(urlContacto("abc 1")).toBe("/dashboard/contactos/abc%201");
    expect(urlProducto("p1")).toBe("/dashboard/productos/p1");
    expect(urlFacturaVenta("f1")).toBe("/dashboard/facturacion/f1");
    expect(urlFacturaProveedor("fp1")).toBe("/dashboard/compras/fp1");
    expect(urlPagoProveedor("pp1")).toBe("/dashboard/compras/pagos/pp1");
    expect(urlPagoRecibido("pr1")).toBe("/dashboard/pagos-recibidos/pr1");
    expect(urlGastoMenor("g1")).toBe("/dashboard/gastos/g1");
  });

  test("arma el enlace a movimientos de cuenta", () => {
    expect(urlMovimientoCuenta("1101", "2026-11-01", "2026-11-30")).toBe(
      "/dashboard/reportes/movimientos-cuenta?cuenta=1101&desde=2026-11-01&hasta=2026-11-30",
    );
  });

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
