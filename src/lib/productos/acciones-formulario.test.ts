import { describe, expect, test } from "vitest";

import { ACCION_CREAR_OTRO, esAccionCrearOtro } from "./acciones-formulario";

function evento(valor: unknown): EventTarget {
  return valor as EventTarget;
}

describe("acción de «Guardar y crear otro»", () => {
  test("un botón con value crear-otro devuelve true", () => {
    expect(esAccionCrearOtro(evento({ tagName: "BUTTON", value: ACCION_CREAR_OTRO }))).toBe(true);
  });

  test("un botón con otro value devuelve false", () => {
    expect(esAccionCrearOtro(evento({ tagName: "BUTTON", value: "guardar" }))).toBe(false);
  });

  test("sin submitter (Enter o click fuera del botón) devuelve false", () => {
    expect(esAccionCrearOtro(null)).toBe(false);
  });

  test("un elemento que no es botón devuelve false", () => {
    expect(esAccionCrearOtro(evento({ tagName: "DIV", value: ACCION_CREAR_OTRO }))).toBe(false);
    expect(esAccionCrearOtro(new EventTarget())).toBe(false);
  });
});
