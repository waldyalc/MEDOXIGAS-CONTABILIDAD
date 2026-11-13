import { createClient } from "@/lib/supabase/server";

import type { Producto } from "./productos";

const CAMPOS = "id, nombre, tipo, referencia, descripcion, precio, itbis_tasa, inventariable, cantidad, costo";

export async function listarProductos(): Promise<Producto[]> {
  const supabase = await createClient();
  const { data, error } = await supabase.from("productos").select(CAMPOS).order("nombre");
  if (error) return [];
  return (data ?? []) as Producto[];
}
