import { normalizarRol } from "@/lib/auth/rol";
import { createClient } from "@/lib/supabase/server";

import type { PerfilUsuario, TerminoPago } from "./tipos";

export async function getTerminosPago(): Promise<TerminoPago[]> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("listar_terminos_pago");

  if (error) throw new Error(error.message);
  return data ?? [];
}

export async function getPerfilesUsuarios(): Promise<PerfilUsuario[]> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("listar_perfiles");

  if (error) throw new Error(error.message);

  return (data ?? []).map((fila) => ({
    ...fila,
    rol: normalizarRol(fila.rol) ?? "lector",
  }));
}
