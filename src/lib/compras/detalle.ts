import { z } from "zod";

import { createClient } from "@/lib/supabase/server";

import type { MetodoPago } from "./tipos";

export interface AplicacionPagoProveedor {
  factura_proveedor_id: string;
  numero: number;
  ncf: string | null;
  monto: number;
  retenido: number;
}

export interface DetallePagoProveedor {
  id: string;
  numero: number;
  fecha: string;
  monto: number;
  retenido: number;
  metodo: MetodoPago;
  estado: "activo" | "anulado";
  notas: string | null;
  asiento_id: string | null;
  contacto_id: string;
  cuenta_id: string;
  factura_proveedor_id: string | null;
  contacto: { nombre: string; rnc_cedula: string | null } | null;
  factura: { numero: number; ncf: string | null } | null;
  cuenta: { codigo: string; nombre: string } | null;
  aplicaciones: AplicacionPagoProveedor[];
}

interface FilaPagoProveedor {
  id: string;
  numero: number;
  fecha: string;
  monto: number;
  retenido: number;
  metodo: MetodoPago;
  estado: "activo" | "anulado";
  notas: string | null;
  asiento_id: string | null;
  contacto_id: string;
  cuenta_id: string;
  factura_proveedor_id: string | null;
  contactos: { nombre: string; rnc_cedula: string | null } | null;
  cuentas: { codigo: string; nombre: string } | null;
  facturas_proveedor: { numero: number; ncf: string | null } | null;
}

interface FilaAplicacionProveedor {
  factura_proveedor_id: string;
  monto: number;
  retenido: number;
  facturas_proveedor: { numero: number; ncf: string | null } | null;
}

export async function obtenerPagoProveedor(id: string): Promise<DetallePagoProveedor | null> {
  if (!z.uuid().safeParse(id).success) return null;

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("pagos_proveedor")
    .select(
      "id, numero, fecha, monto, retenido, metodo, estado, notas, asiento_id, contacto_id, cuenta_id, factura_proveedor_id, contactos(nombre, rnc_cedula), cuentas(codigo, nombre), facturas_proveedor(numero, ncf)",
    )
    .eq("id", id)
    .maybeSingle<FilaPagoProveedor>();

  if (error) throw new Error(error.message);
  if (!data) return null;

  const { data: aplicaciones, error: errorAplicaciones } = await supabase
    .from("pago_proveedor_aplicaciones")
    .select("factura_proveedor_id, monto, retenido, facturas_proveedor(numero, ncf)")
    .eq("pago_id", id)
    .order("id")
    .returns<FilaAplicacionProveedor[]>();

  if (errorAplicaciones) throw new Error(errorAplicaciones.message);

  let aplicadas: AplicacionPagoProveedor[] = [];

  if ((aplicaciones ?? []).length > 0) {
    aplicadas = (aplicaciones ?? []).map((aplicacion) => ({
      factura_proveedor_id: aplicacion.factura_proveedor_id,
      numero: aplicacion.facturas_proveedor?.numero ?? 0,
      ncf: aplicacion.facturas_proveedor?.ncf ?? null,
      monto: aplicacion.monto,
      retenido: aplicacion.retenido,
    }));
  } else if (data.factura_proveedor_id && data.facturas_proveedor) {
    aplicadas = [
      {
        factura_proveedor_id: data.factura_proveedor_id,
        numero: data.facturas_proveedor.numero,
        ncf: data.facturas_proveedor.ncf,
        monto: data.monto,
        retenido: data.retenido,
      },
    ];
  }

  return {
    id: data.id,
    numero: data.numero,
    fecha: data.fecha,
    monto: data.monto,
    retenido: data.retenido,
    metodo: data.metodo,
    estado: data.estado,
    notas: data.notas,
    asiento_id: data.asiento_id,
    contacto_id: data.contacto_id,
    cuenta_id: data.cuenta_id,
    factura_proveedor_id: data.factura_proveedor_id,
    contacto: data.contactos,
    factura: data.facturas_proveedor,
    cuenta: data.cuentas,
    aplicaciones: aplicadas,
  };
}
