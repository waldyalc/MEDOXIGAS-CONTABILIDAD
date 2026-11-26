const VENTANA_NAVEGACION_INTERNA_MS = 2_000;

let navegacionInternaHasta = 0;

export function marcarNavegacionInternaPos(ahora = Date.now()): void {
  navegacionInternaHasta = ahora + VENTANA_NAVEGACION_INTERNA_MS;
}

export function esNavegacionInternaPos(ahora = Date.now()): boolean {
  return ahora <= navegacionInternaHasta;
}

export function limpiarNavegacionInternaPos(): void {
  navegacionInternaHasta = 0;
}
