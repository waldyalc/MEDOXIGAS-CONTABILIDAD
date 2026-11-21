import type { ZodError } from "zod";

/** Clave estable de un error inline; coincide con la ruta del arreglo en los esquemas de 1B. */
export function claveDeError(...partes: readonly (string | number)[]): string {
  return partes.join("-");
}

/**
 * Convierte los problemas de Zod en un mapa `ruta-del-arreglo → mensaje` para
 * pintar el error debajo del campo, con el primer mensaje de cada ruta.
 */
export function erroresDeZod(error: ZodError): Record<string, string> {
  const errores: Record<string, string> = {};

  for (const problema of error.issues) {
    const clave = claveDeError(...problema.path.map((parte) => String(parte)));
    if (!(clave in errores)) errores[clave] = problema.message;
  }

  return errores;
}
