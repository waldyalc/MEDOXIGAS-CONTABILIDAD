const LOTE_IN = 200;

interface Respuesta<Fila> {
  data: Fila[] | null;
  error: { message: string } | null;
}

/**
 * Parte una lista de ids en lotes de 200: desde ~350 ids la URL de .in()
 * revienta y la petición cae entera (no trunca, falla). Preferir un join
 * !inner cuando la relación existe en PostgREST; los lotes son para ids que
 * vienen de otra consulta y no se pueden filtrar con join (ej.: origen_id
 * polimórfico de asientos).
 */
export async function consultarEnLotes<Fila>(
  ids: readonly string[],
  consulta: (lote: string[]) => PromiseLike<Respuesta<Fila>>,
): Promise<Respuesta<Fila>> {
  const filas: Fila[] = [];
  for (let i = 0; i < ids.length; i += LOTE_IN) {
    const { data, error } = await consulta(ids.slice(i, i + LOTE_IN));
    if (error) return { data: null, error };
    filas.push(...(data ?? []));
  }
  return { data: filas, error: null };
}
