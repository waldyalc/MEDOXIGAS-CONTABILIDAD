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
  // Los TXT de Alegra dejan columnas vacías (no 0.00) cuando no aplican; el
  // `""` del FilaDgii tiene que sobrevivir al formateo de dinero.
  if (valor === "") return "";
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
 *
 * Lo cobrado sale de los pagos activos y el saldo pendiente va a "Venta a
 * crédito". Las retenciones de terceros no se suman a ninguna columna, así que
 * se restan del total a cobrar. El saldo cubierto con nota de crédito NO se
 * reporta como "Otras formas": Alegra lo deja en "Venta a crédito" (Prueba 4,
 * factura B0100000002: efectivo 15.80 + venta a crédito 885.00).
 */
export function formasPagoVenta(
  total: number,
  retenido: number,
  pagado: number,
  pagos: readonly PagoFactura[],
): FormasPago {
  const formas: FormasPago = { efectivo: 0, transferencia: 0, tarjeta: 0, credito: 0, otras: 0 };
  const aCobrar = Math.max(0, total - Math.max(0, retenido));
  let aplicado = 0;

  for (const pago of pagos) {
    const monto = Math.min(Math.max(0, pago.monto), Math.max(0, aCobrar - aplicado));
    if (monto <= 0) continue;

    if (pago.metodo === "efectivo") formas.efectivo += monto;
    else if (pago.metodo === "transferencia" || pago.metodo === "cheque") formas.transferencia += monto;
    else if (pago.metodo === "tarjeta") formas.tarjeta += monto;
    else formas.otras += monto;

    aplicado += monto;
  }

  if (pagos.length === 0) {
    const cobrado = Math.min(Math.max(0, pagado), aCobrar);
    formas.otras += cobrado;
    aplicado += cobrado;
  }

  formas.credito += Math.max(0, aCobrar - aplicado);
  return formas;
}

/** Días calendario entre dos fechas ISO (YYYY-MM-DD), sin depender de la zona horaria. */
export function diasEntreFechas(desde: string, hasta: string): number {
  const inicio = Date.parse(`${desde.slice(0, 10)}T00:00:00Z`);
  const fin = Date.parse(`${hasta.slice(0, 10)}T00:00:00Z`);
  if (Number.isNaN(inicio) || Number.isNaN(fin)) return 0;
  return Math.round((fin - inicio) / 86_400_000);
}

/**
 * Regla DGII que aplica Alegra: el ITBIS de una nota de crédito emitida más de
 * 30 días después de su factura no se acredita (se reporta 0.00 en el 607).
 */
export function itbisNotaCredito(itbis: number, fechaFactura: string | null, fechaNota: string): number {
  if (fechaFactura == null || fechaFactura === "") return itbis;
  return diasEntreFechas(fechaFactura, fechaNota) > 30 ? 0 : itbis;
}

export function nombreArchivoDgii(codigo: string, rnc: string | null | undefined, periodo: string): string {
  const identificacion = soloDigitos(rnc) || "sin-rnc";
  return `DGII_F_${codigo}_${identificacion}_${periodo}.TXT`;
}

/** Mismo nombre del TXT oficial, cambiando la extensión para el Excel. */
export function nombreArchivoDgiiExcel(codigo: string, rnc: string | null | undefined, periodo: string): string {
  return nombreArchivoDgii(codigo, rnc, periodo).replace(/\.TXT$/, ".xlsx");
}
