import type { ContactoResumen } from "@/lib/facturacion/tipos";
import { createClient } from "@/lib/supabase/server";

import {
  elegirCuentaGastoPorDefecto,
  elegirCuentaPagoPorDefecto,
  filtrarCuentasCajaBanco,
  filtrarCuentasGasto,
} from "./seleccion";
import type { CuentaContable, DatosFormularioGasto, GastoLista } from "./tipos";

async function getCuentas(): Promise<CuentaContable[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("cuentas")
    .select("id, codigo, nombre, tipo, acepta_movimientos, activa, es_caja_banco")
    .order("codigo")
    .returns<CuentaContable[]>();

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
  const [cuentasContables, proveedores] = await Promise.all([getCuentas(), getProveedores()]);
  const cuentas = filtrarCuentasGasto(cuentasContables);
  const cuentasCajaBanco = filtrarCuentasCajaBanco(cuentasContables);

  return {
    cuentas,
    cuentasCajaBanco,
    proveedores,
    cuentaPorDefecto: elegirCuentaGastoPorDefecto(cuentas)?.id ?? "",
    cuentaPagoPorDefecto: elegirCuentaPagoPorDefecto(cuentasCajaBanco)?.id ?? "",
  };
}

export async function getGastosLista(): Promise<GastoLista[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("gastos_menores")
    .select(
      "id, numero, ncf, fecha, contacto_id, cuenta_gasto_id, cuenta_pago_id, descripcion, subtotal, itbis, total, estado",
    )
    .order("numero", { ascending: false })
    .limit(300)
    .returns<
      {
        id: string;
        numero: number;
        ncf: string | null;
        fecha: string;
        contacto_id: string | null;
        cuenta_gasto_id: string;
        cuenta_pago_id: string;
        descripcion: string;
        subtotal: number;
        itbis: number;
        total: number;
        estado: GastoLista["estado"];
      }[]
    >();

  if (error) throw new Error(error.message);

  const contactoIds = [...new Set(data.map((gasto) => gasto.contacto_id).filter((id): id is string => id !== null))];
  const cuentaIds = [...new Set(data.flatMap((gasto) => [gasto.cuenta_gasto_id, gasto.cuenta_pago_id]))];

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
    cuenta_pago_nombre: nombresCuentas.get(gasto.cuenta_pago_id) ?? "—",
  }));
}
