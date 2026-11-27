import { describe, expect, it } from "vitest";

import {
  claveAmbienteLocal,
  guardarAmbientePersistidoLocal,
  leerAmbientePersistidoLocal,
  resolverAmbienteInicial,
} from "./ambiente-persistencia";

function crearStorageSimulado(registro: Record<string, string>): Pick<Storage, "getItem" | "setItem"> {
  return {
    getItem: (clave) => registro[clave] ?? null,
    setItem: (clave, valor) => {
      registro[clave] = valor;
    },
  };
}

function crearStorageQueFalla(): Pick<Storage, "getItem" | "setItem"> {
  return {
    getItem: () => {
      throw new Error("SecurityError");
    },
    setItem: () => {
      throw new Error("SecurityError");
    },
  };
}

describe("persistencia local del ambiente e-CF", () => {
  it("construye una clave estable por RNC limpio", () => {
    expect(claveAmbienteLocal("131-48879-1")).toBe("medoxigas:ecf:ambiente:131488791");
    expect(claveAmbienteLocal("  ")).toBe("medoxigas:ecf:ambiente:sin-rnc");
  });

  it("lee solo testecf o certecf desde el Storage simulado", () => {
    const registro: Record<string, string> = {};
    const storage = crearStorageSimulado(registro);
    const clave = claveAmbienteLocal("131488791");

    registro[clave] = "certecf";
    expect(leerAmbientePersistidoLocal("131488791", storage)).toBe("certecf");

    registro[clave] = "testecf";
    expect(leerAmbientePersistidoLocal("131488791", storage)).toBe("testecf");
  });

  it("rechaza valores inválidos y nunca restaura producción desde localStorage", () => {
    const registro: Record<string, string> = {};
    const storage = crearStorageSimulado(registro);
    const clave = claveAmbienteLocal("131488791");

    registro[clave] = "produccion";
    expect(leerAmbientePersistidoLocal("131488791", storage)).toBeNull();

    registro[clave] = "ecf";
    expect(leerAmbientePersistidoLocal("131488791", storage)).toBeNull();

    registro[clave] = "valor-corrupto";
    expect(leerAmbientePersistidoLocal("131488791", storage)).toBeNull();
  });

  it("guarda testecf y certecf sin lanzar errores de Storage", () => {
    const registro: Record<string, string> = {};
    const storage = crearStorageSimulado(registro);
    const clave = claveAmbienteLocal("131488791");

    guardarAmbientePersistidoLocal("131488791", "certecf", storage);
    expect(registro[clave]).toBe("certecf");

    guardarAmbientePersistidoLocal("131488791", "testecf", storage);
    expect(registro[clave]).toBe("testecf");

    expect(() => guardarAmbientePersistidoLocal("131488791", "certecf", crearStorageQueFalla())).not.toThrow();
    expect(leerAmbientePersistidoLocal("131488791", crearStorageQueFalla())).toBeNull();
    expect(leerAmbientePersistidoLocal("131488791", null)).toBeNull();
    expect(() => guardarAmbientePersistidoLocal("131488791", "certecf", null)).not.toThrow();
  });

  it("bloquea guardar producción en localStorage", () => {
    const registro: Record<string, string> = {};
    const storage = crearStorageSimulado(registro);

    guardarAmbientePersistidoLocal("131488791", "produccion", storage);
    expect(registro[claveAmbienteLocal("131488791")]).toBeUndefined();
  });

  it("resuelve producción solo cuando ecf viene activo desde la base de datos", () => {
    expect(resolverAmbienteInicial("ecf", "certecf")).toBe("produccion");
    expect(resolverAmbienteInicial("ecf", "testecf")).toBe("produccion");
    expect(resolverAmbienteInicial("ecf", null)).toBe("produccion");
  });

  it("usa la preferencia local del contador aunque la base siga en otro ambiente no productivo", () => {
    expect(resolverAmbienteInicial("testecf", "certecf")).toBe("certecf");
    expect(resolverAmbienteInicial("certecf", "testecf")).toBe("testecf");
    expect(resolverAmbienteInicial(null, "certecf")).toBe("certecf");
    expect(resolverAmbienteInicial(undefined, "testecf")).toBe("testecf");
  });

  it("cae al ambiente de la base o al default seguro cuando no hay preferencia local", () => {
    expect(resolverAmbienteInicial("certecf", null)).toBe("certecf");
    expect(resolverAmbienteInicial("testecf", null)).toBe("testecf");
    expect(resolverAmbienteInicial(null, null)).toBe("testecf");
    expect(resolverAmbienteInicial(undefined, null)).toBe("testecf");
  });
});
