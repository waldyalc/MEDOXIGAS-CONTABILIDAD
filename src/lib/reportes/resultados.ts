import { centavos } from "./dinero";
import type { FilaEstadoResultados } from "./tipos";

export interface FilaResultadoCalculada {
  codigo: string;
  nombre: string;
  monto: number;
}

export interface EstadoResultadosCalculado {
  ingresos: FilaResultadoCalculada[];
  costos: FilaResultadoCalculada[];
  gastos: FilaResultadoCalculada[];
  totalIngresos: number;
  totalCostos: number;
  utilidadBruta: number;
  totalGastos: number;
  utilidadNeta: number;
}

export function calcularEstadoResultados(filas: readonly FilaEstadoResultados[]): EstadoResultadosCalculado {
  const ingresos: FilaResultadoCalculada[] = [];
  const costos: FilaResultadoCalculada[] = [];
  const gastos: FilaResultadoCalculada[] = [];

  for (const fila of filas) {
    const calculada: FilaResultadoCalculada = {
      codigo: fila.cuenta_codigo,
      nombre: fila.cuenta_nombre,
      monto: centavos(fila.monto),
    };

    if (fila.tipo === "ingreso") ingresos.push(calculada);
    else if (fila.tipo === "costo") costos.push(calculada);
    else if (fila.tipo === "gasto") gastos.push(calculada);
  }

  const ordenar = (lista: FilaResultadoCalculada[]) => lista.sort((a, b) => a.codigo.localeCompare(b.codigo));

  const totalIngresos = ingresos.reduce((total, fila) => total + fila.monto, 0);
  const totalCostos = costos.reduce((total, fila) => total + fila.monto, 0);
  const totalGastos = gastos.reduce((total, fila) => total + fila.monto, 0);
  const utilidadBruta = totalIngresos - totalCostos;

  return {
    ingresos: ordenar(ingresos),
    costos: ordenar(costos),
    gastos: ordenar(gastos),
    totalIngresos,
    totalCostos,
    utilidadBruta,
    totalGastos,
    utilidadNeta: utilidadBruta - totalGastos,
  };
}
