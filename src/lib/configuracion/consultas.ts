import { normalizarRol } from "@/lib/auth/rol";
import { createClient } from "@/lib/supabase/server";

import type { CuentaRetencion, PerfilUsuario, RetencionConfig, RetencionOpcion, TerminoPago } from "./tipos";

export async function getTerminosPago(): Promise<TerminoPago[]> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("listar_terminos_pago");

  if (error) throw new Error(error.message);
  return data ?? [];
}

export async function getRetencionesConfig(): Promise<RetencionConfig[]> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("listar_retenciones");

  if (error) throw new Error(error.message);

  return (data ?? []).map((fila) => ({
    ...fila,
    tipo: fila.tipo === "itbis" ? "itbis" : "isr",
  }));
}

export async function getRetencionesActivas(): Promise<RetencionOpcion[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("retenciones")
    .select("id, nombre, tipo, porcentaje")
    .eq("activa", true)
    .order("tipo")
    .order("porcentaje")
    .returns<RetencionOpcion[]>();

  if (error) throw new Error(error.message);
  return data ?? [];
}

export async function getCuentasRetencion(): Promise<CuentaRetencion[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("cuentas")
    .select("id, codigo, nombre, tipo")
    .eq("activa", true)
    .eq("acepta_movimientos", true)
    .in("tipo", ["activo", "pasivo"])
    .order("codigo")
    .returns<CuentaRetencion[]>();

  if (error) throw new Error(error.message);
  return data ?? [];
}

export async function getPerfilesUsuarios(): Promise<PerfilUsuario[]> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("listar_perfiles");

  if (error) throw new Error(error.message);

  return (data ?? []).map((fila) => ({
    ...fila,
    rol: normalizarRol(fila.rol) ?? "lector",
  }));
}
