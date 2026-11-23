export type EstadoOperacionOffline = "pendiente" | "fallida" | "sincronizada";

export function resumenSnapshotOffline(snapshot: unknown): string | null {
  if (typeof snapshot !== "object" || snapshot === null) return null;
  const ticket = "ticket" in snapshot ? snapshot.ticket : null;
  if (typeof ticket === "object" && ticket !== null && "cliente" in ticket && "total" in ticket) {
    const cliente = ticket.cliente;
    const nombre =
      typeof cliente === "object" && cliente !== null && "nombre" in cliente && typeof cliente.nombre === "string"
        ? cliente.nombre
        : null;
    const total = typeof ticket.total === "string" ? `RD$${ticket.total}` : null;
    return [nombre, total].filter(Boolean).join(" · ") || null;
  }
  const monto = "monto" in snapshot && typeof snapshot.monto === "string" ? `RD$${snapshot.monto}` : null;
  if (!monto) return null;
  const motivo = "motivo" in snapshot && typeof snapshot.motivo === "string" ? snapshot.motivo : "Movimiento";
  return `${motivo} · ${monto}`;
}

export function resumenConfirmacionOffline(resultado: unknown): string | null {
  if (typeof resultado !== "object" || resultado === null) return null;
  const documento =
    "factura" in resultado ? resultado.factura : "movimiento" in resultado ? resultado.movimiento : null;
  if (typeof documento !== "object" || documento === null) return null;
  const numero =
    "numero" in documento && (typeof documento.numero === "number" || typeof documento.numero === "string")
      ? documento.numero
      : null;
  const ncf = "ncf" in documento && typeof documento.ncf === "string" ? documento.ncf : null;
  return [numero !== null ? `No. ${numero}` : null, ncf ? `NCF ${ncf}` : null].filter(Boolean).join(" · ") || null;
}

export interface OperacionOffline {
  uuid: string;
  ambito: string;
  secuencia: number;
  tipo: "venta" | "movimiento";
  turnoId: string;
  folio: string;
  payload: unknown;
  snapshot: unknown;
  estado: EstadoOperacionOffline;
  intentos: number;
  proximoIntento: number;
  error: string | null;
  resultado: unknown;
}

export interface AlmacenColaOffline {
  listar: (ambito: string) => Promise<OperacionOffline[]>;
  guardar: (operacion: OperacionOffline) => Promise<void>;
  eliminar: (ambito: string, uuid: string) => Promise<void>;
}

export type ResultadoEnvioOffline =
  | { ok: true; resultado: unknown }
  | { ok: false; transitorio: boolean; error: string };

export function nuevaOperacionOffline(
  entrada: Pick<OperacionOffline, "ambito" | "tipo" | "turnoId" | "payload" | "snapshot" | "secuencia">,
  uuid = crypto.randomUUID(),
): OperacionOffline {
  return structuredClone({
    ...entrada,
    uuid,
    folio: `POS-LOCAL-${uuid}`,
    estado: "pendiente",
    intentos: 0,
    proximoIntento: 0,
    error: null,
    resultado: null,
  });
}

export function demoraReintentoOffline(intentos: number): number {
  return Math.min(600_000, 5_000 * 2 ** Math.min(Math.max(intentos - 1, 0), 7));
}

/** Una venta rechazada se conserva marcada y el cajero decide reintentarla o descartarla. */
export function programarReintentoOffline(operacion: OperacionOffline): OperacionOffline {
  return { ...operacion, estado: "pendiente", error: null, proximoIntento: 0 };
}

/** Aviso del cierre cuando quedan ventas que el servidor rechazó: no bloquean, pero no subirán. */
export function avisoCierreOffline(fallidas: number): string | null {
  if (fallidas <= 0) return null;
  return fallidas === 1
    ? "1 venta con problema no subirá. Queda guardada en este dispositivo."
    : `${fallidas} ventas con problema no subirán. Quedan guardadas en este dispositivo.`;
}

export interface RevisionCierreOffline {
  impedimento: string | null;
  aviso: string | null;
  porSubir: number;
  fallidas: number;
}

/**
 * El cierre se bloquea solo mientras haya ventas por subir; una venta rechazada
 * (fallida) no impide cerrar el turno, pero el cajero debe ver el aviso.
 */
export function revisionCierreOffline(
  operaciones: Pick<OperacionOffline, "estado">[],
  conectado: boolean,
): RevisionCierreOffline {
  const porSubir = operaciones.filter((operacion) => operacion.estado === "pendiente").length;
  const fallidas = operaciones.filter((operacion) => operacion.estado === "fallida").length;
  const aviso = avisoCierreOffline(fallidas);
  if (!conectado) {
    return {
      impedimento:
        porSubir > 0
          ? `Conéctate para subir ${porSubir} ventas antes de cerrar.`
          : "Conéctate a internet para cerrar el turno.",
      aviso,
      porSubir,
      fallidas,
    };
  }
  return {
    impedimento: porSubir > 0 ? `Conéctate para subir ${porSubir} ventas antes de cerrar.` : null,
    aviso,
    porSubir,
    fallidas,
  };
}

type PasoColaOffline = "seguir" | "detener";

async function procesarOperacionOffline(
  almacen: AlmacenColaOffline,
  operacion: OperacionOffline,
  enviar: (operacion: OperacionOffline) => Promise<ResultadoEnvioOffline>,
  ahora: () => number,
): Promise<PasoColaOffline> {
  let respuesta: ResultadoEnvioOffline;
  try {
    respuesta = await enviar(structuredClone(operacion));
  } catch {
    respuesta = { ok: false, transitorio: true, error: "No se recibió confirmación del servidor." };
  }
  const intentos = operacion.intentos + 1;
  if (!respuesta.ok) {
    await almacen.guardar({
      ...operacion,
      intentos,
      estado: respuesta.transitorio ? "pendiente" : "fallida",
      proximoIntento: respuesta.transitorio ? ahora() + demoraReintentoOffline(intentos) : 0,
      error: respuesta.error,
    });
    // Un fallo de red conserva el orden; un rechazo de negocio no debe frenar las demás ventas.
    return respuesta.transitorio ? "detener" : "seguir";
  }
  await almacen.guardar({
    ...operacion,
    intentos,
    estado: "sincronizada",
    proximoIntento: 0,
    error: null,
    resultado: respuesta.resultado,
  });
  return "seguir";
}

export async function sincronizarColaOffline(
  almacen: AlmacenColaOffline,
  ambito: string,
  enviar: (operacion: OperacionOffline) => Promise<ResultadoEnvioOffline>,
  ahora = Date.now,
): Promise<void> {
  const operaciones = (await almacen.listar(ambito))
    .filter((operacion) => operacion.estado !== "sincronizada")
    .sort((a, b) => a.secuencia - b.secuencia || a.uuid.localeCompare(b.uuid));

  for (const operacion of operaciones) {
    // Una operación rechazada no puede trancar la cola: queda visible y se salta.
    if (operacion.estado === "fallida") continue;
    if (operacion.proximoIntento > ahora()) return;
    if ((await procesarOperacionOffline(almacen, operacion, enviar, ahora)) === "detener") return;
  }
}
