import { centavos } from "@/lib/reportes/dinero";

import type { FilaDgii, FormasPago, PagoFactura } from "./tipos";

export function soloDigitos(texto: string | null | undefined): string {
  return (texto ?? "").replace(/\D/g, "");
}

/** Tipo de identificación DGII: 1 RNC (9 dígitos), 2 Cédula (11), 3 pasaporte/otro. */
export function tipoIdentificacionVenta(rnc: string | null | undefined): string {
  const digitos = soloDigitos(rnc);
  if (digitos.length === 9) return "1";
  if (digitos.length === 11) return "2";
  return "3";
}

/** Tipo de identificación del 606: solo admite RNC o cédula. */
export function tipoIdentificacionCompra(rnc: string | null | undefined): string {
  const digitos = soloDigitos(rnc);
  if (digitos.length === 9) return "1";
  if (digitos.length === 11) return "2";
  return "";
}

export function fechaAAAAMM(fecha: string): string {
  return fecha.slice(0, 7).replace("-", "");
}

export function fechaAAAAMMDD(fecha: string): string {
  return fecha.slice(0, 10).replaceAll("-", "");
}

export function diaDeFecha(fecha: string): string {
  return fecha.slice(8, 10);
}

export function periodoDeFecha(fecha: string): string {
  return fecha.slice(0, 7).replace("-", "");
}

export function mismoMes(desde: string, hasta: string): boolean {
  return desde.slice(0, 7) === hasta.slice(0, 7);
}

/** Primer y último día del mes de la fecha. Los formatos DGII son mensuales. */
export function rangoMes(fecha: string): { desde: string; hasta: string } {
  const anio = Number(fecha.slice(0, 4));
  const mes = Number(fecha.slice(5, 7));
  const ultimoDia = new Date(Date.UTC(anio, mes, 0)).getUTCDate();
  const prefijo = fecha.slice(0, 7);

  return { desde: `${prefijo}-01`, hasta: `${prefijo}-${String(ultimoDia).padStart(2, "0")}` };
}

export function textoPeriodo(periodo: string): string {
  const anio = Number(periodo.slice(0, 4));
  const mes = Number(periodo.slice(4, 6));
  if (!anio || !mes || mes < 1 || mes > 12) return periodo;

  return new Intl.DateTimeFormat("es-DO", { month: "long", year: "numeric", timeZone: "UTC" }).format(
    new Date(Date.UTC(anio, mes - 1, 1)),
  );
}

export function montoDgii(valorCentavos: number): string {
  return (valorCentavos / 100).toFixed(2);
}

export function valorTexto(valor: string | number, tipo: "texto" | "dinero"): string {
  if (tipo === "dinero") return montoDgii(typeof valor === "number" ? valor : centavos(valor));
  return String(valor);
}

export function filaTexto(columnas: readonly { clave: string; tipo: "texto" | "dinero" }[], fila: FilaDgii): string {
  return columnas.map((columna) => valorTexto(fila[columna.clave] ?? "", columna.tipo)).join("|");
}

export function libroTexto(
  encabezado: readonly { clave: string; tipo: "texto" | "dinero" }[],
  detalle: readonly { clave: string; tipo: "texto" | "dinero" }[],
  filaEncabezado: FilaDgii,
  filas: readonly FilaDgii[],
): string {
  const lineas = [filaTexto(encabezado, filaEncabezado), ...filas.map((fila) => filaTexto(detalle, fila))];
  return lineas.join("\r\n");
}

/**
 * Reparte el total de una venta entre las formas de pago del 607.
 * Lo cobrado sale de los pagos activos; las notas de crédito van a "otras" y
 * el saldo pendiente a "venta a crédito".
 */
export function formasPagoVenta(
  total: number,
  pagado: number,
  credito: number,
  pagos: readonly PagoFactura[],
): FormasPago {
  const formas: FormasPago = { efectivo: 0, transferencia: 0, tarjeta: 0, credito: 0, otras: 0 };
  let aplicado = 0;

  for (const pago of pagos) {
    const monto = Math.min(Math.max(0, pago.monto), Math.max(0, total - aplicado));
    if (monto <= 0) continue;

    if (pago.metodo === "efectivo") formas.efectivo += monto;
    else if (pago.metodo === "transferencia" || pago.metodo === "cheque") formas.transferencia += monto;
    else if (pago.metodo === "tarjeta") formas.tarjeta += monto;
    else formas.otras += monto;

    aplicado += monto;
  }

  if (pagos.length === 0) {
    const cobrado = Math.min(Math.max(0, pagado), Math.max(0, total));
    formas.otras += cobrado;
    aplicado += cobrado;
  }

  const notaCredito = Math.min(Math.max(0, credito), Math.max(0, total - aplicado));
  formas.otras += notaCredito;
  aplicado += notaCredito;

  formas.credito += Math.max(0, total - aplicado);
  return formas;
}

export function nombreArchivoDgii(codigo: string, rnc: string | null | undefined, periodo: string): string {
  const identificacion = soloDigitos(rnc) || "sin-rnc";
  return `DGII_F_${codigo}_${identificacion}_${periodo}.TXT`;
}
