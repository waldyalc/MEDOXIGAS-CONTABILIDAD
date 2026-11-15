import { describe, expect, it } from "vitest";

import { readdirSync, readFileSync } from "node:fs";
import { join, relative, sep } from "node:path";

const SRC = join(process.cwd(), "src");

function listar(archivo: string): string[] {
  return readdirSync(archivo, { withFileTypes: true }).flatMap((entrada) => {
    const ruta = join(archivo, entrada.name);
    if (entrada.isDirectory()) return listar(ruta);
    return /\.(ts|tsx)$/.test(entrada.name) && !/\.test\.tsx?$/.test(entrada.name) ? [ruta] : [];
  });
}

function rutaRelativa(ruta: string) {
  return relative(SRC, ruta).split(sep).join("/");
}

const ARCHIVOS = listar(SRC).filter((ruta) => !ruta.endsWith(join("supabase", "types.ts")));

describe("rpc sin extraer", () => {
  it("nadie guarda supabase.rpc en una variable ni lo convierte con as", () => {
    const infractores = ARCHIVOS.filter((ruta) => {
      const texto = readFileSync(ruta, "utf8");
      return /=\s*\w+\.rpc\s*[;\n\r]/.test(texto) || /\.rpc\s+as\b/.test(texto);
    });

    expect(
      infractores.map(rutaRelativa),
      'Llama supabase.rpc("nombre", args) directo: las RPC están tipadas en src/lib/supabase/types.ts. ' +
        "Extraer el método a una variable desvincula this y rompe la pantalla con TypeError (reading 'rest').",
    ).toEqual([]);
  });
});
