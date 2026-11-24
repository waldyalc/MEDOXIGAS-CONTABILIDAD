import { centavos } from "./dinero";
import type { CuentaContable, FilaBalanceComprobacion } from "./tipos";

export interface NodoCuenta {
  cuenta: CuentaContable;
  saldo: number;
  hijos: NodoCuenta[];
}

export function saldosPorCodigo(filas: readonly FilaBalanceComprobacion[]): Record<string, number> {
  const saldos: Record<string, number> = {};

  for (const fila of filas) {
    saldos[fila.cuenta_codigo] = centavos(fila.saldo);
  }

  return saldos;
}

/**
 * Acumula en cada padre el saldo de sus hijos. Un hijo con naturaleza distinta
 * a la del padre es una contra-cuenta (por ejemplo, `1211 Depreciación
 * acumulada` dentro de `12 Activos no corrientes`): su saldo resta en vez de
 * sumar, para que el padre muestre el neto y no el doble.
 */
function sumarSaldoHijos(nodos: NodoCuenta[], naturalezaPadre: string): number {
  let total = 0;

  for (const nodo of nodos) {
    nodo.saldo += sumarSaldoHijos(nodo.hijos, nodo.cuenta.naturaleza);
    total += nodo.cuenta.naturaleza === naturalezaPadre ? nodo.saldo : -nodo.saldo;
  }

  return total;
}

/** Arma el árbol usando padre_id (o deja como raíz si no encuentra al padre). */
export function construirArbolCuentas(
  cuentas: readonly CuentaContable[],
  saldos: Record<string, number>,
): NodoCuenta[] {
  const ordenadas = [...cuentas].sort((a, b) => a.codigo.localeCompare(b.codigo));
  const nodos = new Map<string, NodoCuenta>();

  for (const cuenta of ordenadas) {
    nodos.set(cuenta.id, { cuenta, saldo: saldos[cuenta.codigo] ?? 0, hijos: [] });
  }

  const raices: NodoCuenta[] = [];

  for (const cuenta of ordenadas) {
    const nodo = nodos.get(cuenta.id);
    if (nodo == null) continue;

    const padre = cuenta.padre_id == null ? undefined : nodos.get(cuenta.padre_id);

    if (padre == null || padre === nodo) raices.push(nodo);
    else padre.hijos.push(nodo);
  }

  for (const raiz of raices) {
    raiz.saldo += sumarSaldoHijos(raiz.hijos, raiz.cuenta.naturaleza);
  }

  return raices;
}
