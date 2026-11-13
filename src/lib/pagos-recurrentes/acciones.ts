"use server";

import { revalidatePath } from "next/cache";

import { getRol } from "@/lib/auth/rol";
import { mensajeErrorRpc } from "@/lib/facturacion/errores";
import { createClient } from "@/lib/supabase/server";

import { type EntradaPagoRecurrente, esquemaPagoRecurrente } from "./validacion";

export type ResultadoPagoRecurrente = { ok: true; id: string; mensaje?: string } | { ok: false; error: string };

export async function crearPagoRecurrente(entrada: EntradaPagoRecurrente): Promise<ResultadoPagoRecurrente> {
  const rol = await getRol();
  if (rol !== "admin" && rol !== "contador")
    return { ok: false, error: "No tienes permiso para crear pagos recurrentes." };

  const resultado = esquemaPagoRecurrente.safeParse(entrada);
  if (!resultado.success) {
    return { ok: false, error: resultado.error.issues[0]?.message ?? "Datos inválidos." };
  }

  const datos = resultado.data;
  const supabase = await createClient();
  const { data, error } = await supabase
    .rpc("crear_pago_recurrente", {
      p: {
        nombre: datos.nombre,
        contacto_id: datos.contacto_id,
        cuenta_gasto_id: datos.cuenta_gasto_id,
        cuenta_pago_id: datos.cuenta_pago_id,
        subtotal: datos.subtotal,
        itbis_tasa: datos.itbis_tasa,
        frecuencia_meses: datos.frecuencia_meses,
        fecha_inicio: datos.fecha_inicio,
        vigencia_hasta: datos.vigencia_hasta,
        notas: datos.notas,
        activo: datos.activo,
      },
    })
    .returns<string>();

  if (error) return { ok: false, error: mensajeErrorRpc(error) };
  if (!data) return { ok: false, error: "No se pudo crear el pago recurrente." };

  revalidatePath("/dashboard/pagos-recurrentes");
  return { ok: true, id: data };
}

export async function generarPagoRecurrente(id: string): Promise<ResultadoPagoRecurrente> {
  const rol = await getRol();
  if (rol !== "admin" && rol !== "contador")
    return { ok: false, error: "No tienes permiso para generar pagos recurrentes." };

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("generar_pago_recurrente", { p_id: id }).returns<string | null>();

  if (error) return { ok: false, error: mensajeErrorRpc(error) };

  revalidatePath("/dashboard/pagos-recurrentes");
  revalidatePath(`/dashboard/pagos-recurrentes/${id}`);
  revalidatePath("/dashboard/gastos");

  if (typeof data !== "string") {
    return { ok: true, id, mensaje: "La plantilla no tiene un periodo pendiente por generar." };
  }

  return { ok: true, id: data, mensaje: "Pago del periodo generado." };
}
