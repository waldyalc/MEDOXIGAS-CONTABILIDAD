export const ACCION_CREAR_OTRO = "crear-otro";

interface BotonEnvioLike {
  tagName?: string;
  value?: string;
}

/**
 * ¿El submit que disparó el formulario vino de «Guardar y crear otro»?
 *
 * `new FormData(form)` no incluye el botón que envió, así que la intención se
 * lee del `submitter` del evento nativo. Se comprueba la forma mínima del
 * botón (`tagName`/`value`) para poder probarlo sin DOM.
 */
export function esAccionCrearOtro(submitter: EventTarget | null): boolean {
  if (submitter === null) return false;

  const boton = submitter as unknown as BotonEnvioLike;
  return boton.tagName === "BUTTON" && boton.value === ACCION_CREAR_OTRO;
}
