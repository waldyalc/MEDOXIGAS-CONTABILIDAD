import { describe, expect, test } from "vitest";

import { filtrarItemsPorRol } from "./sidebar-items";

function ids(rol: "admin" | "caja" | "cobros" | null) {
  return filtrarItemsPorRol(rol).flatMap((grupo) => grupo.items.map((item) => item.id));
}

describe("filtrarItemsPorRol", () => {
  test("admin ve los 4 módulos", () => {
    expect(ids("admin")).toEqual(["produccion", "estado-cuenta", "caja-chica", "pos"]);
  });

  test("caja ve Caja Chica y Punto de Venta", () => {
    expect(ids("caja")).toEqual(["caja-chica", "pos"]);
  });

  test("cobros solo ve Estado de cuenta", () => {
    expect(ids("cobros")).toEqual(["estado-cuenta"]);
  });

  test("sin rol no ve nada", () => {
    expect(filtrarItemsPorRol(null)).toEqual([]);
  });
});
