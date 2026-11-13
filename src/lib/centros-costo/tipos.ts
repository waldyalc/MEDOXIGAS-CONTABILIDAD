export interface CentroCosto {
  id: string;
  codigo: string;
  nombre: string;
  descripcion: string | null;
  activo: boolean;
}

export interface CentroCostoOpcion {
  id: string;
  codigo: string;
  nombre: string;
}
