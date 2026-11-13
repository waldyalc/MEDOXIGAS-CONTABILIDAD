import { normalizarTexto } from "./texto";
import type { FilaCartera, FiltrosCartera, VistaConcreta } from "./tipos";

const MS_DIA = 86_400_000;
const FECHA_ISO = /^(\d{4})-(\d{2})-(\d{2})/;

function fechaUtc(iso: string): number | null {
  const coincidencia = FECHA_ISO.exec(iso);
  if (coincidencia == null) return null;

  const anio = Number(coincidencia[1]);
  const mes = Number(coincidencia[2]);
  const dia = Number(coincidencia[3]);

  return Date.UTC(anio, mes - 1, dia);
}

/** Días completos entre dos fechas ISO (YYYY-MM-DD); negativo si `hasta` es anterior. */
export function diasEntre(desde: string, hasta: string): number {
  const inicio = fechaUtc(desde);
  const fin = fechaUtc(hasta);
  if (inicio == null || fin == null) return 0;

  return Math.round((fin - inicio) / MS_DIA);
}

/** Días vencidos a la fecha de corte; 0 si aún no vence. */
export function diasVencida(vencimiento: string, corte: string): number {
  return Math.max(0, diasEntre(vencimiento, corte));
}

export function clasificarVista(dias: number): VistaConcreta {
  if (dias <= 0) return "no-vencidas";
  if (dias <= 30) return "vencidas-30";
  if (dias <= 60) return "vencidas-31-60";
  if (dias <= 90) return "vencidas-61-90";
  return "vencidas-91";
}

function dentroDe(fecha: string, desde: string | null, hasta: string | null): boolean {
  return (desde == null || fecha >= desde) && (hasta == null || fecha <= hasta);
}

export function coincideFiltros(fila: FilaCartera, filtros: FiltrosCartera): boolean {
  if (filtros.vista !== "todas" && fila.vista !== filtros.vista) return false;

  const ncf = normalizarTexto(filtros.ncf).replace(/^#/, "");
  if (ncf !== "") {
    const referencia = `${fila.ncf ?? ""} ${fila.numero}`.toLowerCase();
    if (!referencia.includes(ncf)) return false;
  }

  const contacto = normalizarTexto(filtros.contacto);
  if (contacto !== "" && !normalizarTexto(fila.contactoNombre).includes(contacto)) return false;

  return (
    dentroDe(fila.creado, filtros.creacionDesde, filtros.creacionHasta) &&
    dentroDe(fila.vencimiento, filtros.vencimientoDesde, filtros.vencimientoHasta)
  );
}

export function filtrarCartera(filas: readonly FilaCartera[], filtros: FiltrosCartera): FilaCartera[] {
  return filas.filter((fila) => coincideFiltros(fila, filtros));
}

export function totalCartera(filas: readonly FilaCartera[]): number {
  return filas.reduce((total, fila) => total + fila.saldo, 0);
}

/** Saldo pendiente en centavos: total - pagado - crédito. */
export function saldoCartera(total: number, pagado: number, credito = 0): number {
  return total - pagado - credito;
}

export function totalesPorVista(filas: readonly FilaCartera[]): Record<VistaConcreta, number> {
  const totales: Record<VistaConcreta, number> = {
    "vencidas-30": 0,
    "vencidas-31-60": 0,
    "vencidas-61-90": 0,
    "vencidas-91": 0,
    "no-vencidas": 0,
  };

  for (const fila of filas) {
    totales[fila.vista] += fila.saldo;
  }

  return totales;
}

export interface FiltrosCarteraUrl {
  vista?: string;
  ncf?: string;
  contacto?: string;
  creacion_desde?: string;
  creacion_hasta?: string;
  vencimiento_desde?: string;
  vencimiento_hasta?: string;
}

export function filtrosDesdeUrl(valores: FiltrosCarteraUrl, vista: FiltrosCartera["vista"]): FiltrosCartera {
  return {
    vista,
    ncf: valores.ncf ?? "",
    contacto: valores.contacto ?? "",
    creacionDesde: valores.creacion_desde ?? null,
    creacionHasta: valores.creacion_hasta ?? null,
    vencimientoDesde: valores.vencimiento_desde ?? null,
    vencimientoHasta: valores.vencimiento_hasta ?? null,
  };
}
