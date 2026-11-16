import { describe, expect, test } from "vitest";

import { tiposContacto, unirContactos } from "./seleccion";

describe("tiposContacto", () => {
  test("cliente y proveedor incluyen también los contactos de tipo ambos", () => {
    expect(tiposContacto("cliente")).toEqual(["cliente", "ambos"]);
    expect(tiposContacto("proveedor")).toEqual(["proveedor", "ambos"]);
  });

  test("todos no filtra por tipo (tercero del asiento)", () => {
    expect(tiposContacto("todos")).toBeNull();
  });
});

describe("unirContactos", () => {
  test("agrega el contacto extra sin duplicar y mantiene el orden alfabético", () => {
    const base = [
      { id: "b", nombre: "Betania", rnc_cedula: null },
      { id: "c", nombre: "Carlos", rnc_cedula: null },
    ];
    const extra = { id: "a", nombre: "Ana", rnc_cedula: "001-0000001-1" };

    expect(unirContactos(base, extra).map((contacto) => contacto.id)).toEqual(["a", "b", "c"]);
    expect(unirContactos(base, base[0])).toHaveLength(2);
  });

  test("sin extra devuelve la misma lista ordenada", () => {
    const base = [
      { id: "b", nombre: "B", rnc_cedula: null },
      { id: "a", nombre: "A", rnc_cedula: null },
    ];
    expect(unirContactos(base, null).map((contacto) => contacto.id)).toEqual(["a", "b"]);
  });
});
