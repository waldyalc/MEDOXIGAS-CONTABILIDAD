import type { ContactoResumen } from "@/lib/facturacion/tipos";
import { createClient } from "@/lib/supabase/server";

import type { CuentaGasto, DatosFormularioGasto, GastoLista } from "./tipos";

export async function getCuentasGasto(): Promise<CuentaGasto[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("cuentas")
    .select("id, codigo, nombre")
    .eq("tipo", "gasto")
    .eq("activa", true)
    .eq("acepta_movimientos", true)
    .order("codigo")
    .returns<CuentaGasto[]>();

  if (error) throw new Error(error.message);
  return data;
}

export async function getProveedores(): Promise<ContactoResumen[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("contactos")
    .select("id, nombre, rnc_cedula, direccion")
    .eq("activo", true)
    .in("tipo", ["proveedor", "ambos"])
    .order("nombre")
    .returns<ContactoResumen[]>();

  if (error) throw new Error(error.message);
  return data;
}

export async function getDatosFormularioGasto(): Promise<DatosFormularioGasto> {
  const [cuentas, proveedores] = await Promise.all([getCuentasGasto(), getProveedores()]);
  const porDefecto = cuentas.find((cuenta) => cuenta.codigo === "6101") ?? cuentas[0];

  return { cuentas, proveedores, cuentaPorDefecto: porDefecto?.id ?? "" };
}

export async function getGastosLista(): Promise<GastoLista[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("gastos_menores")
    .select("id, numero, fecha, contacto_id, cuenta_gasto_id, descripcion, subtotal, itbis, total, estado")
    .order("numero", { ascending: false })
    .limit(300)
    .returns<
      {
        id: string;
        numero: number;
        fecha: string;
        contacto_id: string | null;
        cuenta_gasto_id: string;
        descripcion: string;
        subtotal: number;
        itbis: number;
        total: number;
        estado: GastoLista["estado"];
      }[]
    >();

  if (error) throw new Error(error.message);

  const contactoIds = [...new Set(data.map((gasto) => gasto.contacto_id).filter((id): id is string => id !== null))];
  const cuentaIds = [...new Set(data.map((gasto) => gasto.cuenta_gasto_id))];

  const [contactos, cuentas] = await Promise.all([
    contactoIds.length > 0
      ? supabase
          .from("contactos")
          .select("id, nombre")
          .in("id", contactoIds)
          .returns<{ id: string; nombre: string }[]>()
      : Promise.resolve({ data: [], error: null }),
    cuentaIds.length > 0
      ? supabase.from("cuentas").select("id, nombre").in("id", cuentaIds).returns<{ id: string; nombre: string }[]>()
      : Promise.resolve({ data: [], error: null }),
  ]);

  if (contactos.error) throw new Error(contactos.error.message);
  if (cuentas.error) throw new Error(cuentas.error.message);

  const nombresContactos = new Map(contactos.data.map((contacto) => [contacto.id, contacto.nombre]));
  const nombresCuentas = new Map(cuentas.data.map((cuenta) => [cuenta.id, cuenta.nombre]));

  return data.map((gasto) => ({
    ...gasto,
    proveedor_nombre: gasto.contacto_id ? (nombresContactos.get(gasto.contacto_id) ?? "—") : "—",
    cuenta_nombre: nombresCuentas.get(gasto.cuenta_gasto_id) ?? "—",
  }));
}
