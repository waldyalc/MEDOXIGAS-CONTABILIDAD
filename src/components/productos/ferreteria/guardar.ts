import {
  guardarCodigosBarra,
  guardarDatosFerreteriaProducto,
  guardarRecetaCombo,
  guardarUnidadesProducto,
} from "@/lib/inventario/ferreteria/acciones";
import { createClient } from "@/lib/supabase/client";

import type { CodigoBarraDraft, ComponenteComboDraft, UnidadDraft } from "./tipos";

export interface DatosGuardarFerreteria {
  marca: string;
  favoritoPos: boolean;
  ubicacion: string;
  /** Solo los productos inventariables tienen fila de existencia por almacén. */
  guardarUbicacion: boolean;
  almacenId: string;
  unidades: readonly UnidadDraft[];
  codigos: readonly CodigoBarraDraft[];
  componentes: readonly ComponenteComboDraft[];
  guardarComponentes: boolean;
}

function unidadesParaRpc(unidades: readonly UnidadDraft[]) {
  return unidades.map((fila) => ({
    ...(fila.id ? { id: fila.id } : {}),
    nombre: fila.nombre,
    factor_base: fila.factorBase,
    precio: fila.precio.trim() === "" ? null : fila.precio,
    es_compra: fila.esCompra,
    es_venta: fila.esVenta,
    activa: fila.activa,
  }));
}

function componentesParaRpc(componentes: readonly ComponenteComboDraft[]) {
  return componentes.map((fila) => ({ componente_id: fila.componenteId, cantidad: fila.cantidad }));
}

/**
 * Las unidades nuevas no tienen id hasta que se guardan. Se leen del producto
 * ya persistido y se emparejan por nombre para que los códigos de barra
 * puedan apuntar a la presentación correcta en la misma pasada.
 */
async function idsDeUnidades(
  idProducto: string,
  unidades: readonly UnidadDraft[],
): Promise<ReadonlyMap<string, string>> {
  const ids = new Map<string, string>();
  for (const fila of unidades) {
    if (fila.id !== null) ids.set(fila.clave, fila.id);
  }

  const nuevas = unidades.filter((fila) => fila.id === null && fila.nombre.trim() !== "");
  if (nuevas.length === 0) return ids;

  const supabase = createClient();
  const { data, error } = await supabase.from("producto_unidades").select("id, nombre").eq("producto_id", idProducto);

  if (error) throw new Error("No se pudieron verificar las unidades de medida guardadas.");

  for (const fila of nuevas) {
    const nombre = fila.nombre.trim().toLowerCase();
    const guardada = (data ?? []).find((unidad) => unidad.nombre.trim().toLowerCase() === nombre);
    if (guardada) ids.set(fila.clave, guardada.id);
  }

  return ids;
}

/**
 * Guarda la sección de ferretería en orden: las unidades antes que los códigos
 * (los códigos referencian `unidad_id`). Devuelve el primer error en español o
 * `null` cuando todo quedó guardado.
 */
export async function guardarFerreteriaProducto(
  idProducto: string,
  datos: DatosGuardarFerreteria,
): Promise<string | null> {
  const cabecera = await guardarDatosFerreteriaProducto(idProducto, {
    marca: datos.marca,
    favorito_pos: datos.favoritoPos,
    ...(datos.guardarUbicacion
      ? { ubicacion: datos.ubicacion, ...(datos.almacenId ? { almacen_id: datos.almacenId } : {}) }
      : {}),
  });
  if (!cabecera.ok) return `Los datos del catálogo no se guardaron: ${cabecera.error}`;

  const unidades = await guardarUnidadesProducto(idProducto, { unidades: unidadesParaRpc(datos.unidades) });
  if (!unidades.ok) return `Las unidades de medida no se guardaron: ${unidades.error}`;

  const ids = await idsDeUnidades(idProducto, datos.unidades);
  const codigos = await guardarCodigosBarra(idProducto, {
    codigos: datos.codigos.map((fila) => ({
      codigo: fila.codigo,
      unidad_id: ids.get(fila.unidadClave) ?? null,
      principal: fila.principal,
    })),
  });
  if (!codigos.ok) return `Los códigos de barra no se guardaron: ${codigos.error}`;

  if (!datos.guardarComponentes) return null;

  const receta = await guardarRecetaCombo(idProducto, { componentes: componentesParaRpc(datos.componentes) });
  if (!receta.ok) return `La receta del combo no se guardó: ${receta.error}`;

  return null;
}

/** Antes de cambiar un combo a producto o servicio hay que vaciar su receta. */
export async function vaciarRecetaCombo(comboId: string): Promise<string | null> {
  const resultado = await guardarRecetaCombo(comboId, { componentes: [] });
  return resultado.ok ? null : resultado.error;
}
