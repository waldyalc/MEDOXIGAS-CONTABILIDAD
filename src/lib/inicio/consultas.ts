import { cache } from "react";

import { createClient } from "@/lib/supabase/server";

export interface GrupoCartera {
  monto: number;
  documentos: number;
}

export interface CarteraResumen {
  total: number;
  vigentes: GrupoCartera;
  vencidas: GrupoCartera;
}

export interface PuntoSerieVentas {
  etiqueta: string;
  actual: number;
  anterior: number;
}

export interface VentasResumen {
  total: number;
  anterior: number;
  variacion: number | null;
  serie: PuntoSerieVentas[];
}

export interface ResumenNegocio {
  desde: string;
  hasta: string;
  es_diario: boolean;
  cxc: CarteraResumen;
  cxp: CarteraResumen;
  impuestos_venta: number;
  productos_vendidos: number;
  devoluciones_clientes: number;
  clientes_con_ventas: number;
  ventas: VentasResumen;
}

export interface RespuestaResumen {
  resumen: ResumenNegocio | null;
  error: string | null;
}

/**
 * Una sola llamada a `dashboard_resumen` por request: `cache()` la comparte
 * entre las tarjetas y la gráfica aunque cada bloque tenga su propio Suspense.
 */
export const obtenerResumenNegocio = cache(async (desde: string, hasta: string): Promise<RespuestaResumen> => {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("dashboard_resumen", { p_desde: desde, p_hasta: hasta });

  if (error) return { resumen: null, error: error.message };
  return { resumen: data as unknown as ResumenNegocio, error: null };
});
