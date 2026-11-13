import { hoyRD } from "@/lib/facturacion/formato";
import { createClient } from "@/lib/supabase/server";

import type { CierreResultadosAnio, DatosPeriodos, EstadoPeriodo, MesPeriodo } from "./tipos";

const NOMBRES_MES = [
  "Enero",
  "Febrero",
  "Marzo",
  "Abril",
  "Mayo",
  "Junio",
  "Julio",
  "Agosto",
  "Septiembre",
  "Octubre",
  "Noviembre",
  "Diciembre",
] as const;

interface PeriodoFila {
  periodo: string;
  estado: EstadoPeriodo;
  cerrado_en: string | null;
}

function primerDiaDelMes(anio: number, mes: number): string {
  return `${anio}-${String(mes).padStart(2, "0")}-01`;
}

export async function getDatosPeriodos(anioSolicitado: number): Promise<DatosPeriodos> {
  const hoy = hoyRD();
  const anioActual = Number(hoy.slice(0, 4));
  const primerMesActual = `${hoy.slice(0, 7)}-01`;
  const anio = Number.isInteger(anioSolicitado) && anioSolicitado >= 2000 ? anioSolicitado : anioActual;

  const supabase = await createClient();

  const [periodos, cierre] = await Promise.all([
    supabase
      .from("periodos_contables")
      .select("periodo, estado, cerrado_en")
      .gte("periodo", `${anio}-01-01`)
      .lte("periodo", `${anio}-12-31`)
      .returns<PeriodoFila[]>(),
    supabase
      .from("cierres_resultados")
      .select("anio, asiento_id, total, creado_en")
      .eq("anio", anio)
      .maybeSingle()
      .returns<{ anio: number; asiento_id: string; total: number; creado_en: string } | null>(),
  ]);

  if (periodos.error) throw new Error(periodos.error.message);
  if (cierre.error) throw new Error(cierre.error.message);

  const porMes = new Map(periodos.data.map((fila) => [fila.periodo, fila]));

  const meses: MesPeriodo[] = NOMBRES_MES.map((nombre, indice) => {
    const periodo = primerDiaDelMes(anio, indice + 1);
    const fila = porMes.get(periodo);

    return {
      periodo,
      etiqueta: nombre,
      estado: fila?.estado ?? "abierto",
      cerradoEn: fila?.cerrado_en ?? null,
      esFuturo: periodo > primerMesActual,
      esActual: periodo === primerMesActual,
    };
  });

  let datosCierre: CierreResultadosAnio | null = null;
  if (cierre.data) {
    const { data: asiento, error } = await supabase
      .from("asientos")
      .select("numero")
      .eq("id", cierre.data.asiento_id)
      .maybeSingle()
      .returns<{ numero: number } | null>();

    if (error) throw new Error(error.message);

    datosCierre = {
      anio: cierre.data.anio,
      asientoId: cierre.data.asiento_id,
      asientoNumero: asiento?.numero ?? null,
      total: cierre.data.total,
      creadoEn: cierre.data.creado_en,
    };
  }

  return { anio, anioActual, meses, cierre: datosCierre };
}
