export type OrigenTransaccion = "pago_recibido" | "pago_proveedor" | "gasto_menor";

export type TipoTransaccion = "entrada" | "salida";

export interface MovimientoTransaccion {
  id: string;
  origen: OrigenTransaccion;
  comprobante: string;
  fecha: string;
  cuenta: string;
  contactoId: string | null;
  contactoNombre: string | null;
  detalle: string;
  entradas: number;
  salidas: number;
  estado: string;
}

export interface FiltrosTransacciones {
  comprobante?: string;
  fecha?: string;
  estado?: string;
  tipo?: TipoTransaccion | "";
  valorCentavos?: number | null;
}

export interface TotalesTransacciones {
  entradas: number;
  salidas: number;
}

export interface PaginaTransacciones {
  filas: MovimientoTransaccion[];
  pagina: number;
  totalPaginas: number;
  total: number;
}

function normalizar(texto: string): string {
  return texto
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();
}

function coincideComprobante(movimiento: MovimientoTransaccion, comprobante: string): boolean {
  return comprobante === "" || normalizar(movimiento.comprobante).includes(comprobante);
}

function coincideEstado(movimiento: MovimientoTransaccion, estado: string): boolean {
  return estado === "" || normalizar(movimiento.estado) === estado;
}

function coincideTipo(movimiento: MovimientoTransaccion, tipo: TipoTransaccion | ""): boolean {
  if (tipo === "entrada") return movimiento.entradas > 0;
  if (tipo === "salida") return movimiento.salidas > 0;
  return true;
}

function coincideValor(movimiento: MovimientoTransaccion, valor: number | null): boolean {
  return valor == null || movimiento.entradas + movimiento.salidas === valor;
}

export function filtrarTransacciones(
  movimientos: readonly MovimientoTransaccion[],
  filtros: FiltrosTransacciones = {},
): MovimientoTransaccion[] {
  const comprobante = normalizar(filtros.comprobante ?? "");
  const fecha = filtros.fecha ?? "";
  const estado = normalizar(filtros.estado ?? "");
  const tipo = filtros.tipo ?? "";
  const valor = filtros.valorCentavos ?? null;

  return movimientos.filter(
    (movimiento) =>
      coincideComprobante(movimiento, comprobante) &&
      (fecha === "" || movimiento.fecha === fecha) &&
      coincideEstado(movimiento, estado) &&
      coincideTipo(movimiento, tipo) &&
      coincideValor(movimiento, valor),
  );
}

export function totalesTransacciones(movimientos: readonly MovimientoTransaccion[]): TotalesTransacciones {
  return movimientos.reduce<TotalesTransacciones>(
    (totales, movimiento) => ({
      entradas: totales.entradas + movimiento.entradas,
      salidas: totales.salidas + movimiento.salidas,
    }),
    { entradas: 0, salidas: 0 },
  );
}

export function paginarTransacciones(
  movimientos: readonly MovimientoTransaccion[],
  pagina: number,
  porPagina = 20,
): PaginaTransacciones {
  const tamano = Math.max(1, porPagina);
  const total = movimientos.length;
  const totalPaginas = Math.max(1, Math.ceil(total / tamano));
  const paginaActual = Math.min(Math.max(1, Math.trunc(pagina) || 1), totalPaginas);
  const inicio = (paginaActual - 1) * tamano;

  return {
    filas: movimientos.slice(inicio, inicio + tamano),
    pagina: paginaActual,
    totalPaginas,
    total,
  };
}
