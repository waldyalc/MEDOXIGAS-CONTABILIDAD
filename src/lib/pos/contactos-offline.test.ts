import { describe, expect, it } from "vitest";

import {
  filtrarContactosLocal,
  resolverContactoIdOffline,
  sincronizarContactosPendientesOffline,
} from "./contactos-offline";

const CONTACTOS = [
  { nombre: "José Peña", rnc_cedula: "1-01-12345-6" },
  { nombre: "Ferretería Central", rnc_cedula: "1-30-98765-4" },
  { nombre: "María Rodríguez", rnc_cedula: null },
];

describe("clientes locales del POS", () => {
  it("filtra sin acentos ni mayúsculas por nombre", () => {
    expect(filtrarContactosLocal(CONTACTOS, "jose pena")).toEqual([CONTACTOS[0]]);
    expect(filtrarContactosLocal(CONTACTOS, "FERRE")).toEqual([CONTACTOS[1]]);
    expect(filtrarContactosLocal(CONTACTOS, "maria")).toEqual([CONTACTOS[2]]);
  });

  it("busca el RNC/cédula ignorando guiones y espacios", () => {
    expect(filtrarContactosLocal(CONTACTOS, "101123456")).toEqual([CONTACTOS[0]]);
    expect(filtrarContactosLocal(CONTACTOS, "1 30 98765 4")).toEqual([CONTACTOS[1]]);
    expect(filtrarContactosLocal(CONTACTOS, "999")).toEqual([]);
  });

  it("sin texto devuelve como máximo el límite pedido", () => {
    expect(filtrarContactosLocal(CONTACTOS, "", 2)).toEqual(CONTACTOS.slice(0, 2));
    expect(filtrarContactosLocal(CONTACTOS, "   ")).toHaveLength(3);
  });

  it("sin IndexedDB la sincronización y la resolución son no-op seguras", async () => {
    expect(typeof indexedDB).toBe("undefined");

    await expect(sincronizarContactosPendientesOffline("usuario/terminal")).resolves.toEqual({
      ok: true,
      sincronizados: 0,
    });
    await expect(resolverContactoIdOffline("usuario/terminal", "cliente-temp")).resolves.toEqual({
      estado: "original",
      id: "cliente-temp",
    });
  });
});
