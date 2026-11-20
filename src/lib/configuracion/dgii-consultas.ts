import { createClient } from "@/lib/supabase/server";

import type { CuentaDgii } from "./dgii";

/** Cuentas de movimiento activas que se clasifican para los reportes 606/607. */
export async function getCuentasDgii(): Promise<CuentaDgii[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("cuentas")
    .select("id, codigo, nombre, categoria_dgii, tipo_compra, tipo_ingreso")
    .eq("activa", true)
    .eq("acepta_movimientos", true)
    .order("codigo");

  if (error) throw new Error(error.message);

  return (data ?? []).map((cuenta) => ({
    id: cuenta.id,
    codigo: cuenta.codigo,
    nombre: cuenta.nombre,
    categoriaDgii: cuenta.categoria_dgii,
    tipoCompra: cuenta.tipo_compra,
    tipoIngreso: cuenta.tipo_ingreso,
  }));
}
