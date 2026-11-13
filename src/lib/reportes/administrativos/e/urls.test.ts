import { describe, expect, test } from "vitest";

import { URL_REGISTRAR_VENTA, urlMovimientosCuenta } from "./urls";

describe("urls de los reportes administrativos", () => {
  test("arma el detalle de movimientos por cuenta con el rango", () => {
    expect(urlMovimientosCuenta("4101", "2026-11-01", "2026-11-30")).toBe(
      "/dashboard/reportes/movimientos-cuenta?cuenta=4101&desde=2026-11-01&hasta=2026-11-30",
    );
    expect(urlMovimientosCuenta("6107", "2026-01-01", "2026-12-31")).toContain("cuenta=6107");
    expect(URL_REGISTRAR_VENTA).toBe("/dashboard/facturacion/nueva");
  });
});
