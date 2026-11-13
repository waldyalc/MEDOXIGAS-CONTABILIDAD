import { describe, expect, test } from "vitest";

import type { Rol } from "@/lib/auth/rol";

import { filtrarItemsPorRol, sidebarItems } from "./sidebar-items";

const ROLES: Rol[] = ["admin", "contador", "lector"];
const MODULOS = [
  "inicio",
  "ingresos",
  "compras",
  "contactos",
  "productos",
  "inventario",
  "contabilidad",
  "bancos",
  "reportes",
  "configuracion",
];

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

  test("Ingresos, Compras, Inventario y Contabilidad agrupan sus submenús", () => {
    const ingresos = items("admin").find((item) => item.id === "ingresos");
    if (ingresos?.subItems == null) throw new Error("Ingresos debe tener submenú");
    expect(ingresos.subItems.map((sub) => sub.url)).toEqual([
      "/dashboard/facturacion",
      "/dashboard/pagos-recibidos",
      "/dashboard/cotizaciones",
      "/dashboard/conduces",
      "/dashboard/notas-credito",
      "/dashboard/notas-debito",
      "/dashboard/facturas-recurrentes",
    ]);

    const compras = items("admin").find((item) => item.id === "compras");
    if (compras?.subItems == null) throw new Error("Compras debe tener submenú");
    expect(compras.subItems.map((sub) => sub.url)).toEqual([
      "/dashboard/compras",
      "/dashboard/compras/pagos",
      "/dashboard/gastos",
      "/dashboard/compras/notas-credito",
      "/dashboard/ordenes-compra",
      "/dashboard/pagos-recurrentes",
    ]);

    const inventario = items("admin").find((item) => item.id === "inventario");
    if (inventario?.subItems == null) throw new Error("Inventario debe tener submenú");
    expect(inventario.subItems.map((sub) => sub.url)).toEqual([
      "/dashboard/inventario/ajustes",
      "/dashboard/inventario/transferencias",
      "/dashboard/inventario/listas-precios",
      "/dashboard/inventario/almacenes",
      "/dashboard/inventario/categorias",
    ]);

    const contabilidad = items("admin").find((item) => item.id === "contabilidad");
    if (contabilidad?.subItems == null) throw new Error("Contabilidad debe tener submenú");
    expect(contabilidad.subItems.map((sub) => sub.url)).toEqual([
      "/dashboard/contabilidad",
      "/dashboard/contabilidad/asientos",
      "/dashboard/contabilidad/numeraciones",
      "/dashboard/contabilidad/activos",
      "/dashboard/contabilidad/periodos",
    ]);
  });

  test("el grupo se titula Módulos", () => {
    expect(sidebarItems.map((grupo) => grupo.label)).toEqual(["Módulos"]);
  });
});
