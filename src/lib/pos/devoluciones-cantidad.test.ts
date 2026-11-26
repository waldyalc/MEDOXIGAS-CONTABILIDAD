import { describe, expect, it } from "vitest";

import { readFileSync } from "node:fs";
import { join } from "node:path";

const WIZARD = readFileSync(
  join(process.cwd(), "src", "app", "(pos)", "pos", "_components", "devoluciones", "wizard-devolucion.tsx"),
  "utf8",
);

/**
 * Candado (auditoría POS, 24-11-2026): el input de cantidad a devolver muestra
 * el texto crudo que escribe el cajero. Con el monto ya formateado
 * (`textoAMonto`) no se podía escribir «12» ni borrar el «0.00» inicial:
 * cada tecla re-renderizaba el valor formateado encima del texto.
 */
describe("cantidad a devolver: el input conserva el texto crudo", () => {
  it("el value es el texto del estado, no la cantidad ya formateada", () => {
    expect(WIZARD, "El input enlaza el texto crudo `cantidades[linea.id]`, que sí admite edición libre").toContain(
      'value={cantidades[linea.id] ?? ""}',
    );
    expect(WIZARD, "`value={cantidad}` mostraba el monto formateado a 2 decimales y rompía la escritura").not.toContain(
      "value={cantidad}",
    );
  });
});
