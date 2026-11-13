export type TipoColumna = "texto" | "dinero" | "porcentaje" | "fecha";

export type EstiloFila = "normal" | "grupo" | "subtotal" | "total";

export type ValorCelda = string | number | null;

export interface ColumnaReporte {
  clave: string;
  titulo: string;
  tipo: TipoColumna;
  grupo?: string;
}

export interface FilaReporte {
  celdas: Record<string, ValorCelda>;
  nivel?: number;
  estilo?: EstiloFila;
}

export type TablaReporte = {
  titulo: string;
  subtitulo?: string;
  columnas: ColumnaReporte[];
  filas: FilaReporte[];
};
