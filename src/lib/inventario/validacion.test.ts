import { describe, expect, test } from "vitest";

import { listaPrecioSchema, transferenciaSchema, validarAjuste } from "./validacion";

const linea = {
  producto_id: "11111111-1111-1111-1111-111111111111",
  cantidad: 5,
  costoCentavos: 12000,
};

const ajuste = {
  almacen_id: "22222222-2222-2222-2222-222222222222",
  lineas: [linea],
};

describe("validarAjuste", () => {
  test("acepta un ajuste con una línea válida", () => {
    expect(validarAjuste(ajuste)).toBeNull();
  });

  test("exige almacén", () => {
    expect(validarAjuste({ ...ajuste, almacen_id: "" })).toBe("Selecciona el almacén.");
  });

  test("exige al menos una línea", () => {
    expect(validarAjuste({ ...ajuste, lineas: [] })).toBe("Agrega al menos un producto.");
  });

  test("exige producto en cada línea", () => {
    expect(validarAjuste({ ...ajuste, lineas: [{ ...linea, producto_id: "" }] })).toBe(
      "Selecciona el producto de la línea 1.",
    );
  });

  test("exige cantidad mayor que cero", () => {
    expect(validarAjuste({ ...ajuste, lineas: [{ ...linea, cantidad: 0 }] })).toBe(
      "La cantidad de la línea 1 debe ser mayor que cero.",
    );
  });

  test("exige un costo válido", () => {
    expect(validarAjuste({ ...ajuste, lineas: [{ ...linea, costoCentavos: null }] })).toBe(
      "El costo de la línea 1 no es válido.",
    );
    expect(validarAjuste({ ...ajuste, lineas: [{ ...linea, costoCentavos: -1 }] })).toBe(
      "El costo de la línea 1 no es válido.",
    );
    expect(validarAjuste({ ...ajuste, lineas: [{ ...linea, costoCentavos: 0 }] })).toBe(
      "El costo de la línea 1 no es válido.",
    );
  });

  test("señala el número de línea que falla", () => {
    expect(
      validarAjuste({
        ...ajuste,
        lineas: [linea, { ...linea, cantidad: 0 }],
      }),
    ).toBe("La cantidad de la línea 2 debe ser mayor que cero.");
  });
});

describe("transferenciaSchema", () => {
  const base = {
    fecha: "2026-11-14",
    origen_id: "11111111-1111-4111-8111-111111111111",
    destino_id: "22222222-2222-4222-8222-222222222222",
    lineas: [{ producto_id: "33333333-3333-4333-8333-333333333333", cantidad: 2 }],
  };

  test("acepta una transferencia válida", () => {
    expect(transferenciaSchema.safeParse(base).success).toBe(true);
  });

  test("rechaza origen y destino iguales", () => {
    const resultado = transferenciaSchema.safeParse({ ...base, destino_id: base.origen_id });
    expect(resultado.success).toBe(false);
  });

  test("exige al menos un producto", () => {
    expect(transferenciaSchema.safeParse({ ...base, lineas: [] }).success).toBe(false);
  });

  test("exige cantidad positiva", () => {
    expect(
      transferenciaSchema.safeParse({
        ...base,
        lineas: [{ producto_id: base.lineas[0]?.producto_id ?? "", cantidad: 0 }],
      }).success,
    ).toBe(false);
  });
});

describe("listaPrecioSchema", () => {
  test("acepta una lista fija o porcentaje", () => {
    expect(listaPrecioSchema.safeParse({ nombre: "Mayoreo", tipo: "fijo" }).success).toBe(true);
    expect(listaPrecioSchema.safeParse({ nombre: "Mayoreo", tipo: "porcentaje" }).success).toBe(true);
  });

  test("rechaza un tipo desconocido", () => {
    expect(listaPrecioSchema.safeParse({ nombre: "Mayoreo", tipo: "otro" }).success).toBe(false);
  });
});
