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

const PATRONES = [
  { nombre: "tipo RpcSuelta", patron: /\bRpcSuelta\b/ },
  { nombre: "cast rpc as", patron: /\.rpc\s+as\b/ },
  { nombre: "asignación supabase.rpc", patron: /=\s*\w+\.rpc\s*[;\n\r]/ },
  { nombre: "desestructuración rpc", patron: /\{[^}]*\brpc\b[^}]*\}\s*=\s*\w+/ },
] as const;

function infracciones(texto: string): string[] {
  return PATRONES.filter(({ patron }) => patron.test(texto)).map(({ nombre }) => nombre);
}

const AYUDA =
  'Llama supabase.rpc("nombre", args) directo: las RPC están tipadas en src/lib/supabase/types.ts. ' +
  "Extraer el método a una variable (con as, RpcSuelta o desestructurando) desvincula this y rompe la " +
  "pantalla con TypeError (reading 'rest').";

describe("rpc sin extraer", () => {
  it("detecta el patrón que rompió reportes y numeraciones", () => {
    expect(infracciones("const rpc = supabase.rpc as unknown as RpcSuelta;")).toContain("tipo RpcSuelta");
    expect(infracciones("const rpc = supabase.rpc as unknown as RpcSuelta;")).toContain("cast rpc as");
    expect(infracciones("const rpc = supabase.rpc;")).toContain("asignación supabase.rpc");
    expect(infracciones("const { rpc } = supabase;")).toContain("desestructuración rpc");
    expect(infracciones('await supabase.rpc("reporte_movimientos", args)')).toEqual([]);
  });

  it("nadie guarda supabase.rpc en una variable ni lo convierte con as", () => {
    const infractores = ARCHIVOS.flatMap((ruta) =>
      infracciones(readFileSync(ruta, "utf8")).map((patron) => `${rutaRelativa(ruta)} (${patron})`),
    );

    expect(infractores, AYUDA).toEqual([]);
  });
});
