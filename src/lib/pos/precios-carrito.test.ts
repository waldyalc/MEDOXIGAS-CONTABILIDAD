import { describe, expect, it } from "vitest";

import { type LineaPreciosPOS, preciosDeListaALineas } from "./precios-carrito";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const CHECKOUT = join(process.cwd(), "src", "app", "(pos)", "pos", "_components", "vender", "checkout-pos.tsx");

function linea(parcial: Partial<LineaPreciosPOS>): LineaPreciosPOS {
  return {
    productoId: "p-1",
    unidadId: null,
    precio: "100",
    precioBase: "100",
    precioManual: false,
    unidades: [],
    ...parcial,
  };
}

describe("preciosDeListaALineas (cambio de lista de precios)", () => {
  it("la unidad base toma el precio de la lista nueva", () => {
    const [resultado] = preciosDeListaALineas([linea({})], [{ producto_id: "p-1", precio: "80", unidades: [] }]);
    expect(resultado?.precio).toBe("80");
    expect(resultado?.precioBase).toBe("80");
  });

  it("una línea en unidad alterna toma el precio de su unidad, no el de la base", () => {
    const [resultado] = preciosDeListaALineas(
      [
        linea({
          unidadId: "u-caja",
          precio: "900",
          unidades: [{ id: "u-caja", nombre: "Caja", factor_base: "10", precio: "900" }],
        }),
      ],
      [
        {
          producto_id: "p-1",
          precio: "80",
          unidades: [{ id: "u-caja", nombre: "Caja", factor_base: "10", precio: "800" }],
        },
      ],
    );
    expect(resultado?.precio).toBe("800");
    // Y las unidades embebidas se refrescan: el selector ofrece precios de la lista nueva.
    expect(resultado?.unidades[0]?.precio).toBe("800");
  });

  it("no toca el precio manual ni líneas de productos que el catálogo no trajo", () => {
    const [manual, ajena] = preciosDeListaALineas(
      [linea({ precioManual: true, precio: "55" }), linea({ productoId: "p-2", precio: "10" })],
      [{ producto_id: "p-1", precio: "80", unidades: [] }],
    );
    expect(manual?.precio).toBe("55");
    expect(ajena?.precio).toBe("10");
  });
});

describe("precio de la línea al cobrar", () => {
  it("solo se envía cuando es manual: el resto lo resuelve la RPC con la lista vigente", () => {
    const checkout = readFileSync(CHECKOUT, "utf8");
    // `pos_completar_venta` resuelve precio ausente con `_precio_lista`: así un
    // producto fuera de la página cargada (o una lista recién cambiada) no
    // cobra el precio viejo que mostraba el catálogo.
    expect(
      checkout,
      "En `lineasPayload` el precio solo viaja si `precioManual` es true; si no, queda `undefined` y `_precio_lista` lo resuelve en el servidor.",
    ).toContain("precio: linea.precioManual ? linea.precio : undefined");
  });
});
