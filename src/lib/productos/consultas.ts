import type { PrecioLista } from "@/lib/inventario/tipos";
import { createClient } from "@/lib/supabase/server";

import type { Producto } from "./productos";

const CAMPOS =
  "id, nombre, tipo, referencia, descripcion, precio, itbis_tasa, impuesto_id, inventariable, cantidad, costo, categoria_id, activo";

export async function listarProductos(): Promise<Producto[]> {
  const supabase = await createClient();
  const { data, error } = await supabase.from("productos").select(CAMPOS).order("nombre");
  if (error) return [];

  const productos = (data ?? []) as unknown as Omit<Producto, "precios">[];
  if (productos.length === 0) return [];

  const preciosRes = await supabase
    .from("producto_precios")
    .select("producto_id, lista_id, precio")
    .in(
      "producto_id",
      productos.map((producto) => producto.id),
    );

  if (preciosRes.error) return productos.map((producto) => ({ ...producto, precios: [] }));

  const preciosPorProducto = new Map<string, PrecioLista[]>();
  for (const fila of preciosRes.data as { producto_id: string; lista_id: string; precio: number }[]) {
    const actuales = preciosPorProducto.get(fila.producto_id) ?? [];
    actuales.push({ lista_id: fila.lista_id, precio: fila.precio });
    preciosPorProducto.set(fila.producto_id, actuales);
  }

  return productos.map((producto) => ({ ...producto, precios: preciosPorProducto.get(producto.id) ?? [] }));
}
