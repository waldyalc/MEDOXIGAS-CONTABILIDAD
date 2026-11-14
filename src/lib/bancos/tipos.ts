export interface ConciliacionResumen {
  id: string;
  estado: string;
  fechaHasta: string;
}

export interface CuentaBanco {
  id: string;
  codigo: string;
  nombre: string;
  saldo: number | string | null;
  tipoBanco: string | null;
  numeroCuenta: string | null;
  conciliacion: ConciliacionResumen | null;
}

export interface CuentaSeleccion {
  id: string;
  codigo: string;
  nombre: string;
}
