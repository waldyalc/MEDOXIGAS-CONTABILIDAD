"use server";

import { revalidatePath } from "next/cache";

import { getRol } from "@/lib/auth/rol";
import { mensajeErrorRpc } from "@/lib/facturacion/errores";
import { createClient } from "@/lib/supabase/server";

import { mensajeValidacion, plantillaImpresionSchema } from "./validacion";

export type ResultadoPlantilla = { ok: true } | { ok: false; error: string };

export async function guardarPlantillaImpresion(entrada: unknown): Promise<ResultadoPlantilla> {
  const rol = await getRol();
  if (rol !== "admin" && rol !== "contador") {
    return { ok: false, error: "No tienes permiso para editar las plantillas de impresión." };
  }

  const resultado = plantillaImpresionSchema.safeParse(entrada);
  if (!resultado.success) return { ok: false, error: mensajeValidacion(resultado.error) };

  const supabase = await createClient();
  const { error } = await supabase.rpc("guardar_plantilla_impresion", { p: resultado.data });

  if (error) return { ok: false, error: mensajeErrorRpc(error) };

  revalidatePath("/dashboard/configuracion/plantillas-impresion");
  revalidatePath("/dashboard/facturacion");
  revalidatePath("/dashboard/cotizaciones");
  revalidatePath("/dashboard/conduces");
  return { ok: true };
}
