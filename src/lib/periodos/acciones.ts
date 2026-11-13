"use server";

import { revalidatePath } from "next/cache";

import { getRol } from "@/lib/auth/rol";
import { mensajeErrorRpc } from "@/lib/facturacion/errores";
import { mensajeValidacion } from "@/lib/facturacion/validacion";
import { createClient } from "@/lib/supabase/server";

import { anioCierreSchema, periodoMesSchema } from "./validacion";

export type ResultadoPeriodo = { ok: true; periodo: string } | { ok: false; error: string };

export type ResultadoCierre = { ok: true; id: string } | { ok: false; error: string };

function revalidarPeriodos(periodo?: string) {
  revalidatePath("/dashboard/contabilidad/periodos");
  revalidatePath("/dashboard/contabilidad/asientos");
  revalidatePath("/dashboard/contabilidad");
  if (periodo) revalidatePath(`/dashboard/contabilidad/periodos?anio=${periodo.slice(0, 4)}`);
}

export async function cerrarPeriodo(entrada: unknown): Promise<ResultadoPeriodo> {
  const rol = await getRol();
  if (rol !== "admin" && rol !== "contador") {
    return { ok: false, error: "No tienes permiso para cerrar periodos." };
  }

  const resultado = periodoMesSchema.safeParse(entrada);
  if (!resultado.success) return { ok: false, error: mensajeValidacion(resultado.error) };

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("cerrar_periodo", { p_periodo: resultado.data });

  if (error) return { ok: false, error: mensajeErrorRpc(error) };
  if (typeof data !== "string") return { ok: false, error: "No se pudo cerrar el periodo." };

  revalidarPeriodos(resultado.data);
  return { ok: true, periodo: data };
}

export async function reabrirPeriodo(entrada: unknown): Promise<ResultadoPeriodo> {
  const rol = await getRol();
  if (rol !== "admin" && rol !== "contador") {
    return { ok: false, error: "No tienes permiso para reabrir periodos." };
  }

  const resultado = periodoMesSchema.safeParse(entrada);
  if (!resultado.success) return { ok: false, error: mensajeValidacion(resultado.error) };

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("reabrir_periodo", { p_periodo: resultado.data });

  if (error) return { ok: false, error: mensajeErrorRpc(error) };
  if (typeof data !== "string") return { ok: false, error: "No se pudo reabrir el periodo." };

  revalidarPeriodos(resultado.data);
  return { ok: true, periodo: data };
}

export async function cerrarResultadosAnio(entrada: unknown): Promise<ResultadoCierre> {
  const rol = await getRol();
  if (rol !== "admin" && rol !== "contador") {
    return { ok: false, error: "No tienes permiso para cerrar resultados." };
  }

  const resultado = anioCierreSchema.safeParse(entrada);
  if (!resultado.success) return { ok: false, error: mensajeValidacion(resultado.error) };

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("cerrar_resultados_anio", { p_anio: resultado.data });

  if (error) return { ok: false, error: mensajeErrorRpc(error) };
  if (typeof data !== "string") return { ok: false, error: "No se pudo cerrar los resultados del año." };

  revalidarPeriodos(`${resultado.data}-01-01`);
  return { ok: true, id: data };
}
