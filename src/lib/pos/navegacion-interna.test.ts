import { beforeEach, describe, expect, it } from "vitest";

import { esNavegacionInternaPos, limpiarNavegacionInternaPos, marcarNavegacionInternaPos } from "./navegacion-interna";

describe("navegación interna del POS", () => {
  beforeEach(() => {
    limpiarNavegacionInternaPos();
  });

  it("sin una marca reciente no hay navegación interna", () => {
    expect(esNavegacionInternaPos(1_000)).toBe(false);
  });

  it("la marca protege exactamente durante dos segundos", () => {
    marcarNavegacionInternaPos(1_000);

    expect(esNavegacionInternaPos(1_000)).toBe(true);
    expect(esNavegacionInternaPos(2_999)).toBe(true);
    expect(esNavegacionInternaPos(3_000)).toBe(true);
    expect(esNavegacionInternaPos(3_001)).toBe(false);
  });

  it("una nueva marca extiende la ventana desde el último clic", () => {
    marcarNavegacionInternaPos(1_000);
    marcarNavegacionInternaPos(2_500);

    expect(esNavegacionInternaPos(4_500)).toBe(true);
    expect(esNavegacionInternaPos(4_501)).toBe(false);
  });

  it("limpiar elimina la marca antes de que expire", () => {
    marcarNavegacionInternaPos(1_000);
    limpiarNavegacionInternaPos();

    expect(esNavegacionInternaPos(1_500)).toBe(false);
  });
});
