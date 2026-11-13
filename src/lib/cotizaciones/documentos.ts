import { revalidatePath } from "next/cache";

import type { SupabaseClient } from "@supabase/supabase-js";
import { z } from "zod";

import { getRol } from "@/lib/auth/rol";
import { mensajeErrorRpc } from "@/lib/facturacion/errores";
import { createClient } from "@/lib/supabase/server";

import type { TipoDocumento } from "./tipos";
import { crearDocumentoSchema, mensajeValidacion } from "./validacion";

export type ResultadoAccion = { ok: true; id: string } | { ok: false; error: string };

const ETIQUETAS: Record<TipoDocumento, string> = {
  cotizacion: "cotizaciones",
  remision: "conduces",
};

const RUTAS: Record<TipoDocumento, string> = {
  cotizacion: "cotizaciones",
  remision: "conduces",
};

function puedeEscribir(rol: string | null) {
  return rol === "admin" || rol === "contador";
}

async function cliente(): Promise<SupabaseClient> {
  return (await createClient()) as unknown as SupabaseClient;
}

export async function crearDocumentoNoContable(tipo: TipoDocumento, entrada: unknown): Promise<ResultadoAccion> {
  if (!puedeEscribir(await getRol())) {
    return { ok: false, error: `No tienes permiso para crear ${ETIQUETAS[tipo]}.` };
  }

  const resultado = crearDocumentoSchema.safeParse(entrada);
  if (!resultado.success) return { ok: false, error: mensajeValidacion(resultado.error) };

  const datos = resultado.data;
  const payload = {
    contacto_id: datos.contacto_id,
    fecha: datos.fecha,
    vencimiento: datos.vencimiento,
    notas: datos.notas?.trim() || null,
    vendedor_id: datos.vendedor_id ?? null,
    centro_costo_id: datos.centro_costo_id ?? null,
    lineas: datos.lineas.map((linea) => ({
      producto_id: linea.producto_id ?? null,
      descripcion: linea.descripcion ?? "",
      cantidad: linea.cantidad,
      precio: linea.precio,
      descuento_pct: linea.descuento_pct,
      itbis_tasa: linea.itbis_tasa,
    })),
  };

  const supabase = await cliente();
  const { data, error } = await supabase.rpc(tipo === "cotizacion" ? "crear_cotizacion" : "crear_remision", {
    p: payload,
  });

  if (error) return { ok: false, error: mensajeErrorRpc(error) };
  if (typeof data !== "string") {
    return { ok: false, error: `El documento se guardó pero no se recibió su identificador.` };
  }

  revalidatePath(`/dashboard/${RUTAS[tipo]}`);
  revalidatePath(`/dashboard/${RUTAS[tipo]}/${data}`);
  return { ok: true, id: data };
}

export async function convertirDocumentoNoContable(
  tipo: TipoDocumento,
  id: string,
  tipoComprobante: string,
): Promise<ResultadoAccion> {
  if (!puedeEscribir(await getRol())) {
    return { ok: false, error: `No tienes permiso para convertir ${ETIQUETAS[tipo]}.` };
  }
  if (!z.uuid().safeParse(id).success) return { ok: false, error: "El documento no es válido." };
  if (tipoComprobante !== "01" && tipoComprobante !== "02") {
    return { ok: false, error: "Selecciona un tipo de comprobante válido." };
  }

  const supabase = await cliente();
  const { data, error } = await supabase.rpc("convertir_a_factura", {
    p: { tipo, id, tipo_comprobante: tipoComprobante },
  });

  if (error) return { ok: false, error: mensajeErrorRpc(error) };
  if (typeof data !== "string") {
    return { ok: false, error: "La factura se creó pero no se recibió su identificador." };
  }

  revalidatePath(`/dashboard/${RUTAS[tipo]}`);
  revalidatePath(`/dashboard/${RUTAS[tipo]}/${id}`);
  revalidatePath("/dashboard/facturacion");
  revalidatePath(`/dashboard/facturacion/${data}`);
  return { ok: true, id: data };
}
