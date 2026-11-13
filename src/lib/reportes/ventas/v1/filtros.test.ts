import { describe, expect, test } from "vitest";

import { parsearFiltrosVentas, urlVentas } from "./filtros";

describe("filtros de ventas", () => {
  test("usa valores por defecto cuando no hay parámetros", () => {
    expect(parsearFiltrosVentas({})).toEqual({
      tipoComprobante: "",
      almacen: "",
      busqueda: "",
      pagina: 1,
      grafico: "diario",
    });
  });

  test("lee el primer valor de los parámetros y normaliza", () => {
    expect(
      parsearFiltrosVentas({
        numeracion: ["2", "9"],
        almacen: ["PRINCIPAL"],
        q: ["  Constructora  "],
        pagina: ["3"],
        grafico: ["mensual"],
      }),
    ).toEqual({
      tipoComprobante: "2",
      almacen: "principal",
      busqueda: "Constructora",
      pagina: 3,
      grafico: "mensual",
    });
  });

  test("descarta los valores inválidos", () => {
    expect(parsearFiltrosVentas({ numeracion: "1234" }).tipoComprobante).toBe("");
    expect(parsearFiltrosVentas({ numeracion: "12a" }).tipoComprobante).toBe("");
    expect(parsearFiltrosVentas({ almacen: "sucursal" }).almacen).toBe("");
    expect(parsearFiltrosVentas({ pagina: "0" }).pagina).toBe(1);
    expect(parsearFiltrosVentas({ pagina: "2.5" }).pagina).toBe(1);
    expect(parsearFiltrosVentas({ pagina: "abc" }).pagina).toBe(1);
    expect(parsearFiltrosVentas({ grafico: "semanal" }).grafico).toBe("diario");
  });

  test("recorta la búsqueda a 100 caracteres", () => {
    expect(parsearFiltrosVentas({ q: "x".repeat(120) }).busqueda).toHaveLength(100);
  });

  test("conserva el gráfico mensual", () => {
    expect(parsearFiltrosVentas({ grafico: "mensual" }).grafico).toBe("mensual");
  });

  test("arma la URL en orden y omite los valores por defecto", () => {
    expect(
      urlVentas("/dashboard/reportes/ventas", {
        desde: "2026-11-01",
        hasta: "2026-11-30",
        tipoComprobante: "1",
        almacen: "principal",
        busqueda: "cliente",
        grafico: "mensual",
        pagina: 2,
      }),
    ).toBe(
      "/dashboard/reportes/ventas?desde=2026-11-01&hasta=2026-11-30&numeracion=1&almacen=principal&q=cliente" +
        "&grafico=mensual&pagina=2",
    );

    expect(
      urlVentas("/dashboard/reportes/ventas", {
        desde: "2026-11-01",
        hasta: "2026-11-30",
        tipoComprobante: "",
        almacen: "",
        busqueda: "",
        grafico: "diario",
        pagina: 1,
      }),
    ).toBe("/dashboard/reportes/ventas?desde=2026-11-01&hasta=2026-11-30");
  });
});
