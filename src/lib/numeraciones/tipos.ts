export interface Numeracion {
  id: string;
  tipo_comprobante: string;
  nombre: string;
  prefijo: string;
  siguiente: number;
  hasta: number | null;
  vence: string | null;
  activa: boolean;
}

/** Código interno para una serie sin comprobante fiscal (consecutivo libre). */
export const TIPO_SIN_NCF = "00";

/** Tipos de documento que acepta la RPC `crear_numeracion`. */
export const TIPOS_NUMERACION = ["01", "02", "03", "04", "13", "14", "15", "16", TIPO_SIN_NCF] as const;

export type TipoNumeracion = (typeof TIPOS_NUMERACION)[number];
