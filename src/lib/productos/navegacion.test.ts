import { describe, expect, it } from "vitest";

import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

const RAIZ = join(process.cwd(), "src", "app", "(main)", "dashboard", "productos");
const CLIENTE = join(RAIZ, "_components", "productos-cliente.tsx");

const AYUDA =
  "El alta de producto es una pantalla completa en /dashboard/productos/nuevo. " +
  "La lista y el vacío deben enlazar con rutaNuevoProducto(); no vuelvas a abrir el diálogo viejo.";

describe("nuevo producto en pantalla completa", () => {
  it("la lista y el vacío navegan a /dashboard/productos/nuevo", () => {
    const texto = readFileSync(CLIENTE, "utf8");
    const enlaces = texto.match(/rutaNuevoProducto\(\)/g)?.length ?? 0;

    expect(enlaces, AYUDA).toBeGreaterThanOrEqual(2);
    expect(texto, AYUDA).not.toMatch(/ProductoDialogo/);
    expect(texto, "La lista usa EncabezadoPagina, no un h1 text-3xl.").not.toMatch(/text-3xl/);
  });

  it("existe la página /dashboard/productos/nuevo", () => {
    expect(existsSync(join(RAIZ, "nuevo", "page.tsx"))).toBe(true);
  });
});
