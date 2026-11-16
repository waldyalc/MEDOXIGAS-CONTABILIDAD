import { describe, expect, test } from "vitest";

import { readFileSync } from "node:fs";
import { join } from "node:path";

/**
 * Candado: PostgREST corta cada consulta en ~1,000 filas (también .rpc()).
 * Estas consultas alimentan reportes fiscales, contables, bancos, fichas y
 * selectores de documentos: si vuelven a leer sin paginar, los totales salen
 * incompletos en silencio. Usa paginarConsulta (lotes de 1,000) o joins.
 */
const PAGINADAS = [
  "src/lib/reportes/fiscales/consultas.ts",
  "src/lib/reportes/fiscales/retenciones-consultas.ts",
  "src/lib/reportes/libros/consultas.ts",
  "src/lib/reportes/consultas.ts",
  "src/lib/reportes/administrativos/d/consultas.ts",
  "src/lib/contactos/ficha-consultas.ts",
  "src/lib/contactos/estado-cuenta-consultas.ts",
  "src/lib/bancos/consultas.ts",
  "src/lib/facturacion/consultas.ts",
  "src/lib/compras/consultas.ts",
  "src/lib/ordenes-compra/consultas.ts",
  "src/lib/inventario/consultas.ts",
  "src/lib/pagos-recurrentes/consultas.ts",
  "src/lib/reportes/ventas/v3/consultas.ts",
];

function leer(ruta: string): string {
  return readFileSync(join(process.cwd(), ruta), "utf8");
}

describe("consultas sin corte silencioso de 1,000 filas", () => {
  test.each(PAGINADAS)("%s pagina o usa lotes", (ruta) => {
    const codigo = leer(ruta);

    expect(
      codigo,
      `Lee en lotes con paginarConsulta/consultarEnLotes en vez de quedarte con la primera página de PostgREST (${ruta})`,
    ).toMatch(/paginarConsulta|consultarEnLotes/);
    expect(codigo, `Quita el tope fijo y pagina el servidor (${ruta})`).not.toMatch(/\.limit\((300|500|1000)\)/);
  });

  test("las líneas de venta por producto no se cortan en 20,000", () => {
    const codigo = leer("src/lib/reportes/ventas/v2/consultas.ts");

    expect(
      codigo,
      "Ventas/rentabilidad por producto debe leer hasta que un lote salga corto, sin MAXIMO_LINEAS",
    ).not.toMatch(/MAXIMO_LINEAS/);
    expect(codigo).toMatch(/if \(filas\.length < TAMANO_PAGINA\) break;/);
  });
});
