import { describe, expect, test } from "vitest";

import {
  leerOpcionesLista,
  leerPagina,
  leerTamano,
  rangoPagina,
  resumirPagina,
  TAMANO_PAGINA_DEFECTO,
  urlLista,
} from "./parametros";

describe("parámetros de lista", () => {
  test("usa los valores por defecto cuando la URL no trae nada", () => {
    expect(leerOpcionesLista({})).toEqual({ pagina: 1, tamano: TAMANO_PAGINA_DEFECTO, q: "" });
  });

  test("acepta una página válida y rechaza números inválidos", () => {
    expect(leerPagina({ pagina: "3" })).toBe(3);
    expect(leerPagina({ pagina: "0" })).toBe(1);
    expect(leerPagina({ pagina: "-2" })).toBe(1);
    expect(leerPagina({ pagina: "abc" })).toBe(1);
    expect(leerPagina({ pagina: ["4"] })).toBe(4);
  });

  test("solo admite los tamaños de página ofrecidos", () => {
    expect(leerTamano({ tamano: "50" })).toBe(50);
    expect(leerTamano({ tamano: "100" })).toBe(100);
    expect(leerTamano({ tamano: "7" })).toBe(TAMANO_PAGINA_DEFECTO);
    expect(leerTamano({ tamano: "abc" })).toBe(TAMANO_PAGINA_DEFECTO);
  });

  test("recorta la búsqueda a 100 caracteres", () => {
    expect(leerOpcionesLista({ q: "  x  " }).q).toBe("x");
    expect(leerOpcionesLista({ q: "a".repeat(150) }).q).toHaveLength(100);
  });

  test("calcula el rango de la página (Range de PostgREST)", () => {
    expect(rangoPagina(1, 25)).toEqual({ desde: 0, hasta: 24 });
    expect(rangoPagina(4, 25)).toEqual({ desde: 75, hasta: 99 });
    expect(rangoPagina(0, 25)).toEqual({ desde: 0, hasta: 24 });
  });
});

describe("resumen de paginación", () => {
  test("reparte el total en páginas y ajusta la última", () => {
    expect(resumirPagina(1, 25, 60)).toEqual({
      pagina: 1,
      totalPaginas: 3,
      inicio: 1,
      fin: 25,
      total: 60,
    });
    expect(resumirPagina(3, 25, 60)).toEqual({
      pagina: 3,
      totalPaginas: 3,
      inicio: 51,
      fin: 60,
      total: 60,
    });
  });

  test("acota una página fuera de rango a la última existente", () => {
    expect(resumirPagina(999, 25, 60).pagina).toBe(3);
    expect(resumirPagina(999, 25, 60).inicio).toBe(51);
  });

  test("mantiene una página válida cuando no hay filas", () => {
    expect(resumirPagina(5, 25, 0)).toEqual({
      pagina: 1,
      totalPaginas: 1,
      inicio: 0,
      fin: 0,
      total: 0,
    });
  });
});

describe("urlLista", () => {
  const base = "/dashboard/compras";

  test("conserva los filtros actuales y cambia solo la página", () => {
    expect(urlLista(base, { q: "proveedor", tamano: "50", pagina: "2" }, { pagina: "3" })).toBe(
      `${base}?q=proveedor&tamano=50&pagina=3`,
    );
  });

  test("al buscar vuelve a la página 1 y quita el parámetro vacío", () => {
    const url = urlLista(base, { q: "viejo", pagina: "4" }, { q: "nuevo", pagina: null });
    expect(url).toBe(`${base}?q=nuevo`);
    expect(urlLista(base, {}, { q: "", pagina: null })).toBe(base);
  });
});
