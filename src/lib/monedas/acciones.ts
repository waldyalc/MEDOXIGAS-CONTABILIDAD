"use server";

import { revalidatePath } from "next/cache";

import { getRol } from "@/lib/auth/rol";
import { mensajeErrorRpc } from "@/lib/facturacion/errores";
import { createClient } from "@/lib/supabase/server";

import { mensajeValidacion, tasaCambioSchema } from "./validacion";

export type ResultadoTasa = { ok: true; id: string } | { ok: false; error: string };

export async function guardarTasaCambio(entrada: unknown): Promise<ResultadoTasa> {
  const rol = await getRol();
  if (rol !== "admin" && rol !== "contador") {
    return { ok: false, error: "No tienes permiso para guardar tasas de cambio." };
  }

  const resultado = tasaCambioSchema.safeParse(entrada);
  if (!resultado.success) return { ok: false, error: mensajeValidacion(resultado.error) };

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("guardar_tasa_cambio", { p: resultado.data });

  if (error) return { ok: false, error: mensajeErrorRpc(error) };
  if (typeof data !== "string") return { ok: false, error: "No se recibió el identificador de la tasa." };

  revalidatePath("/dashboard/configuracion/monedas");
  return { ok: true, id: data };
}
