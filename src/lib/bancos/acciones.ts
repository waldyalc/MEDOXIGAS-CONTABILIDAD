"use server";

import { revalidatePath } from "next/cache";

import type { SupabaseClient } from "@supabase/supabase-js";

import { getRol } from "@/lib/auth/rol";
import { centavosAValor, valorACentavos } from "@/lib/facturacion/calculo";
import { mensajeErrorRpc } from "@/lib/facturacion/errores";
import { mensajeValidacion } from "@/lib/facturacion/validacion";
import { avisoSaldoCuenta } from "@/lib/reportes/saldos";
import { createClient } from "@/lib/supabase/server";

import { depositoSchema, transferenciaSchema, validarDeposito, validarTransferencia } from "./validacion";

export type ResultadoBanco = { ok: true; id: string; aviso?: string } | { ok: false; error: string };

async function avisosCuentas(cuentaIds: string[], fecha: string): Promise<string | undefined> {
  const avisos = await Promise.all(cuentaIds.map((cuentaId) => avisoSaldoCuenta(cuentaId, fecha)));
  const unicos = [...new Set(avisos.filter((aviso): aviso is string => aviso !== null))];
  return unicos.length > 0 ? unicos.join(" ") : undefined;
}

export async function transferirEntreCuentas(entrada: unknown): Promise<ResultadoBanco> {
  const rol = await getRol();
  if (rol !== "admin" && rol !== "contador") {
    return { ok: false, error: "No tienes permiso para transferir entre cuentas." };
  }

  const resultado = transferenciaSchema.safeParse(entrada);
  if (!resultado.success) return { ok: false, error: mensajeValidacion(resultado.error) };

  const datos = resultado.data;
  const montoCentavos = valorACentavos(datos.monto);
  const errorValidacion = validarTransferencia({
    cuenta_origen_id: datos.cuenta_origen_id,
    cuenta_destino_id: datos.cuenta_destino_id,
    montoCentavos,
  });
  if (errorValidacion) return { ok: false, error: errorValidacion };

  const payload = {
    cuenta_origen_id: datos.cuenta_origen_id,
    cuenta_destino_id: datos.cuenta_destino_id,
    monto: centavosAValor(montoCentavos),
    fecha: datos.fecha,
    ...(datos.descripcion ? { descripcion: datos.descripcion } : {}),
  };

  const supabase = (await createClient()) as unknown as SupabaseClient;
  const { data, error } = await supabase.rpc("transferir_entre_cuentas", { p: payload }).returns<string>();

  if (error) return { ok: false, error: mensajeErrorRpc(error) };
  if (typeof data !== "string") return { ok: false, error: "No se pudo registrar la transferencia." };

  const aviso = await avisosCuentas([datos.cuenta_origen_id, datos.cuenta_destino_id], datos.fecha);

  revalidatePath("/dashboard/bancos");
  return { ok: true, id: data, ...(aviso ? { aviso } : {}) };
}

export async function registrarDeposito(entrada: unknown): Promise<ResultadoBanco> {
  const rol = await getRol();
  if (rol !== "admin" && rol !== "contador") {
    return { ok: false, error: "No tienes permiso para registrar depósitos." };
  }

  const resultado = depositoSchema.safeParse(entrada);
  if (!resultado.success) return { ok: false, error: mensajeValidacion(resultado.error) };

  const datos = resultado.data;
  const montoCentavos = valorACentavos(datos.monto);
  const errorValidacion = validarDeposito({
    cuenta_destino_id: datos.cuenta_destino_id,
    cuenta_contrapartida_id: datos.cuenta_contrapartida_id,
    montoCentavos,
  });
  if (errorValidacion) return { ok: false, error: errorValidacion };

  const payload = {
    cuenta_destino_id: datos.cuenta_destino_id,
    cuenta_contrapartida_id: datos.cuenta_contrapartida_id,
    monto: centavosAValor(montoCentavos),
    fecha: datos.fecha,
    ...(datos.descripcion ? { descripcion: datos.descripcion } : {}),
  };

  const supabase = (await createClient()) as unknown as SupabaseClient;
  const { data, error } = await supabase.rpc("registrar_deposito", { p: payload }).returns<string>();

  if (error) return { ok: false, error: mensajeErrorRpc(error) };
  if (typeof data !== "string") return { ok: false, error: "No se pudo registrar el depósito." };

  const aviso = await avisosCuentas([datos.cuenta_destino_id, datos.cuenta_contrapartida_id], datos.fecha);

  revalidatePath("/dashboard/bancos");
  return { ok: true, id: data, ...(aviso ? { aviso } : {}) };
}
