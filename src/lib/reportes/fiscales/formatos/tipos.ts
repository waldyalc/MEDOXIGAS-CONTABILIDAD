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
  /**
   * Columnas que van al TXT, en orden. Cuando no se indica, van todas las del
   * detalle. El 607 lo usa para mostrar en pantalla/Excel columnas del archivo
   * de Alegra que no existen en el TXT (Monto facturado por exportaciones).
   */
  columnasTexto?: readonly string[];
}

/** Columnas del detalle que se escriben en el TXT, en orden. */
export function columnasTextoDgii(formato: FormatoDgii): ColumnaDgii[] {
  if (formato.columnasTexto == null) return [...formato.detalle];

  const porClave = new Map(formato.detalle.map((columna) => [columna.clave, columna]));
  return formato.columnasTexto.flatMap((clave) => {
    const columna = porClave.get(clave);
    return columna == null ? [] : [columna];
  });
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
