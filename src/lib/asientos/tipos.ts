export interface AsientoLista {
  id: string;
  numero: number;
  fecha: string;
  descripcion: string;
  origen_tipo: string;
  total: number;
}

export interface CuentaAsiento {
  id: string;
  codigo: string;
  nombre: string;
}

export interface ContactoAsiento {
  id: string;
  nombre: string;
}

export interface DatosFormularioAsiento {
  cuentas: CuentaAsiento[];
  contactos: ContactoAsiento[];
}
