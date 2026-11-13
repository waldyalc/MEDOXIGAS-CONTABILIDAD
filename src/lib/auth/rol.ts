import { createClient } from "@/lib/supabase/server";

export type Rol = "admin" | "caja" | "cobros";

export function normalizarRol(valor: string | null | undefined): Rol | null {
  return valor === "admin" || valor === "caja" || valor === "cobros" ? valor : null;
}

export async function getRol(): Promise<Rol | null> {
  const supabase = await createClient();
  const { data } = await supabase.auth.getUser();
  if (!data.user) return null;

  const perfil = await supabase.from("perfiles").select("rol").eq("user_id", data.user.id).maybeSingle();
  return normalizarRol(perfil.data?.rol);
}
