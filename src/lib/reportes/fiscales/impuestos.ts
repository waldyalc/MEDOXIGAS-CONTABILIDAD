import type { TablaReporte } from "@/lib/reportes/exportar/tipos";

import type { DetalleImpuesto } from "./tipos";

export interface FilaResumenTasa {
  clave: string;
  etiqueta: string;
  tasa: number | null;
  base: number;
  impuesto: number;
}

export interface ResumenTasas {
  filas: FilaResumenTasa[];
  totalBase: number;
  totalImpuesto: number;
}

const TASAS = [
  { clave: "itbis18", etiqueta: "ITBIS (18%)", tasa: 18 },
  { clave: "itbis16", etiqueta: "ITBIS (16%)", tasa: 16 },
  { clave: "itbis0", etiqueta: "ITBIS (0%)", tasa: 0 },
  { clave: "exento", etiqueta: "Exento (0%)", tasa: null },
] as const;

export function resumirPorTasa(detalles: readonly DetalleImpuesto[]): ResumenTasas {
  const filas: FilaResumenTasa[] = TASAS.map((tasa) => ({
    clave: tasa.clave,
    etiqueta: tasa.etiqueta,
    tasa: tasa.tasa,
    base: 0,
    impuesto: 0,
  }));

  for (const detalle of detalles) {
    const fila =
      detalle.tasa == null ? filas[3] : filas.find((actual) => actual.tasa === Math.round(detalle.tasa ?? 0));
    if (fila == null) continue;

    fila.base += detalle.base;
    fila.impuesto += detalle.impuesto;
  }

  return {
    filas,
    totalBase: filas.reduce((total, fila) => total + fila.base, 0),
    totalImpuesto: filas.reduce((total, fila) => total + fila.impuesto, 0),
  };
}

/** Diferencia de impuestos: positiva a pagar, negativa a favor. */
export function diferenciaImpuestos(
  ventas: ResumenTasas,
  compras: ResumenTasas,
  devolucionesVentas: ResumenTasas,
  devolucionesCompras: ResumenTasas,
): number {
  return (
    ventas.totalImpuesto - compras.totalImpuesto - devolucionesVentas.totalImpuesto + devolucionesCompras.totalImpuesto
  );
}

export function tablaDetalleImpuestos(
  filas: readonly DetalleImpuesto[],
  titulo: string,
  subtitulo: string,
): TablaReporte {
  return {
    titulo,
    subtitulo,
    columnas: [
      { clave: "ncf", titulo: "NCF/Número", tipo: "texto" },
      { clave: "tipo", titulo: "Tipo de documento", tipo: "texto" },
      { clave: "contacto", titulo: "Contacto", tipo: "texto" },
      { clave: "fecha", titulo: "Creación", tipo: "fecha" },
      { clave: "impuesto", titulo: "Impuesto", tipo: "texto" },
      { clave: "base", titulo: "Base imponible", tipo: "dinero" },
      { clave: "valor", titulo: "Valor impuesto", tipo: "dinero" },
    ],
    filas: filas.map((fila) => ({
      celdas: {
        ncf: fila.ncf || `#${fila.numero}`,
        tipo: fila.tipoDocumento,
        contacto: fila.contactoNombre,
        fecha: fila.fecha,
        impuesto: fila.tasa == null ? "Exento (0%)" : `ITBIS (${fila.tasa}%)`,
        base: fila.base,
        valor: fila.impuesto,
      },
    })),
  };
}
