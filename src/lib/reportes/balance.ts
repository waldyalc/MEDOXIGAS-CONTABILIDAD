import { centavos } from "./dinero";
import type { FilaBalanceComprobacion } from "./tipos";

export interface FilaBalanceCalculada {
  codigo: string;
  nombre: string;
  tipo: string;
  debitos: number;
  creditos: number;
  saldo: number;
}

export interface TotalesBalance {
  debitos: number;
  creditos: number;
  diferencia: number;
  cuadra: boolean;
}

export interface BalanceCalculado {
  filas: FilaBalanceCalculada[];
  totales: TotalesBalance;
}

export function calcularBalance(filas: readonly FilaBalanceComprobacion[]): BalanceCalculado {
  const calculadas = filas.map<FilaBalanceCalculada>((fila) => ({
    codigo: fila.cuenta_codigo,
    nombre: fila.cuenta_nombre,
    tipo: fila.tipo,
    debitos: centavos(fila.debitos),
    creditos: centavos(fila.creditos),
    saldo: centavos(fila.saldo),
  }));

  const debitos = calculadas.reduce((total, fila) => total + fila.debitos, 0);
  const creditos = calculadas.reduce((total, fila) => total + fila.creditos, 0);
  const diferencia = debitos - creditos;

  return {
    filas: calculadas,
    totales: { debitos, creditos, diferencia, cuadra: diferencia === 0 },
  };
}
