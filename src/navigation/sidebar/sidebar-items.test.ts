import { describe, expect, test } from "vitest";

import type { Rol } from "@/lib/auth/rol";

import { filtrarItemsPorRol, sidebarItems } from "./sidebar-items";

const ROLES: Rol[] = ["admin", "contador", "lector"];
const MODULOS = ["inicio", "facturacion", "clientes", "productos", "gastos", "bancos", "reportes"];

function ids(rol: Rol | null) {
  return filtrarItemsPorRol(rol).flatMap((grupo) => grupo.items.map((item) => item.id));
}

function items(rol: Rol) {
  return filtrarItemsPorRol(rol).flatMap((grupo) => grupo.items);
}

describe("filtrarItemsPorRol", () => {
  for (const rol of ROLES) {
    test(`${rol} ve todos los módulos`, () => {
      expect(ids(rol)).toEqual(MODULOS);
    });
  }

  test("sin rol no ve nada", () => {
    expect(filtrarItemsPorRol(null)).toEqual([]);
  });

  test("Inicio está activo y los módulos futuros están deshabilitados con badge soon", () => {
    const inicio = items("admin").find((item) => item.id === "inicio");
    if (inicio == null || !("url" in inicio)) throw new Error("Inicio debe ser un enlace");
    expect(inicio.url).toBe("/dashboard");
    expect(inicio.disabled).toBeUndefined();

    const futuros = items("admin").filter((item) => item.id !== "inicio");
    expect(futuros).toHaveLength(6);
    for (const item of futuros) {
      expect(item.badge).toBe("soon");
      expect(item.disabled).toBe(true);
    }
  });

  test("el grupo se titula Módulos", () => {
    expect(sidebarItems.map((grupo) => grupo.label)).toEqual(["Módulos"]);
  });
});
