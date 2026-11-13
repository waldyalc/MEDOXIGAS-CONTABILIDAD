import type { TipoAjuste } from "./validacion";

export interface Almacen {
  id: string;
  nombre: string;
  es_principal: boolean;
  activo: boolean;
}

export interface CategoriaProducto {
  id: string;
  nombre: string;
  descripcion: string | null;
  activo: boolean;
}

export interface ProductoInventario {
  id: string;
  nombre: string;
  referencia: string | null;
  cantidad: number;
  costo: number;
}

export interface AjusteLista {
  id: string;
  numero: number;
  fecha: string;
  total: number;
  observaciones: string | null;
  almacen_nombre: string;
}

export interface AjusteLinea {
  id: string;
  producto_id: string;
  producto_nombre: string;
  tipo: TipoAjuste;
  cantidad: number;
  costo_unitario: number;
  total: number;
}

export interface AjusteDetalle {
  id: string;
  numero: number;
  fecha: string;
  almacen_id: string;
  almacen_nombre: string;
  observaciones: string | null;
  total: number;
  asiento_id: string | null;
  lineas: AjusteLinea[];
}
