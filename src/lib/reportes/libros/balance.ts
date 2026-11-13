import { centavos } from "../dinero";
import type { CuentaContable } from "../tipos";
import { partirSaldo, signoNeto } from "./comun";
import type { FilaSaldoCuenta } from "./tipos";

interface Agregado {
  saldoInicialDebito: number;
  saldoInicialCredito: number;
  debitos: number;
  creditos: number;
  saldoFinalDebito: number;
  saldoFinalCredito: number;
}

interface Nodo {
  cuenta: CuentaContable;
  hijos: Nodo[];
  propio: Agregado;
}

export interface OpcionesBalanza {
  buscar: string;
  incluirCero: boolean;
}

export interface FilaBalanzaCalculada {
  clave: string;
  tipo: string;
  codigo: string;
  nombre: string;
  nivel: number;
  esGrupo: boolean;
  esPadre: boolean;
  saldoInicialDebito: number;
  saldoInicialCredito: number;
  debitos: number;
  creditos: number;
  saldoFinalDebito: number;
  saldoFinalCredito: number;
}

export interface TotalesBalanza {
  saldoInicialDebito: number;
  saldoInicialCredito: number;
  debitos: number;
  creditos: number;
  saldoFinalDebito: number;
  saldoFinalCredito: number;
  cuadra: boolean;
}

export interface BalanzaCalculada {
  filas: FilaBalanzaCalculada[];
  totales: TotalesBalanza;
}

const ORDEN_TIPOS = ["activo", "pasivo", "capital", "ingreso", "costo", "gasto"];

function vacio(): Agregado {
  return {
    saldoInicialDebito: 0,
    saldoInicialCredito: 0,
    debitos: 0,
    creditos: 0,
    saldoFinalDebito: 0,
    saldoFinalCredito: 0,
  };
}

function sumar(a: Agregado, b: Agregado): Agregado {
  return {
    saldoInicialDebito: a.saldoInicialDebito + b.saldoInicialDebito,
    saldoInicialCredito: a.saldoInicialCredito + b.saldoInicialCredito,
    debitos: a.debitos + b.debitos,
    creditos: a.creditos + b.creditos,
    saldoFinalDebito: a.saldoFinalDebito + b.saldoFinalDebito,
    saldoFinalCredito: a.saldoFinalCredito + b.saldoFinalCredito,
  };
}

function tieneMontos(agregado: Agregado): boolean {
  return (
    agregado.saldoInicialDebito !== 0 ||
    agregado.saldoInicialCredito !== 0 ||
    agregado.debitos !== 0 ||
    agregado.creditos !== 0 ||
    agregado.saldoFinalDebito !== 0 ||
    agregado.saldoFinalCredito !== 0
  );
}

function agregadoDeCuenta(fila: FilaSaldoCuenta): Agregado {
  const saldoInicial = centavos(fila.saldo_inicial);
  const debitos = centavos(fila.debitos);
  const creditos = centavos(fila.creditos);
  const inicial = partirSaldo(saldoInicial, fila.cuenta_naturaleza);
  const final = partirSaldo(
    saldoInicial + signoNeto(fila.cuenta_naturaleza, debitos, creditos),
    fila.cuenta_naturaleza,
  );

  return {
    saldoInicialDebito: inicial.debito,
    saldoInicialCredito: inicial.credito,
    debitos,
    creditos,
    saldoFinalDebito: final.debito,
    saldoFinalCredito: final.credito,
  };
}

export function calcularBalanza(
  saldos: readonly FilaSaldoCuenta[],
  cuentas: readonly CuentaContable[],
  opciones: OpcionesBalanza,
): BalanzaCalculada {
  const porId = new Map<string, Nodo>();

  for (const cuenta of cuentas) {
    porId.set(cuenta.id, { cuenta, hijos: [], propio: vacio() });
  }

  const raices: Nodo[] = [];

  for (const nodo of porId.values()) {
    const padre = nodo.cuenta.padre_id ? porId.get(nodo.cuenta.padre_id) : undefined;
    if (padre) {
      padre.hijos.push(nodo);
    } else {
      raices.push(nodo);
    }
  }

  for (const nodo of porId.values()) {
    nodo.hijos.sort((a, b) => a.cuenta.codigo.localeCompare(b.cuenta.codigo));
  }

  raices.sort(
    (a, b) =>
      ORDEN_TIPOS.indexOf(a.cuenta.tipo) - ORDEN_TIPOS.indexOf(b.cuenta.tipo) ||
      a.cuenta.codigo.localeCompare(b.cuenta.codigo),
  );

  for (const fila of saldos) {
    const nodo = porId.get(fila.cuenta_id);
    if (!nodo) continue;
    nodo.propio = sumar(nodo.propio, agregadoDeCuenta(fila));
  }

  const consulta = opciones.buscar.trim().toLowerCase();
  const visibles = new Set<string>();

  function agregarDescendientes(nodo: Nodo) {
    if (visibles.has(nodo.cuenta.id)) return;
    visibles.add(nodo.cuenta.id);
    for (const hijo of nodo.hijos) agregarDescendientes(hijo);
  }

  function agregarAncestros(nodo: Nodo) {
    let actual = nodo.cuenta.padre_id ? porId.get(nodo.cuenta.padre_id) : undefined;
    while (actual) {
      if (visibles.has(actual.cuenta.id)) break;
      visibles.add(actual.cuenta.id);
      actual = actual.cuenta.padre_id ? porId.get(actual.cuenta.padre_id) : undefined;
    }
  }

  if (!consulta) {
    for (const nodo of porId.values()) visibles.add(nodo.cuenta.id);
  } else {
    for (const nodo of porId.values()) {
      const coincide =
        nodo.cuenta.codigo.toLowerCase().includes(consulta) || nodo.cuenta.nombre.toLowerCase().includes(consulta);
      if (!coincide) continue;
      agregarDescendientes(nodo);
      agregarAncestros(nodo);
    }
  }

  const memo = new Map<string, Agregado>();

  function calcular(nodo: Nodo): Agregado {
    const cache = memo.get(nodo.cuenta.id);
    if (cache) return cache;
    if (!visibles.has(nodo.cuenta.id)) return vacio();

    let total = nodo.propio;
    for (const hijo of nodo.hijos) total = sumar(total, calcular(hijo));
    memo.set(nodo.cuenta.id, total);
    return total;
  }

  const filas: FilaBalanzaCalculada[] = [];

  function recorrer(nodo: Nodo, nivel: number) {
    if (!visibles.has(nodo.cuenta.id)) return;

    const total = calcular(nodo);
    if (!opciones.incluirCero && !tieneMontos(total)) return;

    filas.push({
      clave: nodo.cuenta.id,
      tipo: nodo.cuenta.tipo,
      codigo: nodo.cuenta.codigo,
      nombre: nodo.cuenta.nombre,
      nivel,
      esGrupo: nodo.cuenta.padre_id == null,
      esPadre: nodo.hijos.length > 0,
      ...total,
    });

    for (const hijo of nodo.hijos) recorrer(hijo, nivel + 1);
  }

  for (const raiz of raices) recorrer(raiz, 0);

  let totales = vacio();
  for (const raiz of raices) totales = sumar(totales, calcular(raiz));

  return {
    filas,
    totales: {
      ...totales,
      cuadra: totales.saldoFinalDebito === totales.saldoFinalCredito,
    },
  };
}
