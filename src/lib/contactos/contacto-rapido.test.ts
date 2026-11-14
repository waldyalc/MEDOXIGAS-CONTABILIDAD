import { describe, expect, test } from "vitest";

import { errorIdentificacion, normalizarIdentificacion, tipoContactoDesde } from "./contacto-rapido";

describe("identificación del contacto rápido", () => {
  test("normaliza RNC y cédula solo con dígitos", () => {
    expect(normalizarIdentificacion("rnc", "1-31-12345-6")).toBe("131123456");
    expect(normalizarIdentificacion("cedula", "001-1234567-8")).toBe("00112345678");
  });

  test("acepta RNC de 9 dígitos y rechaza otras longitudes", () => {
    expect(errorIdentificacion("rnc", "131123456")).toBeNull();
    expect(errorIdentificacion("rnc", "13112345")).toBe("El RNC debe tener 9 dígitos.");
    expect(errorIdentificacion("rnc", "1311234567")).toBe("El RNC debe tener 9 dígitos.");
  });

  test("acepta cédula de 11 dígitos y rechaza otras longitudes", () => {
    expect(errorIdentificacion("cedula", "00112345678")).toBeNull();
    expect(errorIdentificacion("cedula", "0011234567")).toBe("La cédula debe tener 11 dígitos.");
  });

  test("acepta pasaporte alfanumérico y rechaza longitudes fuera de rango", () => {
    expect(normalizarIdentificacion("pasaporte", " ab 1234 ")).toBe("AB1234");
    expect(errorIdentificacion("pasaporte", "AB1234")).toBeNull();
    expect(errorIdentificacion("pasaporte", "AB12")).not.toBeNull();
  });

  test("el número vacío es válido porque es opcional", () => {
    expect(errorIdentificacion("rnc", "   ")).toBeNull();
    expect(errorIdentificacion("cedula", "")).toBeNull();
  });

  test("sin tipo definido acepta RNC o cédula", () => {
    expect(errorIdentificacion(null, "131123456")).toBeNull();
    expect(errorIdentificacion(undefined, "00112345678")).toBeNull();
    expect(errorIdentificacion(null, "12345")).not.toBeNull();
  });
});

describe("tipo de contacto desde los toggles", () => {
  test("combina cliente y proveedor", () => {
    expect(tipoContactoDesde(true, false)).toBe("cliente");
    expect(tipoContactoDesde(false, true)).toBe("proveedor");
    expect(tipoContactoDesde(true, true)).toBe("ambos");
    expect(tipoContactoDesde(false, false)).toBeNull();
  });
});
