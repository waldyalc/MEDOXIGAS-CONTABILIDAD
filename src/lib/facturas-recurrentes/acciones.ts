"use server";

import { revalidatePath } from "next/cache";

import { z } from "zod";

import { getRol } from "@/lib/auth/rol";
import { centavosAValor } from "@/lib/facturacion/calculo";
import { mensajeErrorRpc } from "@/lib/facturacion/errores";
import { createClient } from "@/lib/supabase/server";

import { crearFacturaRecurrenteSchema, mensajeValidacionRecurrente } from "./validacion";

export type ResultadoRecurrente = { ok: true; id: string } | { ok: false; error: string };

function puedeEscribir(rol: string | null) {
  return rol === "admin" || rol === "contador";
}

export async function crearFacturaRecurrente(entrada: unknown): Promise<ResultadoRecurrente> {
  if (!puedeEscribir(await getRol())) return { ok: false, error: "No tienes permiso para crear facturas recurrentes." };

  const resultado = crearFacturaRecurrenteSchema.safeParse(entrada);
  if (!resultado.success) return { ok: false, error: mensajeValidacionRecurrente(resultado.error) };

  const datos = resultado.data;
  const payload = {
    contacto_id: datos.contacto_id,
    tipo_comprobante: datos.tipo_comprobante,
    fecha_inicio: datos.fecha_inicio,
    vigencia_hasta: datos.vigencia_hasta ?? null,
    frecuencia_meses: datos.frecuencia_meses,
    plazo_dias: datos.plazo_dias,
    notas: datos.notas ?? null,
    terminos: datos.terminos ?? null,
    pie: datos.pie ?? null,
    lineas: datos.lineas.map((linea) => ({
      producto_id: linea.producto_id ?? null,
      descripcion: linea.descripcion ?? "",
      cantidad: linea.cantidad,
      precio: centavosAValor(Math.round(linea.precio * 100)),
      descuento_pct: linea.descuento_pct,
      itbis_tasa: linea.itbis_tasa,
    })),
  };

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("crear_factura_recurrente", { p: payload });

  if (error) return { ok: false, error: mensajeErrorRpc(error) };
  if (typeof data !== "string")
    return { ok: false, error: "La factura recurrente se guardó pero no se recibió su identificador." };

  revalidatePath("/dashboard/facturas-recurrentes");
  revalidatePath(`/dashboard/facturas-recurrentes/${data}`);
  return { ok: true, id: data };
}

export async function generarFacturaRecurrente(id: string): Promise<ResultadoRecurrente> {
  if (!puedeEscribir(await getRol()))
    return { ok: false, error: "No tienes permiso para generar facturas recurrentes." };
  if (!z.uuid().safeParse(id).success) return { ok: false, error: "Factura recurrente inválida." };

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("generar_factura_recurrente", { p_recurrente_id: id });

  if (error) return { ok: false, error: mensajeErrorRpc(error) };
  if (typeof data !== "string")
    return { ok: false, error: "La factura se generó pero no se recibió su identificador." };

  revalidatePath("/dashboard/facturas-recurrentes");
  revalidatePath(`/dashboard/facturas-recurrentes/${id}`);
  revalidatePath("/dashboard/facturacion");
  revalidatePath(`/dashboard/facturacion/${data}`);
  return { ok: true, id: data };
}
