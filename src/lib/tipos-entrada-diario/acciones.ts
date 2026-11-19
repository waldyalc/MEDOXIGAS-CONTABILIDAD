"use server";

import { revalidatePath } from "next/cache";

import { z } from "zod";

import { getRol } from "@/lib/auth/rol";
import { mensajeErrorRpc } from "@/lib/facturacion/errores";
import { createClient } from "@/lib/supabase/server";
import { mensajeValidacion, tipoEntradaSchema } from "@/lib/tipos-entrada-diario/validacion";

export type ResultadoTipoEntrada = { ok: true; id: string } | { ok: false; error: string };

async function puedeEscribir() {
  const rol = await getRol();
  return rol === "admin" || rol === "contador";
}

function revalidar() {
  revalidatePath("/dashboard/configuracion/tipos-entrada-diario");
  revalidatePath("/dashboard/contabilidad/asientos");
}

export async function crearTipoEntrada(entrada: unknown): Promise<ResultadoTipoEntrada> {
  if (!(await puedeEscribir())) return { ok: false, error: "No tienes permiso para crear tipos de entrada." };

  const resultado = tipoEntradaSchema.safeParse(entrada);
  if (!resultado.success) return { ok: false, error: mensajeValidacion(resultado.error) };

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("crear_tipo_entrada_diario", { p: resultado.data });

  if (error) return { ok: false, error: mensajeErrorRpc(error) };
  if (typeof data !== "string") return { ok: false, error: "No se recibió el identificador del tipo de entrada." };

  revalidar();
  return { ok: true, id: data };
}

export async function actualizarTipoEntrada(id: string, entrada: unknown): Promise<ResultadoTipoEntrada> {
  if (!(await puedeEscribir())) return { ok: false, error: "No tienes permiso para editar tipos de entrada." };
  if (!z.uuid().safeParse(id).success) return { ok: false, error: "Tipo de entrada inválido." };

  const resultado = tipoEntradaSchema.safeParse(entrada);
  if (!resultado.success) return { ok: false, error: mensajeValidacion(resultado.error) };

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("actualizar_tipo_entrada_diario", { p_id: id, p: resultado.data });

  if (error) return { ok: false, error: mensajeErrorRpc(error) };
  if (typeof data !== "string") return { ok: false, error: "No se recibió el identificador del tipo de entrada." };

  revalidar();
  return { ok: true, id: data };
}
