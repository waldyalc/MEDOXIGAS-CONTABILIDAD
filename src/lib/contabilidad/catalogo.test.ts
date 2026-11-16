import { describe, expect, test } from "vitest";

import type { CuentaContable } from "@/lib/reportes/tipos";

import {
  alternarExpandido,
  aplanarArbol,
  construirArbolCatalogo,
  expandidosIniciales,
  expandirTodo,
  filtrarArbol,
  indexarSaldosPorCodigo,
  normalizarTexto,
} from "./catalogo";

function cuenta(id: string, codigo: string, nombre: string, tipo: string, padreId: string | null): CuentaContable {
  return {
    id,
    codigo,
    nombre,
    tipo,
    naturaleza: tipo === "pasivo" || tipo === "ingreso" ? "credito" : "debito",
    padre_id: padreId,
    acepta_movimientos: padreId != null,
    activa: true,
  };
}

const CUENTAS: CuentaContable[] = [
  cuenta("pasivos", "2", "Pasivos", "pasivo", null),
  cuenta("corrientes", "11", "Activos corrientes", "activo", "activos"),
  cuenta("banco", "1102", "Banco principal", "activo", "corrientes"),
  cuenta("caja", "1101", "Caja general", "activo", "corrientes"),
  cuenta("activos", "1", "Activos", "activo", null),
  cuenta("no-corrientes", "12", "Activos no corrientes", "activo", "activos"),
  cuenta("equipos", "1201", "Equipos", "activo", "no-corrientes"),
  cuenta("cxp", "2101", "Cuentas por pagar", "pasivo", "pasivos"),
  cuenta("ingresos", "4", "Ingresos", "ingreso", null),
  cuenta("ventas", "4101", "Ventas de productos", "ingreso", "ingresos"),
];

const ARBOL = construirArbolCatalogo(CUENTAS, {});

describe("construirArbolCatalogo", () => {
  test("arma la jerarquía con padre_id, ordena por código y suma los saldos de las hijas", () => {
    const arbol = construirArbolCatalogo(CUENTAS, { "1101": 100000, "1102": 250000, "2101": 70000 });

    expect(arbol.map((nodo) => nodo.cuenta.codigo)).toEqual(["1", "2", "4"]);
    expect(arbol[0]?.hijos.map((nodo) => nodo.cuenta.codigo)).toEqual(["11", "12"]);
    expect(arbol[0]?.hijos[0]?.hijos.map((nodo) => nodo.cuenta.codigo)).toEqual(["1101", "1102"]);
    expect(arbol[0]?.hijos[0]?.saldo).toBe(350000);
    expect(arbol[0]?.saldo).toBe(350000);
    expect(arbol[1]?.saldo).toBe(70000);
  });
});

describe("indexarSaldosPorCodigo", () => {
  test("convierte los montos a centavos y los indexa por código de cuenta", () => {
    const saldos = indexarSaldosPorCodigo([
      { cuenta_codigo: "1101", saldo: "1234.56" },
      { cuenta_codigo: "2101", saldo: -789.5 },
    ]);

    expect(saldos).toEqual({ "1101": 123456, "2101": -78950 });
  });

  test("trata un saldo nulo como cero", () => {
    expect(indexarSaldosPorCodigo([{ cuenta_codigo: "4101", saldo: null }])).toEqual({ "4101": 0 });
  });

  test("una cuenta sin movimiento queda fuera del mapa y el árbol la muestra en cero", () => {
    const saldos = indexarSaldosPorCodigo([{ cuenta_codigo: "1101", saldo: 100 }]);

    expect(saldos["1102"]).toBeUndefined();
    expect(construirArbolCatalogo(CUENTAS, saldos)[0]?.hijos[0]?.hijos[1]?.saldo).toBe(0);
  });
});

describe("filtrarArbol", () => {
  test("filtra por nombre y conserva a los ancestros de la coincidencia", () => {
    const { nodos, expandidos } = filtrarArbol(ARBOL, "caja");

    expect(nodos.map((nodo) => nodo.cuenta.codigo)).toEqual(["1"]);
    expect(nodos[0]?.hijos.map((nodo) => nodo.cuenta.codigo)).toEqual(["11"]);
    expect(nodos[0]?.hijos[0]?.hijos.map((nodo) => nodo.cuenta.codigo)).toEqual(["1101"]);
    expect(expandidos).toEqual(new Set(["activos", "corrientes"]));
  });

  test("filtra por código y abre la rama donde está la cuenta", () => {
    const { nodos, expandidos } = filtrarArbol(ARBOL, "1102");

    expect(nodos.map((nodo) => nodo.cuenta.codigo)).toEqual(["1"]);
    expect(nodos[0]?.hijos[0]?.hijos.map((nodo) => nodo.cuenta.codigo)).toEqual(["1102"]);
    expect(expandidos).toEqual(new Set(["activos", "corrientes"]));
  });

  test("al coincidir un padre conserva su subárbol y abre todas sus ramas", () => {
    const { nodos, expandidos } = filtrarArbol(ARBOL, "activos");

    expect(nodos[0]?.hijos).toHaveLength(2);
    expect(expandidos).toEqual(new Set(["activos", "corrientes", "no-corrientes"]));
  });

  test("sin coincidencias devuelve el árbol vacío y sin ramas abiertas", () => {
    expect(filtrarArbol(ARBOL, "zzz")).toEqual({ nodos: [], expandidos: new Set() });
  });

  test("normaliza mayúsculas y acentos", () => {
    expect(normalizarTexto("  Pérdidas y Ganancias ")).toBe("perdidas y ganancias");
  });
});

describe("abrir y cerrar ramas", () => {
  test("arranca con Activos y su primer nivel abiertos", () => {
    const abiertos = expandidosIniciales(ARBOL);

    expect(abiertos).toEqual(new Set(["activos", "corrientes", "no-corrientes"]));

    const filas = aplanarArbol(ARBOL, abiertos);
    expect(filas.map((fila) => fila.nodo.cuenta.codigo)).toEqual(["1", "11", "1101", "1102", "12", "1201", "2", "4"]);
    expect(filas.map((fila) => fila.nivel)).toEqual([0, 1, 2, 2, 1, 2, 0, 0]);
  });

  test("contraer una rama oculta a sus descendientes sin tocar las demás", () => {
    const abiertos = alternarExpandido(expandidosIniciales(ARBOL), "corrientes");

    expect(abiertos.has("corrientes")).toBe(false);
    expect(abiertos.has("no-corrientes")).toBe(true);

    const filas = aplanarArbol(ARBOL, abiertos);
    expect(filas.map((fila) => fila.nodo.cuenta.codigo)).toEqual(["1", "11", "12", "1201", "2", "4"]);
  });

  test("expandir todo abre solo las cuentas que tienen hijas", () => {
    expect(expandirTodo(ARBOL)).toEqual(new Set(["activos", "corrientes", "no-corrientes", "pasivos", "ingresos"]));
    expect(aplanarArbol(ARBOL, new Set()).map((fila) => fila.nodo.cuenta.codigo)).toEqual(["1", "2", "4"]);
  });
});
