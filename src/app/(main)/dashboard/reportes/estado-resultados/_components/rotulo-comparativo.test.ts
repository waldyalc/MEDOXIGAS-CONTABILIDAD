import { describe, expect, it } from "vitest";

import { rotuloComparativo } from "./rotulo-comparativo";

describe("rotuloComparativo", () => {
  it("reproduce el encabezado de un mes natural completo", () => {
    expect(rotuloComparativo("2026-11-01", "2026-11-30")).toBe("Del 1 al 30 de noviembre: Comparativo 2026 - 2025");
  });

  it("lee el rango parcial dentro del mismo mes", () => {
    expect(rotuloComparativo("2026-11-05", "2026-11-19")).toBe("Del 5 al 19 de noviembre: Comparativo 2026 - 2025");
  });

  it("nombra los dos meses cuando el rango los cruza", () => {
    expect(rotuloComparativo("2026-10-28", "2026-11-03")).toBe(
      "Del 28 de octubre al 3 de noviembre: Comparativo 2026 - 2025",
    );
  });

  it("incluye los años cuando el rango cruza de año", () => {
    expect(rotuloComparativo("2025-12-15", "2026-01-15")).toBe(
      "Del 15 de diciembre de 2025 al 15 de enero de 2026: Comparativo 2026 - 2025",
    );
  });
});
