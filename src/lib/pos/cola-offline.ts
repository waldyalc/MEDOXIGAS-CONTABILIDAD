export type EstadoOperacionOffline = "pendiente" | "fallida" | "sincronizada";

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
    if (operacion.estado === "fallida" || operacion.proximoIntento > ahora()) return;
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
      return;
    }
    await almacen.guardar({
      ...operacion,
      intentos,
      estado: "sincronizada",
      proximoIntento: 0,
      error: null,
      resultado: respuesta.resultado,
    });
  }
}
