import { describe, expect, it } from "vitest";

import { readdirSync, readFileSync } from "node:fs";
import { join, relative, sep } from "node:path";

const SRC = join(process.cwd(), "src");
const UI = join(SRC, "components", "ui");
const RUTAS = [join(SRC, "app"), join(SRC, "components")];

const PENDIENTES = new Set([
  "app/(main)/dashboard/compras/_components/formulario-factura.tsx",
  "app/(main)/dashboard/gastos/nuevo/_components/gasto-form.tsx",
]);

function listar(archivo: string): string[] {
  return readdirSync(archivo, { withFileTypes: true }).flatMap((entrada) => {
    const ruta = join(archivo, entrada.name);
    if (entrada.isDirectory()) return listar(ruta);
    return /\.(tsx|jsx)$/.test(entrada.name) ? [ruta] : [];
  });
}

function rutaRelativa(ruta: string) {
  return relative(SRC, ruta).split(sep).join("/");
}

const ARCHIVOS = RUTAS.flatMap(listar).filter((ruta) => !ruta.startsWith(`${UI}${sep}`));

describe("selects nativos", () => {
  it("no usa <select> fuera de components/ui", () => {
    const infractores = ARCHIVOS.filter((ruta) => /<select[\s>]/.test(readFileSync(ruta, "utf8")));

    expect(infractores.map(rutaRelativa), "Usa SelectCampo o el Select de components/ui/select").toEqual([]);
  });

  it("no usa NativeSelect fuera de components/ui", () => {
    const infractores = ARCHIVOS.filter((ruta) => !PENDIENTES.has(rutaRelativa(ruta))).filter((ruta) =>
      /NativeSelect/.test(readFileSync(ruta, "utf8")),
    );

    expect(infractores.map(rutaRelativa), "Usa SelectCampo o el Select de components/ui/select").toEqual([]);
  });
});
