import { describe, expect, it } from "vitest";

import { puedeAnularDocumento } from "./anulacion";

describe("puedeAnularDocumento", () => {
  it("permite anular a admin y contador mientras el documento esté activo", () => {
    expect(puedeAnularDocumento("admin", "activo")).toBe(true);
    expect(puedeAnularDocumento("contador", "activo")).toBe(true);
  });

  it("niega al lector, a quien no tiene sesión y a los documentos ya anulados", () => {
    expect(puedeAnularDocumento("lector", "activo")).toBe(false);
    expect(puedeAnularDocumento(null, "activo")).toBe(false);
    expect(puedeAnularDocumento("admin", "anulado")).toBe(false);
    expect(puedeAnularDocumento("contador", "anulado")).toBe(false);
  });
});
