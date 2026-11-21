import type { ReactNode } from "react";

import { cn } from "cn";

import { PillEstado, type TonoPill } from "@/components/listas/tabla-lista";
import { Card, CardContent } from "@/components/ui/card";
import type { ClaseConcepto, Decimal, EstadoNomina, FrecuenciaPago, OrigenLinea } from "@/lib/nomina/tipos";

/**
 * Piezas compartidas por las pantallas de periodos, recibos, pagos, envíos y
 * reporte TSS. Solo formato y navegación: ningún cálculo de dinero.
 */

export const RUTA_NOMINA = "/dashboard/contabilidad/nomina";
export const RUTA_PERIODOS = `${RUTA_NOMINA}/periodos`;
export const RUTA_RECIBOS = `${RUTA_NOMINA}/recibos`;
export const RUTA_PAGOS = `${RUTA_NOMINA}/pagos`;
export const RUTA_ENVIOS = `${RUTA_NOMINA}/envios`;
export const RUTA_REPORTES = `${RUTA_NOMINA}/reportes`;
export const RUTA_ASIENTOS = "/dashboard/contabilidad/asientos";
export const RUTA_CONFIG_LABORAL = "/dashboard/configuracion/nomina/laboral";

export function rutaPeriodoNomina(id: string) {
  return `${RUTA_PERIODOS}/${encodeURIComponent(id)}`;
}

export function rutaReciboNomina(id: string) {
  return `${RUTA_RECIBOS}/${encodeURIComponent(id)}`;
}

export function rutaColillaNomina(id: string) {
  return `${RUTA_RECIBOS}/${encodeURIComponent(id)}/colilla`;
}

export function rutaPagosNomina(periodoId: string) {
  return `${RUTA_PAGOS}/${encodeURIComponent(periodoId)}`;
}

export function rutaAsientoNomina(asientoId: string) {
  return `${RUTA_ASIENTOS}/${encodeURIComponent(asientoId)}`;
}

export const MIGAS_BASE = [
  { etiqueta: "Inicio", href: "/dashboard" },
  { etiqueta: "Contabilidad", href: "/dashboard/contabilidad" },
  { etiqueta: "Nómina", href: RUTA_NOMINA },
] as const;

const MESES = [
  "enero",
  "febrero",
  "marzo",
  "abril",
  "mayo",
  "junio",
  "julio",
  "agosto",
  "septiembre",
  "octubre",
  "noviembre",
  "diciembre",
] as const;

const MESES_CORTOS = ["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sep", "oct", "nov", "dic"] as const;

export { MESES, MESES_CORTOS };

interface PartesFecha {
  anio: number;
  mes: number;
  dia: number;
}

function partesFecha(fecha: string): PartesFecha {
  const [anio, mes, dia] = fecha.slice(0, 10).split("-").map(Number);
  return { anio: anio ?? 0, mes: mes ?? 0, dia: dia ?? 0 };
}

/** `16–30 nov 2026` en tablas y `16–30 de noviembre de 2026` en encabezados. */
export function etiquetaPeriodo(fechaInicio: string, fechaFin: string, larga = false): string {
  const inicio = partesFecha(fechaInicio);
  const fin = partesFecha(fechaFin);
  const meses = larga ? MESES : MESES_CORTOS;
  const nombreFin = meses[fin.mes - 1] ?? "";
  const mismoMes = inicio.mes === fin.mes && inicio.anio === fin.anio;

  if (larga) {
    if (mismoMes) return `${inicio.dia}–${fin.dia} de ${nombreFin} de ${fin.anio}`;
    const nombreInicio = MESES[inicio.mes - 1] ?? "";
    return `${inicio.dia} de ${nombreInicio} – ${fin.dia} de ${nombreFin} de ${fin.anio}`;
  }

  if (mismoMes) return `${inicio.dia}–${fin.dia} ${nombreFin} ${fin.anio}`;
  const nombreInicio = MESES_CORTOS[inicio.mes - 1] ?? "";
  return `${inicio.dia} ${nombreInicio} – ${fin.dia} ${nombreFin} ${fin.anio}`;
}

export function etiquetaFrecuencia(frecuencia: FrecuenciaPago): string {
  return frecuencia === "mensual" ? "Mensual" : "Quincenal";
}

export function etiquetaEstadoNomina(estado: EstadoNomina): { etiqueta: string; tono: TonoPill } {
  if (estado === "calculado") return { etiqueta: "Calculado", tono: "pendiente" };
  if (estado === "contabilizado") return { etiqueta: "Contabilizado", tono: "info" };
  if (estado === "pagado") return { etiqueta: "Pagado", tono: "exito" };
  if (estado === "anulado") return { etiqueta: "Anulado", tono: "peligro" };
  return { etiqueta: "Borrador", tono: "neutro" };
}

export function EstadoNominaPill({ estado }: { estado: EstadoNomina }) {
  const { etiqueta, tono } = etiquetaEstadoNomina(estado);
  return <PillEstado tono={tono}>{etiqueta}</PillEstado>;
}

export function etiquetaClase(clase: ClaseConcepto): string {
  if (clase === "ingreso") return "Ingreso";
  if (clase === "deduccion") return "Deducción";
  if (clase === "aporte_empleador") return "Aporte patronal";
  return "Provisión";
}

export function etiquetaOrigen(origen: OrigenLinea): string {
  if (origen === "recurrente") return "Recurrente";
  if (origen === "manual") return "Manual";
  return "Sistema";
}

const DIAS = new Intl.NumberFormat("es-DO", { maximumFractionDigits: 3 });
const PORCENTAJE = new Intl.NumberFormat("es-DO", { maximumFractionDigits: 3 });

/** Días y horas con hasta 3 decimales (`11.915`, `23.83`); `formatoCantidad` corta en 2. */
export function formatoDias(valor: Decimal | null | undefined): string {
  if (valor == null || valor === "") return "—";
  const numero = Number(valor);
  return Number.isFinite(numero) ? DIAS.format(numero) : "—";
}

export function formatoPorcentajeNomina(valor: Decimal | null | undefined): string {
  if (valor == null || valor === "") return "—";
  const numero = Number(valor);
  return Number.isFinite(numero) ? `${PORCENTAJE.format(numero)} %` : "—";
}

/** Suma presentacional de montos ya calculados por el servidor (nunca recalcula tasas). */
export function sumarMontos(valores: readonly Decimal[]): number {
  return valores.reduce((total, valor) => total + Number(valor), 0);
}

interface TarjetaResumenNominaProps {
  etiqueta: string;
  valor: ReactNode;
  ayuda?: ReactNode;
  enfasis?: boolean;
  className?: string;
}

/** KPI de la pantalla: etiqueta 12 px, valor 20 px y cifras tabulares. */
export function TarjetaResumenNomina({ etiqueta, valor, ayuda, enfasis, className }: TarjetaResumenNominaProps) {
  return (
    <Card
      className={cn(
        "border-border bg-card gap-0 rounded-2xl border py-0 shadow-none ring-0 [--card-spacing:0px]",
        className,
      )}
    >
      <CardContent className="flex flex-col gap-1 p-4">
        <span className="text-muted-foreground text-xs leading-4 font-medium">{etiqueta}</span>
        <span
          className={cn(
            "text-xl leading-7 font-semibold text-slate-700 tabular-nums dark:text-slate-200",
            enfasis && "text-foreground",
          )}
        >
          {valor}
        </span>
        {ayuda ? <span className="text-muted-foreground text-xs leading-4">{ayuda}</span> : null}
      </CardContent>
    </Card>
  );
}

/** Bloque `<dl>` de etiqueta a la izquierda y valor numérico a la derecha. */
export function FilaDefinicion({ etiqueta, valor }: { etiqueta: string; valor: ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-4">
      <dt className="text-muted-foreground text-sm">{etiqueta}</dt>
      <dd className="m-0 text-sm font-medium tabular-nums">{valor}</dd>
    </div>
  );
}
