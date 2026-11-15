import { describe, expect, it } from "vitest";

import { consultarEnLotes } from "./lotes";

describe("consultarEnLotes", () => {
  it("parte en lotes de 200 y concatena en orden", async () => {
    const ids = Array.from({ length: 450 }, (_, i) => `id-${i}`);
    const vistos: number[] = [];
    const { data, error } = await consultarEnLotes(ids, (lote) => {
      vistos.push(lote.length);
      return Promise.resolve({ data: lote.map((id) => id.length), error: null });
    });
    expect(error).toBeNull();
    expect(vistos).toEqual([200, 200, 50]);
    expect(data).toHaveLength(450);
  });

  it("propaga el error y detiene los lotes", async () => {
    const ids = Array.from({ length: 500 }, (_, i) => `id-${i}`);
    let llamadas = 0;
    const { data, error } = await consultarEnLotes(ids, () => {
      llamadas += 1;
      return Promise.resolve(llamadas === 2 ? { data: null, error: { message: "boom" } } : { data: [1], error: null });
    });
    expect(data).toBeNull();
    expect(error?.message).toBe("boom");
    expect(llamadas).toBe(2);
  });

  it("lista vacía: cero consultas y lista vacía", async () => {
    const { data, error } = await consultarEnLotes([], () => {
      throw new Error("no debe llamarse");
    });
    expect(error).toBeNull();
    expect(data).toEqual([]);
  });
});
