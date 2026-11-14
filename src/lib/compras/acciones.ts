"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { z } from "zod";

import { getRol } from "@/lib/auth/rol";
import { centavosAValor, valorACentavos } from "@/lib/facturacion/calculo";
import { mensajeErrorRpc } from "@/lib/facturacion/errores";
import { avisoSaldoCuenta } from "@/lib/reportes/saldos";
import { createClient } from "@/lib/supabase/server";

import type { EntradaFacturaProveedor, EntradaPagoProveedor } from "./esquema";
import { esquemaFacturaProveedor, esquemaPagoProveedor, esquemaPagoProveedorMultiple } from "./esquema";

export type ResultadoAccion = { ok: true; id?: string; aviso?: string } | { ok: false; error: string };

async function puedeEscribir() {
  const rol = await getRol();
  return rol === "admin" || rol === "contador";
}

function revalidarCompras(id?: string) {
  revalidatePath("/dashboard/compras");
  revalidatePath("/dashboard/compras/pagos");
  if (id) revalidatePath(`/dashboard/compras/${id}`);
}

export async function crearFacturaProveedor(
  entrada: EntradaFacturaProveedor,
  ordenId?: string,
): Promise<ResultadoAccion> {
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
        ...(datos.almacen_id ? { almacen_id: datos.almacen_id } : {}),
        ...(datos.ncf ? { ncf: datos.ncf } : {}),
        ...(datos.notas ? { notas: datos.notas } : {}),
        ...(datos.centro_costo_id ? { centro_costo_id: datos.centro_costo_id } : {}),
        lineas: datos.lineas.map((linea) => ({
          ...(linea.producto_id ? { producto_id: linea.producto_id } : {}),
          ...(linea.cuenta_id ? { cuenta_id: linea.cuenta_id } : {}),
          descripcion: linea.descripcion,
          cantidad: linea.cantidad,
          costo: linea.costo,
          itbis_tasa: linea.itbis_tasa,
          impuesto_id: linea.impuesto_id,
        })),
      },
    })
    .returns<string>();

  if (error) return { ok: false, error: mensajeErrorRpc(error) };
  if (!data) return { ok: false, error: "No se pudo crear la factura de proveedor." };

  if (ordenId && z.uuid().safeParse(ordenId).success) {
    const { error: errorOrden } = await supabase.rpc("vincular_orden_compra", {
      p_orden_id: ordenId,
      p_factura_proveedor_id: data,
    });

    if (errorOrden) console.warn("No se pudo vincular la orden de compra:", errorOrden.message);
    revalidatePath("/dashboard/ordenes-compra");
    revalidatePath(`/dashboard/ordenes-compra/${ordenId}`);
  }

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
        ...(datos.retenciones.length > 0 ? { retenciones: datos.retenciones } : {}),
      },
    })
    .returns<string>();

  if (error) return { ok: false, error: mensajeErrorRpc(error) };
  if (!data) return { ok: false, error: "No se pudo registrar el pago." };

  const aviso = await avisoSaldoCuenta(datos.cuenta_id, datos.fecha);

  revalidarCompras(datos.factura_proveedor_id);
  return { ok: true, id: data, ...(aviso ? { aviso } : {}) };
}

export async function registrarPagoProveedorMultiple(entrada: unknown): Promise<ResultadoAccion> {
  if (!(await puedeEscribir())) return { ok: false, error: "No tienes permiso para registrar pagos." };

  const resultado = esquemaPagoProveedorMultiple.safeParse(entrada);
  if (!resultado.success) {
    return { ok: false, error: resultado.error.issues[0]?.message ?? "Datos inválidos." };
  }

  const datos = resultado.data;
  const encabezado = {
    contacto_id: datos.contacto_id,
    fecha: datos.fecha,
    cuenta_id: datos.cuenta_id,
    metodo: datos.metodo,
    ...(datos.notas ? { notas: datos.notas } : {}),
    ...(datos.centro_costo_id ? { centro_costo_id: datos.centro_costo_id } : {}),
    ...(datos.otros.length > 0
      ? {
          otros_egresos: datos.otros.map((linea) => ({
            cuenta_id: linea.cuenta_id,
            descripcion: linea.descripcion,
            monto: centavosAValor(valorACentavos(linea.monto)),
            itbis_tasa: linea.itbis_tasa,
          })),
        }
      : {}),
  };
  const aplicaciones = datos.aplicaciones.map((aplicacion) => ({
    factura_proveedor_id: aplicacion.factura_proveedor_id,
    monto: centavosAValor(valorACentavos(aplicacion.monto)),
    ...(aplicacion.retenciones.length > 0 ? { retenciones: aplicacion.retenciones } : {}),
  }));

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("registrar_pago_proveedor_multi", {
    p_encabezado: encabezado,
    p_aplicaciones: aplicaciones,
  });

  if (error) return { ok: false, error: mensajeErrorRpc(error) };
  if (!data) return { ok: false, error: "No se pudo registrar el pago." };

  const aviso = await avisoSaldoCuenta(datos.cuenta_id, datos.fecha);

  revalidatePath("/dashboard/compras");
  revalidatePath("/dashboard/compras/pagos");
  revalidatePath(`/dashboard/contactos/${datos.contacto_id}`);
  for (const aplicacion of datos.aplicaciones) {
    revalidatePath(`/dashboard/compras/${aplicacion.factura_proveedor_id}`);
  }

  return { ok: true, id: data, ...(aviso ? { aviso } : {}) };
}

export async function anularFacturaProveedor(id: string): Promise<ResultadoAccion> {
  if (!(await puedeEscribir())) return { ok: false, error: "No tienes permiso para anular documentos." };

  const supabase = await createClient();
  const { error } = await supabase.rpc("anular_documento", { p_tipo: "factura_proveedor", p_id: id });

  if (error) return { ok: false, error: mensajeErrorRpc(error) };

  revalidarCompras(id);
  return { ok: true };
}

export async function anularPagoProveedor(id: string): Promise<ResultadoAccion> {
  if (!(await puedeEscribir())) return { ok: false, error: "No tienes permiso para anular documentos." };
  if (!z.uuid().safeParse(id).success) return { ok: false, error: "Pago inválido." };

  const supabase = await createClient();
  const { error } = await supabase.rpc("anular_documento", { p_tipo: "pago_proveedor", p_id: id });

  if (error) return { ok: false, error: mensajeErrorRpc(error) };

  revalidatePath("/dashboard/compras");
  revalidatePath("/dashboard/compras/pagos");
  revalidatePath(`/dashboard/compras/pagos/${id}`);
  return { ok: true, id };
}
