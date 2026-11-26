"use server";

import { redirect } from "next/navigation";

import { validarCambioContrasena } from "@/lib/auth/perfil-validacion";
import { createClient } from "@/lib/supabase/server";

export type ResultadoCambioContrasena = { ok: true } | { ok: false; error: string };

function errorActualizacionContrasena(mensaje: string | undefined) {
  const normalizado = mensaje?.toLowerCase() ?? "";
  if (normalizado.includes("weak") || normalizado.includes("at least") || normalizado.includes("password")) {
    return "La nueva contraseña no cumple los requisitos de seguridad.";
  }
  return "No se pudo actualizar la contraseña. Inténtalo de nuevo.";
}

export async function cambiarContrasena(entrada: {
  actual: string;
  nueva: string;
  confirmar: string;
}): Promise<ResultadoCambioContrasena> {
  const validacion = validarCambioContrasena(entrada);
  if (!validacion.ok) return validacion;

  const supabase = await createClient();
  const {
    data: { user },
    error: errorUsuario,
  } = await supabase.auth.getUser();

  if (errorUsuario || !user?.email) {
    return { ok: false, error: "No hay una sesión activa. Vuelve a entrar e inténtalo otra vez." };
  }

  const { error: errorAcceso } = await supabase.auth.signInWithPassword({
    email: user.email,
    password: entrada.actual,
  });

  if (errorAcceso) {
    return { ok: false, error: "La contraseña actual no es correcta." };
  }

  const { error } = await supabase.auth.updateUser({ password: entrada.nueva });
  if (error) return { ok: false, error: errorActualizacionContrasena(error.message) };

  return { ok: true };
}

export async function cerrarTodasLasSesiones() {
  const supabase = await createClient();
  await supabase.auth.signOut({ scope: "global" });
  redirect("/login");
}
