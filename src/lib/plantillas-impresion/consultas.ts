import { createClient } from "@/lib/supabase/server";

import { type PlantillaImpresion, type PlantillaResuelta, TIPOS_PLANTILLA, type TipoPlantilla } from "./tipos";

const ORDEN: Record<TipoPlantilla, number> = { factura: 0, cotizacion: 1, conduce: 2 };

export async function getPlantillasImpresion(): Promise<PlantillaImpresion[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("plantillas_impresion")
    .select("tipo_documento, notas_pie, terminos, mostrar_logo, actualizado_en")
    .returns<PlantillaImpresion[]>();

  if (error) throw new Error(error.message);
  return data.sort((a, b) => ORDEN[a.tipo_documento] - ORDEN[b.tipo_documento]);
}

export async function getPlantillaImpresion(tipo: TipoPlantilla): Promise<PlantillaResuelta> {
  const plantillas = await getPlantillasImpresion();
  const propia = plantillas.find((plantilla) => plantilla.tipo_documento === tipo);
  const factura = plantillas.find((plantilla) => plantilla.tipo_documento === "factura");

  const notas = propia?.notas_pie?.trim() || factura?.notas_pie?.trim() || "";
  const terminos = propia?.terminos?.trim() || factura?.terminos?.trim() || "";

  return {
    notas,
    terminos,
    mostrarLogo: propia?.mostrar_logo ?? factura?.mostrar_logo ?? true,
  };
}

export function tipoPlantillaDeDocumento(tipo: "cotizacion" | "remision"): TipoPlantilla {
  return tipo === "remision" ? "conduce" : "cotizacion";
}

export function esTipoPlantilla(valor: string): valor is TipoPlantilla {
  return TIPOS_PLANTILLA.some((tipo) => tipo === valor);
}
