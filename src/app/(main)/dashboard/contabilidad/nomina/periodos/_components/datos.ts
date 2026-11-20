import { mensajeErrorRpc } from "@/lib/facturacion/errores";
import { paginarConsulta } from "@/lib/supabase/paginar";
import { createClient } from "@/lib/supabase/server";

/** Lecturas puntuales de las pantallas de nómina (solo columnas que se muestran). */

export interface ConteoRecibos {
  /** Todos los recibos del periodo, incluidos los anulados. */
  total: number;
  /** No anulados. */
  activos: number;
  borradores: number;
  calculados: number;
  contabilizados: number;
  pagados: number;
  /** No anulados con colilla enviada. */
  enviados: number;
  /** No anulados en calculado/contabilizado/pagado (los que pueden enviarse). */
  enviables: number;
  ultimaFechaPago: string | null;
  ultimoEnvio: string | null;
}

interface FilaConteo {
  periodo_id: string;
  estado: string;
  fecha_pagado: string | null;
  colilla_enviada_en: string | null;
}

const SIN_RECIBOS: ConteoRecibos = {
  total: 0,
  activos: 0,
  borradores: 0,
  calculados: 0,
  contabilizados: 0,
  pagados: 0,
  enviados: 0,
  enviables: 0,
  ultimaFechaPago: null,
  ultimoEnvio: null,
};

function masReciente(actual: string | null, nuevo: string | null): string | null {
  if (!nuevo) return actual;
  return actual && actual > nuevo ? actual : nuevo;
}

function acumular(actual: ConteoRecibos, fila: FilaConteo): void {
  actual.total += 1;
  if (fila.estado !== "anulado") {
    actual.activos += 1;
    if (fila.estado === "borrador") actual.borradores += 1;
    if (fila.estado === "calculado") actual.calculados += 1;
    if (fila.estado === "contabilizado") actual.contabilizados += 1;
    if (fila.estado === "pagado") actual.pagados += 1;
    if (fila.estado !== "borrador") actual.enviables += 1;
    if (fila.colilla_enviada_en) actual.enviados += 1;
    actual.ultimoEnvio = masReciente(actual.ultimoEnvio, fila.colilla_enviada_en);
  }

  actual.ultimaFechaPago = masReciente(actual.ultimaFechaPago, fila.fecha_pagado);
}

/** Agrupa por periodo los recibos de la página: empleados, pagos y colillas. */
export async function getConteosRecibos(periodoIds: readonly string[]): Promise<Map<string, ConteoRecibos>> {
  const conteos = new Map<string, ConteoRecibos>();
  if (periodoIds.length === 0) return conteos;

  const supabase = await createClient();
  const { data, error } = await paginarConsulta((inicio, fin) =>
    supabase
      .from("nomina_recibos")
      .select("periodo_id, estado, fecha_pagado, colilla_enviada_en")
      .in("periodo_id", [...periodoIds])
      .order("periodo_id")
      .order("id")
      .range(inicio, fin)
      .returns<FilaConteo[]>(),
  );

  if (error) throw new Error(mensajeErrorRpc(error));

  for (const fila of data ?? []) {
    const actual = conteos.get(fila.periodo_id) ?? { ...SIN_RECIBOS };
    acumular(actual, fila);
    conteos.set(fila.periodo_id, actual);
  }

  return conteos;
}

/** Años con parámetros legales sembrados; el formulario de periodo no inventa tasas. */
export async function getAniosConParametros(): Promise<number[]> {
  const supabase = await createClient();
  const { data, error } = await supabase.from("nomina_parametros_rd").select("anio").order("anio");

  if (error) throw new Error(mensajeErrorRpc(error));
  return (data ?? []).map((fila) => fila.anio);
}
