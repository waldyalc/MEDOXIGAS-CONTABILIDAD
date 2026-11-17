import { describe, expect, test } from "vitest";

import { completarConDatosDgii } from "./completar";
import type { DatosContribuyenteDgii } from "./consulta";

const VACIO = { nombre: "" };

function datos(parcial: Partial<DatosContribuyenteDgii> = {}): DatosContribuyenteDgii {
  return {
    nombre: "MEDOXIGAS ALC SRL",
    nombreComercial: null,
    municipioProvincia: null,
    direccion: null,
    estado: "ACTIVO",
    ...parcial,
  };
}

describe("completar el contacto con la DGII", () => {
  test("llena el nombre vacío", () => {
    const resultado = completarConDatosDgii(datos(), VACIO, VACIO);
    expect(resultado.campos).toEqual({ nombre: "MEDOXIGAS ALC SRL" });
    expect(resultado.mensaje).toBe("Datos de la DGII: se completó el nombre.");
  });

  test("si el nombre ya coincide, no lo toca", () => {
    const resultado = completarConDatosDgii(datos(), { nombre: "MEDOXIGAS ALC SRL" }, VACIO);
    expect(resultado.campos).toEqual({});
    expect(resultado.mensaje).toBe("El nombre ya coincide con el de la DGII.");
  });

  test("no sobrescribe el nombre que escribió el usuario", () => {
    const resultado = completarConDatosDgii(datos(), { nombre: "Mi proveedor" }, VACIO);
    expect(resultado.campos).toEqual({});
    expect(resultado.mensaje).toContain("no se cambió el nombre");
  });

  test("puede reemplazar el nombre que rellenó una consulta anterior", () => {
    const resultado = completarConDatosDgii(
      datos({ nombre: "OTRA EMPRESA SRL" }),
      { nombre: "MEDOXIGAS ALC SRL" },
      { nombre: "MEDOXIGAS ALC SRL" },
    );
    expect(resultado.campos).toEqual({ nombre: "OTRA EMPRESA SRL" });
  });
});
