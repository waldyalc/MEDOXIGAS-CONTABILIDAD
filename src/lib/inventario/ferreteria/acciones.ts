"use server";

import { revalidatePath } from "next/cache";

import { getRol } from "@/lib/auth/rol";
import { mensajeErrorRpc } from "@/lib/facturacion/errores";
import { createClient } from "@/lib/supabase/server";

import {
  codigosBarraProductoSchema,
  crearConteoSchema,
  datosFerreteriaProductoSchema,
  idSchema,
  lineasConteoSchema,
  mensajeValidacion,
  recetaComboSchema,
  unidadesProductoSchema,
} from "./esquemas";

export type ResultadoFerreteria = { ok: true; id: string } | { ok: false; error: string };

export type ResultadoAplicarConteo = { ok: true; id: string; ajusteId: string | null } | { ok: false; error: string };

function puedeEscribir(rol: string | null) {
  return rol === "admin" || rol === "contador";
}

/**
 * Guarda los datos de ferretería del producto: marca, favorito del POS y
 * ubicación (en la existencia del almacén indicado o del principal).
 * Solo envía los campos presentes para no borrar los que el formulario no toca.
 */
export async function guardarDatosFerreteriaProducto(
  productoId: string,
  entrada: unknown,
): Promise<ResultadoFerreteria> {
  if (!puedeEscribir(await getRol())) return { ok: false, error: "No tienes permiso para editar datos del producto." };

  if (!idSchema.safeParse(productoId).success) return { ok: false, error: "El producto no es válido." };

  const resultado = datosFerreteriaProductoSchema.safeParse(entrada);
  if (!resultado.success) return { ok: false, error: mensajeValidacion(resultado.error) };

  const datos = resultado.data;
  const payload: Record<string, string | boolean> = {};

  if (datos.marca !== undefined) payload.marca = datos.marca;
  if (datos.favorito_pos !== undefined) payload.favorito_pos = datos.favorito_pos;
  if (datos.ubicacion !== undefined) payload.ubicacion = datos.ubicacion;
  if (datos.almacen_id !== undefined) payload.almacen_id = datos.almacen_id;

  const supabase = await createClient();
  const { error } = await supabase.rpc("actualizar_producto", { p_id: productoId, p: payload });

  if (error) return { ok: false, error: mensajeErrorRpc(error) };

  revalidatePath("/dashboard/productos");
  revalidatePath(`/dashboard/productos/${productoId}`);
  return { ok: true, id: productoId };
}

/**
 * Reemplaza el conjunto de códigos de barra del producto (los que no vienen
 * se eliminan, como hace `_producto_guardar_ferreteria`). El primero con
 * `principal: true` es el que usa la pistola del POS por defecto.
 */
export async function guardarCodigosBarra(productoId: string, entrada: unknown): Promise<ResultadoFerreteria> {
  if (!puedeEscribir(await getRol())) return { ok: false, error: "No tienes permiso para guardar códigos de barra." };

  if (!idSchema.safeParse(productoId).success) return { ok: false, error: "El producto no es válido." };

  const resultado = codigosBarraProductoSchema.safeParse(entrada);
  if (!resultado.success) return { ok: false, error: mensajeValidacion(resultado.error) };

  const codigos = resultado.data.codigos.map((codigo) => ({
    codigo: codigo.codigo,
    unidad_id: codigo.unidad_id,
    principal: codigo.principal,
  }));

  const supabase = await createClient();
  const { error } = await supabase.rpc("actualizar_producto", {
    p_id: productoId,
    p: { codigos_barra: codigos },
  });

  if (error) return { ok: false, error: mensajeErrorRpc(error) };

  revalidatePath("/dashboard/productos");
  revalidatePath(`/dashboard/productos/${productoId}`);
  return { ok: true, id: productoId };
}

/**
 * Reemplaza las presentaciones del producto. Enviar `id` actualiza la fila
 * (conserva el vínculo de los códigos de barra); las que no vienen se
 * desactivan, nunca se borran.
 */
export async function guardarUnidadesProducto(productoId: string, entrada: unknown): Promise<ResultadoFerreteria> {
  if (!puedeEscribir(await getRol())) return { ok: false, error: "No tienes permiso para guardar unidades de medida." };

  if (!idSchema.safeParse(productoId).success) return { ok: false, error: "El producto no es válido." };

  const resultado = unidadesProductoSchema.safeParse(entrada);
  if (!resultado.success) return { ok: false, error: mensajeValidacion(resultado.error) };

  const unidades = resultado.data.unidades.map((unidad) => ({
    ...(unidad.id ? { id: unidad.id } : {}),
    nombre: unidad.nombre,
    factor_base: unidad.factor_base,
    precio: unidad.precio,
    es_compra: unidad.es_compra,
    es_venta: unidad.es_venta,
    activa: unidad.activa,
  }));

  const supabase = await createClient();
  const { error } = await supabase.rpc("actualizar_producto", {
    p_id: productoId,
    p: { unidades },
  });

  if (error) return { ok: false, error: mensajeErrorRpc(error) };

  revalidatePath("/dashboard/productos");
  revalidatePath(`/dashboard/productos/${productoId}`);
  revalidatePath("/dashboard/facturacion/nueva");
  return { ok: true, id: productoId };
}

/**
 * Guarda la receta de un combo (reemplaza sus componentes; un arreglo vacío
 * la deja sin componentes, y entonces el combo no se puede vender).
 */
export async function guardarRecetaCombo(comboId: string, entrada: unknown): Promise<ResultadoFerreteria> {
  if (!puedeEscribir(await getRol())) return { ok: false, error: "No tienes permiso para editar combos." };

  if (!idSchema.safeParse(comboId).success) return { ok: false, error: "El combo no es válido." };

  const resultado = recetaComboSchema(comboId).safeParse(entrada);
  if (!resultado.success) return { ok: false, error: mensajeValidacion(resultado.error) };

  const componentes = resultado.data.componentes.map((componente) => ({
    componente_id: componente.componente_id,
    cantidad: componente.cantidad,
  }));

  const supabase = await createClient();
  const { error } = await supabase.rpc("actualizar_producto", {
    p_id: comboId,
    p: { componentes },
  });

  if (error) return { ok: false, error: mensajeErrorRpc(error) };

  revalidatePath("/dashboard/productos");
  revalidatePath(`/dashboard/productos/${comboId}`);
  revalidatePath("/dashboard/facturacion/nueva");
  return { ok: true, id: comboId };
}

/** Crea un conteo físico en borrador; las líneas son opcionales al inicio. */
export async function crearConteo(entrada: unknown): Promise<ResultadoFerreteria> {
  if (!puedeEscribir(await getRol())) return { ok: false, error: "No tienes permiso para crear conteos." };

  const resultado = crearConteoSchema.safeParse(entrada);
  if (!resultado.success) return { ok: false, error: mensajeValidacion(resultado.error) };

  const datos = resultado.data;
  const lineas = datos.lineas.map((linea) => ({
    producto_id: linea.producto_id,
    cantidad_contada: linea.cantidad_contada,
    ...(linea.notas ? { notas: linea.notas } : {}),
  }));

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("crear_conteo_inventario", {
    p: {
      almacen_id: datos.almacen_id,
      fecha: datos.fecha,
      ...(datos.notas ? { notas: datos.notas } : {}),
      lineas,
    },
  });

  if (error) return { ok: false, error: mensajeErrorRpc(error) };
  if (typeof data !== "string") return { ok: false, error: "No se pudo crear el conteo de inventario." };

  revalidatePath("/dashboard/inventario/conteos");
  return { ok: true, id: data };
}

/**
 * Reemplaza las líneas de un conteo en borrador. La cantidad del sistema no
 * se envía: la RPC la lee de existencias en ese momento.
 */
export async function guardarLineasConteo(conteoId: string, entrada: unknown): Promise<ResultadoFerreteria> {
  if (!puedeEscribir(await getRol()))
    return { ok: false, error: "No tienes permiso para guardar las líneas del conteo." };

  if (!idSchema.safeParse(conteoId).success) return { ok: false, error: "El conteo no es válido." };

  const resultado = lineasConteoSchema.safeParse(entrada);
  if (!resultado.success) return { ok: false, error: mensajeValidacion(resultado.error) };

  const lineas = resultado.data.lineas.map((linea) => ({
    producto_id: linea.producto_id,
    cantidad_contada: linea.cantidad_contada,
    ...(linea.notas ? { notas: linea.notas } : {}),
  }));

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("guardar_lineas_conteo", {
    p_id: conteoId,
    p: { lineas },
  });

  if (error) return { ok: false, error: mensajeErrorRpc(error) };
  if (typeof data !== "string") return { ok: false, error: "No se pudieron guardar las líneas del conteo." };

  revalidatePath("/dashboard/inventario/conteos");
  revalidatePath(`/dashboard/inventario/conteos/${conteoId}`);
  return { ok: true, id: data };
}

/**
 * Aplica el conteo: congela las diferencias y crea el ajuste de inventario
 * (con su asiento). Devuelve `ajusteId: null` cuando no hubo diferencias.
 */
export async function aplicarConteo(conteoId: string): Promise<ResultadoAplicarConteo> {
  if (!puedeEscribir(await getRol())) return { ok: false, error: "No tienes permiso para aplicar conteos." };

  if (!idSchema.safeParse(conteoId).success) return { ok: false, error: "El conteo no es válido." };

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("aplicar_conteo_inventario", { p_id: conteoId });

  if (error) return { ok: false, error: mensajeErrorRpc(error) };

  const ajusteId = typeof data === "string" ? data : null;

  revalidatePath("/dashboard/inventario/conteos");
  revalidatePath(`/dashboard/inventario/conteos/${conteoId}`);
  revalidatePath("/dashboard/inventario/ajustes");
  revalidatePath("/dashboard/productos");
  revalidatePath("/dashboard/reportes/valor-inventario");
  return { ok: true, id: conteoId, ajusteId };
}

/**
 * Anula un conteo en borrador. Un conteo aplicado se revierte anulando su
 * ajuste de inventario (`anular_documento`), no el conteo.
 */
export async function anularConteo(conteoId: string): Promise<ResultadoFerreteria> {
  if (!puedeEscribir(await getRol())) return { ok: false, error: "No tienes permiso para anular conteos." };

  if (!idSchema.safeParse(conteoId).success) return { ok: false, error: "El conteo no es válido." };

  const supabase = await createClient();
  const { error } = await supabase.rpc("anular_conteo_inventario", { p_id: conteoId });

  if (error) return { ok: false, error: mensajeErrorRpc(error) };

  revalidatePath("/dashboard/inventario/conteos");
  revalidatePath(`/dashboard/inventario/conteos/${conteoId}`);
  return { ok: true, id: conteoId };
}
