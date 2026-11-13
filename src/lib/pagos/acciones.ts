"use server";

import { revalidatePath } from "next/cache";

import { z } from "zod";

import { getRol } from "@/lib/auth/rol";
import { centavosAValor, valorACentavos } from "@/lib/facturacion/calculo";
import { mensajeErrorRpc } from "@/lib/facturacion/errores";
import { mensajeValidacion } from "@/lib/facturacion/validacion";
import { createClient } from "@/lib/supabase/server";

import { registrarPagoSchema } from "./validacion";

export type ResultadoPago = { ok: true; id: string } | { ok: false; error: string };

export async function registrarPago(entrada: unknown): Promise<ResultadoPago> {
  const rol = await getRol();
  if (rol !== "admin" && rol !== "contador") return { ok: false, error: "No tienes permiso para registrar pagos." };

  const resultado = registrarPagoSchema.safeParse(entrada);
  if (!resultado.success) return { ok: false, error: mensajeValidacion(resultado.error) };

  const datos = resultado.data;
  const payload = {
    factura_id: datos.factura_id,
    contacto_id: datos.contacto_id,
    fecha: datos.fecha,
    cuenta_id: datos.cuenta_id,
    metodo: datos.metodo,
    monto: centavosAValor(valorACentavos(datos.monto)),
    ...(datos.notas ? { notas: datos.notas } : {}),
    ...(datos.retenciones.length > 0 ? { retenciones: datos.retenciones } : {}),
  };

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("registrar_pago_recibido", { p: payload });

  if (error) return { ok: false, error: mensajeErrorRpc(error) };
  if (typeof data !== "string") return { ok: false, error: "El pago se guardó pero no se recibió su identificador." };

  revalidatePath("/dashboard/pagos-recibidos");
  revalidatePath("/dashboard/facturacion");
  revalidatePath(`/dashboard/facturacion/${datos.factura_id}`);
  return { ok: true, id: data };
}

export async function anularPagoRecibido(id: string): Promise<ResultadoPago> {
  const rol = await getRol();
  if (rol !== "admin" && rol !== "contador") return { ok: false, error: "No tienes permiso para anular pagos." };
  if (!z.uuid().safeParse(id).success) return { ok: false, error: "Pago inválido." };

  const supabase = await createClient();
  const { error } = await supabase.rpc("anular_documento", { p_tipo: "pago_recibido", p_id: id });

  if (error) return { ok: false, error: mensajeErrorRpc(error) };

  revalidatePath("/dashboard/pagos-recibidos");
  revalidatePath(`/dashboard/pagos-recibidos/${id}`);
  revalidatePath("/dashboard/facturacion");
  return { ok: true, id };
}
