"use server";

import { revalidatePath } from "next/cache";

import { getRol } from "@/lib/auth/rol";
import { mensajeErrorRpc } from "@/lib/facturacion/errores";
import { createClient } from "@/lib/supabase/server";

import { esquemaClasificacionDgii } from "./dgii";

export type ResultadoClasificacionDgii = { ok: true } | { ok: false; error: string };

/**
 * Guarda la clasificación DGII de una cuenta con la RPC
 * `actualizar_clasificacion_dgii`. Un valor nulo limpia la clasificación.
 */
export async function actualizarClasificacionDgii(entrada: unknown): Promise<ResultadoClasificacionDgii> {
  const rol = await getRol();
  if (rol !== "admin" && rol !== "contador") {
    return { ok: false, error: "No tienes permiso para clasificar las cuentas de los reportes DGII." };
  }

  const resultado = esquemaClasificacionDgii.safeParse(entrada);
  if (!resultado.success) {
    return { ok: false, error: resultado.error.issues[0]?.message ?? "Datos inválidos" };
  }

  const supabase = await createClient();
  const { error } = await supabase.rpc("actualizar_clasificacion_dgii", {
    p: {
      cuenta_id: resultado.data.cuentaId,
      categoria_dgii: resultado.data.categoriaDgii,
      tipo_compra: resultado.data.tipoCompra,
      tipo_ingreso: resultado.data.tipoIngreso,
    },
  });

  if (error) return { ok: false, error: mensajeErrorRpc(error) };

  revalidatePath("/dashboard/configuracion/reportes-dgii");
  revalidatePath("/dashboard/reportes/606");
  revalidatePath("/dashboard/reportes/607");
  return { ok: true };
}
