"use server";

import { getRol } from "@/lib/auth/rol";
import { ejecutarSetPruebasSimulacion } from "@/lib/ecf/pruebas-simulacion";
import type { AmbienteEcf as AmbienteMotorEcf, ResultadoSimulacionCaso } from "@/lib/ecf/tipos";
import { createClient } from "@/lib/supabase/server";

import type { AmbienteEcf as AmbienteUiEcf } from "./_components/pasos-habilitacion";

export interface ResumenSimulacionSerializado {
  ambiente: AmbienteMotorEcf;
  rncEmisor: string;
  razonSocial: string;
  rncEsDePrueba: boolean;
  totalCasos: number;
  aprobados: number;
  fallidos: number;
  duracionMs: number;
  certificado: {
    titular: string;
    emisor: string;
    numeroSerie: string;
    validoHastaIso: string;
    vigente: boolean;
    diasRestantes: number;
    huellaSha256: string;
  };
  casos: ResultadoSimulacionCaso[];
}

export type ResultadoAccionSimulacion =
  | { ok: true; resumen: ResumenSimulacionSerializado }
  | { ok: false; error: string };

const RNC_PRUEBA_DEFECTO = "131999999";

function sanitizarRnc(rnc: string | null | undefined): { rnc: string; esPrueba: boolean } {
  const digitos = rnc?.replace(/\D/g, "") ?? "";
  if (/^\d{9}(\d{2})?$/.test(digitos)) return { rnc: digitos, esPrueba: false };
  return { rnc: RNC_PRUEBA_DEFECTO, esPrueba: true };
}

export async function ejecutarSimulacionEcfAction(
  ambienteUi: AmbienteUiEcf = "testecf",
): Promise<ResultadoAccionSimulacion> {
  const rol = await getRol();
  if (rol !== "admin" && rol !== "contador") {
    return { ok: false, error: "Solo administradores y contadores pueden ejecutar el set de simulación e-CF." };
  }

  // La simulación local nunca apunta al ambiente productivo (ecf).
  const ambiente: AmbienteMotorEcf = ambienteUi === "certecf" ? "certecf" : "testecf";

  const supabase = await createClient();
  const { data: empresa, error } = await supabase
    .from("empresa")
    .select("nombre, rnc")
    .eq("id", 1)
    .maybeSingle<{ nombre: string; rnc: string | null }>();

  if (error) {
    return { ok: false, error: `No se pudieron leer los datos del emisor: ${error.message}` };
  }

  const { rnc, esPrueba } = sanitizarRnc(empresa?.rnc);
  const razonSocial = empresa?.nombre?.trim() || "MEDOXIGAS ALC, SRL";

  try {
    const resumen = ejecutarSetPruebasSimulacion({
      rncEmisor: rnc,
      razonSocial,
      ambiente,
    });

    return {
      ok: true,
      resumen: {
        ambiente: resumen.ambiente,
        rncEmisor: resumen.rncEmisor,
        razonSocial,
        rncEsDePrueba: esPrueba,
        totalCasos: resumen.totalCasos,
        aprobados: resumen.aprobados,
        fallidos: resumen.fallidos,
        duracionMs: resumen.duracionMs,
        certificado: {
          titular: resumen.certificado.titular,
          emisor: resumen.certificado.emisor,
          numeroSerie: resumen.certificado.numeroSerie,
          validoHastaIso: resumen.certificado.validoHasta.toISOString(),
          vigente: resumen.certificado.vigente,
          diasRestantes: resumen.certificado.diasRestantes,
          huellaSha256: resumen.certificado.huellaSha256,
        },
        casos: resumen.casos,
      },
    };
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : "No se pudo ejecutar el set de pruebas de simulación e-CF.",
    };
  }
}
