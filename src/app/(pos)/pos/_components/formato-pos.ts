import { centavosATexto } from "@/lib/pos/calculo";
import type { Decimal, MetodoPOS } from "@/lib/pos/tipos";

const dineroPOS = new Intl.NumberFormat("es-DO", {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

/** Moneda del POS como la muestra Alegra: «RD$10.00» sin espacio. */
export function formatoMonedaPOS(valor: number | string | null | undefined): string {
  if (valor == null) return "—";
  const numero = typeof valor === "number" ? valor : Number(valor);
  if (!Number.isFinite(numero)) return "—";
  return `RD$${dineroPOS.format(numero)}`;
}

/** Convierte lo que escribe el cajero a un decimal de 2 posiciones; null si no es válido. */
export function textoAMonto(texto: string): Decimal | null {
  const limpio = texto.replace(/RD\$/gi, "").replace(/\s/g, "").replace(/,/g, "").trim();

  if (limpio === "" || limpio === "-" || limpio === ".") return null;
  if (!/^-?\d*(?:\.\d{0,4})?$/.test(limpio)) return null;

  const numero = Number(limpio);
  if (!Number.isFinite(numero)) return null;
  return centavosATexto(Math.round(numero * 100));
}

/** Valor inicial de un input de monto (sin ceros decorativos cuando no hace falta). */
export function montoParaInput(valor: Decimal | null | undefined): string {
  if (valor == null) return "";
  return valor;
}

export function capitalizar(texto: string): string {
  if (texto === "") return texto;
  return texto.charAt(0).toUpperCase() + texto.slice(1);
}

export const ETIQUETAS_METODO: Record<MetodoPOS, string> = {
  efectivo: "Efectivo",
  tarjeta_debito: "Tarjeta débito",
  tarjeta_credito: "Tarjeta crédito",
  transferencia: "Transferencia",
};

export function etiquetaMetodoDB(metodo: string): string {
  if (metodo === "efectivo") return "Efectivo";
  if (metodo === "tarjeta") return "Tarjeta";
  if (metodo === "transferencia") return "Transferencia";
  if (metodo === "cheque") return "Cheque";
  return capitalizar(metodo);
}

export function primerDiaMesRD(): string {
  const formato = new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Santo_Domingo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
  const hoy = formato.format(new Date());
  return `${hoy.slice(0, 8)}01`;
}

export function hoyRD(): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Santo_Domingo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}

export function sumarDias(fecha: string, dias: number): string {
  const [anio, mes, dia] = fecha.split("-").map(Number);
  if (!anio || !mes || !dia) return fecha;
  const resultado = new Date(Date.UTC(anio, mes - 1, dia + dias));
  return resultado.toISOString().slice(0, 10);
}

export function esFecha(texto: string): boolean {
  return /^\d{4}-\d{2}-\d{2}$/.test(texto);
}
