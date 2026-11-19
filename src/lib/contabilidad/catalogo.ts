import { construirArbolCuentas, type NodoCuenta } from "@/lib/reportes/contabilidad";
import { centavos } from "@/lib/reportes/dinero";
import type { CuentaContable, FilaSaldoCuenta } from "@/lib/reportes/tipos";

export const CONFIGURACION_CONTABLE = [
  { clave: "caja", etiqueta: "Caja" },
  { clave: "banco", etiqueta: "Banco" },
  { clave: "cxc", etiqueta: "Cuentas por cobrar" },
  { clave: "inventario", etiqueta: "Inventario" },
  { clave: "itbis_adelantado", etiqueta: "ITBIS adelantado en compras" },
  { clave: "cxp", etiqueta: "Cuentas por pagar" },
  { clave: "itbis_por_pagar", etiqueta: "ITBIS por pagar" },
  { clave: "ventas", etiqueta: "Ventas de productos" },
  { clave: "ventas_servicios", etiqueta: "Ventas de servicios" },
  { clave: "costo_ventas", etiqueta: "Costo de ventas" },
  { clave: "gastos_generales", etiqueta: "Gastos generales" },
  { clave: "ajustes_iniciales", etiqueta: "Ajustes iniciales" },
] as const;

export const ETIQUETAS_CONFIG: Record<string, string> = Object.fromEntries(
  CONFIGURACION_CONTABLE.map((fila): [string, string] => [fila.clave, fila.etiqueta]),
);

const USOS_BANCO: Record<string, string> = {
  banco: "Cuenta de banco",
  efectivo: "Caja o efectivo",
  tarjeta: "Tarjeta",
};

export function usoDeCuenta(
  cuenta: Pick<CuentaContable, "es_caja_banco" | "tipo_banco">,
  usoConfig?: string,
): string | null {
  if (usoConfig != null) return usoConfig;
  if (!cuenta.es_caja_banco) return null;
  return USOS_BANCO[cuenta.tipo_banco ?? ""] ?? "Caja o banco";
}

export function construirArbolCatalogo(
  cuentas: readonly CuentaContable[],
  saldos: Record<string, number>,
): NodoCuenta[] {
  return construirArbolCuentas(cuentas, saldos);
}

/** Saldos de `catalogo_saldos` indexados por código de cuenta, en centavos. */
export function indexarSaldosPorCodigo(filas: readonly FilaSaldoCuenta[]): Record<string, number> {
  const saldos: Record<string, number> = {};

  for (const fila of filas) {
    saldos[fila.cuenta_codigo] = centavos(fila.saldo);
  }

  return saldos;
}

export function normalizarTexto(valor: string): string {
  return valor
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
    .toLowerCase();
}

function coincide(cuenta: CuentaContable, termino: string): boolean {
  return normalizarTexto(cuenta.nombre).includes(termino) || normalizarTexto(cuenta.codigo).includes(termino);
}

function marcarRamas(nodo: NodoCuenta, expandidos: Set<string>): void {
  if (nodo.hijos.length === 0) return;

  expandidos.add(nodo.cuenta.id);
  for (const hijo of nodo.hijos) marcarRamas(hijo, expandidos);
}

export interface FiltroArbol {
  nodos: NodoCuenta[];
  expandidos: Set<string>;
}

/** Filtra por nombre o código y conserva los ancestros de cada coincidencia. */
export function filtrarArbol(nodos: readonly NodoCuenta[], termino: string): FiltroArbol {
  const texto = normalizarTexto(termino);
  if (texto === "") return { nodos: [...nodos], expandidos: new Set() };

  const expandidos = new Set<string>();

  function filtrar(nodo: NodoCuenta): NodoCuenta | null {
    if (coincide(nodo.cuenta, texto)) {
      marcarRamas(nodo, expandidos);
      return nodo;
    }

    const hijos = nodo.hijos.map(filtrar).filter((hijo): hijo is NodoCuenta => hijo != null);
    if (hijos.length === 0) return null;

    expandidos.add(nodo.cuenta.id);
    return { cuenta: nodo.cuenta, saldo: nodo.saldo, hijos };
  }

  const filtrados = nodos.map(filtrar).filter((nodo): nodo is NodoCuenta => nodo != null);
  return { nodos: filtrados, expandidos };
}

export interface FilaCatalogo {
  nodo: NodoCuenta;
  nivel: number;
  esRaiz: boolean;
  indiceRaiz: number;
  abierta: boolean;
}

export function aplanarArbol(nodos: readonly NodoCuenta[], expandidos: ReadonlySet<string>): FilaCatalogo[] {
  const filas: FilaCatalogo[] = [];

  function recorrer(nodo: NodoCuenta, nivel: number, esRaiz: boolean, indiceRaiz: number): void {
    const abierta = expandidos.has(nodo.cuenta.id);
    filas.push({ nodo, nivel, esRaiz, indiceRaiz, abierta });

    if (!abierta) return;
    for (const hijo of nodo.hijos) recorrer(hijo, nivel + 1, false, indiceRaiz);
  }

  nodos.forEach((nodo, indice) => {
    recorrer(nodo, 0, true, indice);
  });
  return filas;
}

/** Abre Activos y su primer nivel; el resto queda cerrado. */
export function expandidosIniciales(nodos: readonly NodoCuenta[]): Set<string> {
  const expandidos = new Set<string>();
  const activos = nodos.find((nodo) => nodo.cuenta.codigo === "1" || normalizarTexto(nodo.cuenta.nombre) === "activos");
  if (activos == null) return expandidos;

  expandidos.add(activos.cuenta.id);
  for (const hijo of activos.hijos) {
    if (hijo.hijos.length > 0) expandidos.add(hijo.cuenta.id);
  }

  return expandidos;
}

export function expandirTodo(nodos: readonly NodoCuenta[]): Set<string> {
  const expandidos = new Set<string>();

  function recorrer(nodo: NodoCuenta): void {
    if (nodo.hijos.length === 0) return;

    expandidos.add(nodo.cuenta.id);
    for (const hijo of nodo.hijos) recorrer(hijo);
  }

  for (const nodo of nodos) recorrer(nodo);
  return expandidos;
}

export function alternarExpandido(expandidos: ReadonlySet<string>, id: string): Set<string> {
  const siguiente = new Set(expandidos);

  if (siguiente.has(id)) siguiente.delete(id);
  else siguiente.add(id);

  return siguiente;
}

export function indexarNodos(nodos: readonly NodoCuenta[]): Map<string, NodoCuenta> {
  const indice = new Map<string, NodoCuenta>();

  function recorrer(nodo: NodoCuenta): void {
    indice.set(nodo.cuenta.id, nodo);
    for (const hijo of nodo.hijos) recorrer(hijo);
  }

  for (const nodo of nodos) recorrer(nodo);
  return indice;
}
