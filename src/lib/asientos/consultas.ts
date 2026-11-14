import { createClient } from "@/lib/supabase/server";

import type { AsientoLista, CentroCostoAsiento, ContactoAsiento, CuentaAsiento, DatosFormularioAsiento } from "./tipos";

const FORMATO_FECHA = /^\d{4}-\d{2}-\d{2}$/;

export function normalizarFecha(valor: string | undefined): string | undefined {
  if (valor == null || !FORMATO_FECHA.test(valor)) return undefined;
  return valor;
}

export async function getAsientosLista(desde?: string, hasta?: string): Promise<AsientoLista[]> {
  const supabase = await createClient();
  let consulta = supabase
    .from("asientos")
    .select("id, numero, fecha, descripcion, origen_tipo, total")
    .order("numero", { ascending: false })
    .limit(300);

  if (desde) consulta = consulta.gte("fecha", desde);
  if (hasta) consulta = consulta.lte("fecha", hasta);

  const { data, error } = await consulta.returns<AsientoLista[]>();
  if (error) throw new Error(error.message);

  return data;
}

export async function getDatosFormularioAsiento(): Promise<DatosFormularioAsiento> {
  const supabase = await createClient();
  const [cuentas, contactos, centrosCosto] = await Promise.all([
    supabase
      .from("cuentas")
      .select("id, codigo, nombre")
      .eq("activa", true)
      .eq("acepta_movimientos", true)
      .order("codigo")
      .returns<CuentaAsiento[]>(),
    supabase.from("contactos").select("id, nombre").eq("activo", true).order("nombre").returns<ContactoAsiento[]>(),
    supabase
      .from("centros_costo")
      .select("id, codigo, nombre")
      .eq("activo", true)
      .order("codigo")
      .returns<CentroCostoAsiento[]>(),
  ]);

  if (cuentas.error) throw new Error(cuentas.error.message);
  if (contactos.error) throw new Error(contactos.error.message);
  if (centrosCosto.error) throw new Error(centrosCosto.error.message);

  return { cuentas: cuentas.data, contactos: contactos.data, centrosCosto: centrosCosto.data };
}
