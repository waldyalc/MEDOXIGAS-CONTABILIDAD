/**
 * Validación de campos de formulario, sin React ni DOM.
 *
 * Cada formulario declara reglas (`requerido`, o una regla propia) y
 * `erroresDe` devuelve solo la primera falla de cada campo, en el orden en
 * que aparecen en pantalla. El hook `useValidacionFormulario`
 * (`src/components/formularios/validacion.ts`) usa esto para pintar los
 * errores, mostrar el toast y enfocar el primer campo inválido.
 */

export interface ReglaCampo {
  campo: string;
  invalido: boolean;
  mensaje: string;
}

export interface ErrorCampo {
  campo: string;
  mensaje: string;
}

/** Un valor vacío es `null`, `undefined`, texto en blanco o una lista sin elementos. */
export function vacio(valor: unknown): boolean {
  if (valor === null || valor === undefined) return true;
  if (typeof valor === "string") return valor.trim() === "";
  if (Array.isArray(valor)) return valor.length === 0;
  return false;
}

/** Regla de campo obligatorio con el mensaje en español que se muestra debajo. */
export function requerido(campo: string, valor: unknown, mensaje: string): ReglaCampo {
  return { campo, invalido: vacio(valor), mensaje };
}

/** Primera falla de cada campo, en el orden de las reglas. */
export function erroresDe(reglas: ReglaCampo[]): ErrorCampo[] {
  const vistos = new Set<string>();
  const errores: ErrorCampo[] = [];

  for (const regla of reglas) {
    if (!regla.invalido || vistos.has(regla.campo)) continue;
    vistos.add(regla.campo);
    errores.push({ campo: regla.campo, mensaje: regla.mensaje });
  }

  return errores;
}

export function mapaErrores(errores: ErrorCampo[]): Record<string, string> {
  return Object.fromEntries(errores.map((error) => [error.campo, error.mensaje]));
}
