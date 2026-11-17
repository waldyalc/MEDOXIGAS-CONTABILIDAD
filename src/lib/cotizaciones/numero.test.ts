import { describe, expect, test } from "vitest";

import { previsualizarNumero } from "./numero";

describe("próximo número de cotizaciones y conduces", () => {
  test("empieza en 1 cuando todavía no hay documentos", () => {
    expect(previsualizarNumero(null)).toEqual({ estado: "lista", numero: 1 });
    expect(previsualizarNumero(undefined)).toEqual({ estado: "lista", numero: 1 });
  });

  test("muestra el último número guardado más uno, como la secuencia de la tabla", () => {
    expect(previsualizarNumero(12)).toEqual({ estado: "lista", numero: 13 });
  });

  test("no consume ni modifica la numeración", () => {
    const ultimo = 12;

    expect(previsualizarNumero(ultimo)).toEqual({ estado: "lista", numero: 13 });
    expect(previsualizarNumero(ultimo)).toEqual({ estado: "lista", numero: 13 });
    expect(ultimo).toBe(12);
  });

  test("avisa cuando ya no cabe otro número entero", () => {
    expect(previsualizarNumero(2_147_483_647)).toEqual({
      estado: "no-disponible",
      mensaje: "La numeración llegó a su número máximo.",
    });
  });
});
