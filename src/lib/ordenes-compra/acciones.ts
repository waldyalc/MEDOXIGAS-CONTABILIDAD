"use server";

import { revalidatePath } from "next/cache";

import { getRol } from "@/lib/auth/rol";
import { mensajeErrorRpc } from "@/lib/facturacion/errores";
import { createClient } from "@/lib/supabase/server";

import { type EntradaOrdenCompra, esquemaOrdenCompra } from "./esquema";

export type ResultadoOrdenCompra = { ok: true; id: string } | { ok: false; error: string };

export async function crearOrdenCompra(entrada: EntradaOrdenCompra): Promise<ResultadoOrdenCompra> {
  const rol = await getRol();
  if (rol !== "admin" && rol !== "contador")
    return { ok: false, error: "No tienes permiso para crear órdenes de compra." };

  const resultado = esquemaOrdenCompra.safeParse(entrada);
  if (!resultado.success) {
    return { ok: false, error: resultado.error.issues[0]?.message ?? "Datos inválidos." };
  }

  const datos = resultado.data;
  const supabase = await createClient();
  const { data, error } = await supabase
    .rpc("crear_orden_compra", {
      p: {
        contacto_id: datos.contacto_id,
        fecha: datos.fecha,
        fecha_entrega: datos.fecha_entrega,
        ...(datos.notas ? { notas: datos.notas } : {}),
        ...(datos.terminos ? { terminos: datos.terminos } : {}),
        lineas: datos.lineas.map((linea) => ({
          ...(linea.producto_id ? { producto_id: linea.producto_id } : {}),
          ...(linea.cuenta_id ? { cuenta_id: linea.cuenta_id } : {}),
          descripcion: linea.descripcion,
          cantidad: linea.cantidad,
          costo: linea.costo,
          itbis_tasa: linea.itbis_tasa,
        })),
      },
    })
    .returns<string>();

  if (error) return { ok: false, error: mensajeErrorRpc(error) };
  if (!data) return { ok: false, error: "No se pudo crear la orden de compra." };

  revalidatePath("/dashboard/ordenes-compra");
  return { ok: true, id: data };
}
