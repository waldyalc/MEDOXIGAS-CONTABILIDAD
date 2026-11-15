const TAMANO_LOTE = 1000;

interface Respuesta<Fila> {
  data: Fila[] | null;
  error: { message: string } | null;
}

/**
 * Lee una consulta completa por lotes de 1,000 filas: PostgREST corta cada
 * request en ~1,000 filas (también en .rpc()) y quedarse con eso trunca
 * reportes en silencio. La consulta debe traer un ORDER BY determinístico
 * (numero, id, fecha+numero...) o los lotes pueden repetir o saltar filas.
 */
export async function paginarConsulta<Fila>(
  consulta: (desde: number, hasta: number) => PromiseLike<Respuesta<Fila>>,
): Promise<Respuesta<Fila>> {
  const filas: Fila[] = [];
  for (let inicio = 0; ; inicio += TAMANO_LOTE) {
    const { data, error } = await consulta(inicio, inicio + TAMANO_LOTE - 1);
    if (error) return { data: null, error };
    const lote = data ?? [];
    filas.push(...lote);
    if (lote.length < TAMANO_LOTE) return { data: filas, error: null };
  }
}
