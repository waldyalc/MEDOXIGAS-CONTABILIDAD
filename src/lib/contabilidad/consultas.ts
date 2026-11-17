import { createClient } from "@/lib/supabase/server";

import type { CuentaOpcion } from "./validacion";

export async function listarOpcionesCuenta(): Promise<CuentaOpcion[]> {
  const supabase = await createClient();
  const { data, error } = await supabase.from("cuentas").select("id, codigo, nombre, tipo").order("codigo");

  if (error) throw new Error(error.message);
  return data ?? [];
}

/** Cuentas activas que aceptan movimientos, para asignarlas a un producto. */
export async function listarCuentasMovimiento(): Promise<CuentaOpcion[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("cuentas")
    .select("id, codigo, nombre, tipo")
    .eq("activa", true)
    .eq("acepta_movimientos", true)
    .order("codigo");

  if (error) throw new Error(error.message);
  return data ?? [];
}
