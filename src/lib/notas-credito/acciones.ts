"use server";

import { revalidatePath } from "next/cache";

import { getRol } from "@/lib/auth/rol";
import { mensajeErrorRpc } from "@/lib/facturacion/errores";
import { createClient } from "@/lib/supabase/server";

import { crearNotaCreditoVentaSchema, mensajeValidacionNota } from "./validacion";

export type ResultadoNotaCredito = { ok: true; id: string } | { ok: false; error: string };

export async function crearNotaCreditoVenta(entrada: unknown): Promise<ResultadoNotaCredito> {
  const rol = await getRol();
  if (rol !== "admin" && rol !== "contador")
    return { ok: false, error: "No tienes permiso para crear notas de crédito." };

  const resultado = crearNotaCreditoVentaSchema.safeParse(entrada);
  if (!resultado.success) return { ok: false, error: mensajeValidacionNota(resultado.error) };

  const datos = resultado.data;
  const payload = {
    factura_id: datos.factura_id,
    fecha: datos.fecha,
    notas: datos.notas ?? null,
    devuelve_inventario: datos.devuelve_inventario,
    lineas: datos.lineas.map((linea) => ({
      factura_linea_id: linea.factura_linea_id,
      cantidad: linea.cantidad,
    })),
  };

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("crear_nota_credito_venta", { p: payload });

  if (error) return { ok: false, error: mensajeErrorRpc(error) };
  if (typeof data !== "string")
    return { ok: false, error: "La nota de crédito se guardó pero no se recibió su identificador." };

  revalidatePath("/dashboard/notas-credito");
  revalidatePath("/dashboard/facturacion");
  revalidatePath(`/dashboard/facturacion/${datos.factura_id}`);
  return { ok: true, id: data };
}
