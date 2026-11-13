import { z } from "zod";

import { createClient } from "@/lib/supabase/server";

import type { MetodoPago } from "./tipos";

export interface DetallePagoProveedor {
  id: string;
  numero: number;
  fecha: string;
  monto: number;
  metodo: MetodoPago;
  estado: "activo" | "anulado";
  notas: string | null;
  asiento_id: string | null;
  contacto_id: string;
  cuenta_id: string;
  factura_proveedor_id: string;
  contacto: { nombre: string; rnc_cedula: string | null } | null;
  factura: { numero: number; ncf: string | null } | null;
  cuenta: { codigo: string; nombre: string } | null;
}

interface FilaPagoProveedor {
  id: string;
  numero: number;
  fecha: string;
  monto: number;
  metodo: MetodoPago;
  estado: "activo" | "anulado";
  notas: string | null;
  asiento_id: string | null;
  contacto_id: string;
  cuenta_id: string;
  factura_proveedor_id: string;
  contactos: { nombre: string; rnc_cedula: string | null } | null;
  cuentas: { codigo: string; nombre: string } | null;
  facturas_proveedor: { numero: number; ncf: string | null } | null;
}

export async function obtenerPagoProveedor(id: string): Promise<DetallePagoProveedor | null> {
  if (!z.uuid().safeParse(id).success) return null;

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("pagos_proveedor")
    .select(
      "id, numero, fecha, monto, metodo, estado, notas, asiento_id, contacto_id, cuenta_id, factura_proveedor_id, contactos(nombre, rnc_cedula), cuentas(codigo, nombre), facturas_proveedor(numero, ncf)",
    )
    .eq("id", id)
    .maybeSingle<FilaPagoProveedor>();

  if (error) throw new Error(error.message);
  if (!data) return null;

  return {
    id: data.id,
    numero: data.numero,
    fecha: data.fecha,
    monto: data.monto,
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
  };
}
