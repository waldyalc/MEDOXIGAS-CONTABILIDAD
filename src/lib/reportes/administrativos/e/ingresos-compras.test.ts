import { describe, expect, test } from "vitest";

import type { CuentaContable, FilaEstadoResultados } from "../../tipos";
import { aplanarIngresosCompras, calcularReporteIngresosCompras } from "./ingresos-compras";

function cuenta(
  id: string,
  codigo: string,
  nombre: string,
  tipo: CuentaContable["tipo"],
  padreId: string | null,
): CuentaContable {
  return {
    id,
    codigo,
    nombre,
    tipo,
    naturaleza: tipo === "ingreso" ? "credito" : "debito",
    padre_id: padreId,
    acepta_movimientos: padreId != null,
    activa: true,
  };
}

const CUENTAS: CuentaContable[] = [
  cuenta("4", "4", "Ingresos", "ingreso", null),
  cuenta("41", "41", "Ingresos de actividades ordinarias", "ingreso", "4"),
  cuenta("4101", "4101", "Ventas de productos", "ingreso", "41"),
  cuenta("4102", "4102", "Ventas de servicios", "ingreso", "41"),
  cuenta("5", "5", "Costos", "costo", null),
  cuenta("5101", "5101", "Costo de ventas", "costo", "5"),
  cuenta("6", "6", "Gastos", "gasto", null),
  cuenta("6101", "6101", "Gastos generales", "gasto", "6"),
  cuenta("6106", "6106", "Agua", "gasto", "6101"),
];

const FILAS: FilaEstadoResultados[] = [
  { tipo: "ingreso", cuenta_codigo: "4101", cuenta_nombre: "Ventas de productos", monto: "18500.00" },
  { tipo: "costo", cuenta_codigo: "5101", cuenta_nombre: "Costo de ventas", monto: "11100.00" },
  { tipo: "gasto", cuenta_codigo: "6106", cuenta_nombre: "Agua", monto: "1050.00" },
];

describe("reporte de ingresos y compras", () => {
  test("arma el árbol por padre y acumula los montos en los padres", () => {
    const reporte = calcularReporteIngresosCompras(CUENTAS, FILAS);

    expect(reporte.ingresos).toHaveLength(1);
    const ingresos = reporte.ingresos[0];
    expect(ingresos?.codigo).toBe("4");
    expect(ingresos?.monto).toBe(1_850_000);
    expect(ingresos?.hijos[0]?.codigo).toBe("41");
    expect(ingresos?.hijos[0]?.hijos[0]?.codigo).toBe("4101");
    expect(ingresos?.hijos[0]?.hijos[0]?.monto).toBe(1_850_000);

    const filasPlanas = aplanarIngresosCompras([...reporte.ingresos, ...reporte.costos, ...reporte.gastos]);
    expect(filasPlanas.map((fila) => [fila.nodo.codigo, fila.nivel])).toEqual([
      ["4", 0],
      ["41", 1],
      ["4101", 2],
      ["4102", 2],
      ["5", 0],
      ["5101", 1],
      ["6", 0],
      ["6101", 1],
      ["6106", 2],
    ]);
  });

  test("costos y gastos van en negativo y cuadran con los totales de las notas", () => {
    const reporte = calcularReporteIngresosCompras(CUENTAS, FILAS);

    expect(reporte.totalIngresos).toBe(1_850_000);
    expect(reporte.totalEgresos).toBe(-1_215_000);
    expect(reporte.saldo).toBe(635_000);
    expect(reporte.costos[0]?.monto).toBe(-1_110_000);
    expect(reporte.gastos[0]?.monto).toBe(-105_000);
    expect(reporte.gastos[0]?.hijos[0]?.hijos[0]?.monto).toBe(-105_000);
  });

  test("muestra u oculta cuentas en cero según el switch", () => {
    const conCeros = calcularReporteIngresosCompras(CUENTAS, FILAS, { incluirCeros: true });
    const sinCeros = calcularReporteIngresosCompras(CUENTAS, FILAS, { incluirCeros: false });

    expect(conCeros.ingresos[0]?.hijos[0]?.hijos.map((nodo) => nodo.codigo)).toEqual(["4101", "4102"]);
    expect(sinCeros.ingresos[0]?.hijos[0]?.hijos.map((nodo) => nodo.codigo)).toEqual(["4101"]);
    expect(calcularReporteIngresosCompras(CUENTAS, FILAS, { incluirCeros: false }).saldo).toBe(635_000);
  });

  test("busca por nombre o código y conserva la ruta de padres", () => {
    const reporte = calcularReporteIngresosCompras(CUENTAS, FILAS, { buscar: "agua", incluirCeros: false });

    expect(reporte.ingresos).toEqual([]);
    expect(reporte.costos).toEqual([]);
    expect(reporte.gastos.map((nodo) => nodo.codigo)).toEqual(["6"]);
    expect(reporte.gastos[0]?.hijos.map((nodo) => nodo.codigo)).toEqual(["6101"]);
    expect(reporte.gastos[0]?.hijos[0]?.hijos.map((nodo) => nodo.codigo)).toEqual(["6106"]);

    const porCodigo = calcularReporteIngresosCompras(CUENTAS, FILAS, { buscar: "4101", incluirCeros: true });
    expect(porCodigo.ingresos[0]?.hijos[0]?.hijos.map((nodo) => nodo.codigo)).toEqual(["4101"]);
  });
});
