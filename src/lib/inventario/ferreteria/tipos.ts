/**
 * Tipos de la capa TypeScript del inventario de ferretería (fase 1B).
 *
 * Regla de dinero y cantidades: todo `numeric` de Postgres se expone como
 * texto decimal (`Decimal`), nunca como `number` flotante. Así el valor que
 * devuelve la RPC se imprime y se vuelve a enviar tal cual.
 */

export const TIPOS_PRODUCTO = ["producto", "servicio", "combo"] as const;

export type TipoProducto = (typeof TIPOS_PRODUCTO)[number];

export const ESTADOS_CONTEO = ["borrador", "aplicado", "anulado"] as const;

export type EstadoConteo = (typeof ESTADOS_CONTEO)[number];

/** `numeric` de Postgres como texto decimal; nunca se guarda como float. */
export type Decimal = string;

/** Resultado de `pos_buscar_por_codigo_barra`. */
export interface ProductoPosCodigo {
  producto_id: string;
  nombre: string;
  referencia: string | null;
  marca: string | null;
  tipo: TipoProducto;
  unidad_id: string | null;
  unidad_nombre: string | null;
  factor_base: Decimal;
  precio: Decimal;
  itbis_tasa: Decimal;
  stock: Decimal;
  disponible: Decimal | null;
  imagen_path: string | null;
  favorito_pos: boolean;
  codigo: string;
}

/** Presentación activa que devuelve el catálogo del POS. */
export interface UnidadPos {
  id: string;
  nombre: string;
  factor_base: Decimal;
  precio: Decimal;
}

/** Resultado de `pos_catalogo_productos`. */
export interface ProductoCatalogoPos {
  producto_id: string;
  nombre: string;
  referencia: string | null;
  marca: string | null;
  tipo: TipoProducto;
  categoria_id: string | null;
  favorito_pos: boolean;
  imagen_path: string | null;
  unidad_medida: string | null;
  precio: Decimal;
  itbis_tasa: Decimal;
  stock: Decimal;
  disponible: Decimal | null;
  unidades: UnidadPos[];
}

/** Resultado de `reporte_stock_bajo`. */
export interface ProductoStockBajo {
  producto_id: string;
  nombre: string;
  referencia: string | null;
  marca: string | null;
  ubicacion: string | null;
  almacen_id: string;
  cantidad: Decimal;
  minimo: Decimal;
  maximo: Decimal | null;
  faltante: Decimal;
  sugerido: Decimal;
}

export interface CodigoBarra {
  id: string;
  producto_id: string;
  unidad_id: string | null;
  codigo: string;
  principal: boolean;
  creado_en: string;
}

export interface UnidadMedida {
  id: string;
  producto_id: string;
  nombre: string;
  factor_base: Decimal;
  precio: Decimal | null;
  es_compra: boolean;
  es_venta: boolean;
  activa: boolean;
  creado_en: string;
}

export interface ComponenteCombo {
  id: string;
  combo_id: string;
  componente_id: string;
  componente_nombre: string;
  componente_tipo: TipoProducto;
  inventariable: boolean;
  cantidad: Decimal;
}

/** Producto simple que puede usarse como componente de un combo. */
export interface ProductoParaCombo {
  id: string;
  nombre: string;
  referencia: string | null;
  marca: string | null;
  inventariable: boolean;
}

export interface ConteoResumen {
  id: string;
  numero: number;
  fecha: string;
  estado: EstadoConteo;
  almacen_id: string;
  almacen_nombre: string;
  notas: string | null;
  ajuste_id: string | null;
  creado_en: string;
}

export interface ConteoLinea {
  id: string;
  producto_id: string;
  producto_nombre: string;
  producto_referencia: string | null;
  cantidad_sistema: Decimal;
  cantidad_contada: Decimal;
  diferencia: Decimal;
  notas: string | null;
}

export interface ConteoDetalle extends ConteoResumen {
  lineas: ConteoLinea[];
}

/** Resultado de aplicar un conteo: `null` cuando no hubo diferencias. */
export interface ConteoAplicado {
  ajuste_id: string | null;
}
