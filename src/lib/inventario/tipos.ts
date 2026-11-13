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

export type TipoListaPrecio = "fijo" | "porcentaje";

export interface ListaPrecio {
  id: string;
  nombre: string;
  es_principal: boolean;
  tipo: TipoListaPrecio;
  activo: boolean;
}

export interface PrecioLista {
  lista_id: string;
  precio: number;
}

export interface ExistenciaAlmacen {
  almacen_id: string;
  almacen_nombre: string;
  es_principal: boolean;
  cantidad: number;
}

export interface AjusteLista {
  id: string;
  numero: number;
  fecha: string;
  total: number;
  observaciones: string | null;
  almacen_nombre: string;
  estado: "activo" | "anulada";
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
  estado: "activo" | "anulada";
  asiento_id: string | null;
  lineas: AjusteLinea[];
}

export interface TransferenciaLista {
  id: string;
  numero: number;
  fecha: string;
  origen_nombre: string;
  destino_nombre: string;
  estado: "activa" | "anulada";
  lineas: number;
}

export interface TransferenciaLinea {
  id: string;
  producto_id: string;
  producto_nombre: string;
  cantidad: number;
}

export interface TransferenciaDetalle {
  id: string;
  numero: number;
  fecha: string;
  origen_id: string;
  origen_nombre: string;
  destino_id: string;
  destino_nombre: string;
  observaciones: string | null;
  estado: "activa" | "anulada";
  lineas: TransferenciaLinea[];
}
