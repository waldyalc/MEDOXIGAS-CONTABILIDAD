import { describe, expect, test } from "vitest";

import type { CuentaContable, FilaEstadoResultados } from "../../tipos";
import { calcularReporteAnual } from "./anual";
import { calcularReporteIngresosCompras } from "./ingresos-compras";
import { tablaAnual, tablaIngresosCompras, tablaTransacciones } from "./tablas";
import { type MovimientoTransaccion, totalesTransacciones } from "./transacciones";

const CUENTAS: CuentaContable[] = [
  {
    id: "4",
    codigo: "4",
    nombre: "Ingresos",
    tipo: "ingreso",
    naturaleza: "credito",
    padre_id: null,
    acepta_movimientos: false,
    activa: true,
  },
  {
    id: "4101",
    codigo: "4101",
    nombre: "Ventas de productos",
    tipo: "ingreso",
    naturaleza: "credito",
    padre_id: "4",
    acepta_movimientos: true,
    activa: true,
  },
  {
    id: "5",
    codigo: "5",
    nombre: "Costos",
    tipo: "costo",
    naturaleza: "debito",
    padre_id: null,
    acepta_movimientos: false,
    activa: true,
  },
  {
    id: "5101",
    codigo: "5101",
    nombre: "Costo de ventas",
    tipo: "costo",
    naturaleza: "debito",
    padre_id: "5",
    acepta_movimientos: true,
    activa: true,
  },
];

const FILAS: FilaEstadoResultados[] = [
  { tipo: "ingreso", cuenta_codigo: "4101", cuenta_nombre: "Ventas de productos", monto: "18500.00" },
  { tipo: "costo", cuenta_codigo: "5101", cuenta_nombre: "Costo de ventas", monto: "11100.00" },
  { tipo: "gasto", cuenta_codigo: "6101", cuenta_nombre: "Gastos generales", monto: "1050.00" },
];

describe("tablas de exportación de administrativos", () => {
  test("ingresos y compras aplana el árbol y agrega los totales", () => {
    const reporte = calcularReporteIngresosCompras(CUENTAS, FILAS);
    const tabla = tablaIngresosCompras(reporte, "2026-11-01", "2026-11-30");

    expect(tabla.titulo).toBe("Ingresos y compras");
    expect(tabla.columnas.map((columna) => columna.clave)).toEqual(["cuenta", "total"]);
    expect(tabla.filas.map((fila) => fila.celdas.cuenta)).toEqual([
      "4 Ingresos",
      "4101 Ventas de productos",
      "5 Costos",
      "5101 Costo de ventas",
      "Total de ingresos",
      "Total de egresos",
      "Saldo (utilidad)",
    ]);
    expect(tabla.filas[4]?.celdas.total).toBe(1_850_000);
    expect(tabla.filas[5]?.celdas.total).toBe(-1_110_000);
    expect(tabla.filas[6]?.celdas.total).toBe(740_000);
    expect(tabla.filas[6]?.estilo).toBe("total");
  });

  test("transacciones conserva columnas, filas y totales", () => {
    const movimientos: MovimientoTransaccion[] = [
      {
        id: "1",
        origen: "pago_recibido",
        comprobante: "1",
        fecha: "2026-11-13",
        cuentaId: "cuenta-1",
        cuenta: "Caja general",
        contactoId: "c1",
        contactoNombre: "Cliente Uno",
        detalle: "Facturas: B0100000001",
        entradas: 800_000,
        salidas: 0,
        estado: "activo",
      },
      {
        id: "2",
        origen: "gasto_menor",
        comprobante: "B1300000001",
        fecha: "2026-11-13",
        cuentaId: "cuenta-2",
        cuenta: "Caja chica",
        contactoId: null,
        contactoNombre: null,
        detalle: "Combustible",
        entradas: 0,
        salidas: 50_000,
        estado: "activo",
      },
    ];

    const tabla = tablaTransacciones(movimientos, totalesTransacciones(movimientos), "2026-11-01", "2026-11-30");

    expect(tabla.columnas.map((columna) => columna.clave)).toEqual([
      "comprobante",
      "fecha",
      "cuenta",
      "proveedor",
      "detalle",
      "entradas",
      "salidas",
    ]);
    expect(tabla.subtitulo).toContain("No incluye transferencias entre bancos");
    expect(tabla.filas[0]?.celdas.entradas).toBe(800_000);
    expect(tabla.filas[1]?.celdas.salidas).toBe(50_000);
    expect(tabla.filas[2]).toEqual({
      celdas: {
        comprobante: "Total",
        fecha: null,
        cuenta: null,
        proveedor: null,
        detalle: null,
        entradas: 800_000,
        salidas: 50_000,
      },
      estilo: "total",
    });
  });

  test("reporte anual incluye resumen y rankings", () => {
    const reporte = calcularReporteAnual({
      anio: 2026,
      hoy: "2026-11-13",
      comparar: true,
      estado: FILAS,
      estadoAnterior: [],
      ventas: [{ fecha: "2026-11-13", monto: "18500.00" }],
      ventasAnterior: [],
      productos: [{ id: "p1", nombre: "Varilla 3/8", monto: "7600.00" }],
      clientes: [{ id: "c1", nombre: "Cliente Uno", monto: "14100.00" }],
      gastos: [{ id: "6101", nombre: "Gastos generales", monto: "1050.00" }],
    });

    const tabla = tablaAnual(reporte, 2026, true);

    expect(tabla.titulo).toBe("Reporte anual 2026");
    expect(tabla.subtitulo).toBe("Comparado con 2025");
    expect(tabla.filas[0]?.celdas.concepto).toBe("Resumen");
    expect(tabla.filas.find((fila) => fila.celdas.concepto === "Utilidad neta")?.celdas.valor).toBe(635_000);
    expect(tabla.filas.find((fila) => fila.celdas.concepto === "Margen neto")?.celdas.participacion).toBe(34.32);
    expect(tabla.filas.find((fila) => fila.celdas.concepto === "Varilla 3/8")?.celdas.valor).toBe(760_000);
    expect(tabla.filas.find((fila) => fila.celdas.concepto === "Principales gastos")).toBeDefined();
  });
});
