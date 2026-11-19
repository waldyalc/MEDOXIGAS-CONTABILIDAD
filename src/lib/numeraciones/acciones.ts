"use server";

import { revalidatePath } from "next/cache";

import { getRol } from "@/lib/auth/rol";
import { mensajeErrorRpc } from "@/lib/facturacion/errores";
import { createClient } from "@/lib/supabase/server";

import { actualizarNumeracionSchema, crearNumeracionSchema, mensajeValidacion } from "./validacion";

export type ResultadoAccion = { ok: true } | { ok: false; error: string };

function puedeEscribir(rol: string | null) {
  return rol === "admin" || rol === "contador";
}

export async function actualizarNumeracion(entrada: unknown): Promise<ResultadoAccion> {
  if (!puedeEscribir(await getRol())) return { ok: false, error: "No tienes permiso para editar numeraciones." };

  const resultado = actualizarNumeracionSchema.safeParse(entrada);
  if (!resultado.success) return { ok: false, error: mensajeValidacion(resultado.error) };

  const supabase = await createClient();
  const { error } = await supabase.rpc("actualizar_numeracion", { p: resultado.data });

  if (error) return { ok: false, error: mensajeErrorRpc(error) };

  revalidatePath("/dashboard/contabilidad/numeraciones");
  revalidatePath("/dashboard/facturacion");
  return { ok: true };
}

export async function crearNumeracion(entrada: unknown): Promise<ResultadoAccion> {
  if (!puedeEscribir(await getRol())) return { ok: false, error: "No tienes permiso para crear numeraciones." };

  const resultado = crearNumeracionSchema.safeParse(entrada);
  if (!resultado.success) return { ok: false, error: mensajeValidacion(resultado.error) };

  const supabase = await createClient();
  const { error } = await supabase.rpc("crear_numeracion", { p: resultado.data });

  if (error) return { ok: false, error: mensajeErrorRpc(error) };

  revalidatePath("/dashboard/contabilidad/numeraciones");
  revalidatePath("/dashboard/facturacion");
  return { ok: true };
}
