import { z } from "zod";

import { createClient } from "@/lib/supabase/server";

import type { MetodoPago } from "./tipos";

export interface DetallePagoRecibido {
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
  factura_id: string | null;
  contacto: { nombre: string; rnc_cedula: string | null } | null;
  factura: { numero: number; ncf: string | null } | null;
  cuenta: { codigo: string; nombre: string } | null;
}

interface FilaPagoRecibido {
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
  factura_id: string | null;
  contactos: { nombre: string; rnc_cedula: string | null } | null;
  cuentas: { codigo: string; nombre: string } | null;
  facturas: { numero: number; ncf: string | null } | null;
}

export async function obtenerPagoRecibido(id: string): Promise<DetallePagoRecibido | null> {
  if (!z.uuid().safeParse(id).success) return null;

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("pagos_recibidos")
    .select(
      "id, numero, fecha, monto, metodo, estado, notas, asiento_id, contacto_id, cuenta_id, factura_id, contactos(nombre, rnc_cedula), cuentas(codigo, nombre), facturas(numero, ncf)",
    )
    .eq("id", id)
    .maybeSingle<FilaPagoRecibido>();

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
    factura_id: data.factura_id,
    contacto: data.contactos,
    factura: data.facturas,
    cuenta: data.cuentas,
  };
}
