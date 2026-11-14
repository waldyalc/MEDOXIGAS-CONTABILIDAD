import type { ClaseFila, FilaReporte } from "./tipos";

/** Redondea un porcentaje a 2 decimales, como se muestra en los reportes. */
export function redondearPorcentaje(valor: number): number {
  return Math.round(valor * 100) / 100;
}

export function calcularPorcentaje(valor: number, base: number): number {
  if (base === 0) return 0;
  return redondearPorcentaje((valor / base) * 100);
}

export function sinAcentos(texto: string): string {
  return texto
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
}

export function coincideBusqueda(codigo: string, nombre: string, busqueda: string): boolean {
  const termino = sinAcentos(busqueda.trim());
  if (termino === "") return true;
  return sinAcentos(`${codigo} ${nombre}`).includes(termino);
}

interface ParametrosFila {
  clave: string;
  clase: ClaseFila;
  codigo?: string;
  nombre: string;
  cuentaId?: string | null;
  actual: number;
  anterior: number;
  porcentajeActual: number;
  porcentajeAnterior: number;
  variacionEnMagnitud?: boolean;
}

export function crearFila({
  clave,
  clase,
  codigo,
  nombre,
  cuentaId = null,
  actual,
  anterior,
  porcentajeActual,
  porcentajeAnterior,
  variacionEnMagnitud = false,
}: ParametrosFila): FilaReporte {
  const cambio = variacionEnMagnitud ? Math.abs(actual) - Math.abs(anterior) : actual - anterior;
  const base = variacionEnMagnitud ? Math.abs(anterior) : anterior;

  return {
    clave,
    clase,
    codigo: codigo ?? "",
    nombre,
    cuentaId,
    actual,
    anterior,
    porcentajeActual: redondearPorcentaje(porcentajeActual),
    porcentajeAnterior: redondearPorcentaje(porcentajeAnterior),
    variacionAbsoluta: cambio,
    variacionRelativa: base === 0 ? 0 : redondearPorcentaje((cambio / Math.abs(base)) * 100),
  };
}
