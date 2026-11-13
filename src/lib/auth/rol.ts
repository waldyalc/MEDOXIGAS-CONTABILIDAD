import { cache } from "react";

import { createClient } from "@/lib/supabase/server";

export type Rol = "admin" | "contador" | "lector";

export interface Perfil {
  correo: string | null;
  nombre: string | null;
  rol: Rol | null;
}

export function normalizarRol(valor: string | null | undefined): Rol | null {
  return valor === "admin" || valor === "contador" || valor === "lector" ? valor : null;
}

export const getPerfil = cache(async (): Promise<Perfil | null> => {
  const supabase = await createClient();
  const { data } = await supabase.auth.getUser();
  if (!data.user) return null;

  const perfil = await supabase.from("perfiles").select("nombre, rol").eq("user_id", data.user.id).maybeSingle();
  return {
    correo: data.user.email ?? null,
    nombre: perfil.data?.nombre ?? null,
    rol: normalizarRol(perfil.data?.rol),
  };
});

export async function getRol(): Promise<Rol | null> {
  const perfil = await getPerfil();
  return perfil?.rol ?? null;
}
