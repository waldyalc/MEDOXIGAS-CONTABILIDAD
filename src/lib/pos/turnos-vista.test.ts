import { describe, expect, it } from "vitest";

import { readFileSync } from "node:fs";
import { join } from "node:path";

const TURNOS = readFileSync(
  join(process.cwd(), "src", "app", "(pos)", "pos", "_components", "turnos", "turnos-pos.tsx"),
  "utf8",
);

/**
 * Candado (auditoría POS, 24-11-2026): `useState(vistaInicial)` solo copia el
 * valor en el primer render. Tras «Reintentar» o un `router.refresh()` la
 * pantalla seguía mostrando el resumen viejo (o null) aunque el servidor ya
 * hubiera mandado datos nuevos.
 */
describe("resumen de turno tras «Reintentar» o refresh", () => {
  it("vista se sincroniza con vistaInicial cuando el servidor reenvía datos", () => {
    expect(TURNOS, "El resumen del servidor tiene que entrar a `vista` tras cada refresh").toContain(
      "setVista(vistaInicial)",
    );
    expect(TURNOS, "La sincronía va en un useEffect que depende de vistaInicial").toContain("[vistaInicial]");
  });
});
