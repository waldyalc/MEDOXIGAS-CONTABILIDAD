export type TipoCuenta = "activo" | "pasivo" | "capital" | "ingreso" | "costo" | "gasto";

export type OrigenAsiento =
  | "factura"
  | "pago_recibido"
  | "factura_proveedor"
  | "pago_proveedor"
  | "gasto_menor"
  | "manual"
  | "anulacion";

export interface FilaLibroDiario {
  asiento_numero: number;
  fecha: string;
  asiento_descripcion: string | null;
  origen_tipo: string;
  cuenta_codigo: string;
  cuenta_nombre: string;
  debito: number | string | null;
  credito: number | string | null;
}

export interface FilaBalanceComprobacion {
  cuenta_codigo: string;
  cuenta_nombre: string;
  tipo: string;
  debitos: number | string | null;
  creditos: number | string | null;
  saldo: number | string | null;
}

export interface FilaEstadoResultados {
  tipo: string;
  cuenta_codigo: string;
  cuenta_nombre: string;
  monto: number | string | null;
}

export interface FilaCxc {
  contacto_id: string;
  contacto_nombre: string;
  factura_id: string;
  numero: number;
  ncf: string | null;
  fecha: string;
  vencimiento: string;
  total: number | string | null;
  pagado: number | string | null;
  saldo: number | string | null;
  dias_vencida: number | null;
}

export interface CuentaContable {
  id: string;
  codigo: string;
  nombre: string;
  tipo: string;
  naturaleza: string;
  padre_id: string | null;
  acepta_movimientos: boolean;
  activa: boolean;
  descripcion?: string | null;
  es_caja_banco?: boolean;
  tipo_banco?: string | null;
}

export interface FilaConfigContable {
  clave: string;
  cuenta_id: string;
}
