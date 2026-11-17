import type { DatosContribuyenteDgii } from "./consulta";

export interface CamposContacto {
  nombre: string;
}

export type CamposRellenados = Partial<CamposContacto>;

/** Se completa si está vacío o si su valor lo puso una consulta anterior. */
function debeRellenar(actual: string, relleno: string): boolean {
  return actual.trim() === "" || actual === relleno;
}

/**
 * Decide si se puede completar el nombre con la respuesta de la DGII.
 * Nunca sobrescribe lo que el usuario escribió: si ya hay un nombre distinto
 * al que rellenó una consulta previa, se respeta.
 */
export function completarConDatosDgii(
  datos: DatosContribuyenteDgii,
  escritos: CamposContacto,
  rellenos: CamposContacto,
): { campos: CamposRellenados; mensaje: string } {
  if (escritos.nombre === datos.nombre) {
    return { campos: {}, mensaje: "El nombre ya coincide con el de la DGII." };
  }

  if (!debeRellenar(escritos.nombre, rellenos.nombre)) {
    return {
      campos: {},
      mensaje: `La DGII encontró ${datos.nombre}; no se cambió el nombre que ya tenías escrito.`,
    };
  }

  return {
    campos: { nombre: datos.nombre },
    mensaje: "Datos de la DGII: se completó el nombre.",
  };
}
