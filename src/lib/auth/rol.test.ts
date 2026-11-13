import { describe, expect, test, vi } from "vitest";

vi.mock("@/lib/supabase/server", () => ({ createClient: vi.fn() }));

const { normalizarRol } = await import("./rol");

describe("normalizarRol", () => {
  test("acepta admin, caja y cobros", () => {
    expect(normalizarRol("admin")).toBe("admin");
    expect(normalizarRol("caja")).toBe("caja");
    expect(normalizarRol("cobros")).toBe("cobros");
  });

  test("rechaza valores desconocidos o vacíos", () => {
    for (const valor of [null, undefined, "", "lector", "Cobros", " admin "]) {
      expect(normalizarRol(valor)).toBeNull();
    }
  });
});
