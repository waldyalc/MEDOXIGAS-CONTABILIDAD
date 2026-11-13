import { hoyRD } from "@/lib/facturacion/formato";
import { formatoDia } from "@/lib/formato";
import type { FilaReporte, TablaReporte } from "@/lib/reportes/exportar/tipos";

import { aCentavos, type DocumentoFicha } from "./ficha";

export const TRAMOS_ANTIGUEDAD = ["todas", "al-dia", "1-30", "31-60", "61-90", "+90"] as const;

export type TramoAntiguedad = (typeof TRAMOS_ANTIGUEDAD)[number];
export type TramoVencido = Exclude<TramoAntiguedad, "todas">;

export const OPCIONES_ANTIGUEDAD: { valor: TramoAntiguedad; etiqueta: string }[] = [
  { valor: "todas", etiqueta: "Todas" },
  { valor: "al-dia", etiqueta: "Al día" },
  { valor: "1-30", etiqueta: "1-30 días" },
  { valor: "31-60", etiqueta: "31-60 días" },
  { valor: "61-90", etiqueta: "61-90 días" },
  { valor: "+90", etiqueta: "+90 días" },
];

const ETIQUETAS_TRAMO: Record<TramoVencido, string> = {
  "al-dia": "Al día",
  "1-30": "1-30 días",
  "31-60": "31-60 días",
  "61-90": "61-90 días",
  "+90": "+90 días",
};

export type ParametrosEstadoCuenta = Record<string, string | string[] | undefined>;

export interface FiltrosEstadoCuenta {
  corte: string;
  antiguedad: TramoAntiguedad;
}

export interface PagoEstadoCuenta {
  factura_id: string | null;
  fecha: string;
  monto: number | string;
  estado: string;
}

export interface FilaEstadoCuenta {
  id: string;
  numero: number;
  ncf: string | null;
  fecha: string;
  vencimiento: string;
  totalCentavos: number;
  cobradoCentavos: number;
  saldoCentavos: number;
  diasVencidos: number;
  tramo: TramoVencido;
  pagada: boolean;
}

export interface TotalesEstadoCuenta {
  ventas: number;
  cobrado: number;
  porCobrar: number;
}

export interface ResumenEstadoCuenta {
  filas: FilaEstadoCuenta[];
  totales: TotalesEstadoCuenta;
}

function diaUtc(iso: string): number | null {
  const [anio, mes, dia] = iso.slice(0, 10).split("-").map(Number);
  if (!anio || !mes || !dia) return null;

  const fecha = Date.UTC(anio, mes - 1, dia);
  const comprobacion = new Date(fecha);
  if (comprobacion.getUTCFullYear() !== anio || comprobacion.getUTCMonth() !== mes - 1) return null;
  if (comprobacion.getUTCDate() !== dia) return null;

  return fecha;
}

export function diasEntre(desde: string, hasta: string): number {
  const inicio = diaUtc(desde);
  const fin = diaUtc(hasta);
  if (inicio === null || fin === null) return 0;
  return Math.round((fin - inicio) / 86_400_000);
}

export function diasVencidos(vencimiento: string, corte: string): number {
  return Math.max(0, diasEntre(vencimiento, corte));
}

export function tramoAntiguedad(dias: number): TramoVencido {
  if (dias <= 0) return "al-dia";
  if (dias <= 30) return "1-30";
  if (dias <= 60) return "31-60";
  if (dias <= 90) return "61-90";
  return "+90";
}

export function etiquetaTramo(tramo: TramoVencido): string {
  return ETIQUETAS_TRAMO[tramo];
}

function cobradoAlCorte(
  pagos: readonly PagoEstadoCuenta[],
  facturaId: string,
  corte: string,
  porFactura: Map<string, number>,
): number {
  const cache = porFactura.get(facturaId);
  if (cache !== undefined) return cache;

  const cobrado = pagos.reduce((total, pago) => {
    if (pago.estado !== "activo" || pago.factura_id !== facturaId) return total;
    if (pago.fecha.slice(0, 10) > corte) return total;
    return total + aCentavos(pago.monto);
  }, 0);

  porFactura.set(facturaId, cobrado);
  return cobrado;
}

export function calcularEstadoCuenta(
  facturas: readonly DocumentoFicha[],
  pagos: readonly PagoEstadoCuenta[],
  corte: string,
  antiguedad: TramoAntiguedad = "todas",
): ResumenEstadoCuenta {
  const porFactura = new Map<string, number>();

  const filas = facturas
    .filter((factura) => factura.estado !== "anulada" && factura.fecha.slice(0, 10) <= corte)
    .map<FilaEstadoCuenta>((factura) => {
      const totalCentavos = aCentavos(factura.total);
      const cobradoCentavos = cobradoAlCorte(pagos, factura.id, corte, porFactura);
      const saldoCentavos = Math.max(0, totalCentavos - cobradoCentavos);
      const dias = diasVencidos(factura.vencimiento, corte);

      return {
        id: factura.id,
        numero: factura.numero,
        ncf: factura.ncf,
        fecha: factura.fecha,
        vencimiento: factura.vencimiento,
        totalCentavos,
        cobradoCentavos,
        saldoCentavos,
        diasVencidos: dias,
        tramo: tramoAntiguedad(dias),
        pagada: saldoCentavos === 0,
      };
    })
    .filter((fila) => antiguedad === "todas" || fila.tramo === antiguedad)
    .sort((a, b) => a.fecha.localeCompare(b.fecha) || a.numero - b.numero);

  return {
    filas,
    totales: {
      ventas: filas.reduce((total, fila) => total + fila.totalCentavos, 0),
      cobrado: filas.reduce((total, fila) => total + fila.cobradoCentavos, 0),
      porCobrar: filas.reduce((total, fila) => total + fila.saldoCentavos, 0),
    },
  };
}

function etiquetaAntiguedad(valor: TramoAntiguedad): string {
  return OPCIONES_ANTIGUEDAD.find((opcion) => opcion.valor === valor)?.etiqueta ?? valor;
}

export function tablaEstadoCuenta(
  contactoNombre: string,
  filtros: FiltrosEstadoCuenta,
  resumen: ResumenEstadoCuenta,
): TablaReporte {
  const filas: FilaReporte[] = resumen.filas.map((fila) => ({
    celdas: {
      documento: fila.ncf === null ? `#${fila.numero}` : `#${fila.numero} · ${fila.ncf}`,
      creacion: fila.fecha,
      vencimiento: fila.vencimiento,
      antiguedad: etiquetaTramo(fila.tramo),
      diasVencidos: fila.diasVencidos,
      estado: fila.pagada ? "Pagada" : "Pendiente",
      total: fila.totalCentavos,
      cobrado: fila.cobradoCentavos,
      saldo: fila.saldoCentavos,
    },
  }));

  filas.push({
    celdas: {
      documento: "Totales",
      creacion: null,
      vencimiento: null,
      antiguedad: null,
      diasVencidos: null,
      estado: null,
      total: resumen.totales.ventas,
      cobrado: resumen.totales.cobrado,
      saldo: resumen.totales.porCobrar,
    },
    estilo: "total",
  });

  return {
    titulo: "Estado de cuenta",
    subtitulo: `${contactoNombre} · Corte al ${formatoDia(filtros.corte)} · Antigüedad: ${etiquetaAntiguedad(filtros.antiguedad)}`,
    columnas: [
      { clave: "documento", titulo: "Documento", tipo: "texto" },
      { clave: "creacion", titulo: "Creación", tipo: "fecha" },
      { clave: "vencimiento", titulo: "Vencimiento", tipo: "fecha" },
      { clave: "antiguedad", titulo: "Antigüedad", tipo: "texto" },
      { clave: "diasVencidos", titulo: "Días vencidos", tipo: "texto" },
      { clave: "estado", titulo: "Estado", tipo: "texto" },
      { clave: "total", titulo: "Total", tipo: "dinero" },
      { clave: "cobrado", titulo: "Cobrado", tipo: "dinero" },
      { clave: "saldo", titulo: "Saldo", tipo: "dinero" },
    ],
    filas,
  };
}

function esFechaValida(texto: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(texto)) return false;
  const fecha = new Date(`${texto}T00:00:00.000Z`);
  return !Number.isNaN(fecha.getTime()) && fecha.toISOString().slice(0, 10) === texto;
}

function leerTexto(valor: string | string[] | undefined): string | null {
  const texto = Array.isArray(valor) ? valor[0] : valor;
  return texto ?? null;
}

function esTramo(valor: string): valor is TramoAntiguedad {
  return (TRAMOS_ANTIGUEDAD as readonly string[]).includes(valor);
}

export function parsearFiltrosEstadoCuenta(params: ParametrosEstadoCuenta, hoy: string = hoyRD()): FiltrosEstadoCuenta {
  const corte = leerTexto(params.corte);
  const antiguedad = leerTexto(params.antiguedad);

  return {
    corte: corte !== null && esFechaValida(corte) ? corte : hoy,
    antiguedad: antiguedad !== null && esTramo(antiguedad) ? antiguedad : "todas",
  };
}
