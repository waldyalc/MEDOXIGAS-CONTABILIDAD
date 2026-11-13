import { TIPOS_COMPROBANTE, type TipoComprobante } from "./tipos";

export interface OpcionTipoComprobante {
  valor: TipoComprobante;
  etiqueta: string;
  titulo: string;
}

const INFO: Record<TipoComprobante, { etiqueta: string; titulo: string }> = {
  "01": { etiqueta: "01 Crédito fiscal", titulo: "Factura de Crédito Fiscal" },
  "02": { etiqueta: "02 Consumo", titulo: "Factura de Consumo" },
  "14": { etiqueta: "14 Régimen especial", titulo: "Comprobante de Régimen Especial" },
  "15": { etiqueta: "15 Gubernamental", titulo: "Comprobante Gubernamental" },
  "16": { etiqueta: "16 Exportaciones", titulo: "Comprobante de Exportación" },
};

export const OPCIONES_TIPO_COMPROBANTE: readonly OpcionTipoComprobante[] = TIPOS_COMPROBANTE.map((valor) => ({
  valor,
  ...INFO[valor],
}));

export function esTipoComprobante(valor: string): valor is TipoComprobante {
  return TIPOS_COMPROBANTE.some((tipo) => tipo === valor);
}

export function etiquetaTipoComprobante(valor: string): string {
  return OPCIONES_TIPO_COMPROBANTE.find((opcion) => opcion.valor === valor)?.etiqueta ?? valor;
}

export function tituloTipoComprobante(valor: string): string {
  return OPCIONES_TIPO_COMPROBANTE.find((opcion) => opcion.valor === valor)?.titulo ?? "Comprobante fiscal";
}
