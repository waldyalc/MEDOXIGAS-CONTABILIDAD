/**
 * Salud del sondeo de conexión y texto del pie del POS.
 *
 * Un fallo aislado del sondeo (un timeout, un cambio de red, un despliegue de
 * Vercel) no debe pintar el POS como «Sin conexión»: hacen falta
 * `FALLOS_PARA_OFFLINE` sondeos seguidos. Cualquier respuesta buena reinicia el
 * contador y devuelve el pie a «En línea» al instante.
 *
 * «Error al subir» se deriva SOLO de operaciones `fallida` de la cola (la
 * bandeja de ventas con problema), nunca de un reintento transitorio que se
 * sube solo.
 */
export type EstadoConexion = "online" | "offline" | "sincronizando";

export const FALLOS_PARA_OFFLINE = 3;

/**
 * El sondeo pega a un estático del CDN, no a `/login`: con sesión iniciada,
 * `/login` redirige a `/dashboard` y cada latido renderizaba el dashboard
 * entero en el servidor; un render lento superaba el timeout y pintaba
 * «Sin conexión» aunque las ventas siguieran subiendo.
 */
export const RUTA_SONDEO = "/marca/logo-medoxigas-menu.png";

export interface SaludConexion {
  fallos: number;
  conectado: boolean;
}

export const SALUD_CONEXION_INICIAL: SaludConexion = { fallos: 0, conectado: true };

/**
 * Un fallo suelto no cambia el estado; el umbral sí. Un acierto lo resetea.
 * `sinRed` es el `!navigator.onLine` del navegador: eso no es un sondeo
 * fallido sino el sistema diciendo que no hay red — el pie pasa a
 * «Sin conexión» de inmediato, sin esperar los 3 fallos.
 */
export function registrarSondeo(salud: SaludConexion, respondio: boolean, sinRed = false): SaludConexion {
  if (respondio) return { ...SALUD_CONEXION_INICIAL };
  if (sinRed) return { fallos: FALLOS_PARA_OFFLINE, conectado: false };
  const fallos = Math.min(salud.fallos + 1, FALLOS_PARA_OFFLINE);
  return { fallos, conectado: fallos < FALLOS_PARA_OFFLINE };
}

/** Un fallo aislado no toca el estado visible; uno confirmado sí. */
export function estadoTrasSondeo(estado: EstadoConexion, conectado: boolean): EstadoConexion {
  if (estado === "sincronizando") return estado;
  return conectado ? "online" : "offline";
}

export function textoEstadoOffline({
  estado,
  porSubir,
  fallidas,
  preparado,
  error = null,
}: {
  estado: EstadoConexion;
  porSubir: number;
  fallidas: number;
  preparado: boolean;
  error?: string | null;
}): string {
  if (fallidas > 0) {
    const etiqueta = fallidas === 1 ? "venta con problema" : "ventas con problema";
    return `Error al subir — ${fallidas} ${etiqueta}${porSubir > 0 ? ` · ${porSubir} por subir` : ""}`;
  }
  // Sin almacenamiento local no hay POS offline: el aviso va en el pie, no solo en el panel.
  if (!preparado && error) return error;
  if (estado === "sincronizando") return `Subiendo ventas… ${porSubir} por subir`;
  if (estado === "offline") return `Sin conexión — ${porSubir} ${porSubir === 1 ? "venta" : "ventas"} por subir`;
  if (!preparado) return "Preparando la cola local…";
  return `${porSubir} ${porSubir === 1 ? "operación" : "operaciones"} por subir · En línea`;
}
