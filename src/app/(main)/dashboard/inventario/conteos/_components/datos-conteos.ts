import { centavosDeDecimal } from "@/lib/inventario/ferreteria/mapeo";
import type { ConteoResumen } from "@/lib/inventario/ferreteria/tipos";
import { paginarConsulta } from "@/lib/supabase/paginar";
import { createClient } from "@/lib/supabase/server";

/** Fila de la lista con los datos que no vienen en `listarConteos`. */
export interface ConteoLista extends ConteoResumen {
  creado_por_nombre: string | null;
  /** Suma de las diferencias de las líneas, en centésimas. */
  diferencia_total_centavos: number;
}

interface FilaCreador {
  id: string;
  creado_por: string | null;
}

interface FilaDiferencia {
  id: string;
  conteo_id: string;
  diferencia: number | string;
}

/**
 * Completa la página visible de conteos con quién lo creó y la diferencia
 * total de sus líneas. Solo consulta los ids de esta página: un conteo puede
 * tener miles de líneas y la lista no necesita leer el resto.
 */
export async function enriquecerConteos(conteos: readonly ConteoResumen[]): Promise<ConteoLista[]> {
  if (conteos.length === 0) return [];

  const ids = conteos.map((conteo) => conteo.id);
  const supabase = await createClient();

  const [creadores, diferencias, nombres] = await Promise.all([
    paginarConsulta((inicio, fin) =>
      supabase
        .from("conteos_inventario")
        .select("id, creado_por")
        .in("id", ids)
        .order("id")
        .range(inicio, fin)
        .returns<FilaCreador[]>(),
    ),
    paginarConsulta((inicio, fin) =>
      supabase
        .from("conteo_inventario_lineas")
        .select("id, conteo_id, diferencia")
        .in("conteo_id", ids)
        .order("id")
        .range(inicio, fin)
        .returns<FilaDiferencia[]>(),
    ),
    nombresDeUsuarios(),
  ]);

  if (creadores.error) throw new Error(creadores.error.message);
  if (diferencias.error) throw new Error(diferencias.error.message);

  const diferenciaPorConteo = new Map<string, number>();
  for (const fila of diferencias.data ?? []) {
    const acumulado = diferenciaPorConteo.get(fila.conteo_id) ?? 0;
    diferenciaPorConteo.set(fila.conteo_id, acumulado + centavosDeDecimal(String(fila.diferencia)));
  }

  const creadorDe = new Map((creadores.data ?? []).map((fila) => [fila.id, fila.creado_por]));

  return conteos.map((conteo) => {
    const creadoPor = creadorDe.get(conteo.id) ?? null;

    return {
      ...conteo,
      creado_por_nombre: creadoPor === null ? null : (nombres.get(creadoPor) ?? null),
      diferencia_total_centavos: diferenciaPorConteo.get(conteo.id) ?? 0,
    };
  });
}

/**
 * Nombres que el usuario puede ver: el suyo siempre; los del resto solo si es
 * admin (`listar_perfiles` es de admin, y `perfiles` deja leer solo la fila
 * propia). Para `contador` y `lector` la columna queda en "—".
 */
async function nombresDeUsuarios(): Promise<Map<string, string>> {
  const supabase = await createClient();
  const nombres = new Map<string, string>();

  const { data: propio } = await supabase.from("perfiles").select("user_id, nombre, rol").maybeSingle();
  if (!propio) return nombres;

  nombres.set(propio.user_id, propio.nombre?.trim() || "Tú");

  if (propio.rol !== "admin") return nombres;

  const { data } = await supabase.rpc("listar_perfiles");
  for (const fila of data ?? []) {
    nombres.set(fila.user_id, fila.nombre?.trim() || fila.correo || "—");
  }

  return nombres;
}
