import { z } from "zod";

import { createClient } from "@/lib/supabase/server";

export interface DetalleGasto {
  id: string;
  numero: number;
  ncf: string | null;
  fecha: string;
  descripcion: string;
  estado: "activo" | "anulado";
  subtotal: number;
  itbis: number;
  total: number;
  asiento_id: string | null;
  contacto_id: string | null;
  cuenta_gasto_id: string;
  cuenta_pago_id: string;
  contacto: { nombre: string; rnc_cedula: string | null } | null;
  cuenta_gasto: { codigo: string; nombre: string } | null;
  cuenta_pago: { codigo: string; nombre: string } | null;
}

interface FilaGasto {
  id: string;
  numero: number;
  ncf: string | null;
  fecha: string;
  descripcion: string;
  estado: "activo" | "anulado";
  subtotal: number;
  itbis: number;
  total: number;
  asiento_id: string | null;
  contacto_id: string | null;
  cuenta_gasto_id: string;
  cuenta_pago_id: string;
  contactos: { nombre: string; rnc_cedula: string | null } | null;
  cuenta_gasto: { codigo: string; nombre: string } | null;
  cuenta_pago: { codigo: string; nombre: string } | null;
}

export async function obtenerGasto(id: string): Promise<DetalleGasto | null> {
  if (!z.uuid().safeParse(id).success) return null;

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("gastos_menores")
    .select(
      "id, numero, ncf, fecha, descripcion, estado, subtotal, itbis, total, asiento_id, contacto_id, cuenta_gasto_id, cuenta_pago_id, contactos(nombre, rnc_cedula), cuenta_gasto:cuentas!gastos_menores_cuenta_gasto_id_fkey(codigo, nombre), cuenta_pago:cuentas!gastos_menores_cuenta_pago_id_fkey(codigo, nombre)",
    )
    .eq("id", id)
    .maybeSingle<FilaGasto>();

  if (error) throw new Error(error.message);
  if (!data) return null;

  return {
    id: data.id,
    numero: data.numero,
    ncf: data.ncf,
    fecha: data.fecha,
    descripcion: data.descripcion,
    estado: data.estado,
    subtotal: data.subtotal,
    itbis: data.itbis,
    total: data.total,
    asiento_id: data.asiento_id,
    contacto_id: data.contacto_id,
    cuenta_gasto_id: data.cuenta_gasto_id,
    cuenta_pago_id: data.cuenta_pago_id,
    contacto: data.contactos,
    cuenta_gasto: data.cuenta_gasto,
    cuenta_pago: data.cuenta_pago,
  };
}
