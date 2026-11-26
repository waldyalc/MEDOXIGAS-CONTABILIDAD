import { describe, expect, it } from "vitest";

import { puedeCerrarResultados } from "./validacion";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const leer = (ruta: string) => readFileSync(join(process.cwd(), ruta), "utf8");

const PANEL = "src/app/(main)/dashboard/contabilidad/periodos/_components/panel-periodos.tsx";

describe("puedeCerrarResultados", () => {
  it("solo deja cerrar años terminados", () => {
    expect(puedeCerrarResultados(2024, 2026)).toBe(true);
    expect(puedeCerrarResultados(2025, 2026)).toBe(true);
  });

  it("rechaza el año en curso y los futuros", () => {
    expect(puedeCerrarResultados(2026, 2026)).toBe(false);
    expect(puedeCerrarResultados(2027, 2026)).toBe(false);
  });
});

describe("panel de periodos y cierre anual", () => {
  it("bloquea el cierre con la regla de años terminados, no con la comparación vieja", () => {
    const panel = leer(PANEL);

    expect(
      panel,
      "El botón «Cerrar resultados del año» debe usar puedeCerrarResultados(datos.anio, datos.anioActual): " +
        "solo se cierran ejercicios terminados.",
    ).toContain("puedeCerrarResultados(datos.anio, datos.anioActual)");

    expect(
      panel,
      "No vuelvas a `datos.anio > datos.anioActual`: dejaba cerrar el año en curso y bloqueaba los años futuros.",
    ).not.toContain("datos.anio > datos.anioActual");
  });

  it("dice en pantalla que el cierre también marca los 12 meses", () => {
    expect(leer(PANEL), "El aviso del cierre anual debe explicar que cierra los 12 meses del año").toContain(
      "cierra los 12 meses del año",
    );
  });

  it("avisa que el año en curso se cierra cuando termine", () => {
    expect(leer(PANEL)).toContain("El año en curso se podrá cerrar cuando termine.");
  });
});
