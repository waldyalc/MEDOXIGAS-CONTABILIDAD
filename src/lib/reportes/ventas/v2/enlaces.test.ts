import { describe, expect, test } from "vitest";

import {
  urlContacto,
  urlFacturaProveedor,
  urlFacturaVenta,
  urlGastoMenor,
  urlMovimientosCuenta,
  urlPagoProveedor,
  urlPagoRecibido,
  urlProducto,
  urlRentabilidadProducto,
  urlVentasProducto,
} from "./enlaces";

describe("enlaces de reportes de ventas", () => {
  test("arma las rutas de las entidades", () => {
    expect(urlContacto("abc-123")).toBe("/dashboard/contactos/abc-123");
    expect(urlProducto("abc-123")).toBe("/dashboard/productos/abc-123");
    expect(urlFacturaVenta("abc-123")).toBe("/dashboard/facturacion/abc-123");
    expect(urlFacturaProveedor("abc-123")).toBe("/dashboard/compras/abc-123");
    expect(urlPagoProveedor("abc-123")).toBe("/dashboard/compras/pagos/abc-123");
    expect(urlPagoRecibido("abc-123")).toBe("/dashboard/pagos-recibidos/abc-123");
    expect(urlGastoMenor("abc-123")).toBe("/dashboard/gastos/abc-123");
  });

  test("arma la ruta de movimientos de cuenta", () => {
    expect(urlMovimientosCuenta("1101", "2026-11-01", "2026-11-30")).toBe(
      "/dashboard/reportes/movimientos-cuenta?cuenta=1101&desde=2026-11-01&hasta=2026-11-30",
    );
  });

  test("arma la ruta de ventas por producto sin filtros opcionales", () => {
    expect(urlVentasProducto({ desde: "2026-11-01", hasta: "2026-11-30" })).toBe(
      "/dashboard/reportes/ventas-producto?desde=2026-11-01&hasta=2026-11-30",
    );
  });

  test("agrega búsqueda recortada y página mayor a uno", () => {
    const url = urlVentasProducto({
      desde: "2026-11-01",
      hasta: "2026-11-30",
      busqueda: "  cemento gris ",
      pagina: 2,
    });

    expect(url).toContain("q=cemento+gris");
    expect(url).toContain("pagina=2");
    expect(url).not.toContain("cemento++gris");
  });

  test("omite la página cuando es uno o no se indica", () => {
    expect(urlVentasProducto({ desde: "2026-11-01", hasta: "2026-11-30", pagina: 1 })).not.toContain("pagina");
    expect(urlVentasProducto({ desde: "2026-11-01", hasta: "2026-11-30" })).not.toContain("pagina");
  });

  test("arma la ruta de rentabilidad por producto", () => {
    const conPagina = urlRentabilidadProducto({ desde: "2026-11-01", hasta: "2026-11-30", pagina: 3 });
    expect(conPagina).toContain("pagina=3");
    expect(conPagina).toContain("desde=2026-11-01");
    expect(conPagina).toContain("hasta=2026-11-30");

    expect(urlRentabilidadProducto({ desde: "2026-11-01", hasta: "2026-11-30" })).toBe(
      "/dashboard/reportes/rentabilidad-producto?desde=2026-11-01&hasta=2026-11-30",
    );
  });
});
