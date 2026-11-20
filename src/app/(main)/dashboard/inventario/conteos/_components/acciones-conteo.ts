"use server";

import { mensajeErrorRpc } from "@/lib/facturacion/errores";
import { listarCatalogoPos } from "@/lib/inventario/ferreteria/consultas";
import { createClient } from "@/lib/supabase/server";

import type { ProductoConteo, RespuestaProductosConteo } from "./tipos-conteo";

/**
 * Buscador del conteo físico: usa el catálogo del POS (trigramas sobre nombre,
 * referencia y marca, más los códigos de barra) y se queda solo con productos
 * simples con control de inventario, que son los únicos que acepta
 * `guardar_lineas_conteo`.
 */
export async function buscarProductosConteo(almacenId: string, busqueda: string): Promise<RespuestaProductosConteo> {
  if (almacenId.trim() === "") {
    return { ok: false, error: "Selecciona el almacén antes de buscar productos." };
  }

  const texto = busqueda.trim().slice(0, 120);

  try {
    const catalogo = await listarCatalogoPos({
      almacen_id: almacenId,
      busqueda: texto,
      limit: 100,
    });

    const candidatos = catalogo.filter((producto) => producto.tipo === "producto");
    if (candidatos.length === 0) return { ok: true, productos: [] };

    const supabase = await createClient();
    const { data, error } = await supabase
      .from("productos")
      .select("id")
      .eq("inventariable", true)
      .in(
        "id",
        candidatos.map((producto) => producto.producto_id),
      );

    if (error) return { ok: false, error: mensajeErrorRpc(error) };

    const inventariables = new Set((data ?? []).map((fila) => fila.id));
    const productos: ProductoConteo[] = candidatos
      .filter((producto) => inventariables.has(producto.producto_id))
      .map((producto) => ({
        id: producto.producto_id,
        nombre: producto.nombre,
        referencia: producto.referencia,
        stock: producto.stock,
      }));

    return { ok: true, productos };
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error.message : "No se pudieron buscar los productos.",
    };
  }
}
