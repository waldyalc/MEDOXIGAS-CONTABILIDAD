import { createClient } from "@/lib/supabase/server";

import type { TipoEntradaDiario } from "./tipos";

export async function getTiposEntradaDiario(): Promise<TipoEntradaDiario[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("tipos_entrada_diario")
    .select("id, nombre, prefijo, siguiente, activo")
    .order("activo", { ascending: false })
    .order("nombre")
    .returns<TipoEntradaDiario[]>();

  if (error) throw new Error(error.message);
  return data;
}
