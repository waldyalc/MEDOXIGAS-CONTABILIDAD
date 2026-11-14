"use server";

import { revalidatePath } from "next/cache";

import { getRol } from "@/lib/auth/rol";
import { mensajeErrorRpc } from "@/lib/facturacion/errores";
import { createClient } from "@/lib/supabase/server";

import {
  esquemaActualizarRetencion,
  esquemaEmpresa,
  esquemaRetencion,
  esquemaTerminoPago,
  mensajeValidacion,
} from "./validacion";

export type ResultadoAccion = { ok: true } | { ok: false; error: string };

export async function guardarEmpresa(entrada: unknown): Promise<ResultadoAccion> {
  if ((await getRol()) !== "admin") {
    return { ok: false, error: "Solo el administrador puede cambiar los datos de la empresa." };
  }

  const resultado = esquemaEmpresa.safeParse(entrada);
  if (!resultado.success) return { ok: false, error: mensajeValidacion(resultado.error) };

  const supabase = await createClient();
  const { error } = await supabase.rpc("actualizar_empresa", { p: resultado.data });

  if (error) return { ok: false, error: mensajeErrorRpc(error) };

  revalidatePath("/dashboard/configuracion/empresa");
  revalidatePath("/dashboard/facturacion");
  revalidatePath("/dashboard/cotizaciones");
  revalidatePath("/dashboard/conduces");
  return { ok: true };
}

export async function crearTerminoPago(entrada: unknown): Promise<ResultadoAccion> {
  const rol = await getRol();
  if (rol !== "admin" && rol !== "contador") {
    return { ok: false, error: "No tienes permiso para crear términos de pago." };
  }

  const resultado = esquemaTerminoPago.safeParse(entrada);
  if (!resultado.success) return { ok: false, error: mensajeValidacion(resultado.error) };

  const supabase = await createClient();
  const { error } = await supabase.rpc("crear_termino_pago", { p: resultado.data });

  if (error) return { ok: false, error: mensajeErrorRpc(error) };

  revalidatePath("/dashboard/configuracion/terminos-pago");
  return { ok: true };
}

export async function crearRetencion(entrada: unknown): Promise<ResultadoAccion> {
  const rol = await getRol();
  if (rol !== "admin" && rol !== "contador") {
    return { ok: false, error: "No tienes permiso para crear retenciones." };
  }

  const resultado = esquemaRetencion.safeParse(entrada);
  if (!resultado.success) return { ok: false, error: mensajeValidacion(resultado.error) };

  const supabase = await createClient();
  const { error } = await supabase.rpc("crear_retencion", { p: resultado.data });

  if (error) return { ok: false, error: mensajeErrorRpc(error) };

  revalidatePath("/dashboard/configuracion/retenciones");
  return { ok: true };
}

export async function actualizarRetencion(entrada: unknown): Promise<ResultadoAccion> {
  const rol = await getRol();
  if (rol !== "admin" && rol !== "contador") {
    return { ok: false, error: "No tienes permiso para editar retenciones." };
  }

  const resultado = esquemaActualizarRetencion.safeParse(entrada);
  if (!resultado.success) return { ok: false, error: mensajeValidacion(resultado.error) };

  const supabase = await createClient();
  const { error } = await supabase.rpc("actualizar_retencion", { p: resultado.data });

  if (error) return { ok: false, error: mensajeErrorRpc(error) };

  revalidatePath("/dashboard/configuracion/retenciones");
  return { ok: true };
}
