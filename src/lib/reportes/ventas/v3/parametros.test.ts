import { describe, expect, test } from "vitest";

import { parsearBusqueda, parsearCliente, parsearCorte, parsearPagina, parsearVencimiento } from "./parametros";

describe("parámetros de los reportes de ventas", () => {
  test("lee la búsqueda y la recorta", () => {
    expect(parsearBusqueda({ q: "  constructora  " })).toBe("constructora");
    expect(parsearBusqueda({ q: ["ana", "luis"] })).toBe("ana");
    expect(parsearBusqueda({})).toBe("");
  });

  test("pagina válida y fuera de rango", () => {
    expect(parsearPagina({ pagina: "2" }, 25)).toBe(2);
    expect(parsearPagina({ pagina: "abc" }, 25)).toBe(1);
    expect(parsearPagina({ pagina: "0" }, 25)).toBe(1);
    expect(parsearPagina({ pagina: "9" }, 25)).toBe(3);
    expect(parsearPagina({}, 0)).toBe(1);
  });

  test("solo acepta un cliente con formato UUID", () => {
    expect(parsearCliente({ cliente: "5c3c1f0e-2f1a-4c3b-9d4e-8a7b6c5d4e3f" })).toBe(
      "5c3c1f0e-2f1a-4c3b-9d4e-8a7b6c5d4e3f",
    );
    expect(parsearCliente({ cliente: "5" })).toBeNull();
    expect(parsearCliente({})).toBeNull();
  });

  test("la fecha de corte inválida usa hoy", () => {
    expect(parsearCorte({ corte: "2026-11-13" }, "2026-11-13")).toBe("2026-11-13");
    expect(parsearCorte({ corte: "2026-02-31" }, "2026-11-13")).toBe("2026-11-13");
    expect(parsearCorte({}, "2026-11-13")).toBe("2026-11-13");
  });

  test("el estado de vencimiento desconocido cae en todos", () => {
    expect(parsearVencimiento({ vencimiento: "31-60" })).toBe("31-60");
    expect(parsearVencimiento({ vencimiento: "91-mas" })).toBe("91-mas");
    expect(parsearVencimiento({ vencimiento: "otro" })).toBe("todas");
    expect(parsearVencimiento({})).toBe("todas");
  });
});
