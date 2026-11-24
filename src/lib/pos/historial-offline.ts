import { calcularLineaPOS } from "./calculo";
import type { OperacionOffline } from "./cola-offline";
import type { HistorialPOSFila, LineaVenta, VentaPOSResultado } from "./tipos";

/**
 * Proyección de las ventas guardadas en este dispositivo (cola offline) al
 * historial de `/pos/historial`. Las filas del servidor son la verdad; lo
 * local se pinta solo mientras la venta no aparece en ellas, para que el
 * cajero vea sus ventas pendientes, con problema o recién sincronizadas.
 *
 * Todo lo que viene de IndexedDB es `unknown`: se lee con guardas, sin `any`.
 */

export type EstadoVentaLocal = "sincronizando" | "error" | "sincronizada";

export interface LineaLocalHistorial {
  id: string;
  descripcion: string;
  referencia: string | null;
  cantidad: string;
  unidad_nombre: string | null;
  precio: string;
  descuento_pct: string;
  itbis_tasa: string;
  total: string;
}

export interface TotalesLocalHistorial {
  subtotal: string;
  descuento: string;
  itbis: string;
  total: string;
  recibido: string;
  cambio: string;
}

export interface VentaLocalHistorial {
  uuid: string;
  folio: string;
  estado: EstadoVentaLocal;
  /** Motivo legible del rechazo del servidor; solo en `error`. */
  motivo: string | null;
  /** NCF definitivo que confirmó el servidor; `null` mientras no suba. */
  ncf: string | null;
  numero: number | null;
  cliente: { nombre: string; rnc_cedula: string | null };
  fecha: string;
  total: string;
  lineas: LineaLocalHistorial[];
  totales: TotalesLocalHistorial;
  /** Pestaña del carrito tal como se guardó; la valida `cargarVentaOffline`. */
  pestana: unknown;
  /** Resultado completo armado en local (cuando existe), para reimprimir el ticket real. */
  ventaCompleta: VentaPOSResultado | null;
}

export type ItemHistorialPOS =
  | { origen: "servidor"; fila: HistorialPOSFila }
  | { origen: "local"; venta: VentaLocalHistorial };

/** Id de selección en la lista maestro-detalle. */
export function idDeItemHistorial(item: ItemHistorialPOS): string {
  return item.origen === "servidor" ? item.fila.id : item.venta.uuid;
}

function campos(valor: unknown): Record<string, unknown> | null {
  if (typeof valor !== "object" || valor === null || Array.isArray(valor)) return null;
  return valor as Record<string, unknown>;
}

function texto(valor: unknown): string | null {
  return typeof valor === "string" && valor !== "" ? valor : null;
}

function numero(valor: unknown): number | null {
  return typeof valor === "number" && Number.isFinite(valor) ? valor : null;
}

function ticketDe(snapshot: unknown): Record<string, unknown> | null {
  return campos(campos(snapshot)?.ticket);
}

function facturaConfirmada(resultado: unknown): { id: string | null; ncf: string | null; numero: number | null } {
  const factura = campos(campos(resultado)?.factura);
  return { id: texto(factura?.id), ncf: texto(factura?.ncf), numero: numero(factura?.numero) };
}

function clienteDe(ticket: Record<string, unknown> | null): { nombre: string; rnc_cedula: string | null } {
  const cliente = campos(ticket?.cliente);
  return {
    nombre: texto(cliente?.nombre) ?? "Cliente sin nombre",
    rnc_cedula: texto(cliente?.rnc_cedula),
  };
}

function lineasDe(ticket: Record<string, unknown> | null): LineaLocalHistorial[] {
  const lista = ticket?.lineas;
  if (!Array.isArray(lista)) return [];

  return lista.flatMap((item) => {
    const linea = campos(item);
    if (!linea) return [];
    const descripcion = texto(linea.descripcion) ?? texto(linea.producto_nombre);
    if (!descripcion) return [];

    return [
      {
        id: texto(linea.id) ?? descripcion,
        descripcion,
        referencia: texto(linea.referencia),
        cantidad: texto(linea.cantidad) ?? "1",
        unidad_nombre: texto(linea.unidad_nombre),
        precio: texto(linea.precio) ?? "0",
        descuento_pct: texto(linea.descuento_pct) ?? "0",
        itbis_tasa: texto(linea.itbis_tasa) ?? "0",
        total: texto(linea.total) ?? "0",
      },
    ];
  });
}

function totalesDe(ticket: Record<string, unknown> | null): TotalesLocalHistorial {
  return {
    subtotal: texto(ticket?.subtotal) ?? "0",
    descuento: texto(ticket?.descuento) ?? "0",
    itbis: texto(ticket?.itbis) ?? "0",
    total: texto(ticket?.total) ?? "0",
    recibido: texto(ticket?.recibido) ?? "0",
    cambio: texto(ticket?.cambio) ?? "0",
  };
}

function estadoLocal(estado: OperacionOffline["estado"]): EstadoVentaLocal {
  if (estado === "pendiente") return "sincronizando";
  if (estado === "fallida") return "error";
  return "sincronizada";
}

function ventaCompletaDe(snapshot: Record<string, unknown> | null): VentaPOSResultado | null {
  const venta = campos(snapshot?.venta);
  if (!venta) return null;
  const factura = campos(venta.factura);
  const contacto = campos(venta.contacto);
  if (!factura || !contacto || !Array.isArray(venta.lineas) || !Array.isArray(venta.pagos)) return null;
  return venta as unknown as VentaPOSResultado;
}

/** Proyecta una operación de venta; `null` si no aplica o ya está en el servidor. */
export function proyectarVentaLocal(
  operacion: OperacionOffline,
  filas: readonly HistorialPOSFila[],
): VentaLocalHistorial | null {
  if (operacion.tipo !== "venta") return null;

  const snapshot = campos(operacion.snapshot);
  const ticket = ticketDe(operacion.snapshot);
  const confirmada = facturaConfirmada(operacion.resultado);
  const estado = estadoLocal(operacion.estado);

  if (estado === "sincronizada") {
    const yaEnServidor = filas.some(
      (fila) =>
        (confirmada.id !== null && fila.id === confirmada.id) ||
        (confirmada.ncf !== null && fila.ncf === confirmada.ncf),
    );
    if (yaEnServidor) return null;
  }

  const totales = totalesDe(ticket);

  return {
    uuid: operacion.uuid,
    folio: operacion.folio,
    estado,
    motivo: estado === "error" ? operacion.error : null,
    ncf: estado === "sincronizada" ? confirmada.ncf : null,
    numero: estado === "sincronizada" ? confirmada.numero : null,
    cliente: clienteDe(ticket),
    fecha: texto(ticket?.fecha) ?? "",
    total: totales.total,
    lineas: lineasDe(ticket),
    totales,
    pestana: snapshot?.pestana ?? null,
    ventaCompleta: ventaCompletaDe(snapshot),
  };
}

export interface FiltrosHistorialLocal {
  q?: string;
  desde?: string;
  hasta?: string;
  estado?: string;
  terminalId?: string;
  pagina?: number;
  /** Ventana máxima (ms) para mostrar una venta local sincronizada aún ausente en `filas`. */
  ventanaSincronizadaMs?: number;
  ahoraMs?: number;
}

const VENTANA_SINCRONIZADA_MS = 5 * 60 * 1000;

function diaDeIso(fecha: string): string {
  return fecha.length >= 10 ? fecha.slice(0, 10) : "";
}

function coincideFiltrosLocal(
  venta: VentaLocalHistorial,
  operacion: OperacionOffline,
  filtros?: FiltrosHistorialLocal,
): boolean {
  if (!filtros) return true;
  if ((filtros.pagina ?? 1) > 1) return false;
  if (filtros.terminalId) {
    const terminalLocal = operacion.ambito.split("/")[1] ?? "";
    if (terminalLocal !== "" && terminalLocal !== filtros.terminalId) return false;
  }
  if (filtros.estado === "anulada") return false;
  if (filtros.estado === "abierta" && venta.estado === "sincronizada") return false;
  const dia = diaDeIso(venta.fecha);
  if (dia && filtros.desde && dia < filtros.desde) return false;
  if (dia && filtros.hasta && dia > filtros.hasta) return false;
  if (filtros.q?.trim()) {
    const buscado = filtros.q.trim().toLocaleLowerCase("es");
    const textoVenta = `${venta.folio} ${venta.ncf ?? ""} ${venta.cliente.nombre}`.toLocaleLowerCase("es");
    if (!textoVenta.includes(buscado)) return false;
  }
  if (venta.estado === "sincronizada" && venta.fecha) {
    const fechaMs = Date.parse(venta.fecha);
    const ahora = filtros.ahoraMs ?? Date.now();
    const ventana = filtros.ventanaSincronizadaMs ?? VENTANA_SINCRONIZADA_MS;
    if (Number.isFinite(fechaMs) && ahora - fechaMs > ventana) return false;
  }
  return true;
}

/** Ventas locales de la más reciente a la más vieja, respetando filtros y paginación. */
export function proyectarVentasLocales(
  operaciones: readonly OperacionOffline[],
  filas: readonly HistorialPOSFila[],
  filtros?: FiltrosHistorialLocal,
): VentaLocalHistorial[] {
  return [...operaciones]
    .sort((a, b) => b.secuencia - a.secuencia || a.uuid.localeCompare(b.uuid))
    .flatMap((operacion) => {
      const venta = proyectarVentaLocal(operacion, filas);
      if (!venta || !coincideFiltrosLocal(venta, operacion, filtros)) return [];
      return [venta];
    });
}

/** Lo local va primero: son las ventas que el cajero acaba de cobrar. */
export function combinarHistorialPOS(
  filas: readonly HistorialPOSFila[],
  ventas: readonly VentaLocalHistorial[],
): ItemHistorialPOS[] {
  return [
    ...ventas.map((venta): ItemHistorialPOS => ({ origen: "local", venta })),
    ...filas.map((fila): ItemHistorialPOS => ({ origen: "servidor", fila })),
  ];
}

/** Líneas del ticket de soporte a partir de lo guardado en el snapshot. */
export function lineasVentaDeLocal(lineas: readonly LineaLocalHistorial[]): LineaVenta[] {
  return lineas.map((linea) => {
    const totales = calcularLineaPOS({
      cantidad: linea.cantidad,
      precio: linea.precio,
      descuento_pct: linea.descuento_pct,
      itbis_tasa: linea.itbis_tasa,
    });

    return {
      id: linea.id,
      producto_id: null,
      producto_nombre: null,
      referencia: linea.referencia,
      descripcion: linea.descripcion,
      cantidad: linea.cantidad,
      unidad_id: null,
      unidad_nombre: linea.unidad_nombre,
      factor_base: null,
      precio: linea.precio,
      descuento_pct: linea.descuento_pct,
      itbis_tasa: linea.itbis_tasa,
      impuesto_id: null,
      subtotal: totales.subtotal,
      itbis: totales.itbis,
      total: totales.total,
    };
  });
}
