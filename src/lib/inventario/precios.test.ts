import { describe, expect, test } from "vitest";

import { etiquetaTipoLista, precioListaCentavos, precioSugeridoCentavos } from "./precios";

const listas = [
  { id: "fija", tipo: "fijo" as const },
  { id: "porcentaje", tipo: "porcentaje" as const },
];

describe("precio por lista", () => {
  test("la lista fija usa el valor guardado", () => {
    expect(precioListaCentavos(65_000, "fijo", 700)).toBe(70_000);
  });

  test("el porcentaje positivo sube el precio base", () => {
    expect(precioListaCentavos(65_000, "porcentaje", 10)).toBe(71_500);
  });

  test("el porcentaje negativo baja el precio base", () => {
    expect(precioListaCentavos(65_000, "porcentaje", -10)).toBe(58_500);
  });

  test("no deja precios negativos", () => {
    expect(precioListaCentavos(65_000, "porcentaje", -150)).toBe(0);
  });

  test("sin lista o sin precio configurado usa el precio base", () => {
    expect(precioSugeridoCentavos(650, listas, [{ lista_id: "fija", precio: 700 }], null)).toBe(65_000);
    expect(precioSugeridoCentavos(650, listas, [], "fija")).toBe(65_000);
  });

  test("resuelve la lista fija del producto", () => {
    expect(precioSugeridoCentavos(650, listas, [{ lista_id: "fija", precio: 700 }], "fija")).toBe(70_000);
  });

  test("resuelve el porcentaje del producto", () => {
    expect(precioSugeridoCentavos(650, listas, [{ lista_id: "porcentaje", precio: 5 }], "porcentaje")).toBe(68_250);
  });

  test("etiqueta el tipo de lista", () => {
    expect(etiquetaTipoLista("fijo")).toBe("Valor fijo");
    expect(etiquetaTipoLista("porcentaje")).toBe("Porcentaje sobre el precio");
  });
});
