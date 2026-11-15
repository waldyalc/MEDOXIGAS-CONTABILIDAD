import { describe, expect, test } from "vitest";

import { limpiarBusqueda, numeroBuscado, numeroDocumento, patronIlike } from "./busqueda";

describe("limpiarBusqueda", () => {
  test("recorta espacios y colapsa los intermedios", () => {
    expect(limpiarBusqueda("  José   Pérez  ")).toBe("José Pérez");
  });

  test("conserva comas y paréntesis para buscar el nombre tal cual", () => {
    expect(limpiarBusqueda("Pérez, Juan (Sucursal)")).toBe("Pérez, Juan (Sucursal)");
    expect(limpiarBusqueda("100%")).toBe("100%");
    expect(limpiarBusqueda("a\\b")).toBe("a b");
    expect(limpiarBusqueda('a"b')).toBe("a b");
  });

  test("limita el término a 80 caracteres", () => {
    expect(limpiarBusqueda("x".repeat(120))).toHaveLength(80);
  });
});

describe("patronIlike", () => {
  test("envuelve el término en comodines y comillas dobles", () => {
    expect(patronIlike(" B01 ")).toBe('"%B01%"');
    expect(patronIlike("Pérez, Juan")).toBe('"%Pérez, Juan%"');
    expect(patronIlike("")).toBe('"%%"');
  });
});

describe("numeroBuscado", () => {
  test("convierte un número entero y acepta el prefijo #", () => {
    expect(numeroBuscado("1258")).toBe(1258);
    expect(numeroBuscado("#1258")).toBe(1258);
    expect(numeroBuscado("  #001  ")).toBe(1);
  });

  test("ignora números con letras, decimales o demasiado grandes", () => {
    expect(numeroBuscado("B0100001258")).toBeNull();
    expect(numeroBuscado("12.5")).toBeNull();
    expect(numeroBuscado("1234567890123456")).toBeNull();
    expect(numeroBuscado("")).toBeNull();
  });
});

describe("numeroDocumento", () => {
  test("acepta números de factura, compra o pago de hasta 6 dígitos", () => {
    expect(numeroDocumento("15236")).toBe(15236);
    expect(numeroDocumento("#15236")).toBe(15236);
    expect(numeroDocumento("123456")).toBe(123456);
  });

  test("no confunde un RNC ni los dígitos de un NCF con un número de documento", () => {
    expect(numeroDocumento("131123456")).toBeNull();
    expect(numeroDocumento("00112345678")).toBeNull();
    expect(numeroDocumento("0100000050")).toBeNull();
    expect(numeroDocumento("B0100000050")).toBeNull();
  });
});
