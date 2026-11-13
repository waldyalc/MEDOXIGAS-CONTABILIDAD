import { describe, expect, test } from "vitest";

import type { FilaEstadoResultados } from "../../tipos";
import {
  calcularReporteAnual,
  type DatosReporteAnual,
  describirVariacionVentas,
  formatearPorcentajeAnual,
} from "./anual";

const ESTADO: FilaEstadoResultados[] = [
  { tipo: "ingreso", cuenta_codigo: "4101", cuenta_nombre: "Ventas", monto: "18500.00" },
  { tipo: "costo", cuenta_codigo: "5101", cuenta_nombre: "Costo de ventas", monto: "11100.00" },
  { tipo: "gasto", cuenta_codigo: "6101", cuenta_nombre: "Gastos generales", monto: "1050.00" },
];

function datos(extras: Partial<DatosReporteAnual> = {}): DatosReporteAnual {
  return {
    anio: 2025,
    hoy: "2026-11-13",
    comparar: true,
    estado: ESTADO,
    estadoAnterior: [],
    ventas: [{ fecha: "2025-11-13", monto: "18500.00" }],
    ventasAnterior: [],
    productos: [
      { id: "p1", nombre: "Varilla 3/8", monto: "7600.00" },
      { id: "p2", nombre: "Cemento gris 42.5kg", monto: "6500.00" },
      { id: "p3", nombre: "Pintura galón", monto: "2900.00" },
      { id: "p4", nombre: "Tubo PVC 1/2", monto: "1500.00" },
    ],
    clientes: [
      { id: "c1", nombre: "Cliente Uno", monto: "14100.00" },
      { id: "c2", nombre: "Cliente Dos", monto: "4400.00" },
    ],
    gastos: [{ id: "6101", nombre: "Gastos generales", monto: "1050.00" }],
    ...extras,
  };
}

describe("reporte anual", () => {
  test("resume ventas, costos y gastos, utilidad y margen de las notas", () => {
    const reporte = calcularReporteAnual(datos());

    expect(reporte.resumen.ventas).toBe(1_850_000);
    expect(reporte.resumen.costosYGastos).toBe(1_215_000);
    expect(reporte.resumen.utilidadNeta).toBe(635_000);
    expect(reporte.resumen.margenNeto).toBe(34.32);
    expect(formatearPorcentajeAnual(reporte.resumen.margenNeto)).toBe("34.32%");
  });

  test("calcula promedios con los días del año", () => {
    const reporte = calcularReporteAnual(datos());

    expect(reporte.resumen.promedioMensual).toBe(154_167);
    expect(reporte.resumen.promedioSemanal).toBe(35_479);
    expect(reporte.resumen.promedioDiario).toBe(5_068);
  });

  test("usa los días transcurridos cuando el año es el actual", () => {
    const reporte = calcularReporteAnual(
      datos({
        anio: 2026,
        hoy: "2026-11-13",
        ventas: [{ fecha: "2026-11-13", monto: "18500.00" }],
      }),
    );

    expect(reporte.resumen.promedioDiario).toBe(5_836);
    expect(reporte.resumen.promedioSemanal).toBe(40_852);
  });

  test("calcula la variación contra el año anterior", () => {
    const reporte = calcularReporteAnual(
      datos({
        ventasAnterior: [{ fecha: "2024-11-13", monto: "14800.00" }],
      }),
    );

    expect(reporte.resumen.ventasAnterior).toBe(1_480_000);
    expect(reporte.resumen.variacionVentas).toBe(25);
    expect(describirVariacionVentas(reporte.resumen, 2025)).toBe(
      "Las ventas netas fueron RD$18,500.00 y aumentaron 25.00% frente a 2024",
    );
  });

  test("describe una caída y el caso sin ventas del año anterior", () => {
    const caida = calcularReporteAnual(datos({ ventasAnterior: [{ fecha: "2024-11-13", monto: "20000.00" }] }));
    const sinAnterior = calcularReporteAnual(datos());

    expect(caida.resumen.variacionVentas).toBe(-7.5);
    expect(describirVariacionVentas(caida.resumen, 2025)).toBe(
      "Las ventas netas fueron RD$18,500.00 y disminuyeron 7.50% frente a 2024",
    );
    expect(describirVariacionVentas(sinAnterior.resumen, 2025)).toBe(
      "Las ventas netas fueron RD$18,500.00 y aumentaron 0.00% frente a 2024",
    );
  });

  test("arma las series mensual y diaria con el año anterior", () => {
    const reporte = calcularReporteAnual(datos({ ventasAnterior: [{ fecha: "2024-11-13", monto: "10000.00" }] }));

    expect(reporte.serieMensual).toHaveLength(12);
    expect(reporte.serieMensual[10]).toEqual({
      clave: "2025-11",
      etiqueta: "Nov",
      actual: 1_850_000,
      anterior: 1_000_000,
    });
    expect(reporte.serieMensual[0]?.actual).toBe(0);
    expect(reporte.serieDiaria).toHaveLength(365);
    expect(reporte.serieDiaria[316]).toEqual({
      clave: "2025-11-13",
      etiqueta: "13 Nov",
      actual: 1_850_000,
      anterior: 1_000_000,
    });
  });

  test("calcula participaciones de productos, clientes y gastos", () => {
    const reporte = calcularReporteAnual(datos());

    expect(reporte.productos.map((fila) => fila.participacion)).toEqual([41.08, 35.14, 15.68, 8.11]);
    expect(reporte.clientes.map((fila) => fila.participacion)).toEqual([76.22, 23.78]);
    expect(reporte.gastos).toEqual([{ id: "6101", nombre: "Gastos generales", monto: 105_000, participacion: 100 }]);
    expect(reporte.gastosTotales).toBe(105_000);
    expect(reporte.participacionGastosEnVentas).toBe(5.68);
  });

  test("agrupa productos sin ficha por su descripción", () => {
    const reporte = calcularReporteAnual(
      datos({
        productos: [
          { id: null, nombre: "Servicio de instalación", monto: "1000.00" },
          { id: null, nombre: "Servicio de instalación", monto: "500.00" },
        ],
      }),
    );

    expect(reporte.productos).toHaveLength(1);
    expect(reporte.productos[0]?.monto).toBe(150_000);
    expect(reporte.productos[0]?.participacion).toBe(8.11);
  });
});
