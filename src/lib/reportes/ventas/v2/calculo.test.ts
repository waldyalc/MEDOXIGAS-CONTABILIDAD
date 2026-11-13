import { describe, expect, test } from "vitest";

import {
  agruparRentabilidad,
  agruparVentasPorProducto,
  filtrarVentas,
  paginar,
  parsearBusqueda,
  parsearPagina,
  resumirRentabilidad,
  resumirVentas,
} from "./calculo";
import type { LineaVenta } from "./tipos";

const LINEAS: LineaVenta[] = [
  {
    productoId: "cemento",
    nombre: "Cemento gris 42.5kg",
    referencia: "CEM-425",
    cantidad: 10,
    subtotal: "6500.00",
    total: "7670.00",
    costoUnitario: "390.00",
  },
  {
    productoId: "varilla",
    nombre: "Varilla 3/8",
    referencia: "VAR-38",
    cantidad: 20,
    subtotal: "7600.00",
    total: "8968.00",
    costoUnitario: "228.00",
  },
  {
    productoId: "tubo",
    nombre: "Tubo PVC 1/2",
    referencia: "TUBO-12",
    cantidad: 10,
    subtotal: "1500.00",
    total: "1770.00",
    costoUnitario: "90.00",
  },
  {
    productoId: "pintura",
    nombre: "Pintura galón",
    referencia: "PIN-GAL",
    cantidad: 2,
    subtotal: "2900.00",
    total: "3422.00",
    costoUnitario: "870.00",
  },
];

describe("agruparVentasPorProducto", () => {
  test("agrupa las líneas de la ferretería y suma centavos", () => {
    const filas = agruparVentasPorProducto(LINEAS);

    expect(filas.map((fila) => fila.nombre)).toEqual([
      "Varilla 3/8",
      "Cemento gris 42.5kg",
      "Pintura galón",
      "Tubo PVC 1/2",
    ]);
    expect(filas.find((fila) => fila.nombre === "Cemento gris 42.5kg")).toMatchObject({
      cantidad: 10,
      antes: 650_000,
      despues: 767_000,
    });
    expect(filas.find((fila) => fila.nombre === "Varilla 3/8")).toMatchObject({
      cantidad: 20,
      antes: 760_000,
      despues: 896_800,
    });
    expect(filas.find((fila) => fila.nombre === "Tubo PVC 1/2")).toMatchObject({
      cantidad: 10,
      antes: 150_000,
      despues: 177_000,
    });
    expect(filas.find((fila) => fila.nombre === "Pintura galón")).toMatchObject({
      cantidad: 2,
      antes: 290_000,
      despues: 342_200,
    });
  });

  test("resume los totales de ventas", () => {
    expect(resumirVentas(agruparVentasPorProducto(LINEAS))).toEqual({
      cantidad: 42,
      antes: 1_850_000,
      despues: 2_183_000,
    });
  });

  test("agrupa dos líneas del mismo producto y toma la primera referencia no vacía", () => {
    const lineas: LineaVenta[] = [
      {
        productoId: "tubo",
        nombre: "Tubo PVC 1/2",
        referencia: null,
        cantidad: 10,
        subtotal: 1500,
        total: 1770,
        costoUnitario: 90,
      },
      {
        productoId: "tubo",
        nombre: "Tubo PVC 1/2",
        referencia: "TUBO-12",
        cantidad: 5,
        subtotal: 750,
        total: 885,
        costoUnitario: 90,
      },
    ];

    const filas = agruparVentasPorProducto(lineas);

    expect(filas).toHaveLength(1);
    expect(filas[0]).toMatchObject({
      clave: "tubo",
      referencia: "TUBO-12",
      cantidad: 15,
      antes: 225_000,
      despues: 265_500,
    });
  });

  test("agrupa una línea sin producto por descripción normalizada", () => {
    const lineas: LineaVenta[] = [
      {
        productoId: null,
        nombre: " Servicio de corte ",
        referencia: null,
        cantidad: 1,
        subtotal: 500,
        total: 590,
        costoUnitario: null,
      },
      {
        productoId: null,
        nombre: "servicio de corte",
        referencia: "SRV-1",
        cantidad: 1,
        subtotal: 250,
        total: 295,
        costoUnitario: 100,
      },
    ];

    const filas = agruparVentasPorProducto(lineas);

    expect(filas).toHaveLength(1);
    expect(filas[0]).toMatchObject({
      clave: "desc:servicio de corte",
      nombre: "Servicio de corte",
      referencia: "SRV-1",
      cantidad: 2,
      antes: 75_000,
      despues: 88_500,
    });
  });
});

describe("agruparRentabilidad", () => {
  test("calcula costo histórico, rentabilidad y porcentaje por producto", () => {
    const filas = agruparRentabilidad(LINEAS);

    expect(filas.map((fila) => fila.nombre)).toEqual([
      "Varilla 3/8",
      "Cemento gris 42.5kg",
      "Pintura galón",
      "Tubo PVC 1/2",
    ]);
    expect(filas.find((fila) => fila.nombre === "Cemento gris 42.5kg")).toMatchObject({
      totalVendido: 650_000,
      costoTotal: 390_000,
      rentabilidad: 260_000,
      porcentaje: 40,
    });
    expect(filas.find((fila) => fila.nombre === "Varilla 3/8")).toMatchObject({
      totalVendido: 760_000,
      costoTotal: 456_000,
      rentabilidad: 304_000,
      porcentaje: 40,
    });
    expect(filas.find((fila) => fila.nombre === "Tubo PVC 1/2")).toMatchObject({
      totalVendido: 150_000,
      costoTotal: 90_000,
      rentabilidad: 60_000,
      porcentaje: 40,
    });
    expect(filas.find((fila) => fila.nombre === "Pintura galón")).toMatchObject({
      totalVendido: 290_000,
      costoTotal: 174_000,
      rentabilidad: 116_000,
      porcentaje: 40,
    });
    expect(typeof filas.find((fila) => fila.nombre === "Cemento gris 42.5kg")?.porcentaje).toBe("number");
  });

  test("resume los totales de rentabilidad", () => {
    expect(resumirRentabilidad(agruparRentabilidad(LINEAS))).toEqual({
      totalVendido: 1_850_000,
      costoTotal: 1_110_000,
      rentabilidad: 740_000,
    });
  });
});

describe("filtrarVentas", () => {
  const filas = agruparVentasPorProducto(LINEAS);

  test("encuentra por nombre sin importar mayúsculas ni tildes", () => {
    expect(filtrarVentas(filas, "cemento").map((fila) => fila.nombre)).toEqual(["Cemento gris 42.5kg"]);
    expect(filtrarVentas(filas, "galon").map((fila) => fila.nombre)).toEqual(["Pintura galón"]);
  });

  test("encuentra por referencia", () => {
    expect(filtrarVentas(filas, "var-38").map((fila) => fila.nombre)).toEqual(["Varilla 3/8"]);
  });

  test("una búsqueda vacía devuelve todas las filas", () => {
    expect(filtrarVentas(filas, "   ")).toHaveLength(4);
  });
});

describe("paginar", () => {
  const filas = Array.from({ length: 25 }, (_, indice) => indice + 1);

  test("devuelve la página pedida", () => {
    const resultado = paginar(filas, 2, 20);

    expect(resultado.filas).toHaveLength(5);
    expect(resultado.pagina).toBe(2);
    expect(resultado.totalPaginas).toBe(2);
  });

  test("limita la página al rango válido", () => {
    expect(paginar(filas, 99, 20).pagina).toBe(2);
    expect(paginar(filas, 0, 20).pagina).toBe(1);
    expect(paginar(filas, -3, 20).pagina).toBe(1);
  });

  test("una lista vacía conserva una página", () => {
    const resultado = paginar([], 1, 20);

    expect(resultado.filas).toEqual([]);
    expect(resultado.totalPaginas).toBe(1);
  });
});

describe("parámetros de búsqueda y página", () => {
  test("toma el primer valor de q y lo recorta", () => {
    expect(parsearBusqueda({ q: ["  cemento  "] })).toBe("cemento");
    expect(parsearBusqueda({})).toBe("");
  });

  test("convierte pagina a entero positivo", () => {
    expect(parsearPagina({ pagina: "2" })).toBe(2);
    expect(parsearPagina({})).toBe(1);
    expect(parsearPagina({ pagina: "0" })).toBe(1);
    expect(parsearPagina({ pagina: "abc" })).toBe(1);
  });
});
