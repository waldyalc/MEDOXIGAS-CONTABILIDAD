import { describe, expect, test } from "vitest";

import { readFileSync } from "node:fs";
import { join } from "node:path";

const CONSULTAS = [
  "src/lib/cotizaciones/consultas.ts",
  "src/lib/gastos/consultas.ts",
  "src/lib/ordenes-compra/consultas.ts",
  "src/lib/facturas-recurrentes/consultas.ts",
  "src/lib/activos-fijos/consultas.ts",
  "src/lib/compras/notas-credito/consultas.ts",
];

function leer(ruta: string): string {
  return readFileSync(join(process.cwd(), ruta), "utf8");
}

describe("listas sin topes silenciosos", () => {
  test.each(CONSULTAS)("%s pagina en el servidor con el total real", (ruta) => {
    const codigo = leer(ruta);

    expect(codigo, "Quita el .limit(300/500) y pagina con rangoPagina/resumirPagina").not.toMatch(
      /\.limit\((300|500)\)/,
    );
    expect(codigo).toMatch(/count:\s*"exact"/);
    expect(codigo).toMatch(/resumirPagina/);
  });
});
