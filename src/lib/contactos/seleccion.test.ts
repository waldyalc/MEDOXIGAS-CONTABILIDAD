import { describe, expect, test } from "vitest";

import { type ContactoBuscado, unirContactos } from "./seleccion";

const ANA: ContactoBuscado = { id: "ana", nombre: "Ana", rnc_cedula: null };
const LUIS: ContactoBuscado = { id: "luis", nombre: "Luis", rnc_cedula: "001-1234567-8" };
const ZOE: ContactoBuscado = { id: "zoe", nombre: "Zoe", rnc_cedula: null };

describe("unirContactos", () => {
  test("agrega el seleccionado y ordena por nombre sin duplicar", () => {
    expect(unirContactos([LUIS], ANA).map((contacto) => contacto.id)).toEqual(["ana", "luis"]);
  });

  test("no duplica un contacto que ya está en la lista", () => {
    expect(unirContactos([ANA, LUIS], { ...ANA, nombre: "Ana María" }).map((contacto) => contacto.nombre)).toEqual([
      "Ana María",
      "Luis",
    ]);
  });

  test("sin extra devuelve una copia ordenada", () => {
    expect(unirContactos([ZOE, ANA], null).map((contacto) => contacto.id)).toEqual(["ana", "zoe"]);
  });
});
