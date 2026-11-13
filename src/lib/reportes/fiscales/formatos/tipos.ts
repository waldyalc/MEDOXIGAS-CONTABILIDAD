import type { TablaReporte } from "@/lib/reportes/exportar/tipos";

import type { FilaDgii } from "../tipos";

export type TipoColumnaDgii = "texto" | "dinero";

export interface ColumnaDgii {
  clave: string;
  nombre: string;
  largo: number;
  tipo: TipoColumnaDgii;
}

export interface FormatoDgii {
  codigo: string;
  nombre: string;
  encabezado: readonly ColumnaDgii[];
  detalle: readonly ColumnaDgii[];
}

export function tablaDgii(formato: FormatoDgii, filas: readonly FilaDgii[], subtitulo?: string): TablaReporte {
  return {
    titulo: formato.nombre,
    subtitulo,
    columnas: formato.detalle.map((columna) => ({
      clave: columna.clave,
      titulo: columna.nombre,
      tipo: columna.tipo,
    })),
    filas: filas.map((fila) => ({ celdas: fila })),
  };
}
