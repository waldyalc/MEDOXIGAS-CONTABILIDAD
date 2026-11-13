import { rutaPagoProveedor, rutaPagoRecibido } from "@/lib/enlaces";

import type { ContactoTipo } from "./contactos";

export interface ContactoFicha {
  id: string;
  nombre: string;
  rnc_cedula: string | null;
  telefono: string | null;
  correo: string | null;
  direccion: string | null;
  tipo: ContactoTipo;
}

export interface CuentaFicha {
  id: string;
  codigo: string;
  nombre: string;
}

export interface DocumentoFicha {
  id: string;
  numero: number;
  ncf: string | null;
  fecha: string;
  vencimiento: string;
  total: number | string;
  pagado: number | string;
  estado: string;
}

export interface PagoFicha {
  id: string;
  numero: number;
  fecha: string;
  monto: number | string;
  estado: string;
  factura_id: string | null;
  factura_numero: number | null;
}

export interface AsientoFicha {
  id: string;
  numero: number;
  fecha: string;
  descripcion: string;
  debitoCentavos: number;
  creditoCentavos: number;
}

export interface LineaAsientoContacto {
  asiento_id: string;
  debito: number | string;
  credito: number | string;
}

export interface TotalesAsiento {
  debitoCentavos: number;
  creditoCentavos: number;
}

export interface DatosFichaContacto {
  contacto: ContactoFicha;
  cuentaCxc: CuentaFicha | null;
  cuentaCxp: CuentaFicha | null;
  facturas: DocumentoFicha[];
  facturasProveedor: DocumentoFicha[];
  pagosRecibidos: PagoFicha[];
  pagosProveedor: PagoFicha[];
  asientos: AsientoFicha[];
}

export interface TransaccionFicha {
  clave: string;
  numero: number;
  fecha: string;
  detalle: string;
  estado: string;
  egresosCentavos: number;
  ingresosCentavos: number;
  href: string;
}

export function aCentavos(valor: number | string | null | undefined): number {
  if (valor == null) return 0;
  const numero = typeof valor === "number" ? valor : Number(valor);
  if (!Number.isFinite(numero)) return 0;
  return Math.round(numero * 100);
}

export function sumarLineasAsiento(lineas: readonly LineaAsientoContacto[]): Map<string, TotalesAsiento> {
  const totales = new Map<string, TotalesAsiento>();

  for (const linea of lineas) {
    const actual = totales.get(linea.asiento_id) ?? { debitoCentavos: 0, creditoCentavos: 0 };
    actual.debitoCentavos += aCentavos(linea.debito);
    actual.creditoCentavos += aCentavos(linea.credito);
    totales.set(linea.asiento_id, actual);
  }

  return totales;
}

export function saldoDocumento(
  total: number | string | null | undefined,
  pagado: number | string | null | undefined,
): number {
  return Math.max(0, aCentavos(total) - aCentavos(pagado));
}

export function totalPorCobrar(facturas: readonly DocumentoFicha[]): number {
  return facturas.reduce(
    (total, factura) => (factura.estado === "anulada" ? total : total + saldoDocumento(factura.total, factura.pagado)),
    0,
  );
}

export function totalPorPagar(facturas: readonly DocumentoFicha[]): number {
  return facturas.reduce(
    (total, factura) => (factura.estado === "anulada" ? total : total + saldoDocumento(factura.total, factura.pagado)),
    0,
  );
}

export function totalAnticipos(pagos: readonly PagoFicha[]): number {
  return pagos.reduce(
    (total, pago) => (pago.estado === "activo" && pago.factura_id === null ? total + aCentavos(pago.monto) : total),
    0,
  );
}

export function normalizarFiltroNumero(valor: string): string {
  return valor.trim().toLowerCase();
}

export function filtrarPorNumero<T extends { numero: number; ncf?: string | null }>(
  filas: readonly T[],
  filtro: string,
): T[] {
  const texto = normalizarFiltroNumero(filtro);
  if (texto === "") return [...filas];

  return filas.filter((fila) => {
    if (String(fila.numero).includes(texto)) return true;
    return (fila.ncf ?? "").toLowerCase().includes(texto);
  });
}

function detallePagoRecibido(pago: PagoFicha): string {
  if (pago.factura_numero == null) return `Pago recibido #${pago.numero} · Anticipo`;
  return `Pago recibido #${pago.numero} · Factura #${pago.factura_numero}`;
}

function detallePagoProveedor(pago: PagoFicha): string {
  if (pago.factura_numero == null) return `Pago a proveedor #${pago.numero}`;
  return `Pago a proveedor #${pago.numero} · Factura de proveedor #${pago.factura_numero}`;
}

export function construirTransacciones(
  recibidos: readonly PagoFicha[],
  proveedores: readonly PagoFicha[],
): TransaccionFicha[] {
  const transacciones: TransaccionFicha[] = [
    ...recibidos.map((pago) => ({
      clave: `recibido-${pago.id}`,
      numero: pago.numero,
      fecha: pago.fecha,
      detalle: detallePagoRecibido(pago),
      estado: pago.estado,
      egresosCentavos: 0,
      ingresosCentavos: aCentavos(pago.monto),
      href: rutaPagoRecibido(pago.id),
    })),
    ...proveedores.map((pago) => ({
      clave: `proveedor-${pago.id}`,
      numero: pago.numero,
      fecha: pago.fecha,
      detalle: detallePagoProveedor(pago),
      estado: pago.estado,
      egresosCentavos: aCentavos(pago.monto),
      ingresosCentavos: 0,
      href: rutaPagoProveedor(pago.id),
    })),
  ];

  return transacciones.sort((a, b) => b.fecha.localeCompare(a.fecha) || b.numero - a.numero);
}

export function etiquetaEstadoDocumento(estado: string, tipo: "venta" | "compra"): string {
  if (estado === "pagada") return "Pagada";
  if (estado === "anulada") return "Anulada";
  return tipo === "venta" ? "Por cobrar" : "Por pagar";
}

export function etiquetaEstadoPago(estado: string): string {
  return estado === "anulado" ? "Anulado" : "Activo";
}
