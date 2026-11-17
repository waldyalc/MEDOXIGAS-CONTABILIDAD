import { describe, expect, it } from "vitest";

import { erroresDe, mapaErrores, requerido, vacio } from "./validacion";

describe("validación de formularios", () => {
  it("trata como vacíos null, undefined, texto en blanco y listas sin elementos", () => {
    expect(vacio(null)).toBe(true);
    expect(vacio(undefined)).toBe(true);
    expect(vacio("")).toBe(true);
    expect(vacio("   ")).toBe(true);
    expect(vacio([])).toBe(true);
  });

  it("no trata como vacíos el cero, false ni una lista con elementos", () => {
    expect(vacio(0)).toBe(false);
    expect(vacio(false)).toBe(false);
    expect(vacio(["linea"])).toBe(false);
  });

  it("devuelve el mensaje del campo obligatorio vacío", () => {
    const errores = erroresDe([requerido("cliente", "", "El cliente es requerido.")]);

    expect(errores).toEqual([{ campo: "cliente", mensaje: "El cliente es requerido." }]);
  });

  it("omite los campos completos y conserva el orden de las reglas", () => {
    const errores = erroresDe([
      requerido("fecha", "2026-11-17", "La fecha es requerida."),
      requerido("cliente", "", "El cliente es requerido."),
      requerido("lineas", [], "Agregue al menos una línea."),
    ]);

    expect(errores.map((error) => error.campo)).toEqual(["cliente", "lineas"]);
  });

  it("deja solo la primera falla de un campo repetido", () => {
    const errores = erroresDe([
      requerido("monto", "", "El monto es requerido."),
      requerido("monto", "", "El monto debe ser mayor que cero."),
    ]);

    expect(errores).toEqual([{ campo: "monto", mensaje: "El monto es requerido." }]);
  });

  it("convierte los errores en un mapa por campo", () => {
    const mapa = mapaErrores(erroresDe([requerido("cliente", "", "El cliente es requerido.")]));

    expect(mapa).toEqual({ cliente: "El cliente es requerido." });
  });
});
