"use server";

import { revalidatePath } from "next/cache";

import { getRol } from "@/lib/auth/rol";
import { centavosAValor, valorACentavos } from "@/lib/facturacion/calculo";
import { mensajeErrorRpc } from "@/lib/facturacion/errores";
import { mensajeValidacion } from "@/lib/facturacion/validacion";
import { createClient } from "@/lib/supabase/server";

import { crearActivoFijoSchema, depreciarActivoSchema, vidaUtilEnMeses } from "./validacion";

export type ResultadoActivoFijo = { ok: true; id: string } | { ok: false; error: string };

export async function crearActivoFijo(entrada: unknown): Promise<ResultadoActivoFijo> {
  const rol = await getRol();
  if (rol !== "admin" && rol !== "contador") {
    return { ok: false, error: "No tienes permiso para crear activos fijos." };
  }

  const resultado = crearActivoFijoSchema.safeParse(entrada);
  if (!resultado.success) return { ok: false, error: mensajeValidacion(resultado.error) };

  const datos = resultado.data;

  const payload = {
    nombre: datos.nombre,
    ...(datos.referencia ? { referencia: datos.referencia } : {}),
    tipo_activo: datos.tipo_activo,
    ...(datos.proveedor_contacto_id ? { proveedor_contacto_id: datos.proveedor_contacto_id } : {}),
    fecha_adquisicion: datos.fecha_adquisicion,
    costo_unitario: centavosAValor(valorACentavos(datos.costo_unitario)),
    cantidad: datos.cantidad,
    monto_total: centavosAValor(valorACentavos(datos.monto_total)),
    valor_residual: centavosAValor(valorACentavos(datos.valor_residual)),
    ...(datos.cuenta_activo_id ? { cuenta_activo_id: datos.cuenta_activo_id } : {}),
    ...(datos.cuenta_depreciacion_id ? { cuenta_depreciacion_id: datos.cuenta_depreciacion_id } : {}),
    ...(datos.cuenta_gasto_id ? { cuenta_gasto_id: datos.cuenta_gasto_id } : {}),
    fecha_inicio_depreciacion: datos.fecha_inicio_depreciacion,
    vida_util_meses: vidaUtilEnMeses(datos.vida_util, datos.periodo_depreciacion),
    contabilizar_creacion: datos.contabilizar_creacion,
  };

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("crear_activo_fijo", { p: payload });

  if (error) return { ok: false, error: mensajeErrorRpc(error) };
  if (typeof data !== "string") {
    return { ok: false, error: "El activo se guardó pero no se recibió su identificador." };
  }

  revalidatePath("/dashboard/contabilidad/activos");
  revalidatePath("/dashboard/contabilidad");
  return { ok: true, id: data };
}

export async function depreciarPeriodo(entrada: unknown): Promise<ResultadoActivoFijo> {
  const rol = await getRol();
  if (rol !== "admin" && rol !== "contador") {
    return { ok: false, error: "No tienes permiso para depreciar activos." };
  }

  const resultado = depreciarActivoSchema.safeParse(entrada);
  if (!resultado.success) return { ok: false, error: mensajeValidacion(resultado.error) };

  const datos = resultado.data;

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("depreciar_activo", {
    p_activo_id: datos.activo_id,
    ...(datos.periodo ? { p_periodo: datos.periodo } : {}),
  });

  if (error) return { ok: false, error: mensajeErrorRpc(error) };
  if (typeof data !== "string") {
    return { ok: false, error: "No se pudo registrar la depreciación." };
  }

  revalidatePath("/dashboard/contabilidad/activos");
  revalidatePath(`/dashboard/contabilidad/activos/${datos.activo_id}`);
  revalidatePath("/dashboard/contabilidad/asientos");
  return { ok: true, id: data };
}
