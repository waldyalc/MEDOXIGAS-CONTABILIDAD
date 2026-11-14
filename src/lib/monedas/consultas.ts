import { createClient } from "@/lib/supabase/server";

import type { Moneda, MonedaConTasa, TasaCambio } from "./tipos";

export async function getMonedas(): Promise<Moneda[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("monedas")
    .select("codigo, nombre, simbolo, es_base, activo")
    .order("es_base", { ascending: false })
    .order("codigo")
    .returns<Moneda[]>();

  if (error) throw new Error(error.message);
  return data;
}

export async function getTasasCambio(): Promise<TasaCambio[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("tasas_cambio")
    .select("id, moneda_codigo, fecha, tasa")
    .order("fecha", { ascending: false })
    .order("moneda_codigo")
    .returns<TasaCambio[]>();

  if (error) throw new Error(error.message);
  return data;
}

export async function getMonedasConTasas(): Promise<{ monedas: MonedaConTasa[]; tasas: TasaCambio[] }> {
  const [monedas, tasas] = await Promise.all([getMonedas(), getTasasCambio()]);
  const ultimaPorMoneda = new Map<string, TasaCambio>();

  for (const tasa of tasas) {
    if (!ultimaPorMoneda.has(tasa.moneda_codigo)) ultimaPorMoneda.set(tasa.moneda_codigo, tasa);
  }

  return {
    monedas: monedas.map((moneda) => {
      const ultima = ultimaPorMoneda.get(moneda.codigo);
      return {
        ...moneda,
        ultimaTasa: moneda.es_base ? 1 : (ultima?.tasa ?? null),
        ultimaFecha: moneda.es_base ? null : (ultima?.fecha ?? null),
      };
    }),
    tasas,
  };
}
