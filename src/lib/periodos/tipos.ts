export type EstadoPeriodo = "abierto" | "cerrado";

export interface MesPeriodo {
  periodo: string;
  etiqueta: string;
  estado: EstadoPeriodo;
  cerradoEn: string | null;
  esFuturo: boolean;
  esActual: boolean;
}

export interface CierreResultadosAnio {
  anio: number;
  asientoId: string;
  asientoNumero: number | null;
  total: number;
  creadoEn: string;
}

export interface DatosPeriodos {
  anio: number;
  anioActual: number;
  meses: MesPeriodo[];
  cierre: CierreResultadosAnio | null;
}
