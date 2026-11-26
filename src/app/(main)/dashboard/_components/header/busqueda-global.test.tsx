import { describe, expect, it } from "vitest";

import { readFileSync } from "node:fs";
import { join } from "node:path";

/**
 * Candado de Waldy (26-11-2026): la barra de búsqueda del topbar copia el
 * diseño exacto de Alegra (32 px de alto, máx. 475 px, fondo blanco, borde
 * slate-200, hover slate-400 sin borde azul y texto «Buscar» sin badges Ctrl K).
 */
describe("barra de búsqueda global estilo Alegra", () => {
  const fuente = readFileSync(
    join(process.cwd(), "src", "app", "(main)", "dashboard", "_components", "header", "busqueda-global.tsx"),
    "utf8",
  );

  it("usa las medidas y colores exactos de Alegra sin borde azul en hover", () => {
    expect(fuente).toContain("h-8");
    expect(fuente).toContain("max-w-[475px]");
    expect(fuente).toContain("rounded-[8px]");
    expect(fuente).toContain("border-slate-200");
    expect(fuente).toContain("bg-white");
    expect(fuente).toContain("hover:border-slate-400");
    expect(fuente).not.toContain("hover:border-ring");
    expect(fuente).not.toMatch(/["\s]bg-slate-100(?=["\s])/);
  });

  it("muestra «Buscar» limpio sin badges Kbd y conserva el atajo ⌘K/Ctrl+K", () => {
    expect(fuente).toContain(">Buscar<");
    expect(fuente).not.toContain("<Kbd");
    expect(fuente).not.toContain("Buscar…");
    expect(fuente).toContain('evento.key.toLowerCase() !== "k"');
  });
});
