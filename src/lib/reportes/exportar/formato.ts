import { formatearRd } from "../dinero";
import type { TipoColumna, ValorCelda } from "./tipos";

const FECHA_ISO = /^(\d{4})-(\d{2})-(\d{2})/;

const FORMATO_FECHA_HORA = new Intl.DateTimeFormat("es-DO", {
  dateStyle: "medium",
  timeStyle: "short",
  timeZone: "America/Santo_Domingo",
});

const FORMATO_PORCENTAJE = new Intl.NumberFormat("es-DO", {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

function formatearFechaDate(fecha: Date): string {
  const dia = String(fecha.getUTCDate()).padStart(2, "0");
  const mes = String(fecha.getUTCMonth() + 1).padStart(2, "0");
  return `${dia}/${mes}/${fecha.getUTCFullYear()}`;
}

/** Fecha legible DD/MM/AAAA. Los ISO YYYY-MM-DD se leen sin convertir zona horaria. */
export function formatearFecha(valor: ValorCelda | Date | undefined): string {
  if (valor == null || valor === "") return "";

  if (valor instanceof Date) {
    return Number.isNaN(valor.getTime()) ? "" : formatearFechaDate(valor);
  }

  if (typeof valor === "number") {
    const fecha = new Date(valor);
    return Number.isNaN(fecha.getTime()) ? String(valor) : formatearFechaDate(fecha);
  }

  const coincidencia = FECHA_ISO.exec(valor);
  if (coincidencia) {
    const [, anio, mes, dia] = coincidencia;
    if (anio && mes && dia) return `${dia}/${mes}/${anio}`;
  }

  const fecha = new Date(valor);
  return Number.isNaN(fecha.getTime()) ? valor : formatearFechaDate(fecha);
}

/** Fecha y hora de generación en formato es-DO. */
export function formatearFechaHora(fecha: Date): string {
  return FORMATO_FECHA_HORA.format(fecha);
}

/** Puntos porcentuales con dos decimales y sufijo %. */
export function formatearPorcentaje(valor: number): string {
  return `${FORMATO_PORCENTAJE.format(valor)} %`;
}

/** Convierte centavos enteros a pesos para celdas numéricas de Excel. */
export function dineroAPesos(valorCentavos: number): number {
  return valorCentavos / 100;
}

/** Formatea centavos enteros como RD$ para texto (PDF). */
export function formatearDinero(valorCentavos: number): string {
  return formatearRd(valorCentavos);
}

function esNumero(valor: ValorCelda): valor is number {
  return typeof valor === "number" && Number.isFinite(valor);
}

/** Valor numérico o de texto que se escribe en una celda de Excel. */
export function valorExcel(valor: ValorCelda, tipo: TipoColumna): string | number | null {
  if (valor == null || valor === "") return null;

  if (tipo === "dinero") {
    if (esNumero(valor)) return dineroAPesos(valor);
    const numero = Number(valor);
    return Number.isFinite(numero) ? dineroAPesos(numero) : null;
  }

  if (tipo === "porcentaje") {
    if (esNumero(valor)) return valor;
    const numero = Number(valor);
    return Number.isFinite(numero) ? numero : null;
  }

  if (tipo === "fecha") return formatearFecha(valor);

  return valor;
}

/** Texto presentable de una celda, usado en el PDF y en el ancho de columnas. */
export function textoCelda(valor: ValorCelda, tipo: TipoColumna): string {
  if (valor == null || valor === "") return "";

  if (tipo === "dinero") {
    if (esNumero(valor)) return formatearDinero(valor);
    const numero = Number(valor);
    return Number.isFinite(numero) ? formatearDinero(numero) : String(valor);
  }

  if (tipo === "porcentaje") {
    if (esNumero(valor)) return formatearPorcentaje(valor);
    const numero = Number(valor);
    return Number.isFinite(numero) ? formatearPorcentaje(numero) : String(valor);
  }

  if (tipo === "fecha") return formatearFecha(valor);

  return String(valor);
}
