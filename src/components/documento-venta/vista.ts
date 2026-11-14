import { formatoCantidad } from "@/lib/facturacion/formato";

export type TipoVistaDocumento = "factura" | "cotizacion" | "conduce";
export type TonoEstado = "amber" | "green" | "red" | "neutral";

export interface EtiquetaEstado {
  etiqueta: string;
  tono: TonoEstado;
}

export interface ResumenFacturaVista {
  valorTotal: number;
  valorRetenido: number;
  totalCobrado: number;
  porCobrar: number;
}

export interface LineaCalculable {
  cantidad: number;
  precio: number;
  descuento_pct: number;
  itbis_tasa: number;
  subtotal: number;
}

export interface NotaConEstado {
  total: number;
  estado: string;
}

export interface PermisosVista {
  pagar: boolean;
  notaCredito: boolean;
  notaDebito: boolean;
  anular: boolean;
  convertir: boolean;
  convertirEnConduce: boolean;
  editar: boolean;
  clonar: boolean;
}

function sinPermisos(): PermisosVista {
  return {
    pagar: false,
    notaCredito: false,
    notaDebito: false,
    anular: false,
    convertir: false,
    convertirEnConduce: false,
    editar: false,
    clonar: false,
  };
}

export function permisosDeFactura(estado: string, porCobrar: number, puedeEscribir: boolean): PermisosVista {
  if (!puedeEscribir) return sinPermisos();
  if (estado === "anulada") return { ...sinPermisos(), clonar: true };

  return {
    pagar: estado === "abierta" && porCobrar > 0,
    notaCredito: porCobrar > 0,
    notaDebito: true,
    anular: true,
    convertir: false,
    convertirEnConduce: false,
    editar: false,
    clonar: true,
  };
}

export function permisosDeDocumento(
  estado: string,
  puedeEscribir: boolean,
  tipo: "cotizacion" | "conduce",
): PermisosVista {
  if (!puedeEscribir) return sinPermisos();
  if (estado !== "abierta") return { ...sinPermisos(), clonar: true };

  return {
    pagar: false,
    notaCredito: false,
    notaDebito: false,
    anular: false,
    convertir: true,
    convertirEnConduce: tipo === "cotizacion",
    editar: true,
    clonar: true,
  };
}

export function redondearDinero(valor: number): number {
  return Math.round(valor * 100) / 100;
}

export function resumenFactura(factura: {
  total: number;
  pagado: number;
  credito: number;
  retenido: number;
}): ResumenFacturaVista {
  return {
    valorTotal: factura.total,
    valorRetenido: factura.retenido,
    totalCobrado: factura.pagado,
    porCobrar: Math.max(0, redondearDinero(factura.total - factura.pagado - factura.credito - factura.retenido)),
  };
}

export function estadoDeFactura(estado: string, porCobrar: number): EtiquetaEstado {
  if (estado === "anulada") return { etiqueta: "Anulada", tono: "red" };
  if (estado === "pagada" || porCobrar <= 0) return { etiqueta: "Cobrada", tono: "green" };
  return { etiqueta: "Por cobrar", tono: "amber" };
}

export function estadoDeDocumento(estado: string, facturada = true): EtiquetaEstado {
  if (estado === "anulada") return { etiqueta: "Anulada", tono: "red" };
  if (estado === "convertida") return { etiqueta: facturada ? "Facturada" : "Convertida", tono: "green" };
  return { etiqueta: "Sin facturar", tono: "amber" };
}

export function descuentoDeLinea(linea: Pick<LineaCalculable, "cantidad" | "precio" | "descuento_pct">): number {
  return redondearDinero((linea.cantidad * linea.precio * linea.descuento_pct) / 100);
}

export function descuentoDeLineas(lineas: readonly LineaCalculable[]): number {
  const centavos = lineas.reduce((total, linea) => total + Math.round(descuentoDeLinea(linea) * 100), 0);
  return centavos / 100;
}

export function montoGravadoDeLineas(lineas: readonly LineaCalculable[]): number {
  const centavos = lineas.reduce((total, linea) => {
    const esItbis = linea.itbis_tasa > 0 && linea.itbis_tasa !== 2 && linea.itbis_tasa !== 10;
    return total + (esItbis ? Math.round(linea.subtotal * 100) : 0);
  }, 0);
  return centavos / 100;
}

export function etiquetaTasaItbis(tasa: number): string {
  if (tasa === 2) return "CDT 2%";
  if (tasa === 10) return "Propina 10%";
  return tasa > 0 ? `ITBIS ${formatoCantidad(tasa)}%` : "\u2014";
}

export function etiquetaDescuento(porcentaje: number): string {
  return `${formatoCantidad(porcentaje)}%`;
}

export function etiquetaItbisTotal(lineas: readonly LineaCalculable[]): string {
  const tasas = [...new Set(lineas.map((linea) => linea.itbis_tasa))];
  const unica = tasas.length === 1 ? tasas[0] : null;
  return unica == null ? "ITBIS" : `ITBIS (${formatoCantidad(unica)}%)`;
}

export function totalNotasActivas(notas: readonly NotaConEstado[]): number {
  const centavos = notas.reduce(
    (total, nota) => total + (nota.estado === "anulada" ? 0 : Math.round(nota.total * 100)),
    0,
  );
  return centavos / 100;
}
