"use server";

import { revalidatePath } from "next/cache";

import { z } from "zod";

import { getRol } from "@/lib/auth/rol";
import { mensajeErrorRpc } from "@/lib/facturacion/errores";
import { createClient } from "@/lib/supabase/server";

import { crearNotaCreditoCompraSchema, mensajeValidacionNotaCompra } from "./validacion";

export type ResultadoNotaCreditoCompra = { ok: true; id: string } | { ok: false; error: string };

function revalidarCompra(facturaId: string) {
  revalidatePath("/dashboard/compras");
  revalidatePath("/dashboard/compras/notas-credito");
  revalidatePath(`/dashboard/compras/${facturaId}`);
}

export async function crearNotaCreditoCompra(entrada: unknown): Promise<ResultadoNotaCreditoCompra> {
  const rol = await getRol();
  if (rol !== "admin" && rol !== "contador")
    return { ok: false, error: "No tienes permiso para crear notas de crédito." };

  const resultado = crearNotaCreditoCompraSchema.safeParse(entrada);
  if (!resultado.success) return { ok: false, error: mensajeValidacionNotaCompra(resultado.error) };

  const datos = resultado.data;
  const payload = {
    factura_proveedor_id: datos.factura_proveedor_id,
    fecha: datos.fecha,
    ncf: datos.ncf,
    notas: datos.notas ?? null,
    devuelve_inventario: datos.devuelve_inventario,
    lineas: datos.lineas.map((linea) => ({
      factura_proveedor_linea_id: linea.factura_proveedor_linea_id,
      cantidad: linea.cantidad,
    })),
  };

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("crear_nota_credito_compra", { p: payload });

  if (error) return { ok: false, error: mensajeErrorRpc(error) };
  if (typeof data !== "string")
    return { ok: false, error: "La nota de crédito se guardó pero no se recibió su identificador." };

  revalidarCompra(datos.factura_proveedor_id);
  return { ok: true, id: data };
}

export async function anularNotaCreditoCompra(id: string): Promise<ResultadoNotaCreditoCompra> {
  const rol = await getRol();
  if (rol !== "admin" && rol !== "contador") return { ok: false, error: "No tienes permiso para anular documentos." };
  if (!z.uuid().safeParse(id).success) return { ok: false, error: "Nota de crédito inválida." };

  const supabase = await createClient();
  const { error } = await supabase.rpc("anular_documento", { p_tipo: "nota_credito_compra", p_id: id });

  if (error) return { ok: false, error: mensajeErrorRpc(error) };

  revalidatePath("/dashboard/compras");
  revalidatePath("/dashboard/compras/notas-credito");
  revalidatePath(`/dashboard/compras/notas-credito/${id}`);
  return { ok: true, id };
}
