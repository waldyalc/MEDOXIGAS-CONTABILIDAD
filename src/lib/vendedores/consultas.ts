import { createClient } from "@/lib/supabase/server";

import type { Vendedor, VendedorOpcion } from "./tipos";

export async function getVendedores(): Promise<Vendedor[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("vendedores")
    .select("id, nombre, identificacion, observacion, activo")
    .order("activo", { ascending: false })
    .order("nombre")
    .returns<Vendedor[]>();

  if (error) throw new Error(error.message);
  return data;
}

export async function getVendedoresActivos(): Promise<VendedorOpcion[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("vendedores")
    .select("id, nombre")
    .eq("activo", true)
    .order("nombre")
    .returns<VendedorOpcion[]>();

  if (error) throw new Error(error.message);
  return data;
}
