import { describe, expect, test } from "vitest";

import type { FilaEstadoResultados } from "../tipos";
import { calcularFlujoEfectivo } from "./flujo";
import type { CuentaEstado, EntradaFlujo, FilaReporte } from "./tipos";

const CUENTAS: CuentaEstado[] = [
  {
    id: "1",
    codigo: "1",
    nombre: "Activos",
    tipo: "activo",
    naturaleza: "debito",
    padre_id: null,
    acepta_movimientos: false,
    es_caja_banco: false,
  },
  {
    id: "11",
    codigo: "11",
    nombre: "Activos corrientes",
    tipo: "activo",
    naturaleza: "debito",
    padre_id: "1",
    acepta_movimientos: false,
    es_caja_banco: false,
  },
  {
    id: "1101",
    codigo: "1101",
    nombre: "Caja general",
    tipo: "activo",
    naturaleza: "debito",
    padre_id: "11",
    acepta_movimientos: true,
    es_caja_banco: true,
  },
  {
    id: "1102",
    codigo: "1102",
    nombre: "Banco principal",
    tipo: "activo",
    naturaleza: "debito",
    padre_id: "11",
    acepta_movimientos: true,
    es_caja_banco: true,
  },
  {
    id: "1103",
    codigo: "1103",
    nombre: "Cuentas por cobrar clientes",
    tipo: "activo",
    naturaleza: "debito",
    padre_id: "11",
    acepta_movimientos: true,
    es_caja_banco: false,
  },
  {
    id: "1104",
    codigo: "1104",
    nombre: "Inventario de mercancía",
    tipo: "activo",
    naturaleza: "debito",
    padre_id: "11",
    acepta_movimientos: true,
    es_caja_banco: false,
  },
  {
    id: "1105",
    codigo: "1105",
    nombre: "ITBIS adelantado en compras",
    tipo: "activo",
    naturaleza: "debito",
    padre_id: "11",
    acepta_movimientos: true,
    es_caja_banco: false,
  },
  {
    id: "2",
    codigo: "2",
    nombre: "Pasivos",
    tipo: "pasivo",
    naturaleza: "credito",
    padre_id: null,
    acepta_movimientos: false,
    es_caja_banco: false,
  },
  {
    id: "21",
    codigo: "21",
    nombre: "Pasivos corrientes",
    tipo: "pasivo",
    naturaleza: "credito",
    padre_id: "2",
    acepta_movimientos: false,
    es_caja_banco: false,
  },
  {
    id: "2101",
    codigo: "2101",
    nombre: "Cuentas por pagar proveedores",
    tipo: "pasivo",
    naturaleza: "credito",
    padre_id: "21",
    acepta_movimientos: true,
    es_caja_banco: false,
  },
  {
    id: "2102",
    codigo: "2102",
    nombre: "ITBIS por pagar",
    tipo: "pasivo",
    naturaleza: "credito",
    padre_id: "21",
    acepta_movimientos: true,
    es_caja_banco: false,
  },
  {
    id: "22",
    codigo: "22",
    nombre: "Pasivos no corrientes",
    tipo: "pasivo",
    naturaleza: "credito",
    padre_id: "2",
    acepta_movimientos: false,
    es_caja_banco: false,
  },
  {
    id: "2201",
    codigo: "2201",
    nombre: "Obligaciones financieras",
    tipo: "pasivo",
    naturaleza: "credito",
    padre_id: "22",
    acepta_movimientos: true,
    es_caja_banco: false,
  },
  {
    id: "3",
    codigo: "3",
    nombre: "Patrimonio",
    tipo: "capital",
    naturaleza: "credito",
    padre_id: null,
    acepta_movimientos: false,
    es_caja_banco: false,
  },
  {
    id: "3101",
    codigo: "3101",
    nombre: "Capital social",
    tipo: "capital",
    naturaleza: "credito",
    padre_id: "3",
    acepta_movimientos: true,
    es_caja_banco: false,
  },
  {
    id: "3201",
    codigo: "3201",
    nombre: "Resultados acumulados",
    tipo: "capital",
    naturaleza: "credito",
    padre_id: "3",
    acepta_movimientos: true,
    es_caja_banco: false,
  },
];

const RESULTADOS_ACTUALES: FilaEstadoResultados[] = [
  { tipo: "ingreso", cuenta_codigo: "4101", cuenta_nombre: "Ventas de productos", monto: "18500.00" },
  { tipo: "costo", cuenta_codigo: "5101", cuenta_nombre: "Costo de ventas", monto: "11100.00" },
  { tipo: "gasto", cuenta_codigo: "6101", cuenta_nombre: "Gastos generales", monto: "250.00" },
  { tipo: "gasto", cuenta_codigo: "6102", cuenta_nombre: "Artículos de oficina", monto: "300.00" },
  { tipo: "gasto", cuenta_codigo: "6103", cuenta_nombre: "Combustibles y lubricantes", monto: "500.00" },
];

const ENTRADA: EntradaFlujo = {
  cuentas: CUENTAS,
  actual: {
    resultados: RESULTADOS_ACTUALES,
    saldosInicio: {},
    saldosFin: {
      "1102": -3_907_000,
      "1103": 863_800,
      "1104": 12_480_000,
      "1105": 702_000,
      "2102": 333_000,
      "2201": -519_200,
      "3101": 9_690_000,
    },
  },
  anterior: {
    resultados: [],
    saldosInicio: {},
    saldosFin: {},
  },
};

function buscarFila(filas: readonly FilaReporte[], nombre: string): FilaReporte {
  const fila = filas.find((actual) => actual.nombre === nombre);
  if (fila == null) throw new Error(`No se encontró la fila ${nombre}`);
  return fila;
}

describe("estado de flujo de efectivo (método indirecto)", () => {
  test("reproduce los totales de 08-notas-contables", () => {
    const flujo = calcularFlujoEfectivo(ENTRADA);

    expect(buscarFila(flujo.filas, "Utilidad neta").actual).toBe(635_000);
    expect(buscarFila(flujo.filas, "Cambios en cuentas por cobrar").actual).toBe(-863_800);
    expect(buscarFila(flujo.filas, "Cambios en inventarios").actual).toBe(-12_480_000);
    expect(buscarFila(flujo.filas, "Cambios en otros activos corrientes").actual).toBe(-702_000);
    expect(buscarFila(flujo.filas, "Cambios en cuentas por pagar").actual).toBe(0);
    expect(buscarFila(flujo.filas, "Cambios en otros pasivos corrientes").actual).toBe(333_000);
    expect(buscarFila(flujo.filas, "Total efectivo generado en actividades de operación").actual).toBe(-13_077_800);
    expect(buscarFila(flujo.filas, "Total actividades de inversión").actual).toBe(0);
    expect(buscarFila(flujo.filas, "Total actividades de financiación").actual).toBe(9_170_800);
    expect(buscarFila(flujo.filas, "Aumento (disminución) de efectivo").actual).toBe(-3_907_000);
    expect(buscarFila(flujo.filas, "Efectivo al inicio").actual).toBe(0);

    expect(flujo.efectivoFinal).toBe(-3_907_000);
    expect(buscarFila(flujo.filas, "Efectivo al final").actual).toBe(-3_907_000);
    expect(flujo.saldoSituacion).toBe(-3_907_000);
    expect(buscarFila(flujo.filas, "Saldo del Estado de Situación Financiera").actual).toBe(-3_907_000);
    expect(flujo.diferencia).toBe(0);
    expect(buscarFila(flujo.filas, "Diferencia").actual).toBe(0);
    expect(buscarFila(flujo.filas, "Utilidad neta").anterior).toBe(0);
    expect(flujo.conceptosSinCuentas).toContain("Depreciaciones, amortizaciones y desvalorizaciones");
  });

  test("detalla inversión y financiación por cuenta", () => {
    const flujo = calcularFlujoEfectivo(ENTRADA);

    expect(buscarFila(flujo.filas, "Obligaciones financieras").actual).toBe(-519_200);
    expect(buscarFila(flujo.filas, "Capital social").actual).toBe(9_690_000);
    expect(flujo.filas.some((fila) => fila.nombre === "Resultados acumulados")).toBe(false);
  });

  test("calcula el análisis vertical sobre el total de operación con signo", () => {
    const flujo = calcularFlujoEfectivo(ENTRADA);

    expect(buscarFila(flujo.filas, "Utilidad neta").porcentajeActual).toBe(-4.86);
    expect(buscarFila(flujo.filas, "Cambios en inventarios").porcentajeActual).toBe(95.43);
  });

  test("la búsqueda solo filtra filas de detalle", () => {
    const flujo = calcularFlujoEfectivo(ENTRADA, { busqueda: "inventario" });

    expect(flujo.filas.some((fila) => fila.nombre === "Actividades de operación")).toBe(true);
    expect(flujo.filas.some((fila) => fila.nombre === "Total efectivo generado en actividades de operación")).toBe(
      true,
    );
    expect(flujo.filas.some((fila) => fila.nombre === "Cambios en inventarios")).toBe(true);
    expect(flujo.filas.some((fila) => fila.nombre === "Utilidad neta")).toBe(false);
  });
});
