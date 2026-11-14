"use server";

import { revalidatePath } from "next/cache";

import { getRol } from "@/lib/auth/rol";
import { centavosAValor } from "@/lib/facturacion/calculo";
import { mensajeErrorRpc } from "@/lib/facturacion/errores";
import { createClient } from "@/lib/supabase/server";

import { crearNotaDebitoVentaSchema, mensajeValidacionNotaDebito } from "./validacion";

export type ResultadoNotaDebito = { ok: true; id: string } | { ok: false; error: string };

export async function crearNotaDebitoVenta(entrada: unknown): Promise<ResultadoNotaDebito> {
  const rol = await getRol();
  if (rol !== "admin" && rol !== "contador")
    return { ok: false, error: "No tienes permiso para crear notas de débito." };

  const resultado = crearNotaDebitoVentaSchema.safeParse(entrada);
  if (!resultado.success) return { ok: false, error: mensajeValidacionNotaDebito(resultado.error) };

  const datos = resultado.data;
  const payload = {
    factura_id: datos.factura_id,
    tipo: datos.tipo,
    fecha: datos.fecha,
    notas: datos.notas ?? null,
    lineas: datos.lineas.map((linea) => ({
      producto_id: linea.producto_id ?? null,
      descripcion: linea.descripcion ?? "",
      cantidad: linea.cantidad,
      precio: centavosAValor(Math.round(linea.precio * 100)),
      descuento_pct: linea.descuento_pct,
      itbis_tasa: linea.itbis_tasa,
      impuesto_id: linea.impuesto_id ?? null,
    })),
  };

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("crear_nota_debito_venta", { p: payload });

  if (error) return { ok: false, error: mensajeErrorRpc(error) };
  if (typeof data !== "string")
    return { ok: false, error: "La nota de débito se guardó pero no se recibió su identificador." };

  revalidatePath("/dashboard/notas-debito");
  revalidatePath(`/dashboard/notas-debito/${data}`);
  revalidatePath(`/dashboard/facturacion/${datos.factura_id}`);
  return { ok: true, id: data };
}
