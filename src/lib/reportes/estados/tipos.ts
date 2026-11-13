import type { FilaEstadoResultados } from "../tipos";

export type ClaseFila = "titulo" | "detalle" | "grupo" | "total";

export type Vista = "detallado" | "resumido";

export interface FilaReporte {
  clave: string;
  clase: ClaseFila;
  codigo: string;
  nombre: string;
  actual: number;
  anterior: number;
  porcentajeActual: number;
  porcentajeAnterior: number;
  variacionAbsoluta: number;
  variacionRelativa: number;
}

export interface OpcionesReporte {
  busqueda?: string;
  resumido?: boolean;
}

export interface CuentaEstado {
  id: string;
  codigo: string;
  nombre: string;
  tipo: string;
  naturaleza: string;
  padre_id: string | null;
  acepta_movimientos: boolean;
  es_caja_banco: boolean;
}

export interface EstadoResultadosComparativo {
  filas: FilaReporte[];
}

export interface EntradaSituacion {
  cuentas: readonly CuentaEstado[];
  saldosActuales: Readonly<Record<string, number>>;
  saldosAnteriores: Readonly<Record<string, number>>;
  utilidadEjercicio: number;
  utilidadEjercicioAnterior: number;
  utilidadAnterior: number;
  utilidadAnteriorAnterior: number;
}

export interface SituacionFinancieraCalculada {
  filas: FilaReporte[];
  totalActivos: number;
  totalPasivosPatrimonio: number;
  diferencia: number;
  cuadra: boolean;
}

export interface FlujoPeriodo {
  resultados: readonly FilaEstadoResultados[];
  saldosInicio: Readonly<Record<string, number>>;
  saldosFin: Readonly<Record<string, number>>;
}

export interface EntradaFlujo {
  cuentas: readonly CuentaEstado[];
  actual: FlujoPeriodo;
  anterior: FlujoPeriodo;
}

export interface FlujoEfectivoCalculado {
  filas: FilaReporte[];
  efectivoFinal: number;
  saldoSituacion: number;
  diferencia: number;
  conceptosSinCuentas: string[];
}
