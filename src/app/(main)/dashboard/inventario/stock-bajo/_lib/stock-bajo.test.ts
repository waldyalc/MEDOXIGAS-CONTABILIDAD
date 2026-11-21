import { describe, expect, test } from "vitest";

import {
  clasificarStock,
  csvStockBajo,
  type FilaStockBajo,
  fechaArchivoRd,
  filtrarStockBajo,
  nombreArchivoStockBajo,
  resumirStock,
} from "./stock-bajo";

function fila(parcial: Partial<FilaStockBajo> & Pick<FilaStockBajo, "nombre" | "cantidad">): FilaStockBajo {
  return {
    producto_id: "00000000-0000-4000-8000-000000000001",
    referencia: null,
    marca: null,
    categoria: null,
    codigos: [],
    ubicacion: null,
    almacen_id: "00000000-0000-4000-8000-000000000002",
    minimo: "5",
    maximo: null,
    faltante: "0",
    sugerido: "0",
    ...parcial,
  };
}

describe("criticidad del stock bajo", () => {
  test("la existencia negativa es crítica y el cero es sin stock", () => {
    expect(clasificarStock({ cantidad: "-2.50" })).toBe("critico");
    expect(clasificarStock({ cantidad: "0" })).toBe("sin-stock");
    expect(clasificarStock({ cantidad: "0.00" })).toBe("sin-stock");
    expect(clasificarStock({ cantidad: "3" })).toBe("bajo");
  });

  test("el resumen reparte las filas sin solaparse", () => {
    const resumen = resumirStock([
      fila({ nombre: "A", cantidad: "-1" }),
      fila({ nombre: "B", cantidad: "0" }),
      fila({ nombre: "C", cantidad: "2" }),
      fila({ nombre: "D", cantidad: "4" }),
    ]);

    expect(resumen).toEqual({ criticos: 1, bajoMinimo: 2, sinStock: 1, total: 4 });
  });
});

describe("búsqueda del listado", () => {
  const filas = [
    fila({ nombre: "Cemento gris 42.5 kg", referencia: "CEM-425", codigos: ["7460001234567"], cantidad: "1" }),
    fila({ nombre: 'Tubería PVC 1/2"', referencia: "PVC-12", codigos: [], cantidad: "0" }),
  ];

  test("sin término devuelve todas las filas", () => {
    expect(filtrarStockBajo(filas, "   ")).toHaveLength(2);
  });

  test("encuentra por nombre sin importar acentos ni mayúsculas", () => {
    expect(filtrarStockBajo(filas, "TUBERIA").map((f) => f.nombre)).toEqual(['Tubería PVC 1/2"']);
  });

  test("encuentra por referencia y por código de barra", () => {
    expect(filtrarStockBajo(filas, "cem-425")[0]?.nombre).toBe("Cemento gris 42.5 kg");
    expect(filtrarStockBajo(filas, "7460001234567")[0]?.nombre).toBe("Cemento gris 42.5 kg");
  });

  test("un término sin coincidencias devuelve vacío", () => {
    expect(filtrarStockBajo(filas, "bloque")).toEqual([]);
  });
});

describe("exportación CSV", () => {
  test("incluye encabezado, situación y escapa comas y comillas", () => {
    const csv = csvStockBajo([
      fila({
        nombre: 'Tubería PVC 1/2", 10 pies',
        referencia: "PVC-12",
        marca: "Duratex",
        categoria: "Plomería",
        cantidad: "0",
        minimo: "5",
        maximo: "20",
        sugerido: "20",
        ubicacion: "Pasillo 3 / Estante B",
      }),
    ]);

    const lineas = csv.trimEnd().split("\r\n");
    expect(lineas[0]).toBe("Producto,Referencia,Marca,Categoría,Existencia,Mínimo,Máximo,Sugerido,Ubicación,Situación");
    expect(lineas[1]).toBe(
      '"Tubería PVC 1/2"", 10 pies",PVC-12,Duratex,Plomería,0,5,20,20,Pasillo 3 / Estante B,Sin stock',
    );
  });

  test("el nombre del archivo no lleva acentos ni espacios", () => {
    expect(nombreArchivoStockBajo("Almacén Principal", "2026-11-20")).toBe(
      "stock-bajo-almacen-principal-2026-11-20.csv",
    );
    expect(nombreArchivoStockBajo("  ", "2026-11-20")).toBe("stock-bajo-almacen-2026-11-20.csv");
  });

  test("la fecha del archivo se toma en hora de RD", () => {
    expect(fechaArchivoRd(new Date("2026-11-21T02:00:00.000Z"))).toBe("2026-11-20");
  });
});
