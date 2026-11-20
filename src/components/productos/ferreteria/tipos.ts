import type { CodigoBarra, ComponenteCombo, UnidadMedida } from "@/lib/inventario/ferreteria/tipos";

/**
 * Filas en edición (borradores) de la sección de ferretería del producto.
 * La `clave` es local del formulario: no se envía a la RPC y solo sirve para
 * identificar la fila mientras el usuario edita.
 */

export interface UnidadDraft {
  clave: string;
  /** `null` cuando la presentación todavía no se ha guardado. */
  id: string | null;
  nombre: string;
  factorBase: string;
  precio: string;
  esCompra: boolean;
  esVenta: boolean;
  activa: boolean;
}

export interface CodigoBarraDraft {
  clave: string;
  codigo: string;
  /** Clave de la unidad borrador a la que pertenece el código; "" = unidad base. */
  unidadClave: string;
  principal: boolean;
}

export interface ComponenteComboDraft {
  clave: string;
  componenteId: string;
  cantidad: string;
}

export interface DatosFerreteriaFormulario {
  marca: string;
  favoritoPos: boolean;
  ubicacion: string;
}

export const DATOS_FERRETERIA_VACIOS: DatosFerreteriaFormulario = {
  marca: "",
  favoritoPos: false,
  ubicacion: "",
};

/** Claves deterministas para que la hidratación no cambie entre servidor y cliente. */
export function unidadesIniciales(unidades: readonly UnidadMedida[]): UnidadDraft[] {
  return unidades.map((unidad, indice) => ({
    clave: `unidad-${indice + 1}`,
    id: unidad.id,
    nombre: unidad.nombre,
    factorBase: unidad.factor_base,
    precio: unidad.precio ?? "",
    esCompra: unidad.es_compra,
    esVenta: unidad.es_venta,
    activa: unidad.activa,
  }));
}

export function codigosIniciales(
  codigos: readonly CodigoBarra[],
  unidades: readonly UnidadDraft[],
): CodigoBarraDraft[] {
  const clavePorUnidad = new Map(
    unidades.flatMap((unidad) => (unidad.id === null ? [] : [[unidad.id, unidad.clave] as const])),
  );

  return codigos.map((codigo, indice) => ({
    clave: `codigo-${indice + 1}`,
    codigo: codigo.codigo,
    unidadClave: codigo.unidad_id === null ? "" : (clavePorUnidad.get(codigo.unidad_id) ?? ""),
    principal: codigo.principal,
  }));
}

export function componentesIniciales(componentes: readonly ComponenteCombo[]): ComponenteComboDraft[] {
  return componentes.map((componente, indice) => ({
    clave: `componente-${indice + 1}`,
    componenteId: componente.componente_id,
    cantidad: componente.cantidad,
  }));
}
