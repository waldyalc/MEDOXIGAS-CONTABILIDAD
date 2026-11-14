import type { SupabaseClient } from "@supabase/supabase-js";

import { createClient } from "@/lib/supabase/server";

import type { Impuesto } from "./tipos";

interface CuentaEmbed {
  codigo: string;
  nombre: string;
}

export interface ImpuestoConfig extends Impuesto {
  cuenta_codigo: string | null;
  cuenta_nombre: string | null;
}

export async function getImpuestosActivos(): Promise<Impuesto[]> {
  const supabase = (await createClient()) as unknown as SupabaseClient;
  const { data, error } = await supabase
    .from("impuestos")
    .select("id, codigo, nombre, tipo, tarifa, cuenta_id, activo, orden")
    .eq("activo", true)
    .order("orden")
    .order("nombre");

  if (error) throw new Error(error.message);
  return (data ?? []) as Impuesto[];
}

export async function getImpuestosConfig(): Promise<ImpuestoConfig[]> {
  const supabase = (await createClient()) as unknown as SupabaseClient;
  const { data, error } = await supabase
    .from("impuestos")
    .select("id, codigo, nombre, tipo, tarifa, cuenta_id, activo, orden, cuentas(codigo, nombre)")
    .order("orden")
    .order("nombre");

  if (error) throw new Error(error.message);

  return ((data ?? []) as (Impuesto & { cuentas: CuentaEmbed | CuentaEmbed[] | null })[]).map((fila) => {
    const cuenta = Array.isArray(fila.cuentas) ? (fila.cuentas[0] ?? null) : fila.cuentas;
    return {
      ...fila,
      cuenta_codigo: cuenta?.codigo ?? null,
      cuenta_nombre: cuenta?.nombre ?? null,
    };
  });
}
