import { describe, expect, test, vi } from "vitest";

vi.mock("@/lib/supabase/server", () => ({ createClient: vi.fn() }));

const { normalizarRol } = await import("./rol");

describe("normalizarRol", () => {
  test("acepta admin, contador y lector", () => {
    expect(normalizarRol("admin")).toBe("admin");
    expect(normalizarRol("contador")).toBe("contador");
    expect(normalizarRol("lector")).toBe("lector");
  });

  test("rechaza valores desconocidos o vacíos", () => {
    for (const valor of [null, undefined, "", "supervisor", "ventas", "Admin", " admin ", "CONTADOR"]) {
      expect(normalizarRol(valor)).toBeNull();
    }
  });
});
