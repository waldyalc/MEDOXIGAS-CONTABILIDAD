import type { FilaReporte, TablaReporte } from "@/lib/reportes/exportar/tipos";

import type { FilaRentabilidadProducto, FilaVentaProducto, TotalesRentabilidad, TotalesVentas } from "./tipos";

function subtituloPeriodo(desde: string, hasta: string): string {
  return `Período: ${desde} al ${hasta}`;
}

export function tablaVentasProducto(
  filas: readonly FilaVentaProducto[],
  totales: TotalesVentas,
  desde: string,
  hasta: string,
): TablaReporte {
  const filasTabla: FilaReporte[] = filas.map((fila) => ({
    celdas: {
      producto: fila.nombre,
      referencia: fila.referencia,
      cantidad: fila.cantidad,
      antes: fila.antes,
      despues: fila.despues,
    },
  }));

  filasTabla.push({
    celdas: {
      producto: "Total",
      referencia: null,
      cantidad: totales.cantidad,
      antes: totales.antes,
      despues: totales.despues,
    },
    estilo: "total",
  });

  return {
    titulo: "Ventas por producto/servicio",
    subtitulo: subtituloPeriodo(desde, hasta),
    columnas: [
      { clave: "producto", titulo: "Producto/servicio", tipo: "texto" },
      { clave: "referencia", titulo: "Referencia", tipo: "texto" },
      { clave: "cantidad", titulo: "Número de productos/servicios", tipo: "texto" },
      { clave: "antes", titulo: "Antes de impuestos", tipo: "dinero" },
      { clave: "despues", titulo: "Después de impuestos", tipo: "dinero" },
    ],
    filas: filasTabla,
  };
}

function porcentajeTotal(totales: TotalesRentabilidad): number {
  if (totales.totalVendido <= 0) return 0;
  return Math.round((totales.rentabilidad / totales.totalVendido) * 10000) / 100;
}

export function tablaRentabilidadProducto(
  filas: readonly FilaRentabilidadProducto[],
  totales: TotalesRentabilidad,
  desde: string,
  hasta: string,
): TablaReporte {
  const filasTabla: FilaReporte[] = filas.map((fila) => ({
    celdas: {
      producto: fila.nombre,
      referencia: fila.referencia ?? "-",
      totalVendido: fila.totalVendido,
      costoTotal: fila.costoTotal,
      rentabilidad: fila.rentabilidad,
      porcentaje: fila.porcentaje,
    },
  }));

  filasTabla.push({
    celdas: {
      producto: "Total",
      referencia: null,
      totalVendido: totales.totalVendido,
      costoTotal: totales.costoTotal,
      rentabilidad: totales.rentabilidad,
      porcentaje: porcentajeTotal(totales),
    },
    estilo: "total",
  });

  return {
    titulo: "Rentabilidad por producto/servicio",
    subtitulo: subtituloPeriodo(desde, hasta),
    columnas: [
      { clave: "producto", titulo: "Producto/servicio", tipo: "texto" },
      { clave: "referencia", titulo: "Referencia", tipo: "texto" },
      { clave: "totalVendido", titulo: "Total vendido", tipo: "dinero" },
      { clave: "costoTotal", titulo: "Costo total", tipo: "dinero" },
      { clave: "rentabilidad", titulo: "Rentabilidad total", tipo: "dinero" },
      { clave: "porcentaje", titulo: "Porcentaje", tipo: "porcentaje" },
    ],
    filas: filasTabla,
  };
}
