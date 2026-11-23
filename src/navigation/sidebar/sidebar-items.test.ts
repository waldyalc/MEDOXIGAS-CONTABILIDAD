import { describe, expect, test } from "vitest";

import type { Rol } from "@/lib/auth/rol";

import { filtrarItemsPorRol, sidebarItems } from "./sidebar-items";

const MODULOS = [
  "inicio",
  "ingresos",
  "compras",
  "contactos",
  "inventario",
  "bancos",
  "contabilidad",
  "reportes",
  "configuracion",
  "nomina",
  "punto-venta",
];

const MODULOS_CON_DGII = [...MODULOS, "configuracion-reportes-dgii"];

function ids(rol: Rol | null) {
  return filtrarItemsPorRol(rol).flatMap((grupo) => grupo.items.map((item) => item.id));
}

function items(rol: Rol) {
  return filtrarItemsPorRol(rol).flatMap((grupo) => grupo.items);
}

describe("filtrarItemsPorRol", () => {
  for (const rol of ["admin", "contador"] as const) {
    test(`${rol} ve todos los módulos y la clasificación DGII`, () => {
      expect(ids(rol)).toEqual(MODULOS_CON_DGII);
    });
  }

  test("lector ve los módulos de solo lectura y no la clasificación DGII", () => {
    expect(ids("lector")).toEqual(MODULOS);
    expect(ids("lector")).not.toContain("configuracion-reportes-dgii");
  });

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

  test("Ingresos, Compras, Inventario, Contabilidad y Bancos agrupan sus submenús", () => {
    const ingresos = items("admin").find((item) => item.id === "ingresos");
    if (ingresos?.subItems == null) throw new Error("Ingresos debe tener submenú");
    expect(ingresos.subItems.map((sub) => sub.url)).toEqual([
      "/dashboard/facturacion",
      "/dashboard/facturas-recurrentes",
      "/dashboard/pagos-recibidos",
      "/dashboard/notas-credito",
      "/dashboard/notas-debito",
      "/dashboard/cotizaciones",
      "/dashboard/conduces",
    ]);
    expect(ingresos.subItems.map((sub) => sub.title)).toEqual([
      "Facturas de venta",
      "Facturas de venta recurrentes",
      "Pagos recibidos",
      "Notas de crédito",
      "Notas de débito",
      "Cotizaciones",
      "Conduces",
    ]);

    const compras = items("admin").find((item) => item.id === "compras");
    if (compras?.subItems == null) throw new Error("Compras debe tener submenú");
    expect(compras.subItems.map((sub) => sub.url)).toEqual([
      "/dashboard/compras",
      "/dashboard/compras/pagos",
      "/dashboard/gastos",
      "/dashboard/pagos-recurrentes",
      "/dashboard/compras/notas-credito",
      "/dashboard/ordenes-compra",
    ]);

    const inventario = items("admin").find((item) => item.id === "inventario");
    if (inventario?.subItems == null) throw new Error("Inventario debe tener submenú");
    expect(inventario.subItems.map((sub) => sub.url)).toEqual([
      "/dashboard/productos",
      "/dashboard/reportes/valor-inventario",
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
      "/dashboard/reportes/libro-diario",
      "/dashboard/contabilidad/numeraciones",
      "/dashboard/contabilidad/activos",
      "/dashboard/contabilidad/periodos",
    ]);

    const bancos = items("admin").find((item) => item.id === "bancos");
    if (bancos?.subItems == null) throw new Error("Bancos debe tener submenú");
    expect(bancos.subItems.map((sub) => sub.url)).toEqual(["/dashboard/bancos", "/dashboard/bancos/conciliaciones"]);
    expect(bancos.subItems.map((sub) => sub.title)).toEqual(["Bancos y cajas", "Conciliaciones bancarias"]);

    const nomina = items("admin").find((item) => item.id === "nomina");
    if (nomina?.subItems == null) throw new Error("Nómina debe tener submenú");
    expect(nomina.subItems.map((sub) => sub.url)).toEqual([
      "/dashboard/contabilidad/nomina",
      "/dashboard/contabilidad/nomina/empleados",
      "/dashboard/contabilidad/nomina/periodos",
      "/dashboard/contabilidad/nomina/pagos",
      "/dashboard/contabilidad/nomina/envios",
      "/dashboard/contabilidad/nomina/reportes",
    ]);
  });

  test("Productos vive dentro de Inventario como primer subítem", () => {
    expect(ids("admin")).not.toContain("productos");

    const inventario = items("admin").find((item) => item.id === "inventario");
    if (inventario?.subItems == null) throw new Error("Inventario debe tener submenú");

    expect(inventario.icon).toBeDefined();
    expect(inventario.subItems[0]).toMatchObject({
      id: "productos",
      title: "Productos y servicios",
      url: "/dashboard/productos",
    });
  });

  test("los subítems con pantalla de creación llevan addUrl para el botón +", () => {
    const ingresos = items("admin").find((item) => item.id === "ingresos");
    const facturas = ingresos?.subItems?.find((sub) => sub.id === "facturas-venta");
    expect(facturas?.addUrl).toBe("/dashboard/facturacion/nueva");

    const contabilidad = items("admin").find((item) => item.id === "contabilidad");
    const asientos = contabilidad?.subItems?.find((sub) => sub.id === "asientos");
    expect(asientos?.addUrl).toBe("/dashboard/contabilidad/asientos/nuevo");

    const catalogo = contabilidad?.subItems?.find((sub) => sub.id === "catalogo-cuentas");
    expect(catalogo?.addUrl).toBeUndefined();
  });

  test("solo Inicio lleva separador después", () => {
    expect(
      items("admin")
        .filter((item) => item.separadorDespues)
        .map((item) => item.id),
    ).toEqual(["inicio"]);
  });

  test("POS abre /pos en otra pestaña y lo ven los tres roles", () => {
    for (const rol of ["admin", "contador", "lector"] as const) {
      const puntoVenta = items(rol).find((item) => item.id === "punto-venta");
      if (puntoVenta == null || !("url" in puntoVenta)) throw new Error("Punto de venta debe ser un enlace");

      expect(puntoVenta.url).toBe("/pos");
      expect(puntoVenta.title).toBe("POS");
      expect(puntoVenta.newTab).toBe(true);
      expect(puntoVenta.disabled).toBeUndefined();
    }
  });

  test("el grupo va sin etiqueta, como el menú de Alegra", () => {
    expect(sidebarItems.map((grupo) => grupo.label)).toEqual([undefined]);
  });
});
