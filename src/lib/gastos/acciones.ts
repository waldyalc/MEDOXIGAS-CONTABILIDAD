"use server";

import { revalidatePath } from "next/cache";

import { z } from "zod";

import { getRol } from "@/lib/auth/rol";
import { centavosAValor, valorACentavos } from "@/lib/facturacion/calculo";
import { mensajeErrorRpc } from "@/lib/facturacion/errores";
import { mensajeValidacion } from "@/lib/facturacion/validacion";
import { avisoSaldoCuenta } from "@/lib/reportes/saldos";
import { createClient } from "@/lib/supabase/server";

import { crearGastoMenorSchema } from "./validacion";

export type ResultadoGasto = { ok: true; id: string; aviso?: string } | { ok: false; error: string };

export async function crearGastoMenor(entrada: unknown): Promise<ResultadoGasto> {
  const rol = await getRol();
  if (rol !== "admin" && rol !== "contador") return { ok: false, error: "No tienes permiso para crear gastos." };

  const resultado = crearGastoMenorSchema.safeParse(entrada);
  if (!resultado.success) return { ok: false, error: mensajeValidacion(resultado.error) };

  const datos = resultado.data;
  const payload = {
    fecha: datos.fecha,
    descripcion: datos.descripcion,
    subtotal: centavosAValor(valorACentavos(datos.subtotal)),
    itbis_tasa: datos.itbis_tasa,
    impuesto_id: datos.impuesto_id ?? null,
    ...(datos.cuenta_gasto_id ? { cuenta_gasto_id: datos.cuenta_gasto_id } : {}),
    ...(datos.cuenta_pago_id ? { cuenta_pago_id: datos.cuenta_pago_id } : {}),
    ...(datos.contacto_id ? { contacto_id: datos.contacto_id } : {}),
  };

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("crear_gasto_menor", { p: payload });

  if (error) return { ok: false, error: mensajeErrorRpc(error) };
  if (typeof data !== "string") return { ok: false, error: "El gasto se guardó pero no se recibió su identificador." };

  let cuentaPagoId = datos.cuenta_pago_id;
  if (!cuentaPagoId) {
    try {
      const { data: gasto } = await supabase.from("gastos_menores").select("cuenta_pago_id").eq("id", data).single();
      cuentaPagoId = gasto?.cuenta_pago_id;
    } catch {
      cuentaPagoId = datos.cuenta_pago_id;
    }
  }

  const aviso = await avisoSaldoCuenta(cuentaPagoId, datos.fecha);

  revalidatePath("/dashboard/gastos");
  return { ok: true, id: data, ...(aviso ? { aviso } : {}) };
}

export async function anularGastoMenor(id: string): Promise<ResultadoGasto> {
  const rol = await getRol();
  if (rol !== "admin" && rol !== "contador") return { ok: false, error: "No tienes permiso para anular gastos." };
  if (!z.uuid().safeParse(id).success) return { ok: false, error: "Gasto inválido." };

  const supabase = await createClient();
  const { error } = await supabase.rpc("anular_documento", { p_tipo: "gasto_menor", p_id: id });

  if (error) return { ok: false, error: mensajeErrorRpc(error) };

  revalidatePath("/dashboard/gastos");
  revalidatePath(`/dashboard/gastos/${id}`);
  return { ok: true, id };
}
