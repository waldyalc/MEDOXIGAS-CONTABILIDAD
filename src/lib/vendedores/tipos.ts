export interface Vendedor {
  id: string;
  nombre: string;
  identificacion: string | null;
  observacion: string | null;
  activo: boolean;
}

export interface VendedorOpcion {
  id: string;
  nombre: string;
}
