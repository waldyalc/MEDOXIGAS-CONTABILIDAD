"use server";

import { revalidatePath } from "next/cache";

import { z } from "zod";

import { getRol } from "@/lib/auth/rol";
import { mensajeErrorRpc } from "@/lib/facturacion/errores";
import { createClient } from "@/lib/supabase/server";

import { mensajeValidacion, vendedorSchema } from "./validacion";

export type ResultadoVendedor = { ok: true; id: string } | { ok: false; error: string };

async function puedeEscribir() {
  const rol = await getRol();
  return rol === "admin" || rol === "contador";
}

function revalidar() {
  revalidatePath("/dashboard/configuracion/vendedores");
  revalidatePath("/dashboard/facturacion");
  revalidatePath("/dashboard/cotizaciones");
  revalidatePath("/dashboard/conduces");
  revalidatePath("/dashboard/reportes/ventas-vendedor");
}

export async function crearVendedor(entrada: unknown): Promise<ResultadoVendedor> {
  if (!(await puedeEscribir())) return { ok: false, error: "No tienes permiso para crear vendedores." };

  const resultado = vendedorSchema.safeParse(entrada);
  if (!resultado.success) return { ok: false, error: mensajeValidacion(resultado.error) };

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("crear_vendedor", { p: resultado.data });

  if (error) return { ok: false, error: mensajeErrorRpc(error) };
  if (typeof data !== "string") return { ok: false, error: "No se recibió el identificador del vendedor." };

  revalidar();
  return { ok: true, id: data };
}

export async function actualizarVendedor(id: string, entrada: unknown): Promise<ResultadoVendedor> {
  if (!(await puedeEscribir())) return { ok: false, error: "No tienes permiso para editar vendedores." };
  if (!z.uuid().safeParse(id).success) return { ok: false, error: "Vendedor inválido." };

  const resultado = vendedorSchema.safeParse(entrada);
  if (!resultado.success) return { ok: false, error: mensajeValidacion(resultado.error) };

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("actualizar_vendedor", { p_id: id, p: resultado.data });

  if (error) return { ok: false, error: mensajeErrorRpc(error) };
  if (typeof data !== "string") return { ok: false, error: "No se recibió el identificador del vendedor." };

  revalidar();
  return { ok: true, id: data };
}
