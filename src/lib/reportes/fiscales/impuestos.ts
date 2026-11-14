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

const FILAS = [
  { clave: "itbis18", etiqueta: "ITBIS (18%)", tasa: 18 },
  { clave: "itbis16", etiqueta: "ITBIS (16%)", tasa: 16 },
  { clave: "itbis0", etiqueta: "ITBIS (0%)", tasa: 0 },
  { clave: "exento", etiqueta: "Exento (0%)", tasa: null },
  { clave: "propina", etiqueta: "Propina (10%)", tasa: 10 },
  { clave: "cdt", etiqueta: "CDT (2%)", tasa: 2 },
] as const;

function claveDeDetalle(detalle: DetalleImpuesto): string | null {
  if (detalle.tipo === "exento") return "exento";
  if (detalle.tipo === "propina") return "propina";
  if (detalle.tipo === "otro") return "cdt";

  const tasa = Math.round(detalle.tasa ?? 0);
  if (tasa === 18) return "itbis18";
  if (tasa === 16) return "itbis16";
  if (tasa === 0) return "itbis0";
  return null;
}

export function resumirPorTasa(detalles: readonly DetalleImpuesto[]): ResumenTasas {
  const filas: FilaResumenTasa[] = FILAS.map((fila) => ({
    clave: fila.clave,
    etiqueta: fila.etiqueta,
    tasa: fila.tasa,
    base: 0,
    impuesto: 0,
  }));

  for (const detalle of detalles) {
    const clave = claveDeDetalle(detalle);
    if (clave == null) continue;
    const fila = filas.find((actual) => actual.clave === clave);
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
      { clave: "ncf", titulo: "NCF/NA�mero", tipo: "texto" },
      { clave: "tipo", titulo: "Tipo de documento", tipo: "texto" },
      { clave: "contacto", titulo: "Contacto", tipo: "texto" },
      { clave: "fecha", titulo: "CreaciA3n", tipo: "fecha" },
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
        impuesto: fila.impuestoNombre,
        base: fila.base,
        valor: fila.impuesto,
      },
    })),
  };
}
