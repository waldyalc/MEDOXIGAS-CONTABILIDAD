import { describe, expect, it } from "vitest";

import { paginarConsulta } from "./paginar";

type Respuesta<T> = { data: T[] | null; error: { message: string } | null };

function consultaFalsa(filas: number[], fallos = new Map<number, string>()) {
  const llamadas: Array<[number, number]> = [];
  const ejecutar = (desde: number, hasta: number): Promise<Respuesta<number>> => {
    llamadas.push([desde, hasta]);
    const fallo = fallos.get(llamadas.length);
    return Promise.resolve(
      fallo == null ? { data: filas.slice(desde, hasta + 1), error: null } : { data: null, error: { message: fallo } },
    );
  };
  return { llamadas, ejecutar };
}

describe("paginarConsulta", () => {
  it("devuelve todo en un solo viaje cuando el lote sale corto", async () => {
    const { llamadas, ejecutar } = consultaFalsa(Array.from({ length: 500 }, (_, i) => i));
    const { data, error } = await paginarConsulta(ejecutar);
    expect(error).toBeNull();
    expect(data).toHaveLength(500);
    expect(llamadas).toEqual([[0, 999]]);
  });

  it("itera por lotes de 1,000 hasta que un lote sale corto", async () => {
    const { llamadas, ejecutar } = consultaFalsa(Array.from({ length: 2500 }, (_, i) => i));
    const { data, error } = await paginarConsulta(ejecutar);
    expect(error).toBeNull();
    expect(data).toHaveLength(2500);
    expect(data?.[0]).toBe(0);
    expect(data?.[2499]).toBe(2499);
    expect(llamadas).toEqual([
      [0, 999],
      [1000, 1999],
      [2000, 2999],
    ]);
  });

  it("hace un viaje extra cuando el total es múltiplo exacto de 1,000", async () => {
    const { llamadas, ejecutar } = consultaFalsa(Array.from({ length: 2000 }, (_, i) => i));
    const { data, error } = await paginarConsulta(ejecutar);
    expect(error).toBeNull();
    expect(data).toHaveLength(2000);
    expect(llamadas).toHaveLength(3);
  });

  it("propaga el error y detiene la iteración", async () => {
    const { llamadas, ejecutar } = consultaFalsa(
      Array.from({ length: 5000 }, (_, i) => i),
      new Map([[2, "boom"]]),
    );
    const { data, error } = await paginarConsulta(ejecutar);
    expect(data).toBeNull();
    expect(error?.message).toBe("boom");
    expect(llamadas).toHaveLength(2);
  });

  it("resultado vacío: un solo viaje y lista vacía", async () => {
    const { llamadas, ejecutar } = consultaFalsa([]);
    const { data, error } = await paginarConsulta(ejecutar);
    expect(error).toBeNull();
    expect(data).toEqual([]);
    expect(llamadas).toHaveLength(1);
  });
});
