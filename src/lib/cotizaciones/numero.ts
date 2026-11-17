export type PrevisualizacionNumero = { estado: "lista"; numero: number } | { estado: "no-disponible"; mensaje: string };

/** Límite de `numero int` en Postgres. */
const NUMERO_MAXIMO = 2_147_483_647;

/**
 * Próximo número de una cotización o un conduce, sin reservarlo.
 *
 * `cotizaciones.numero` y `remisiones.numero` son `int` con
 * `default nextval('…_numero_seq')` y la secuencia no es legible por
 * `authenticated`, así que la vista previa replica el próximo valor con el
 * último número guardado más uno
 * (`supabase/migrations/20261113230000_cotizaciones_remisiones.sql`).
 * No escribe, no llama a `nextval` y no consume la secuencia: si otro usuario
 * guarda antes, el número definitivo es el que devuelve el guardado.
 */
export function previsualizarNumero(ultimo: number | null | undefined): PrevisualizacionNumero {
  const numero = (ultimo ?? 0) + 1;
  if (numero > NUMERO_MAXIMO) {
    return { estado: "no-disponible", mensaje: "La numeración llegó a su número máximo." };
  }
  return { estado: "lista", numero };
}
