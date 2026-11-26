import { describe, expect, it } from "vitest";

import { existsSync, readFileSync } from "node:fs";

const fuente = readFileSync(new URL("./page.tsx", import.meta.url), "utf8");

describe("Estado de resultados sin Resumen Beta", () => {
  it("no renderiza ni importa la tarjeta de resumen IA", () => {
    expect(fuente).not.toMatch(/ResumenEstado|resumen-estado|generarResumenResultados|Beta|¿Te pareció útil\?/);
    expect(existsSync("src/app/(main)/dashboard/reportes/estado-resultados/_components/resumen-estado.tsx")).toBe(
      false,
    );
    expect(existsSync("src/lib/reportes/estados/resumen.ts")).toBe(false);
    expect(existsSync("src/lib/reportes/estados/resumen.test.ts")).toBe(false);
  });

  it("usa la tabla comparativa con la primera cabecera vacía y su barra interna", () => {
    expect(fuente).toContain('rotuloCuenta=""');
    expect(fuente).toContain("encabezado={{");
    expect(fuente).toContain("expandible");
  });
});
