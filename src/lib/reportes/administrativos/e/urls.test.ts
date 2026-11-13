import { describe, expect, test } from "vitest";

import {
  URL_REGISTRAR_VENTA,
  urlContacto,
  urlFacturaProveedor,
  urlFacturaVenta,
  urlGastoMenor,
  urlMovimientosCuenta,
  urlPagoProveedor,
  urlPagoRecibido,
  urlProducto,
} from "./urls";

describe("urls de los reportes administrativos", () => {
  test("arma las fichas de documentos y contactos", () => {
    expect(urlContacto("c-1")).toBe("/dashboard/contactos/c-1");
    expect(urlProducto("p-1")).toBe("/dashboard/productos/p-1");
    expect(urlFacturaVenta("f-1")).toBe("/dashboard/facturacion/f-1");
    expect(urlFacturaProveedor("fp-1")).toBe("/dashboard/compras/fp-1");
    expect(urlPagoProveedor("pp-1")).toBe("/dashboard/compras/pagos/pp-1");
    expect(urlPagoRecibido("pr-1")).toBe("/dashboard/pagos-recibidos/pr-1");
    expect(urlGastoMenor("g-1")).toBe("/dashboard/gastos/g-1");
    expect(URL_REGISTRAR_VENTA).toBe("/dashboard/facturacion/nueva");
  });

  test("arma el detalle de movimientos por cuenta con el rango", () => {
    expect(urlMovimientosCuenta("4101", "2026-11-01", "2026-11-30")).toBe(
      "/dashboard/reportes/movimientos-cuenta?cuenta=4101&desde=2026-11-01&hasta=2026-11-30",
    );
    expect(urlMovimientosCuenta("6107", "2026-01-01", "2026-12-31")).toContain("cuenta=6107");
  });
});
