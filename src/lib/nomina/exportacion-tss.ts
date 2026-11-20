import type { Decimal, FilaTSS } from "./tipos";

/**
 * Exportación pura (sin Supabase) del reporte mensual de nómina.
 *
 * SUIRPlus (TSS) y el IR-3 (DGII) se alimentan de las mismas filas de
 * `nomina_reporte_tss`. El CSV usa coma como separador, punto decimal con dos
 * decimales fijos, sin separador de miles y fin de línea CRLF para que Excel y
 * los importadores de escritorio lo lean sin tocar la configuración regional.
 * No lleva BOM: los importadores oficiales tratan el BOM como parte del primer
 * encabezado.
 */

/** Formatea un `Decimal` con dos decimales y punto: `"30000.5"` → `"30000.50"`. */
export function formatearDecimal(valor: Decimal): string {
  const numero = Number(valor);
  return Number.isFinite(numero) ? numero.toFixed(2) : "0.00";
}

/** Envuelve en comillas solo cuando el valor lo necesita y duplica las internas. */
export function celdaCsv(valor: string): string {
  if (/[",\r\n]/.test(valor) || valor !== valor.trim()) {
    return `"${valor.replace(/"/g, '""')}"`;
  }
  return valor;
}

/** `2026` + `1` → `2026-01`. */
export function periodoReporte(anio: number, mes: number): string {
  return `${anio}-${String(mes).padStart(2, "0")}`;
}

interface Columna {
  encabezado: string;
  valor: (fila: FilaTSS) => string;
}

function generarCsv(columnas: Columna[], filas: FilaTSS[]): string {
  const lineas = [columnas.map((columna) => celdaCsv(columna.encabezado)).join(",")];

  for (const fila of filas) {
    lineas.push(columnas.map((columna) => celdaCsv(columna.valor(fila))).join(","));
  }

  return lineas.join("\r\n");
}

/** Columnas del archivo de SUIRPlus (TSS): bases, aportes y neto. */
export const COLUMNAS_SUIRPLUS: readonly string[] = [
  "Periodo",
  "Empleado",
  "Identificacion",
  "Clave TSS",
  "Periodos",
  "Dias trabajados",
  "Salario base",
  "Base SFS",
  "Base AFP",
  "Base SRL",
  "Base INFOTEP",
  "SFS empleado",
  "AFP empleado",
  "SFS empleador",
  "AFP empleador",
  "SRL",
  "INFOTEP",
  "Total deducciones",
  "Neto pagado",
];

const COLUMNAS_SUIRPLUS_VALORES: Columna[] = [
  { encabezado: "Periodo", valor: (fila) => periodoReporte(fila.anio, fila.mes) },
  { encabezado: "Empleado", valor: (fila) => fila.empleado_nombre },
  { encabezado: "Identificacion", valor: (fila) => fila.identificacion },
  { encabezado: "Clave TSS", valor: (fila) => fila.clave_tss ?? "" },
  { encabezado: "Periodos", valor: (fila) => String(fila.periodos) },
  { encabezado: "Dias trabajados", valor: (fila) => formatearDecimal(fila.dias_trabajados) },
  { encabezado: "Salario base", valor: (fila) => formatearDecimal(fila.salario_base) },
  { encabezado: "Base SFS", valor: (fila) => formatearDecimal(fila.base_sfs) },
  { encabezado: "Base AFP", valor: (fila) => formatearDecimal(fila.base_afp) },
  { encabezado: "Base SRL", valor: (fila) => formatearDecimal(fila.base_srl) },
  { encabezado: "Base INFOTEP", valor: (fila) => formatearDecimal(fila.base_infotep) },
  { encabezado: "SFS empleado", valor: (fila) => formatearDecimal(fila.sfs_empleado) },
  { encabezado: "AFP empleado", valor: (fila) => formatearDecimal(fila.afp_empleado) },
  { encabezado: "SFS empleador", valor: (fila) => formatearDecimal(fila.sfs_empleador) },
  { encabezado: "AFP empleador", valor: (fila) => formatearDecimal(fila.afp_empleador) },
  { encabezado: "SRL", valor: (fila) => formatearDecimal(fila.srl) },
  { encabezado: "INFOTEP", valor: (fila) => formatearDecimal(fila.infotep) },
  { encabezado: "Total deducciones", valor: (fila) => formatearDecimal(fila.total_deducciones) },
  { encabezado: "Neto pagado", valor: (fila) => formatearDecimal(fila.neto_pagar) },
];

/** Archivo SUIRPlus (TSS) en texto CSV. */
export function csvSuirPlus(filas: FilaTSS[]): string {
  return generarCsv(COLUMNAS_SUIRPLUS_VALORES, filas);
}

/** Columnas del archivo IR-3 (DGII): base gravable de ISR y retención. */
export const COLUMNAS_IR3: readonly string[] = [
  "Periodo",
  "Empleado",
  "Identificacion",
  "Dias trabajados",
  "Salario base",
  "Base ISR",
  "ISR retenido",
  "Neto pagado",
];

const COLUMNAS_IR3_VALORES: Columna[] = [
  { encabezado: "Periodo", valor: (fila) => periodoReporte(fila.anio, fila.mes) },
  { encabezado: "Empleado", valor: (fila) => fila.empleado_nombre },
  { encabezado: "Identificacion", valor: (fila) => fila.identificacion },
  { encabezado: "Dias trabajados", valor: (fila) => formatearDecimal(fila.dias_trabajados) },
  { encabezado: "Salario base", valor: (fila) => formatearDecimal(fila.salario_base) },
  { encabezado: "Base ISR", valor: (fila) => formatearDecimal(fila.base_isr) },
  { encabezado: "ISR retenido", valor: (fila) => formatearDecimal(fila.isr) },
  { encabezado: "Neto pagado", valor: (fila) => formatearDecimal(fila.neto_pagar) },
];

/** Archivo IR-3 (DGII) en texto CSV. */
export function csvIr3(filas: FilaTSS[]): string {
  return generarCsv(COLUMNAS_IR3_VALORES, filas);
}

export type ReporteTssExportable = "suirplus" | "ir3";

/** Nombre sugerido del archivo: `suirplus-2026-11.csv` o `ir3-2026-11.csv`. */
export function nombreArchivoTss(anio: number, mes: number, reporte: ReporteTssExportable): string {
  return `${reporte}-${periodoReporte(anio, mes)}.csv`;
}
