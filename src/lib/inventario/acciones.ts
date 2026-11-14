"use server";

import { revalidatePath } from "next/cache";

import { getRol } from "@/lib/auth/rol";
import { mensajeErrorRpc } from "@/lib/facturacion/errores";
import { mensajeValidacion } from "@/lib/facturacion/validacion";
import { createClient } from "@/lib/supabase/server";

import { ajusteSchema, almacenSchema, categoriaSchema, listaPrecioSchema, transferenciaSchema } from "./validacion";

export type ResultadoInventario = { ok: true; id: string } | { ok: false; error: string };

function sinPermiso(mensaje: string): ResultadoInventario {
  return { ok: false, error: mensaje };
}

export async function crearAjusteInventario(entrada: unknown): Promise<ResultadoInventario> {
  const rol = await getRol();
  if (rol !== "admin" && rol !== "contador") {
    return sinPermiso("No tienes permiso para crear ajustes de inventario.");
  }

  const resultado = ajusteSchema.safeParse(entrada);
  if (!resultado.success) return { ok: false, error: mensajeValidacion(resultado.error) };

  const datos = resultado.data;
  const payload = {
    fecha: datos.fecha,
    almacen_id: datos.almacen_id,
    ...(datos.observaciones ? { observaciones: datos.observaciones } : {}),
    lineas: datos.lineas.map((linea) => ({
      producto_id: linea.producto_id,
      tipo: linea.tipo,
      cantidad: linea.cantidad,
      costo_unitario: linea.costo_unitario,
    })),
  };

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("crear_ajuste_inventario", { p: payload });

  if (error) return { ok: false, error: mensajeErrorRpc(error) };
  if (typeof data !== "string") return { ok: false, error: "No se pudo registrar el ajuste de inventario." };

  revalidatePath("/dashboard/inventario/ajustes");
  revalidatePath("/dashboard/productos");
  revalidatePath("/dashboard/reportes/valor-inventario");
  return { ok: true, id: data };
}

export async function crearCategoria(entrada: unknown): Promise<ResultadoInventario> {
  const rol = await getRol();
  if (rol !== "admin" && rol !== "contador") {
    return sinPermiso("No tienes permiso para crear categorías.");
  }

  const resultado = categoriaSchema.safeParse(entrada);
  if (!resultado.success) return { ok: false, error: mensajeValidacion(resultado.error) };

  const datos = resultado.data;
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("crear_categoria_producto", {
    p: {
      nombre: datos.nombre,
      ...(datos.descripcion ? { descripcion: datos.descripcion } : {}),
      ...(datos.activo === undefined ? {} : { activo: datos.activo }),
    },
  });

  if (error) return { ok: false, error: mensajeErrorRpc(error) };
  if (typeof data !== "string") return { ok: false, error: "No se pudo crear la categoría." };

  revalidatePath("/dashboard/inventario/categorias");
  revalidatePath("/dashboard/productos");
  return { ok: true, id: data };
}

export async function actualizarCategoria(id: string, entrada: unknown): Promise<ResultadoInventario> {
  const rol = await getRol();
  if (rol !== "admin" && rol !== "contador") {
    return sinPermiso("No tienes permiso para editar categorías.");
  }

  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id)) {
    return { ok: false, error: "La categoría no es válida." };
  }

  const resultado = categoriaSchema.safeParse(entrada);
  if (!resultado.success) return { ok: false, error: mensajeValidacion(resultado.error) };

  const datos = resultado.data;
  const supabase = await createClient();
  const { error } = await supabase.rpc("actualizar_categoria_producto", {
    p_id: id,
    p: {
      nombre: datos.nombre,
      descripcion: datos.descripcion ?? "",
      ...(datos.activo === undefined ? {} : { activo: datos.activo }),
    },
  });

  if (error) return { ok: false, error: mensajeErrorRpc(error) };

  revalidatePath("/dashboard/inventario/categorias");
  revalidatePath("/dashboard/productos");
  return { ok: true, id };
}

export async function crearAlmacen(entrada: unknown): Promise<ResultadoInventario> {
  const rol = await getRol();
  if (rol !== "admin" && rol !== "contador") {
    return sinPermiso("No tienes permiso para crear almacenes.");
  }

  const resultado = almacenSchema.safeParse(entrada);
  if (!resultado.success) return { ok: false, error: mensajeValidacion(resultado.error) };

  const datos = resultado.data;
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("crear_almacen", {
    p: {
      nombre: datos.nombre,
      ...(datos.activo === undefined ? {} : { activo: datos.activo }),
    },
  });

  if (error) return { ok: false, error: mensajeErrorRpc(error) };
  if (typeof data !== "string") return { ok: false, error: "No se pudo crear el almacén." };

  revalidatePath("/dashboard/inventario/almacenes");
  return { ok: true, id: data };
}

export async function actualizarAlmacen(id: string, entrada: unknown): Promise<ResultadoInventario> {
  const rol = await getRol();
  if (rol !== "admin" && rol !== "contador") {
    return sinPermiso("No tienes permiso para editar almacenes.");
  }

  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id)) {
    return { ok: false, error: "El almacén no es válido." };
  }

  const resultado = almacenSchema.safeParse(entrada);
  if (!resultado.success) return { ok: false, error: mensajeValidacion(resultado.error) };

  const datos = resultado.data;
  const supabase = await createClient();
  const { error } = await supabase.rpc("actualizar_almacen", {
    p_id: id,
    p: {
      nombre: datos.nombre,
      ...(datos.activo === undefined ? {} : { activo: datos.activo }),
    },
  });

  if (error) return { ok: false, error: mensajeErrorRpc(error) };

  revalidatePath("/dashboard/inventario/almacenes");
  return { ok: true, id };
}

export async function anularAjusteInventario(id: string): Promise<ResultadoInventario> {
  const rol = await getRol();
  if (rol !== "admin" && rol !== "contador") {
    return sinPermiso("No tienes permiso para anular ajustes de inventario.");
  }

  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id)) {
    return { ok: false, error: "El ajuste no es válido." };
  }

  const supabase = await createClient();
  const { error } = await supabase.rpc("anular_documento", { p_tipo: "ajuste_inventario", p_id: id });

  if (error) return { ok: false, error: mensajeErrorRpc(error) };

  revalidatePath("/dashboard/inventario/ajustes");
  revalidatePath(`/dashboard/inventario/ajustes/${id}`);
  revalidatePath("/dashboard/productos");
  revalidatePath("/dashboard/reportes/valor-inventario");
  return { ok: true, id };
}

export async function crearListaPrecio(entrada: unknown): Promise<ResultadoInventario> {
  const rol = await getRol();
  if (rol !== "admin" && rol !== "contador") {
    return sinPermiso("No tienes permiso para crear listas de precios.");
  }

  const resultado = listaPrecioSchema.safeParse(entrada);
  if (!resultado.success) return { ok: false, error: mensajeValidacion(resultado.error) };

  const datos = resultado.data;
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("crear_lista_precio", {
    p: {
      nombre: datos.nombre,
      tipo: datos.tipo,
      ...(datos.es_principal === undefined ? {} : { es_principal: datos.es_principal }),
      ...(datos.activo === undefined ? {} : { activo: datos.activo }),
    },
  });

  if (error) return { ok: false, error: mensajeErrorRpc(error) };
  if (typeof data !== "string") return { ok: false, error: "No se pudo crear la lista de precios." };

  revalidatePath("/dashboard/inventario/listas-precios");
  revalidatePath("/dashboard/productos");
  revalidatePath("/dashboard/facturacion/nueva");
  return { ok: true, id: data };
}

export async function actualizarListaPrecio(id: string, entrada: unknown): Promise<ResultadoInventario> {
  const rol = await getRol();
  if (rol !== "admin" && rol !== "contador") {
    return sinPermiso("No tienes permiso para editar listas de precios.");
  }

  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id)) {
    return { ok: false, error: "La lista de precios no es válida." };
  }

  const resultado = listaPrecioSchema.safeParse(entrada);
  if (!resultado.success) return { ok: false, error: mensajeValidacion(resultado.error) };

  const datos = resultado.data;
  const supabase = await createClient();
  const { error } = await supabase.rpc("actualizar_lista_precio", {
    p_id: id,
    p: {
      nombre: datos.nombre,
      tipo: datos.tipo,
      ...(datos.es_principal === undefined ? {} : { es_principal: datos.es_principal }),
      ...(datos.activo === undefined ? {} : { activo: datos.activo }),
    },
  });

  if (error) return { ok: false, error: mensajeErrorRpc(error) };

  revalidatePath("/dashboard/inventario/listas-precios");
  revalidatePath("/dashboard/productos");
  revalidatePath("/dashboard/facturacion/nueva");
  return { ok: true, id };
}

export async function crearTransferencia(entrada: unknown): Promise<ResultadoInventario> {
  const rol = await getRol();
  if (rol !== "admin" && rol !== "contador") {
    return sinPermiso("No tienes permiso para crear transferencias.");
  }

  const resultado = transferenciaSchema.safeParse(entrada);
  if (!resultado.success) return { ok: false, error: mensajeValidacion(resultado.error) };

  const datos = resultado.data;
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("crear_transferencia_inventario", {
    p: {
      fecha: datos.fecha,
      origen_id: datos.origen_id,
      destino_id: datos.destino_id,
      ...(datos.observaciones ? { observaciones: datos.observaciones } : {}),
      lineas: datos.lineas.map((linea) => ({
        producto_id: linea.producto_id,
        cantidad: linea.cantidad,
      })),
    },
  });

  if (error) return { ok: false, error: mensajeErrorRpc(error) };
  if (typeof data !== "string") return { ok: false, error: "No se pudo registrar la transferencia." };

  revalidatePath("/dashboard/inventario/transferencias");
  revalidatePath("/dashboard/productos");
  return { ok: true, id: data };
}

export async function anularTransferencia(id: string): Promise<ResultadoInventario> {
  const rol = await getRol();
  if (rol !== "admin" && rol !== "contador") {
    return sinPermiso("No tienes permiso para anular transferencias.");
  }

  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id)) {
    return { ok: false, error: "La transferencia no es válida." };
  }

  const supabase = await createClient();
  const { error } = await supabase.rpc("anular_transferencia_inventario", { p_id: id });

  if (error) return { ok: false, error: mensajeErrorRpc(error) };

  revalidatePath("/dashboard/inventario/transferencias");
  revalidatePath(`/dashboard/inventario/transferencias/${id}`);
  revalidatePath("/dashboard/productos");
  return { ok: true, id };
}
