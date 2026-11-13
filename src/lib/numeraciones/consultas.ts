import { createClient } from "@/lib/supabase/server";

import type { Numeracion } from "./tipos";

export async function getNumeraciones(): Promise<Numeracion[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("numeraciones")
    .select("id, tipo_comprobante, nombre, prefijo, siguiente, hasta, vence, activa")
    .order("tipo_comprobante")
    .order("prefijo")
    .returns<Numeracion[]>();

  if (error) throw new Error(error.message);
  return data;
}
