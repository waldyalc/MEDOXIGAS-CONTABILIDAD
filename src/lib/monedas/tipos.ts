export interface Moneda {
  codigo: string;
  nombre: string;
  simbolo: string;
  es_base: boolean;
  activo: boolean;
}

export interface TasaCambio {
  id: string;
  moneda_codigo: string;
  fecha: string;
  tasa: number;
}

export interface MonedaConTasa extends Moneda {
  ultimaTasa: number | null;
  ultimaFecha: string | null;
}
