"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { getRol } from "@/lib/auth/rol";
import { createClient } from "@/lib/supabase/server";

import type { EntradaFacturaProveedor, EntradaPagoProveedor } from "./esquema";
import { esquemaFacturaProveedor, esquemaPagoProveedor } from "./esquema";

export type ResultadoAccion = { ok: true } | { ok: false; error: string };

async function puedeEscribir() {
  const rol = await getRol();
  return rol === "admin" || rol === "contador";
}

function revalidarCompras(id?: string) {
  revalidatePath("/dashboard/compras");
  revalidatePath("/dashboard/compras/pagos");
  if (id) revalidatePath(`/dashboard/compras/${id}`);
}

export async function crearFacturaProveedor(entrada: EntradaFacturaProveedor): Promise<ResultadoAccion> {
  if (!(await puedeEscribir())) return { ok: false, error: "No tienes permiso para registrar compras." };

  const resultado = esquemaFacturaProveedor.safeParse(entrada);
  if (!resultado.success) {
    return { ok: false, error: resultado.error.issues[0]?.message ?? "Datos inválidos." };
  }

  const datos = resultado.data;
  const supabase = await createClient();
  const { data, error } = await supabase
    .rpc("crear_factura_proveedor", {
      p: {
        contacto_id: datos.contacto_id,
        fecha: datos.fecha,
        vencimiento: datos.vencimiento,
        ...(datos.ncf ? { ncf: datos.ncf } : {}),
        ...(datos.notas ? { notas: datos.notas } : {}),
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

  if (error) return { ok: false, error: error.message };
  if (!data) return { ok: false, error: "No se pudo crear la factura de proveedor." };

  revalidarCompras(data);
  redirect(`/dashboard/compras/${data}`);
}

export async function registrarPagoProveedor(entrada: EntradaPagoProveedor): Promise<ResultadoAccion> {
  if (!(await puedeEscribir())) return { ok: false, error: "No tienes permiso para registrar pagos." };

  const resultado = esquemaPagoProveedor.safeParse(entrada);
  if (!resultado.success) {
    return { ok: false, error: resultado.error.issues[0]?.message ?? "Datos inválidos." };
  }

  const datos = resultado.data;
  const supabase = await createClient();
  const { data, error } = await supabase
    .rpc("registrar_pago_proveedor", {
      p: {
        factura_proveedor_id: datos.factura_proveedor_id,
        fecha: datos.fecha,
        cuenta_id: datos.cuenta_id,
        metodo: datos.metodo,
        monto: datos.monto,
      },
    })
    .returns<string>();

  if (error) return { ok: false, error: error.message };
  if (!data) return { ok: false, error: "No se pudo registrar el pago." };

  revalidarCompras(datos.factura_proveedor_id);
  return { ok: true };
}

export async function anularFacturaProveedor(id: string): Promise<ResultadoAccion> {
  if (!(await puedeEscribir())) return { ok: false, error: "No tienes permiso para anular documentos." };

  const supabase = await createClient();
  const { error } = await supabase.rpc("anular_documento", { p_tipo: "factura_proveedor", p_id: id });

  if (error) return { ok: false, error: error.message };

  revalidarCompras(id);
  return { ok: true };
}
