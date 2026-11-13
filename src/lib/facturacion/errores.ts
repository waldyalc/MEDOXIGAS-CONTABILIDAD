interface ErrorRpc {
  message: string;
  code?: string | null;
}

const GENERICO = "No se pudo completar la operación. Intenta de nuevo.";
const SESION = "Tu sesión expiró. Vuelve a iniciar sesión.";

const POR_CODIGO: Record<string, string> = {
  "42501": "No tienes permiso para realizar esta acción.",
  "23505": "Ese registro ya existe.",
  "23503": "Ese registro está en uso y no se puede cambiar.",
  PGRST301: SESION,
  PGRST302: SESION,
};

const TEXTO_EN_INGLES =
  /\b(error|failed|failure|violates|permission denied|duplicate key|not found|invalid|missing|does not exist|could not|unexpected|expired|unauthorized|forbidden|schema cache)\b/i;

export function mensajeErrorRpc(error: ErrorRpc | null | undefined): string {
  if (!error) return GENERICO;

  const porCodigo = error.code ? POR_CODIGO[error.code] : undefined;
  if (porCodigo) return porCodigo;

  const mensaje = error.message?.trim() ?? "";
  if (!mensaje) return GENERICO;
  if (TEXTO_EN_INGLES.test(mensaje)) return GENERICO;

  return mensaje.charAt(0).toLocaleUpperCase("es-DO") + mensaje.slice(1);
}
