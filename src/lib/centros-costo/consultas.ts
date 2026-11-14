import { createClient } from "@/lib/supabase/server";

import type { CentroCosto, CentroCostoOpcion } from "./tipos";

export async function getCentrosCosto(): Promise<CentroCosto[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("centros_costo")
    .select("id, codigo, nombre, descripcion, activo")
    .order("activo", { ascending: false })
    .order("codigo")
    .returns<CentroCosto[]>();

  if (error) throw new Error(error.message);
  return data;
}

export async function getCentrosCostoActivos(): Promise<CentroCostoOpcion[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("centros_costo")
    .select("id, codigo, nombre")
    .eq("activo", true)
    .order("codigo")
    .returns<CentroCostoOpcion[]>();

  if (error) throw new Error(error.message);
  return data;
}
