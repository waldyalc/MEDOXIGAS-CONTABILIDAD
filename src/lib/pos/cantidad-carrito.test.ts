import { describe, expect, it } from "vitest";

import { formatoCantidad } from "@/lib/facturacion/formato";
import { normalizarCantidad } from "@/lib/pos/calculo";

import { readFileSync } from "node:fs";
import { join } from "node:path";

const RAIZ = process.cwd();
const LINEA = join(RAIZ, "src", "app", "(pos)", "pos", "_components", "vender", "linea-carrito-pos.tsx");

/**
 * Candado de la cantidad del carrito POS (decisión de Waldy, 23-11-2026):
 * se ve como Alegra. Un entero es «3», nunca «3.00»; los decimales solo
 * aparecen si la cantidad los tiene («1.5»), y mientras no se edita es texto
 * plano, no una cajita con borde.
 */
describe("cantidad del carrito POS", () => {
  it("muestra un entero sin decimales y conserva los decimales reales", () => {
    expect(formatoCantidad("3.00"), "«3.00» debe mostrarse como «3», como Alegra").toBe("3");
    expect(formatoCantidad("1.50"), "«1.50» debe mostrarse como «1.5»").toBe("1.5");
    expect(formatoCantidad("1.25"), "«1.25» conserva sus dos decimales").toBe("1.25");
    expect(formatoCantidad("1000.00"), "Los miles llevan separador es-DO").toBe("1,000");
  });

  it("normaliza lo que se guarda en el carrito sin forzar dos decimales", () => {
    expect(normalizarCantidad("3.00"), "El carrito no debe arrastrar «3.00»").toBe("3");
    expect(normalizarCantidad("1.50"), "Los medios se guardan como «1.5»").toBe("1.5");
    expect(normalizarCantidad("1.25"), "Los centavos reales se conservan").toBe("1.25");
    expect(normalizarCantidad("0.50"), "Sin cero final de más").toBe("0.5");
    expect(normalizarCantidad("0.05"), "El cero intermedio no se pierde").toBe("0.05");
    expect(normalizarCantidad("1000.00"), "Los enteros grandes van sin decimales").toBe("1000");
    expect(normalizarCantidad(null), "Una cantidad ausente cuenta como cero").toBe("0");
  });

  it("la línea del carrito usa formatoCantidad al mostrarse y normaliza al guardar", () => {
    const fuente = readFileSync(LINEA, "utf8");

    expect(
      fuente,
      "El estado no editable debe mostrar formatoCantidad(linea.cantidad); así un entero se ve «3» y no «3.00».",
    ).toContain("formatoCantidad(linea.cantidad)");
    expect(
      fuente,
      "Al guardar y al usar −/+ pasa la cantidad por normalizarCantidad() para no volver a «3.00».",
    ).toContain("normalizarCantidad(");
    expect(
      fuente,
      "No vuelvas a mostrar value={linea.cantidad}: el input de edición usa la cantidad normalizada y el texto plano usa formatoCantidad.",
    ).not.toContain("value={linea.cantidad}");
    expect(
      fuente,
      "No vuelvas a toFixed(2) en la cantidad: los pasos −/+ guardan «3», «1.5», etc., sin forzar dos decimales.",
    ).not.toContain("toFixed(2)");

    const etiquetas = fuente.match(/aria-label=\{`Cantidad de \$\{linea\.descripcion\}`\}/g) ?? [];
    expect(
      etiquetas.length,
      "El número y el input de edición deben conservar aria-label «Cantidad de <descripción>».",
    ).toBeGreaterThanOrEqual(2);
  });
});
