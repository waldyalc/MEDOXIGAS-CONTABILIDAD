import type { SupabaseClient } from "@supabase/supabase-js";

import { createClient } from "@/lib/supabase/server";

import { centavos, formatearRd } from "./dinero";
import { hoyRd } from "./fechas";

export interface SaldoCajaBanco {
  cuenta_id: string;
  codigo: string;
  nombre: string;
  saldo: number | string | null;
}

export async function obtenerSaldosCajaBanco(
  fecha?: string,
): Promise<{ filas: SaldoCajaBanco[]; error: string | null }> {
  const supabase = (await createClient()) as unknown as SupabaseClient;
  const { data, error } = await supabase.rpc("saldos_caja_banco", { p_fecha: fecha ?? hoyRd() });

  if (error) return { filas: [], error: error.message };
  return { filas: (data ?? []) as SaldoCajaBanco[], error: null };
}

export async function obtenerSaldoCuenta(
  cuentaId: string,
  fecha?: string,
): Promise<{ nombre: string; saldoCentavos: number } | null> {
  const { filas, error } = await obtenerSaldosCajaBanco(fecha);
  if (error) return null;

  const fila = filas.find((cuenta) => cuenta.cuenta_id === cuentaId);
  if (!fila) return null;

  return { nombre: fila.nombre, saldoCentavos: centavos(fila.saldo) };
}

export function mensajeSaldoNegativo(nombre: string, saldoCentavos: number): string {
  return `${nombre} está en ${formatearRd(saldoCentavos)}. Revisa si falta registrar un depósito o el saldo inicial.`;
}

export async function avisoSaldoCuenta(cuentaId: string | null | undefined, fecha?: string): Promise<string | null> {
  if (!cuentaId) return null;

  try {
    const cuenta = await obtenerSaldoCuenta(cuentaId, fecha);
    if (!cuenta || cuenta.saldoCentavos >= 0) return null;

    return mensajeSaldoNegativo(cuenta.nombre, cuenta.saldoCentavos);
  } catch {
    return null;
  }
}
