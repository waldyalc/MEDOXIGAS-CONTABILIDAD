import { describe, expect, test } from "vitest";

import type { FilaEstadoResultados } from "../tipos";
import { calcularEstadoResultadosComparativo } from "./resultados";
import type { CuentaEstado, FilaReporte } from "./tipos";

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

function cuenta(cambios: Partial<CuentaEstado> & Pick<CuentaEstado, "codigo" | "nombre" | "tipo">): CuentaEstado {
  return {
    id: cambios.codigo,
    naturaleza: cambios.tipo === "ingreso" ? "credito" : "debito",
    padre_id: null,
    acepta_movimientos: true,
    es_caja_banco: false,
    activa: true,
    ...cambios,
  };
}

describe("estado de resultados comparativo", () => {
  test("reproduce el esqueleto y los totales del estado de Alegra", () => {
    const estado = calcularEstadoResultadosComparativo(ACTUALES, []);
    const nombres = estado.filas.map((fila) => fila.nombre);

    for (const esperado of [
      "Ingresos de actividades ordinarias",
      "Ventas",
      "Costos de ventas y operación",
      "Utilidad bruta",
      "Gastos de venta",
      "Gastos de administración",
      "Gastos generales",
      "Utilidad operativa",
      "Otros Ingresos",
      "Gastos financieros",
      "Otros gastos",
      "Utilidad antes de impuestos",
      "Gastos por impuestos",
      "Utilidad/pérdida neta",
    ]) {
      expect(nombres).toContain(esperado);
    }

    const ingresos = buscarFila(estado.filas, "Ingresos de actividades ordinarias");
    const costos = buscarFila(estado.filas, "Costos de ventas y operación");
    const utilidadBruta = buscarFila(estado.filas, "Utilidad bruta");
    const generales = buscarFila(estado.filas, "Gastos generales");
    const utilidadOperativa = buscarFila(estado.filas, "Utilidad operativa");
    const utilidadNeta = buscarFila(estado.filas, "Utilidad/pérdida neta");

    expect(ingresos.actual).toBe(1_850_000);
    expect(ingresos.porcentajeActual).toBe(100);
    expect(costos.actual).toBe(-1_110_000);
    expect(costos.porcentajeActual).toBe(60);
    expect(costos.variacionAbsoluta).toBe(1_110_000);
    expect(costos.variacionRelativa).toBe(0);
    expect(utilidadBruta.actual).toBe(740_000);
    expect(utilidadBruta.porcentajeActual).toBe(40);
    expect(generales.actual).toBe(-105_000);
    expect(generales.porcentajeActual).toBe(5.68);
    expect(utilidadOperativa.actual).toBe(635_000);
    expect(utilidadOperativa.porcentajeActual).toBe(34.32);
    expect(utilidadNeta.actual).toBe(635_000);
    expect(buscarFila(estado.filas, "Gastos por impuestos").actual).toBe(0);
    expect(buscarFila(estado.filas, "Otros Ingresos").actual).toBe(0);
    expect(buscarFila(estado.filas, "Utilidad antes de impuestos").actual).toBe(635_000);
  });

  test("los gastos y costos se muestran en negativo y las cuentas cuelgan de su subgrupo", () => {
    const estado = calcularEstadoResultadosComparativo(ACTUALES, []);

    expect(buscarFila(estado.filas, "Costo de ventas").actual).toBe(-1_110_000);
    expect(buscarFila(estado.filas, "Costo de ventas").nivel).toBe(2);
    expect(buscarFila(estado.filas, "Servicios públicos").actual).toBe(-25_000);
    expect(buscarFila(estado.filas, "Servicios públicos").nivel).toBe(1);
    expect(buscarFila(estado.filas, "Artículos de oficina").actual).toBe(-30_000);
    expect(buscarFila(estado.filas, "Ventas de productos").actual).toBe(1_850_000);
    expect(buscarFila(estado.filas, "Ventas").nivel).toBe(1);
  });

  test("lista las cuentas del catálogo aunque no hayan tenido movimiento", () => {
    const catalogo = [
      cuenta({ codigo: "6123", nombre: "Viáticos y dietas", tipo: "gasto" }),
      cuenta({ codigo: "4102", nombre: "Ventas de servicios", tipo: "ingreso" }),
      cuenta({ codigo: "6199", nombre: "Cuenta desactivada", tipo: "gasto", activa: false }),
      cuenta({ codigo: "6", nombre: "Gastos", tipo: "gasto", acepta_movimientos: false }),
    ];
    const estado = calcularEstadoResultadosComparativo(ACTUALES, [], { cuentas: catalogo });

    expect(buscarFila(estado.filas, "Viáticos y dietas").actual).toBe(-0);
    expect(buscarFila(estado.filas, "Ventas de servicios").actual).toBe(0);
    expect(buscarFila(estado.filas, "Viáticos y dietas").cuentaId).toBe("6123");
    expect(estado.filas.some((fila) => fila.nombre === "Cuenta desactivada")).toBe(false);
    expect(estado.filas.some((fila) => fila.codigo === "6")).toBe(false);
  });

  test("las cuentas de personal van a Gastos de administración y las financieras a su sección", () => {
    const catalogo = [
      cuenta({ codigo: "6110", nombre: "Sueldos y salarios", tipo: "gasto" }),
      cuenta({ codigo: "6301", nombre: "Intereses pagados", tipo: "gasto" }),
      cuenta({ codigo: "6601", nombre: "Comisiones bancarias", tipo: "gasto" }),
    ];
    const estado = calcularEstadoResultadosComparativo(ACTUALES, [], { cuentas: catalogo });

    const personal = buscarFila(estado.filas, "Gastos de personal");
    expect(personal.nivel).toBe(1);
    const iSueldos = estado.filas.findIndex((fila) => fila.nombre === "Sueldos y salarios");
    const iPersonal = estado.filas.findIndex((fila) => fila.nombre === "Gastos de personal");
    expect(iSueldos).toBeGreaterThan(iPersonal);
    const iIntereses = estado.filas.findIndex((fila) => fila.nombre === "Intereses pagados");
    const iFinancieros = estado.filas.findIndex((fila) => fila.nombre === "Gastos financieros");
    expect(iIntereses).toBeGreaterThan(iFinancieros);
    const iComisiones = estado.filas.findIndex((fila) => fila.nombre === "Comisiones bancarias");
    const iOtros = estado.filas.findIndex((fila) => fila.nombre === "Otros gastos");
    expect(iComisiones).toBeGreaterThan(iOtros);
  });

  test("compara contra el mismo período del año anterior", () => {
    const anteriores: FilaEstadoResultados[] = [
      { tipo: "ingreso", cuenta_codigo: "4101", cuenta_nombre: "Ventas de productos", monto: "1000.00" },
      { tipo: "gasto", cuenta_codigo: "6101", cuenta_nombre: "Servicios públicos", monto: "100.00" },
    ];
    const estado = calcularEstadoResultadosComparativo(ACTUALES, anteriores);
    const ingresos = buscarFila(estado.filas, "Ingresos de actividades ordinarias");
    const neta = buscarFila(estado.filas, "Utilidad/pérdida neta");

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
    expect(buscarFila(filtrado.filas, "Utilidad/pérdida neta").actual).toBe(635_000);

    const resumido = calcularEstadoResultadosComparativo(ACTUALES, [], { resumido: true });
    expect(resumido.filas.some((fila) => fila.clase === "detalle")).toBe(false);
    expect(resumido.filas.every((fila) => fila.clase !== "grupo" || fila.nivel === 0)).toBe(true);
    expect(buscarFila(resumido.filas, "Utilidad bruta").actual).toBe(740_000);
  });
});
