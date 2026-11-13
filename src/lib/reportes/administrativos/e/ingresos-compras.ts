import { centavos } from "../../dinero";
import type { CuentaContable, FilaEstadoResultados } from "../../tipos";

export type TipoIngresoCompra = "ingreso" | "costo" | "gasto";

export interface NodoIngresoCompra {
  id: string;
  codigo: string;
  nombre: string;
  tipo: TipoIngresoCompra;
  monto: number;
  hijos: NodoIngresoCompra[];
}

export interface FilaArbolIngresoCompra {
  nodo: NodoIngresoCompra;
  nivel: number;
  tieneHijos: boolean;
}

export interface ReporteIngresosCompras {
  ingresos: NodoIngresoCompra[];
  costos: NodoIngresoCompra[];
  gastos: NodoIngresoCompra[];
  totalIngresos: number;
  totalEgresos: number;
  saldo: number;
}

export interface OpcionesIngresoCompra {
  buscar?: string;
  incluirCeros?: boolean;
}

function esTipoIngresoCompra(tipo: string): tipo is TipoIngresoCompra {
  return tipo === "ingreso" || tipo === "costo" || tipo === "gasto";
}

function signo(tipo: TipoIngresoCompra): 1 | -1 {
  return tipo === "ingreso" ? 1 : -1;
}

function normalizar(texto: string): string {
  return texto
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();
}

function montosPorCodigo(filas: readonly FilaEstadoResultados[]): Map<string, number> {
  const montos = new Map<string, number>();

  for (const fila of filas) {
    if (!esTipoIngresoCompra(fila.tipo)) continue;
    montos.set(fila.cuenta_codigo, centavos(fila.monto));
  }

  return montos;
}

function construirNodos(
  cuentas: readonly CuentaContable[],
  filas: readonly FilaEstadoResultados[],
): NodoIngresoCompra[] {
  const incluidas = cuentas.filter(
    (cuenta): cuenta is CuentaContable & { tipo: TipoIngresoCompra } =>
      esTipoIngresoCompra(cuenta.tipo) && cuenta.activa,
  );
  const ordenadas = [...incluidas].sort((a, b) => a.codigo.localeCompare(b.codigo));
  const montos = montosPorCodigo(filas);
  const nodos = new Map<string, NodoIngresoCompra>();

  for (const cuenta of ordenadas) {
    nodos.set(cuenta.id, {
      id: cuenta.id,
      codigo: cuenta.codigo,
      nombre: cuenta.nombre,
      tipo: cuenta.tipo,
      monto: signo(cuenta.tipo) * (montos.get(cuenta.codigo) ?? 0),
      hijos: [],
    });
  }

  const raices: NodoIngresoCompra[] = [];

  for (const cuenta of ordenadas) {
    const nodo = nodos.get(cuenta.id);
    if (nodo == null) continue;

    const padre = cuenta.padre_id == null ? undefined : nodos.get(cuenta.padre_id);
    if (padre == null || padre === nodo) raices.push(nodo);
    else padre.hijos.push(nodo);
  }

  const sumarHijos = (nodo: NodoIngresoCompra): number => {
    nodo.monto += nodo.hijos.reduce((total, hijo) => total + sumarHijos(hijo), 0);
    return nodo.monto;
  };

  for (const raiz of raices) sumarHijos(raiz);

  return raices;
}

function coincidePropio(nodo: NodoIngresoCompra, busqueda: string): boolean {
  return busqueda !== "" && normalizar(`${nodo.codigo} ${nodo.nombre}`).includes(busqueda);
}

function coincideNodo(nodo: NodoIngresoCompra, busqueda: string): boolean {
  if (!busqueda) return true;
  return coincidePropio(nodo, busqueda) || nodo.hijos.some((hijo) => coincideNodo(hijo, busqueda));
}

function filtrarNodos(
  nodos: readonly NodoIngresoCompra[],
  busqueda: string,
  incluirCeros: boolean,
  conservarTodos = false,
): NodoIngresoCompra[] {
  const resultado: NodoIngresoCompra[] = [];

  for (const nodo of nodos) {
    const padreCoincide = conservarTodos || coincidePropio(nodo, busqueda);

    if (!padreCoincide && !coincideNodo(nodo, busqueda)) continue;

    const hijos = filtrarNodos(nodo.hijos, busqueda, incluirCeros, padreCoincide);

    if (!incluirCeros && nodo.monto === 0 && hijos.length === 0) continue;

    resultado.push({ ...nodo, hijos });
  }

  return resultado;
}

export function calcularReporteIngresosCompras(
  cuentas: readonly CuentaContable[],
  filas: readonly FilaEstadoResultados[],
  opciones: OpcionesIngresoCompra = {},
): ReporteIngresosCompras {
  const raices = construirNodos(cuentas, filas);
  const ingresos = raices.filter((nodo) => nodo.tipo === "ingreso");
  const costos = raices.filter((nodo) => nodo.tipo === "costo");
  const gastos = raices.filter((nodo) => nodo.tipo === "gasto");

  const totalIngresos = ingresos.reduce((total, nodo) => total + nodo.monto, 0);
  const totalCostos = costos.reduce((total, nodo) => total + nodo.monto, 0);
  const totalGastos = gastos.reduce((total, nodo) => total + nodo.monto, 0);
  const totalEgresos = totalCostos + totalGastos;

  const busqueda = normalizar(opciones.buscar ?? "");
  const incluirCeros = opciones.incluirCeros ?? true;

  return {
    ingresos: filtrarNodos(ingresos, busqueda, incluirCeros),
    costos: filtrarNodos(costos, busqueda, incluirCeros),
    gastos: filtrarNodos(gastos, busqueda, incluirCeros),
    totalIngresos,
    totalEgresos,
    saldo: totalIngresos + totalEgresos,
  };
}

export function aplanarIngresosCompras(nodos: readonly NodoIngresoCompra[]): FilaArbolIngresoCompra[] {
  const filas: FilaArbolIngresoCompra[] = [];

  const recorrer = (lista: readonly NodoIngresoCompra[], nivel: number): void => {
    for (const nodo of lista) {
      filas.push({ nodo, nivel, tieneHijos: nodo.hijos.length > 0 });
      recorrer(nodo.hijos, nivel + 1);
    }
  };

  recorrer(nodos, 0);

  return filas;
}
