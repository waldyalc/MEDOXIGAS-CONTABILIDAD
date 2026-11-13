import { describe, expect, test } from "vitest";

import type { Rol } from "@/lib/auth/rol";

import { filtrarItemsPorRol, sidebarItems } from "./sidebar-items";

const ROLES: Rol[] = ["admin", "contador", "lector"];
const MODULOS = ["inicio", "ingresos", "compras", "contactos", "productos", "contabilidad", "reportes"];

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

  test("ningún módulo queda deshabilitado ni con badge", () => {
    for (const item of items("admin")) {
      expect(item.disabled).toBeUndefined();
      expect(item.badge).toBeUndefined();
    }

    const inicio = items("admin").find((item) => item.id === "inicio");
    if (inicio == null || !("url" in inicio)) throw new Error("Inicio debe ser un enlace");
    expect(inicio.url).toBe("/dashboard");

    const reportes = items("admin").find((item) => item.id === "reportes");
    if (reportes == null || !("url" in reportes)) throw new Error("Reportes debe ser un enlace");
    expect(reportes.url).toBe("/dashboard/reportes");
  });

  test("Ingresos y Compras agrupan sus submenús", () => {
    const ingresos = items("admin").find((item) => item.id === "ingresos");
    if (ingresos?.subItems == null) throw new Error("Ingresos debe tener submenú");
    expect(ingresos.subItems.map((sub) => sub.url)).toEqual(["/dashboard/facturacion", "/dashboard/pagos-recibidos"]);

    const compras = items("admin").find((item) => item.id === "compras");
    if (compras?.subItems == null) throw new Error("Compras debe tener submenú");
    expect(compras.subItems.map((sub) => sub.url)).toEqual([
      "/dashboard/compras",
      "/dashboard/compras/pagos",
      "/dashboard/gastos",
    ]);
  });

  test("el grupo se titula Módulos", () => {
    expect(sidebarItems.map((grupo) => grupo.label)).toEqual(["Módulos"]);
  });
});
