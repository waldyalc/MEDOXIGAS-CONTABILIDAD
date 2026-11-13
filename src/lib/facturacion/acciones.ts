"use server";

import { revalidatePath } from "next/cache";

import { z } from "zod";

import { getRol } from "@/lib/auth/rol";
import { createClient } from "@/lib/supabase/server";

import { calcularFactura, centavosAValor, valorACentavos } from "./calculo";
import { crearFacturaSchema, mensajeValidacion } from "./validacion";

export type ResultadoAccion = { ok: true; id: string } | { ok: false; error: string };

function puedeEscribir(rol: string | null) {
  return rol === "admin" || rol === "contador";
}

export async function crearFactura(entrada: unknown): Promise<ResultadoAccion> {
  if (!puedeEscribir(await getRol())) return { ok: false, error: "No tienes permiso para crear facturas." };

  const resultado = crearFacturaSchema.safeParse(entrada);
  if (!resultado.success) return { ok: false, error: mensajeValidacion(resultado.error) };

  const datos = resultado.data;
  const lineas = datos.lineas.map((linea) => ({
    cantidad: linea.cantidad,
    precioCentavos: valorACentavos(linea.precio),
    descuentoPct: linea.descuento_pct,
    itbisTasa: linea.itbis_tasa,
  }));
  const { totales } = calcularFactura(lineas);

  if (totales.totalCentavos <= 0) return { ok: false, error: "El total de la factura debe ser mayor que cero." };

  const payload = {
    tipo_comprobante: datos.tipo_comprobante,
    contacto_id: datos.contacto_id,
    fecha: datos.fecha,
    vencimiento: datos.vencimiento,
    notas: datos.notas ?? null,
    terminos: datos.terminos ?? null,
    pie: datos.pie ?? null,
    lineas: datos.lineas.map((linea) => ({
      producto_id: linea.producto_id ?? null,
      descripcion: linea.descripcion ?? "",
      cantidad: linea.cantidad,
      precio: centavosAValor(valorACentavos(linea.precio)),
      descuento_pct: linea.descuento_pct,
      itbis_tasa: linea.itbis_tasa,
    })),
    ...(datos.pago
      ? {
          pago: {
            cuenta_id: datos.pago.cuenta_id,
            metodo: datos.pago.metodo,
            monto: centavosAValor(totales.totalCentavos),
            fecha: datos.fecha,
          },
        }
      : {}),
  };

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("crear_factura", { p: payload });

  if (error) return { ok: false, error: error.message };
  if (typeof data !== "string")
    return { ok: false, error: "La factura se guardó pero no se recibió su identificador." };

  revalidatePath("/dashboard/facturacion");
  revalidatePath("/dashboard/pagos-recibidos");
  revalidatePath(`/dashboard/facturacion/${data}`);
  return { ok: true, id: data };
}

export async function anularFactura(id: string): Promise<ResultadoAccion> {
  if (!puedeEscribir(await getRol())) return { ok: false, error: "No tienes permiso para anular facturas." };
  if (!z.uuid().safeParse(id).success) return { ok: false, error: "Factura inválida." };

  const supabase = await createClient();
  const { error } = await supabase.rpc("anular_documento", { p_tipo: "factura", p_id: id });

  if (error) return { ok: false, error: error.message };

  revalidatePath("/dashboard/facturacion");
  revalidatePath(`/dashboard/facturacion/${id}`);
  return { ok: true, id };
}
