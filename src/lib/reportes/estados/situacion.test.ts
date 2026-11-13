import { describe, expect, test } from "vitest";

import type { FilaBalanceComprobacion } from "../tipos";
import { calcularSituacionFinanciera, utilidadDesdeBalance } from "./situacion";
import type { CuentaEstado, EntradaSituacion, FilaReporte } from "./tipos";

function cuenta(
  codigo: string,
  nombre: string,
  tipo: string,
  padreId: string | null,
  aceptaMovimientos = true,
): CuentaEstado {
  return {
    id: codigo,
    codigo,
    nombre,
    tipo,
    naturaleza: tipo === "activo" || tipo === "costo" || tipo === "gasto" ? "debito" : "credito",
    padre_id: padreId,
    acepta_movimientos: aceptaMovimientos,
    es_caja_banco: codigo === "1101" || codigo === "1102",
  };
}

const CUENTAS: CuentaEstado[] = [
  cuenta("1", "Activos", "activo", null, false),
  cuenta("11", "Activos corrientes", "activo", "1", false),
  cuenta("1101", "Caja general", "activo", "11"),
  cuenta("1102", "Banco principal", "activo", "11"),
  cuenta("1103", "Cuentas por cobrar clientes", "activo", "11"),
  cuenta("1104", "Inventario", "activo", "11"),
  cuenta("1105", "ITBIS adelantado", "activo", "11"),
  cuenta("2", "Pasivos", "pasivo", null, false),
  cuenta("21", "Pasivos corrientes", "pasivo", "2", false),
  cuenta("2101", "Cuentas por pagar", "pasivo", "21"),
  cuenta("2102", "ITBIS por pagar", "pasivo", "21"),
  cuenta("22", "Pasivos no corrientes", "pasivo", "2", false),
  cuenta("2201", "Obligaciones financieras", "pasivo", "22"),
  cuenta("3", "Patrimonio", "capital", null, false),
  cuenta("3101", "Capital social", "capital", "3"),
  cuenta("3201", "Resultados acumulados", "capital", "3"),
];

const SALDOS_ACTUALES: Record<string, number> = {
  "1102": -3_907_000,
  "1103": 863_800,
  "1104": 12_480_000,
  "1105": 702_000,
  "2102": 333_000,
  "2201": -519_200,
  "3101": 9_690_000,
};

const ENTRADA: EntradaSituacion = {
  cuentas: CUENTAS,
  saldosActuales: SALDOS_ACTUALES,
  saldosAnteriores: {},
  utilidadEjercicio: 635_000,
  utilidadEjercicioAnterior: 0,
  utilidadAnterior: 0,
  utilidadAnteriorAnterior: 0,
};

function buscarFila(filas: readonly FilaReporte[], nombre: string): FilaReporte | undefined {
  return filas.find((fila) => fila.nombre === nombre);
}

describe("utilidad desde la balanza de comprobación", () => {
  test("suma ingresos y resta costos y gastos en centavos", () => {
    const filas: FilaBalanceComprobacion[] = [
      {
        cuenta_codigo: "4101",
        cuenta_nombre: "Ventas de productos",
        tipo: "ingreso",
        debitos: "0.00",
        creditos: "1000.00",
        saldo: "1000.00",
      },
      {
        cuenta_codigo: "5101",
        cuenta_nombre: "Costo de ventas",
        tipo: "costo",
        debitos: "400.00",
        creditos: "0.00",
        saldo: "400.00",
      },
      {
        cuenta_codigo: "6101",
        cuenta_nombre: "Gastos generales",
        tipo: "gasto",
        debitos: "250.50",
        creditos: "0.00",
        saldo: "250.50",
      },
      {
        cuenta_codigo: "1101",
        cuenta_nombre: "Caja general",
        tipo: "activo",
        debitos: "100.00",
        creditos: "0.00",
        saldo: "100.00",
      },
    ];

    expect(utilidadDesdeBalance(filas)).toBe(34950);
    expect(utilidadDesdeBalance([])).toBe(0);
  });
});

describe("estado de situación financiera", () => {
  const calculado = calcularSituacionFinanciera(ENTRADA);

  test("cuadra activos con pasivos más patrimonio", () => {
    expect(calculado.totalActivos).toBe(10_138_800);
    expect(calculado.totalPasivosPatrimonio).toBe(10_138_800);
    expect(calculado.diferencia).toBe(0);
    expect(calculado.cuadra).toBe(true);
  });

  test("muestra el patrimonio y el resultado del ejercicio", () => {
    expect(buscarFila(calculado.filas, "Total patrimonio")?.actual).toBe(10_325_000);
    expect(buscarFila(calculado.filas, "Resultado del ejercicio")?.actual).toBe(635_000);
    expect(buscarFila(calculado.filas, "Resultados de ejercicios anteriores")?.actual).toBe(0);
  });

  test("calcula el análisis vertical contra el total de activos", () => {
    expect(buscarFila(calculado.filas, "Banco principal")?.porcentajeActual).toBe(38.54);
  });

  test("suma la utilidad anterior y la cuenta 3201 en resultados de ejercicios anteriores", () => {
    const conAcumulados: EntradaSituacion = {
      ...ENTRADA,
      saldosActuales: { ...SALDOS_ACTUALES, "3201": 1_000_000 },
      utilidadAnterior: 500_000,
    };
    const situacion = calcularSituacionFinanciera(conAcumulados);

    expect(buscarFila(situacion.filas, "Resultados de ejercicios anteriores")?.actual).toBe(1_500_000);
    expect(buscarFila(situacion.filas, "Total patrimonio")?.actual).toBe(11_825_000);
  });

  test("en vista resumida omite los detalles y conserva los subtotales", () => {
    const resumido = calcularSituacionFinanciera(ENTRADA, { resumido: true });

    expect(buscarFila(resumido.filas, "Banco principal")).toBeUndefined();
    expect(buscarFila(resumido.filas, "Activos corrientes")?.actual).toBe(10_138_800);
    expect(buscarFila(resumido.filas, "Total patrimonio")?.actual).toBe(10_325_000);
  });
});
