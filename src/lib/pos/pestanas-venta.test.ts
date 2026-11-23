import { describe, expect, it } from "vitest";

import { eliminarPestanaDe, esPestanaPrincipal, normalizarNombrePestana, renombrarPestanaEn } from "./pestanas-venta";

interface PestanaPrueba {
  id: string;
  nombre: string;
  lineas: string[];
}

function pestana(id: string, nombre: string, lineas: string[] = []): PestanaPrueba {
  return { id, nombre, lineas };
}

const PRINCIPAL = pestana("principal", "Venta principal");
const VENTA_1 = pestana("venta-1", "Venta 1");
const VENTA_2 = pestana("venta-2", "Venta 2", ["Cilindro"]);
const TRES = [PRINCIPAL, VENTA_1, VENTA_2];

describe("pestañas de venta del POS", () => {
  it("renombrar guarda el nombre en su pestaña y no toca el carrito ni las demás", () => {
    const renombradas = renombrarPestanaEn(TRES, "venta-1", "Cliente Juan");

    expect(renombradas.find((actual) => actual.id === "venta-1")?.nombre).toBe("Cliente Juan");
    expect(renombradas.find((actual) => actual.id === "principal")?.nombre).toBe("Venta principal");
    expect(renombradas.find((actual) => actual.id === "venta-2")).toEqual(VENTA_2);
    expect(renombradas.find((actual) => actual.id === "venta-2")?.lineas).toEqual(["Cilindro"]);
    expect(TRES.find((actual) => actual.id === "venta-1")?.nombre, "No muta el estado anterior").toBe("Venta 1");
  });

  it("el nombre se conserva al cambiar de pestaña y tras otras operaciones", () => {
    const renombradas = renombrarPestanaEn(TRES, "venta-1", "Cotización mostrador");
    const trasEliminar = eliminarPestanaDe(renombradas, "venta-1", "venta-2");
    const trasRenombrarPrincipal = renombrarPestanaEn(trasEliminar.pestanas, "principal", "Venta del día");

    expect(trasRenombrarPrincipal.find((actual) => actual.id === "venta-1")?.nombre).toBe("Cotización mostrador");
    expect(trasRenombrarPrincipal.map((actual) => actual.nombre)).toEqual(["Venta del día", "Cotización mostrador"]);
  });

  it("un nombre vacío o solo espacios conserva el nombre anterior", () => {
    expect(normalizarNombrePestana("", "Venta 1")).toBe("Venta 1");
    expect(normalizarNombrePestana("   ", "Venta 1")).toBe("Venta 1");
    expect(normalizarNombrePestana("  Mostrador  ", "Venta 1")).toBe("Mostrador");
    expect(normalizarNombrePestana("x".repeat(40), "Venta 1")).toHaveLength(30);

    const renombradas = renombrarPestanaEn(TRES, "venta-1", "   ");
    expect(renombradas[1]?.nombre).toBe("Venta 1");
  });

  it("la venta principal no se elimina ni aunque sea la única pestaña", () => {
    const resultado = eliminarPestanaDe([PRINCIPAL], "principal", "principal");

    expect(esPestanaPrincipal([PRINCIPAL], "principal")).toBe(true);
    expect(resultado.eliminada).toBe(false);
    expect(resultado.pestanas).toEqual([PRINCIPAL]);
    expect(resultado.activaId).toBe("principal");
  });

  it("la principal tampoco se elimina cuando hay pestañas extra", () => {
    const resultado = eliminarPestanaDe(TRES, "venta-2", "principal");

    expect(esPestanaPrincipal(TRES, "principal")).toBe(true);
    expect(resultado.eliminada).toBe(false);
    expect(resultado.pestanas).toEqual(TRES);
    expect(resultado.activaId).toBe("venta-2");
  });

  it("una pestaña extra se elimina y su vecina anterior queda activa", () => {
    const resultado = eliminarPestanaDe(TRES, "venta-2", "venta-2");

    expect(resultado.eliminada).toBe(true);
    expect(resultado.pestanas.map((actual) => actual.id)).toEqual(["principal", "venta-1"]);
    expect(resultado.activaId).toBe("venta-1");
  });

  it("al eliminar una extra inactiva la pestaña activa no cambia", () => {
    const resultado = eliminarPestanaDe(TRES, "venta-2", "venta-1");

    expect(resultado.eliminada).toBe(true);
    expect(resultado.pestanas.map((actual) => actual.id)).toEqual(["principal", "venta-2"]);
    expect(resultado.activaId).toBe("venta-2");
  });

  it("nunca deja el carrito sin pestaña: al eliminar la única extra queda la principal", () => {
    const resultado = eliminarPestanaDe([PRINCIPAL, VENTA_1], "venta-1", "venta-1");

    expect(resultado.eliminada).toBe(true);
    expect(resultado.pestanas).toHaveLength(1);
    expect(resultado.pestanas[0]?.id).toBe("principal");
    expect(resultado.activaId).toBe("principal");
  });

  it("un id desconocido no cambia nada", () => {
    const resultado = eliminarPestanaDe(TRES, "venta-1", "no-existe");

    expect(resultado.eliminada).toBe(false);
    expect(resultado.pestanas).toEqual(TRES);
    expect(resultado.activaId).toBe("venta-1");
  });
});
