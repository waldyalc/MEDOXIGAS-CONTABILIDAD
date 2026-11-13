"use server";

import { revalidatePath } from "next/cache";

import { z } from "zod";

import { getRol } from "@/lib/auth/rol";
import { centroCostoSchema, mensajeValidacion } from "@/lib/centros-costo/validacion";
import { mensajeErrorRpc } from "@/lib/facturacion/errores";
import { createClient } from "@/lib/supabase/server";

export type ResultadoCentroCosto = { ok: true; id: string } | { ok: false; error: string };

async function puedeEscribir() {
  const rol = await getRol();
  return rol === "admin" || rol === "contador";
}

function revalidar() {
  revalidatePath("/dashboard/configuracion/centros-costo");
  revalidatePath("/dashboard/facturacion");
  revalidatePath("/dashboard/cotizaciones");
  revalidatePath("/dashboard/conduces");
  revalidatePath("/dashboard/compras");
  revalidatePath("/dashboard/contabilidad/asientos");
  revalidatePath("/dashboard/reportes/estado-resultados");
}

export async function crearCentroCosto(entrada: unknown): Promise<ResultadoCentroCosto> {
  if (!(await puedeEscribir())) return { ok: false, error: "No tienes permiso para crear centros de costo." };

  const resultado = centroCostoSchema.safeParse(entrada);
  if (!resultado.success) return { ok: false, error: mensajeValidacion(resultado.error) };

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("crear_centro_costo", { p: resultado.data });

  if (error) return { ok: false, error: mensajeErrorRpc(error) };
  if (typeof data !== "string") return { ok: false, error: "No se recibió el identificador del centro de costo." };

  revalidar();
  return { ok: true, id: data };
}

export async function actualizarCentroCosto(id: string, entrada: unknown): Promise<ResultadoCentroCosto> {
  if (!(await puedeEscribir())) return { ok: false, error: "No tienes permiso para editar centros de costo." };
  if (!z.uuid().safeParse(id).success) return { ok: false, error: "Centro de costo inválido." };

  const resultado = centroCostoSchema.safeParse(entrada);
  if (!resultado.success) return { ok: false, error: mensajeValidacion(resultado.error) };

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("actualizar_centro_costo", { p_id: id, p: resultado.data });

  if (error) return { ok: false, error: mensajeErrorRpc(error) };
  if (typeof data !== "string") return { ok: false, error: "No se recibió el identificador del centro de costo." };

  revalidar();
  return { ok: true, id: data };
}
