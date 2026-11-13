import { formatearFecha } from "../../exportar/formato";
import type { FilaReporte, TablaReporte } from "../../exportar/tipos";
import type { ReporteAnualCalculado } from "./anual";
import { aplanarIngresosCompras, type ReporteIngresosCompras } from "./ingresos-compras";
import type { MovimientoTransaccion, TotalesTransacciones } from "./transacciones";

export function tablaIngresosCompras(reporte: ReporteIngresosCompras, desde: string, hasta: string): TablaReporte {
  const nodos = [...reporte.ingresos, ...reporte.costos, ...reporte.gastos];
  const filas: FilaReporte[] = aplanarIngresosCompras(nodos).map((fila) => ({
    celdas: {
      cuenta: `${fila.nodo.codigo} ${fila.nodo.nombre}`,
      total: fila.nodo.monto,
    },
    nivel: fila.nivel,
    estilo: fila.tieneHijos ? "grupo" : "normal",
  }));

  filas.push(
    {
      celdas: { cuenta: "Total de ingresos", total: reporte.totalIngresos },
      estilo: "subtotal",
    },
    {
      celdas: { cuenta: "Total de egresos", total: reporte.totalEgresos },
      estilo: "subtotal",
    },
    {
      celdas: { cuenta: "Saldo (utilidad)", total: reporte.saldo },
      estilo: "total",
    },
  );

  return {
    titulo: "Ingresos y compras",
    subtitulo: `Del ${formatearFecha(desde)} al ${formatearFecha(hasta)}`,
    columnas: [
      { clave: "cuenta", titulo: "Cuenta contable", tipo: "texto" },
      { clave: "total", titulo: "Total", tipo: "dinero" },
    ],
    filas,
  };
}

export function tablaTransacciones(
  movimientos: readonly MovimientoTransaccion[],
  totales: TotalesTransacciones,
  desde: string,
  hasta: string,
): TablaReporte {
  const filas: FilaReporte[] = movimientos.map((movimiento) => ({
    celdas: {
      comprobante: movimiento.comprobante,
      fecha: movimiento.fecha,
      cuenta: movimiento.cuenta,
      proveedor: movimiento.contactoNombre,
      detalle: movimiento.detalle,
      entradas: movimiento.entradas || null,
      salidas: movimiento.salidas || null,
    },
  }));

  filas.push({
    celdas: {
      comprobante: "Total",
      fecha: null,
      cuenta: null,
      proveedor: null,
      detalle: null,
      entradas: totales.entradas,
      salidas: totales.salidas,
    },
    estilo: "total",
  });

  return {
    titulo: "Transacciones",
    subtitulo: `Del ${formatearFecha(desde)} al ${formatearFecha(hasta)}. No incluye transferencias entre bancos.`,
    columnas: [
      { clave: "comprobante", titulo: "Comprobante", tipo: "texto" },
      { clave: "fecha", titulo: "Fecha", tipo: "fecha" },
      { clave: "cuenta", titulo: "Cuenta", tipo: "texto" },
      { clave: "proveedor", titulo: "Proveedor", tipo: "texto" },
      { clave: "detalle", titulo: "Detalle", tipo: "texto" },
      { clave: "entradas", titulo: "Entradas", tipo: "dinero" },
      { clave: "salidas", titulo: "Salidas", tipo: "dinero" },
    ],
    filas,
  };
}

function filaAnual(
  concepto: string,
  valor: number | null,
  participacion: number | null,
  estilo: FilaReporte["estilo"] = "normal",
): FilaReporte {
  return { celdas: { concepto, valor, participacion }, estilo };
}

export function tablaAnual(reporte: ReporteAnualCalculado, anio: number, comparar: boolean): TablaReporte {
  const filas: FilaReporte[] = [
    filaAnual("Resumen", null, null, "grupo"),
    filaAnual("Promedio mensual de ventas", reporte.resumen.promedioMensual, null),
    filaAnual("Promedio semanal", reporte.resumen.promedioSemanal, null),
    filaAnual("Promedio diario", reporte.resumen.promedioDiario, null),
    filaAnual("Ventas", reporte.resumen.ventas, null),
    filaAnual("Costos y gastos", reporte.resumen.costosYGastos, null),
    filaAnual("Utilidad neta", reporte.resumen.utilidadNeta, null, "subtotal"),
    filaAnual("Margen neto", null, reporte.resumen.margenNeto),
  ];

  if (comparar) {
    filas.push(
      filaAnual(`Ventas ${anio - 1}`, reporte.resumen.ventasAnterior, null),
      filaAnual(`Variación de ventas vs ${anio - 1}`, null, reporte.resumen.variacionVentas),
    );
  }

  filas.push(filaAnual("Productos/Servicios más vendidos", null, null, "grupo"));
  for (const producto of reporte.productos) {
    filas.push(filaAnual(producto.nombre, producto.monto, producto.participacion));
  }

  filas.push(filaAnual("Mejores clientes", null, null, "grupo"));
  for (const cliente of reporte.clientes) {
    filas.push(filaAnual(cliente.nombre, cliente.monto, cliente.participacion));
  }

  filas.push(filaAnual("Principales gastos", null, null, "grupo"));
  for (const gasto of reporte.gastos) {
    filas.push(filaAnual(gasto.nombre, gasto.monto, gasto.participacion));
  }
  filas.push(filaAnual("% de las ventas", null, reporte.participacionGastosEnVentas));

  return {
    titulo: `Reporte anual ${anio}`,
    subtitulo: comparar ? `Comparado con ${anio - 1}` : undefined,
    columnas: [
      { clave: "concepto", titulo: "Concepto", tipo: "texto" },
      { clave: "valor", titulo: "Valor", tipo: "dinero" },
      { clave: "participacion", titulo: "Participación", tipo: "porcentaje" },
    ],
    filas,
  };
}
