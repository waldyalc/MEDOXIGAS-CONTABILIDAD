import { describe, expect, test } from "vitest";

import { tablaRentabilidadProducto, tablaVentasProducto } from "./tablas";
import type { FilaRentabilidadProducto, FilaVentaProducto } from "./tipos";

const VENTAS: FilaVentaProducto[] = [
  {
    clave: "varilla",
    productoId: "varilla",
    nombre: "Varilla 3/8",
    referencia: "VAR-38",
    cantidad: 20,
    antes: 760_000,
    despues: 896_800,
  },
  {
    clave: "cemento",
    productoId: "cemento",
    nombre: "Cemento gris 42.5kg",
    referencia: null,
    cantidad: 10,
    antes: 650_000,
    despues: 767_000,
  },
];

const RENTABILIDAD: FilaRentabilidadProducto[] = [
  {
    clave: "varilla",
    productoId: "varilla",
    nombre: "Varilla 3/8",
    referencia: "VAR-38",
    totalVendido: 760_000,
    costoTotal: 456_000,
    rentabilidad: 304_000,
    porcentaje: 40,
  },
  {
    clave: "cemento",
    productoId: "cemento",
    nombre: "Cemento gris 42.5kg",
    referencia: null,
    totalVendido: 650_000,
    costoTotal: 390_000,
    rentabilidad: 260_000,
    porcentaje: 40,
  },
];

describe("tablaVentasProducto", () => {
  test("arma columnas, filas y total del reporte", () => {
    const tabla = tablaVentasProducto(
      VENTAS,
      { cantidad: 30, antes: 1_410_000, despues: 1_663_800 },
      "2026-11-01",
      "2026-11-30",
    );

    expect(tabla.titulo).toBe("Ventas por producto/servicio");
    expect(tabla.subtitulo).toBe("Período: 2026-11-01 al 2026-11-30");
    expect(tabla.columnas.map((columna) => columna.clave)).toEqual([
      "producto",
      "referencia",
      "cantidad",
      "antes",
      "despues",
    ]);
    expect(tabla.columnas.map((columna) => columna.tipo)).toEqual(["texto", "texto", "texto", "dinero", "dinero"]);
    expect(tabla.filas).toHaveLength(3);
    expect(tabla.filas[0]?.celdas).toMatchObject({
      producto: "Varilla 3/8",
      referencia: "VAR-38",
      cantidad: 20,
      antes: 760_000,
      despues: 896_800,
    });
    expect(tabla.filas[2]).toMatchObject({
      celdas: { producto: "Total", cantidad: 30, antes: 1_410_000, despues: 1_663_800 },
      estilo: "total",
    });
  });
});

describe("tablaRentabilidadProducto", () => {
  test("usa guion en referencia vacía y calcula el porcentaje total", () => {
    const tabla = tablaRentabilidadProducto(
      RENTABILIDAD,
      { totalVendido: 1_410_000, costoTotal: 846_000, rentabilidad: 564_000 },
      "2026-11-01",
      "2026-11-30",
    );

    expect(tabla.titulo).toBe("Rentabilidad por producto/servicio");
    expect(tabla.columnas.map((columna) => columna.clave)).toEqual([
      "producto",
      "referencia",
      "totalVendido",
      "costoTotal",
      "rentabilidad",
      "porcentaje",
    ]);
    expect(tabla.columnas[5]?.tipo).toBe("porcentaje");
    expect(tabla.filas[1]?.celdas.referencia).toBe("-");
    expect(tabla.filas[0]?.celdas).toMatchObject({
      producto: "Varilla 3/8",
      totalVendido: 760_000,
      costoTotal: 456_000,
      rentabilidad: 304_000,
      porcentaje: 40,
    });
    expect(tabla.filas[2]).toMatchObject({
      celdas: {
        producto: "Total",
        totalVendido: 1_410_000,
        costoTotal: 846_000,
        rentabilidad: 564_000,
        porcentaje: 40,
      },
      estilo: "total",
    });
  });
});
