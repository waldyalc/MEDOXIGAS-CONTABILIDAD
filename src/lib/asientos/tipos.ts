export interface AsientoLista {
  id: string;
  numero: number;
  codigo: string | null;
  fecha: string;
  descripcion: string;
  origen_tipo: string;
  origen_id: string | null;
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

export interface CentroCostoAsiento {
  id: string;
  codigo: string;
  nombre: string;
}

export interface TipoEntradaAsiento {
  id: string;
  nombre: string;
  prefijo: string;
  siguiente: number;
}

export interface DatosFormularioAsiento {
  cuentas: CuentaAsiento[];
  contactos: ContactoAsiento[];
  centrosCosto: CentroCostoAsiento[];
  tiposEntrada: TipoEntradaAsiento[];
}
