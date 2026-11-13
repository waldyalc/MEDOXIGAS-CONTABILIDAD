export interface FilaMovimiento {
  asiento_id: string;
  asiento_numero: number;
  fecha: string;
  estado: string;
  origen_tipo: string;
  documento: string | null;
  contacto_id: string | null;
  tercero: string | null;
  cuenta_id: string;
  cuenta_codigo: string;
  cuenta_nombre: string;
  cuenta_naturaleza: string;
  debito: number | string | null;
  credito: number | string | null;
}

export interface FilaSaldoTercero {
  cuenta_id: string;
  cuenta_codigo: string;
  cuenta_nombre: string;
  cuenta_tipo: string;
  cuenta_naturaleza: string;
  contacto_id: string | null;
  tercero: string | null;
  saldo_inicial: number | string | null;
  debitos: number | string | null;
  creditos: number | string | null;
}

export interface FilaSaldoCuenta {
  cuenta_id: string;
  cuenta_codigo: string;
  cuenta_nombre: string;
  cuenta_tipo: string;
  cuenta_naturaleza: string;
  padre_id: string | null;
  saldo_inicial: number | string | null;
  debitos: number | string | null;
  creditos: number | string | null;
}

export interface ContactoOpcion {
  id: string;
  nombre: string;
}

export interface RespuestaReporte<T> {
  filas: T[];
  error: string | null;
}
