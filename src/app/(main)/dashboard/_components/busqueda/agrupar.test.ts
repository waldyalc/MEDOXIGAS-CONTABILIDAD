import { describe, expect, test } from "vitest";

import { agrupar, claveResultado, grupoDeEntidad, ORDEN_GRUPOS, type ResultadoBusqueda } from "./agrupar";

function resultado(parcial: Partial<ResultadoBusqueda> & Pick<ResultadoBusqueda, "entidad" | "id">): ResultadoBusqueda {
  return {
    titulo: "Título",
    subtitulo: "",
    etiquetas: [],
    estado: null,
    fecha: null,
    monto: null,
    rango: 3,
    ...parcial,
  };
}

describe("agrupar resultados de la búsqueda global", () => {
  test("respeta el orden fijo del rail aunque los resultados lleguen desordenados", () => {
    const grupos = agrupar([
      resultado({ entidad: "asiento", id: "a1" }),
      resultado({ entidad: "contacto", id: "c1" }),
      resultado({ entidad: "gasto_menor", id: "g1" }),
      resultado({ entidad: "factura", id: "f1" }),
    ]);

    expect(grupos.map((grupo) => grupo.grupo)).toEqual(["clientes", "facturacion", "compras", "otros"]);
  });

  test("el orden del rail coincide con las 6 categorías de la spec", () => {
    expect([...ORDEN_GRUPOS]).toEqual(["clientes", "productos", "facturacion", "compras", "documentos", "otros"]);
  });

  test("los grupos vacíos no se pintan", () => {
    const grupos = agrupar([resultado({ entidad: "contacto", id: "c1" })]);

    expect(grupos).toHaveLength(1);
    expect(grupos[0]?.grupo).toBe("clientes");
  });

  test("deduplica por (entidad, id) conservando la primera aparición", () => {
    const primera = resultado({ entidad: "factura", id: "f1", titulo: "La que llegó primero", rango: 1 });
    const repetida = resultado({ entidad: "factura", id: "f1", titulo: "La repetida", rango: 1 });
    const grupos = agrupar([primera, repetida]);

    expect(grupos[0]?.total).toBe(1);
    expect(grupos[0]?.resultados[0]?.titulo).toBe("La que llegó primero");
  });

  test("conserva la misma id en entidades distintas (factura y su nota)", () => {
    const grupos = agrupar([
      resultado({ entidad: "factura", id: "mismo-id" }),
      resultado({ entidad: "nota_credito_venta", id: "mismo-id" }),
    ]);

    expect(grupos.map((grupo) => grupo.grupo)).toEqual(["facturacion"]);
    expect(grupos[0]?.total).toBe(2);
  });

  test("limita a 4 tarjetas por grupo en modo todos y conserva el total real", () => {
    const grupos = agrupar([
      resultado({ entidad: "factura", id: "f1" }),
      resultado({ entidad: "factura", id: "f2" }),
      resultado({ entidad: "factura", id: "f3" }),
      resultado({ entidad: "factura", id: "f4" }),
      resultado({ entidad: "factura", id: "f5" }),
      resultado({ entidad: "factura", id: "f6" }),
    ]);

    expect(grupos[0]?.resultados).toHaveLength(4);
    expect(grupos[0]?.total).toBe(6);
  });

  test("respeta un límite mayor para la categoría fijada (20) y el tope mínimo de 1", () => {
    const facturas = Array.from({ length: 6 }, (_, i) => resultado({ entidad: "factura", id: `f${i}` }));

    expect(agrupar(facturas, { limitePorGrupo: 20 })[0]?.resultados).toHaveLength(6);
    expect(agrupar(facturas, { limitePorGrupo: 0 })[0]?.resultados).toHaveLength(1);
  });

  test("ordena dentro del grupo por rango y luego por fecha descendente", () => {
    const grupos = agrupar([
      resultado({ entidad: "factura", id: "rango2-nueva", rango: 2, fecha: "2026-11-01" }),
      resultado({ entidad: "factura", id: "rango1-vieja", rango: 1, fecha: "2026-01-05" }),
      resultado({ entidad: "factura", id: "rango1-nueva", rango: 1, fecha: "2026-10-12" }),
      resultado({ entidad: "factura", id: "rango2-sin-fecha", rango: 2, fecha: null }),
    ]);

    expect(grupos[0]?.resultados.map((r) => r.id)).toEqual([
      "rango1-nueva",
      "rango1-vieja",
      "rango2-nueva",
      "rango2-sin-fecha",
    ]);
  });

  test("mapea cada entidad al grupo del rail que define la spec", () => {
    expect(grupoDeEntidad("contacto")).toBe("clientes");
    expect(grupoDeEntidad("pago_recibido")).toBe("facturacion");
    expect(grupoDeEntidad("nota_credito_compra")).toBe("compras");
    expect(grupoDeEntidad("reporte")).toBe("otros");
    expect(grupoDeEntidad("documento")).toBe("documentos");
  });

  test("la clave de dedupe separa entidades con la misma id", () => {
    expect(claveResultado({ entidad: "factura", id: "42" })).toBe("factura:42");
    expect(claveResultado({ entidad: "pago_recibido", id: "42" })).not.toBe(
      claveResultado({ entidad: "factura", id: "42" }),
    );
  });
});
