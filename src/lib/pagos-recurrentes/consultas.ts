import type { ContactoOpcion, CuentaOpcion } from "@/lib/compras/tipos";
import { createClient } from "@/lib/supabase/server";

import type { GastoGenerado, OpcionesPagoRecurrente, PagoRecurrenteLista, PagoRecurrenteVista } from "./tipos";

interface PlanDb {
  id: string;
  nombre: string;
  contacto_id: string | null;
  cuenta_gasto_id: string;
  cuenta_pago_id: string;
  subtotal: number;
  itbis_tasa: number;
  frecuencia_meses: number;
  fecha_inicio: string;
  vigencia_hasta: string | null;
  activo: boolean;
}

export async function listarPagosRecurrentes(): Promise<PagoRecurrenteLista[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("pagos_recurrentes")
    .select(
      "id, nombre, contacto_id, cuenta_gasto_id, cuenta_pago_id, subtotal, itbis_tasa, frecuencia_meses, fecha_inicio, vigencia_hasta, activo",
    )
    .order("nombre")
    .returns<PlanDb[]>();

  if (error) throw new Error(error.message);
  if (data.length === 0) return [];

  const contactoIds = [...new Set(data.map((plan) => plan.contacto_id).filter((id): id is string => id !== null))];
  const cuentaIds = [...new Set(data.flatMap((plan) => [plan.cuenta_gasto_id, plan.cuenta_pago_id]))];

  const [contactos, cuentas] = await Promise.all([
    contactoIds.length > 0
      ? supabase
          .from("contactos")
          .select("id, nombre")
          .in("id", contactoIds)
          .returns<{ id: string; nombre: string }[]>()
      : Promise.resolve({ data: [], error: null }),
    supabase.from("cuentas").select("id, nombre").in("id", cuentaIds).returns<{ id: string; nombre: string }[]>(),
  ]);

  if (contactos.error) throw new Error(contactos.error.message);
  if (cuentas.error) throw new Error(cuentas.error.message);

  const nombresContactos = new Map(contactos.data.map((contacto) => [contacto.id, contacto.nombre]));
  const nombresCuentas = new Map(cuentas.data.map((cuenta) => [cuenta.id, cuenta.nombre]));

  return data.map((plan) => ({
    ...plan,
    contacto_nombre: plan.contacto_id ? (nombresContactos.get(plan.contacto_id) ?? null) : null,
    cuenta_gasto_nombre: nombresCuentas.get(plan.cuenta_gasto_id) ?? "—",
    cuenta_pago_nombre: nombresCuentas.get(plan.cuenta_pago_id) ?? "—",
  }));
}

export async function obtenerPagoRecurrente(id: string): Promise<PagoRecurrenteVista | null> {
  const supabase = await createClient();
  const plan = await supabase
    .from("pagos_recurrentes")
    .select(
      "id, nombre, contacto_id, cuenta_gasto_id, cuenta_pago_id, subtotal, itbis_tasa, frecuencia_meses, fecha_inicio, vigencia_hasta, activo, notas",
    )
    .eq("id", id)
    .maybeSingle<PlanDb & { notas: string | null }>();

  if (plan.error) throw new Error(plan.error.message);
  if (!plan.data) return null;

  const [contacto, cuentas, gastos] = await Promise.all([
    plan.data.contacto_id
      ? supabase
          .from("contactos")
          .select("nombre")
          .eq("id", plan.data.contacto_id)
          .maybeSingle()
          .returns<{ nombre: string } | null>()
      : Promise.resolve({ data: null, error: null }),
    supabase
      .from("cuentas")
      .select("id, nombre")
      .in("id", [plan.data.cuenta_gasto_id, plan.data.cuenta_pago_id])
      .returns<{ id: string; nombre: string }[]>(),
    supabase
      .from("gastos_menores")
      .select("id, numero, ncf, fecha, periodo, total, estado, asiento_id")
      .eq("pago_recurrente_id", id)
      .order("periodo", { ascending: false })
      .returns<GastoGenerado[]>(),
  ]);

  if (contacto.error) throw new Error(contacto.error.message);
  if (cuentas.error) throw new Error(cuentas.error.message);
  if (gastos.error) throw new Error(gastos.error.message);

  const nombresCuentas = new Map(cuentas.data.map((cuenta) => [cuenta.id, cuenta.nombre]));

  return {
    ...plan.data,
    contacto_nombre: contacto.data?.nombre ?? null,
    cuenta_gasto_nombre: nombresCuentas.get(plan.data.cuenta_gasto_id) ?? "—",
    cuenta_pago_nombre: nombresCuentas.get(plan.data.cuenta_pago_id) ?? "—",
    gastos: gastos.data,
  };
}

export async function cargarOpcionesPagoRecurrente(): Promise<OpcionesPagoRecurrente> {
  const supabase = await createClient();
  const [cuentasGasto, cuentasCajaBanco, contactos] = await Promise.all([
    supabase
      .from("cuentas")
      .select("id, codigo, nombre, tipo, es_caja_banco")
      .eq("acepta_movimientos", true)
      .in("tipo", ["gasto", "costo"])
      .eq("activa", true)
      .order("codigo")
      .returns<CuentaOpcion[]>(),
    supabase
      .from("cuentas")
      .select("id, codigo, nombre, tipo, es_caja_banco")
      .eq("es_caja_banco", true)
      .eq("acepta_movimientos", true)
      .eq("activa", true)
      .order("codigo")
      .returns<CuentaOpcion[]>(),
    supabase
      .from("contactos")
      .select("id, nombre, rnc_cedula")
      .eq("activo", true)
      .in("tipo", ["proveedor", "ambos"])
      .order("nombre")
      .returns<ContactoOpcion[]>(),
  ]);

  if (cuentasGasto.error) throw new Error(cuentasGasto.error.message);
  if (cuentasCajaBanco.error) throw new Error(cuentasCajaBanco.error.message);
  if (contactos.error) throw new Error(contactos.error.message);

  return {
    cuentasGasto: cuentasGasto.data ?? [],
    cuentasCajaBanco: cuentasCajaBanco.data ?? [],
    contactos: contactos.data ?? [],
  };
}
