"use server";

import { revalidatePath } from "next/cache";

import { getRol } from "@/lib/auth/rol";
import { centavosAValor, valorACentavos } from "@/lib/facturacion/calculo";
import { mensajeErrorRpc } from "@/lib/facturacion/errores";
import { mensajeValidacion } from "@/lib/facturacion/validacion";
import { createClient } from "@/lib/supabase/server";

import { crearAsientoManualSchema } from "./validacion";

export type ResultadoAsientoManual = { ok: true; id: string } | { ok: false; error: string };

export async function crearAsientoManual(entrada: unknown): Promise<ResultadoAsientoManual> {
  const rol = await getRol();
  if (rol !== "admin" && rol !== "contador") {
    return { ok: false, error: "No tienes permiso para crear asientos." };
  }

  const resultado = crearAsientoManualSchema.safeParse(entrada);
  if (!resultado.success) return { ok: false, error: mensajeValidacion(resultado.error) };

  const datos = resultado.data;
  const payload = {
    fecha: datos.fecha,
    descripcion: datos.descripcion,
    lineas: datos.lineas.map((linea) => ({
      cuenta_id: linea.cuenta_id,
      ...(linea.contacto_id ? { contacto_id: linea.contacto_id } : {}),
      ...(linea.descripcion ? { descripcion: linea.descripcion } : {}),
      debito: centavosAValor(valorACentavos(linea.debito)),
      credito: centavosAValor(valorACentavos(linea.credito)),
    })),
  };

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("crear_asiento_manual", { p: payload });

  if (error) return { ok: false, error: mensajeErrorRpc(error) };
  if (typeof data !== "string") {
    return { ok: false, error: "El asiento se guardó pero no se recibió su identificador." };
  }

  revalidatePath("/dashboard/contabilidad/asientos");
  revalidatePath("/dashboard/contabilidad");
  return { ok: true, id: data };
}
