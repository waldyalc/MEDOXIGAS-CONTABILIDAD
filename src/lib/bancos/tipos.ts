export interface CuentaBanco {
  id: string;
  codigo: string;
  nombre: string;
  saldo: number | string | null;
  tipoBanco: string | null;
  numeroCuenta: string | null;
}

export interface CuentaSeleccion {
  id: string;
  codigo: string;
  nombre: string;
}
