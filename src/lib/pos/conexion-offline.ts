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

/** Un fallo suelto no cambia el estado; el umbral sí. Un acierto lo resetea. */
export function registrarSondeo(salud: SaludConexion, respondio: boolean): SaludConexion {
  if (respondio) return { ...SALUD_CONEXION_INICIAL };
  const fallos = Math.min(salud.fallos + 1, FALLOS_PARA_OFFLINE);
  return { fallos, conectado: fallos < FALLOS_PARA_OFFLINE };
}

/**
 * El navegador ya sabe que no hay red (`navigator.onLine === false` o evento
 * `offline`): el POS pasa a «Sin conexión» al instante, sin esperar los tres
 * sondeos que solo existen para dudar cuando el navegador cree tener red.
 */
export function registrarOfflineInmediato(): SaludConexion {
  return { fallos: FALLOS_PARA_OFFLINE, conectado: false };
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
  error,
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
  if (estado === "sincronizando") return `Subiendo ventas… ${porSubir} por subir`;
  if (estado === "offline") return `Sin conexión — ${porSubir} ${porSubir === 1 ? "venta" : "ventas"} por subir`;
  if (!preparado) {
    // Bug #3: si IndexedDB falló, el pie no puede quedarse en «Preparando…».
    return error ? "Error de almacenamiento local — sin modo offline" : "Preparando la cola local…";
  }
  return `${porSubir} ${porSubir === 1 ? "operación" : "operaciones"} por subir · En línea`;
}

export type EstadoPopoverSincronizacion = "sincronizando" | "pendiente" | "al-dia";

export interface TextoPopoverSincronizacion {
  estado: EstadoPopoverSincronizacion;
  titulo: string;
  descripcion: string;
}

const TEXTOS_POPOVER_SINCRONIZACION: Record<EstadoPopoverSincronizacion, { titulo: string; descripcion: string }> = {
  sincronizando: {
    titulo: "Sincronizando",
    descripcion: "Estamos guardando las ventas que hiciste sin conexión, en un momento estará todo listo.",
  },
  pendiente: {
    titulo: "Sincronización pendiente",
    descripcion:
      "Te recomendamos revisar las ventas pendientes por sincronizar para evitar la pérdida de su información.",
  },
  "al-dia": {
    titulo: "Sincronización al día",
    descripcion: "Todo está disponible para que registres tus ventas",
  },
};

/** Título y descripción del popover de sincronización, copiados de Alegra POS. */
export function estadoPopoverSincronizacion({
  estado,
  porSubir,
  fallidas,
}: {
  estado: EstadoConexion;
  porSubir: number;
  fallidas: number;
}): TextoPopoverSincronizacion {
  let clave: EstadoPopoverSincronizacion = "al-dia";
  if (estado === "sincronizando") clave = "sincronizando";
  else if (porSubir > 0 || fallidas > 0) clave = "pendiente";
  return { estado: clave, ...TEXTOS_POPOVER_SINCRONIZACION[clave] };
}
