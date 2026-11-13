import { describe, expect, test } from "vitest";

import type { FilaEstadoResultados } from "../tipos";
import { calcularEstadoResultadosComparativo } from "./resultados";
import type { FilaReporte } from "./tipos";

const ACTUALES: FilaEstadoResultados[] = [
  { tipo: "ingreso", cuenta_codigo: "4101", cuenta_nombre: "Ventas de productos", monto: "18500.00" },
  { tipo: "costo", cuenta_codigo: "5101", cuenta_nombre: "Costo de ventas", monto: "11100.00" },
  { tipo: "gasto", cuenta_codigo: "6101", cuenta_nombre: "Servicios públicos", monto: "250.00" },
  { tipo: "gasto", cuenta_codigo: "6102", cuenta_nombre: "Artículos de oficina", monto: "300.00" },
  { tipo: "gasto", cuenta_codigo: "6103", cuenta_nombre: "Combustibles y lubricantes", monto: "500.00" },
];

function buscarFila(filas: readonly FilaReporte[], nombre: string): FilaReporte {
  const fila = filas.find((actual) => actual.nombre === nombre);
  if (fila == null) throw new Error(`No se encontró la fila ${nombre}`);
  return fila;
}

describe("estado de resultados comparativo", () => {
  test("reproduce los totales y porcentajes de 08-notas-contables", () => {
    const estado = calcularEstadoResultadosComparativo(ACTUALES, []);
    const ingresos = buscarFila(estado.filas, "Ingresos de actividades ordinarias");
    const costos = buscarFila(estado.filas, "Costos de ventas y operación");
    const utilidadBruta = buscarFila(estado.filas, "Utilidad bruta");
    const gastos = buscarFila(estado.filas, "Gastos");
    const utilidadOperativa = buscarFila(estado.filas, "Utilidad operativa");
    const utilidadNeta = buscarFila(estado.filas, "Utilidad (pérdida) neta");

    expect(ingresos.actual).toBe(1_850_000);
    expect(ingresos.porcentajeActual).toBe(100);
    expect(costos.actual).toBe(-1_110_000);
    expect(costos.porcentajeActual).toBe(60);
    expect(costos.variacionAbsoluta).toBe(1_110_000);
    expect(costos.variacionRelativa).toBe(0);
    expect(utilidadBruta.actual).toBe(740_000);
    expect(utilidadBruta.porcentajeActual).toBe(40);
    expect(gastos.actual).toBe(-105_000);
    expect(gastos.porcentajeActual).toBe(5.68);
    expect(utilidadOperativa.actual).toBe(635_000);
    expect(utilidadOperativa.porcentajeActual).toBe(34.32);
    expect(utilidadNeta.actual).toBe(635_000);
    expect(buscarFila(estado.filas, "Impuestos").actual).toBe(0);
    expect(buscarFila(estado.filas, "Otros ingresos/gastos").actual).toBe(0);
  });

  test("los gastos y costos se muestran en negativo y las cuentas en detalle", () => {
    const estado = calcularEstadoResultadosComparativo(ACTUALES, []);

    expect(buscarFila(estado.filas, "Costo de ventas").actual).toBe(-1_110_000);
    expect(buscarFila(estado.filas, "Servicios públicos").actual).toBe(-25_000);
    expect(buscarFila(estado.filas, "Artículos de oficina").actual).toBe(-30_000);
    expect(buscarFila(estado.filas, "Ventas de productos").actual).toBe(1_850_000);
  });

  test("compara contra el mismo período del año anterior", () => {
    const anteriores: FilaEstadoResultados[] = [
      { tipo: "ingreso", cuenta_codigo: "4101", cuenta_nombre: "Ventas de productos", monto: "1000.00" },
      { tipo: "gasto", cuenta_codigo: "6101", cuenta_nombre: "Servicios públicos", monto: "100.00" },
    ];
    const estado = calcularEstadoResultadosComparativo(ACTUALES, anteriores);
    const ingresos = buscarFila(estado.filas, "Ingresos de actividades ordinarias");
    const neta = buscarFila(estado.filas, "Utilidad (pérdida) neta");

    expect(ingresos.anterior).toBe(100_000);
    expect(ingresos.porcentajeAnterior).toBe(100);
    expect(ingresos.variacionAbsoluta).toBe(1_750_000);
    expect(ingresos.variacionRelativa).toBe(1750);
    expect(neta.anterior).toBe(90_000);
    expect(neta.variacionAbsoluta).toBe(545_000);
    expect(neta.variacionRelativa).toBe(605.56);
  });

  test("filtra cuentas por búsqueda y respeta la vista resumida", () => {
    const filtrado = calcularEstadoResultadosComparativo(ACTUALES, [], { busqueda: "oficina" });
    expect(filtrado.filas.some((fila) => fila.nombre === "Ventas de productos")).toBe(false);
    expect(filtrado.filas.some((fila) => fila.nombre === "Artículos de oficina")).toBe(true);
    expect(buscarFila(filtrado.filas, "Utilidad (pérdida) neta").actual).toBe(635_000);

    const resumido = calcularEstadoResultadosComparativo(ACTUALES, [], { resumido: true });
    expect(resumido.filas.some((fila) => fila.clase === "detalle")).toBe(false);
    expect(buscarFila(resumido.filas, "Utilidad bruta").actual).toBe(740_000);
  });
});
