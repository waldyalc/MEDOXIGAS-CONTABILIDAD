import { describe, expect, it, vi } from "vitest";

import { readFileSync } from "node:fs";
import { join } from "node:path";

const mocks = vi.hoisted(() => ({ createClient: vi.fn() }));
vi.mock("@/lib/supabase/server", () => ({ createClient: mocks.createClient }));

const { buscarContactoDuplicado } = await import("./buscar-duplicado");

interface RespuestaMock {
  data: unknown;
  error: unknown;
}

/** Cadena mínima de PostgREST: los filtros devuelven el mismo builder y `.limit()` resuelve. */
function cadena(respuesta: RespuestaMock) {
  const builder: Record<string, unknown> = {};
  for (const metodo of ["select", "eq", "or", "order", "ilike"]) {
    builder[metodo] = vi.fn(() => builder);
  }
  builder.limit = vi.fn().mockResolvedValue(respuesta);
  return builder;
}

describe("buscarContactoDuplicado", () => {
  it("el filtro .ilike() del RNC usa comodines sin comillas literales", async () => {
    const builder = cadena({ data: [], error: null });
    mocks.createClient.mockResolvedValue({ from: vi.fn(() => builder) });

    await buscarContactoDuplicado({ nombre: "JUAN PEREZ", rnc_cedula: "131-48879-1" });

    // `%` entre dígitos encuentra el RNC guardado con o sin guiones; si el
    // patrón viniera entre comillas ("%…%") PostgREST buscaría las comillas
    // como caracteres literales y nunca detectaría el duplicado.
    expect(builder.ilike).toHaveBeenCalledWith("rnc_cedula", "%1%3%1%4%8%8%7%9%1%");
  });

  it("un RNC vacío no dispara la búsqueda por identificación", async () => {
    const builder = cadena({ data: [], error: null });
    mocks.createClient.mockResolvedValue({ from: vi.fn(() => builder) });

    await buscarContactoDuplicado({ nombre: "JUAN PEREZ", rnc_cedula: null });

    expect(builder.ilike).not.toHaveBeenCalled();
  });

  it("el patrón de .ilike() directo nunca es el de .or() (entre comillas)", () => {
    const fuente = readFileSync(join(process.cwd(), "src/lib/contactos/buscar-duplicado.ts"), "utf8");
    // `patronIlike` envuelve en comillas porque es para `.or()`; en `.ilike()`
    // directo va `patronContiene`. Este candado fija esa diferencia.
    expect(fuente).toContain("patronContiene(rnc.split");
    expect(fuente).not.toContain("patronIlike(rnc.split");
  });
});
