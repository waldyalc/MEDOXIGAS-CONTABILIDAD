import { describe, expect, test } from "vitest";

import { esquemaActualizarCuenta, esquemaCrearCuenta, etiquetaTipoCuenta } from "./validacion";

const CUENTA_VALIDA = {
  codigo: " 1201 ",
  nombre: "Caja   sucursal",
  tipo: "activo",
  naturaleza: "debito",
  padre_id: null,
};

describe("esquemaCrearCuenta", () => {
  test("acepta una cuenta válida y normaliza código y nombre", () => {
    const resultado = esquemaCrearCuenta.safeParse(CUENTA_VALIDA);

    expect(resultado.success).toBe(true);
    if (!resultado.success) return;

    expect(resultado.data.codigo).toBe("1201");
    expect(resultado.data.nombre).toBe("Caja sucursal");
    expect(resultado.data.acepta_movimientos).toBe(true);
    expect(resultado.data.es_caja_banco).toBe(false);
    expect(resultado.data.activa).toBe(true);
  });

  test("rechaza el código vacío", () => {
    const resultado = esquemaCrearCuenta.safeParse({ ...CUENTA_VALIDA, codigo: "   " });

    expect(resultado.success).toBe(false);
    if (resultado.success) return;

    expect(resultado.error.issues[0]?.message).toBe("El código es obligatorio");
  });

  test("rechaza un tipo que no está en el catálogo", () => {
    const resultado = esquemaCrearCuenta.safeParse({ ...CUENTA_VALIDA, tipo: "otro" });

    expect(resultado.success).toBe(false);
    if (resultado.success) return;

    expect(resultado.error.issues[0]?.message).toBe("El tipo de cuenta no es válido");
  });

  test("rechaza una naturaleza inválida", () => {
    const resultado = esquemaCrearCuenta.safeParse({ ...CUENTA_VALIDA, naturaleza: "mixta" });

    expect(resultado.success).toBe(false);
    if (resultado.success) return;

    expect(resultado.error.issues[0]?.message).toBe("La naturaleza de la cuenta no es válida");
  });

  test("rechaza un padre que no es uuid", () => {
    const resultado = esquemaCrearCuenta.safeParse({ ...CUENTA_VALIDA, padre_id: "11" });

    expect(resultado.success).toBe(false);
    if (resultado.success) return;

    expect(resultado.error.issues[0]?.message).toBe("La cuenta padre no es válida");
  });

  test("convierte el padre vacío en null", () => {
    const resultado = esquemaCrearCuenta.safeParse({ ...CUENTA_VALIDA, padre_id: "  " });

    expect(resultado.success).toBe(true);
    if (!resultado.success) return;

    expect(resultado.data.padre_id).toBeNull();
  });
});

describe("esquemaActualizarCuenta", () => {
  test("permite omitir código, tipo y naturaleza cuando la cuenta tiene movimientos", () => {
    const resultado = esquemaActualizarCuenta.safeParse({ nombre: "Caja sucursal norte" });

    expect(resultado.success).toBe(true);
    if (!resultado.success) return;

    expect(resultado.data.codigo).toBeUndefined();
    expect(resultado.data.tipo).toBeUndefined();
    expect(resultado.data.naturaleza).toBeUndefined();
  });
});

describe("etiquetaTipoCuenta", () => {
  test("muestra Patrimonio para el tipo capital", () => {
    expect(etiquetaTipoCuenta("capital")).toBe("Patrimonio");
    expect(etiquetaTipoCuenta("activo")).toBe("Activo");
  });
});
