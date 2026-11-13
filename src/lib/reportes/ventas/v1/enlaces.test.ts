import { describe, expect, test } from "vitest";

import { enlaces } from "./enlaces";

describe("enlaces de ventas", () => {
  test("arma las rutas de cada entidad", () => {
    expect(enlaces.contacto("contacto-1")).toBe("/dashboard/contactos/contacto-1");
    expect(enlaces.producto("producto-1")).toBe("/dashboard/productos/producto-1");
    expect(enlaces.facturaVenta("factura-1")).toBe("/dashboard/facturacion/factura-1");
    expect(enlaces.facturaProveedor("compra-1")).toBe("/dashboard/compras/compra-1");
    expect(enlaces.pagoProveedor("pago-1")).toBe("/dashboard/compras/pagos/pago-1");
    expect(enlaces.pagoRecibido("recibo-1")).toBe("/dashboard/pagos-recibidos/recibo-1");
    expect(enlaces.gastoMenor("gasto-1")).toBe("/dashboard/gastos/gasto-1");
  });

  test("arma el enlace de movimientos de cuenta con sus parámetros", () => {
    expect(enlaces.cuentaContable("4101", "2026-11-01", "2026-11-30")).toBe(
      "/dashboard/reportes/movimientos-cuenta?cuenta=4101&desde=2026-11-01&hasta=2026-11-30",
    );
  });
});
