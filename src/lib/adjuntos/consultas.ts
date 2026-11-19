import type { SupabaseClient } from "@supabase/supabase-js";

import { paginarConsulta } from "@/lib/supabase/paginar";
import type { Database } from "@/lib/supabase/types";

import type { AdjuntoItem, TipoEntidadAdjunto } from "./adjuntos";

interface AdjuntoFila {
  id: string;
  nombre: string;
  mime: string;
  bytes: number;
  path: string;
  creado_en: string;
  creado_por_nombre: string | null;
}

function mapearAdjunto(fila: AdjuntoFila): AdjuntoItem {
  return {
    id: fila.id,
    nombre: fila.nombre,
    mime: fila.mime,
    bytes: fila.bytes,
    path: fila.path,
    creadoEn: fila.creado_en,
    creadoPorNombre: fila.creado_por_nombre,
  };
}

/**
 * Lee los adjuntos de una entidad por lotes de 1,000 (el tope de PostgREST
 * truncaría la lista en silencio), de más reciente a más antiguo.
 */
export function listarAdjuntos(
  supabase: SupabaseClient<Database>,
  tipo: TipoEntidadAdjunto,
  entidadId: string,
): Promise<{ data: AdjuntoItem[] | null; error: { message: string } | null }> {
  return paginarConsulta(async (inicio, fin) => {
    const { data, error } = await supabase
      .from("adjuntos")
      .select("id, nombre, mime, bytes, path, creado_en, creado_por_nombre")
      .eq("entidad_tipo", tipo)
      .eq("entidad_id", entidadId)
      .order("creado_en", { ascending: false })
      .order("id")
      .range(inicio, fin)
      .returns<AdjuntoFila[]>();
    return { data: (data ?? []).map(mapearAdjunto), error };
  });
}
