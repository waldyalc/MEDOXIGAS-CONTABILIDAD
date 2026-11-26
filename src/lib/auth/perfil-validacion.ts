export interface CambioContrasenaEntrada {
  actual: string;
  nueva: string;
  confirmar: string;
}

export type ResultadoValidacionContrasena = { ok: true } | { ok: false; error: string };

/**
 * Reglas puras del cambio de contraseña. Se usan igual en el cliente (para
 * responder sin viaje de red) y en la Server Action (como candado real).
 */
export function validarCambioContrasena({
  actual,
  nueva,
  confirmar,
}: CambioContrasenaEntrada): ResultadoValidacionContrasena {
  if (!actual) return { ok: false, error: "Ingresa tu contraseña actual." };
  if (!nueva) return { ok: false, error: "Ingresa la nueva contraseña." };
  if (nueva.length < 8) {
    return { ok: false, error: "La nueva contraseña debe tener al menos 8 caracteres." };
  }
  if (!/\p{L}/u.test(nueva) || !/\d/u.test(nueva)) {
    return { ok: false, error: "La nueva contraseña debe incluir al menos una letra y un número." };
  }
  if (!confirmar) return { ok: false, error: "Confirma la nueva contraseña." };
  if (nueva !== confirmar) return { ok: false, error: "La confirmación no coincide con la nueva contraseña." };
  if (nueva === actual) {
    return { ok: false, error: "La nueva contraseña debe ser diferente de la contraseña actual." };
  }

  return { ok: true };
}
