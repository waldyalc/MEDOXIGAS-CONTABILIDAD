import type { createClient } from "@/lib/supabase/server";

import { numeroDocumento, patronIlike } from "./busqueda";

type Cliente = Awaited<ReturnType<typeof createClient>>;

export const LIMITE_IDS_BUSQUEDA = 200;

/** Ids de los contactos cuyo nombre o RNC coinciden con el término. */
export async function contactosQueCoinciden(
  supabase: Cliente,
  q: string,
  tipos: readonly string[] = ["cliente", "proveedor", "ambos"],
): Promise<string[]> {
  const patron = patronIlike(q);
  const { data, error } = await supabase
    .from("contactos")
    .select("id")
    .in("tipo", tipos)
    .or(`nombre.ilike.${patron},rnc_cedula.ilike.${patron}`)
    .limit(LIMITE_IDS_BUSQUEDA);

  if (error) throw new Error(error.message);
  return (data ?? []).map((contacto) => contacto.id);
}

/** Ids de facturas de venta por número o NCF. */
export async function facturasVentaQueCoinciden(supabase: Cliente, q: string): Promise<string[]> {
  const numero = numeroDocumento(q);
  let consulta = supabase.from("facturas").select("id");

  consulta = numero != null ? consulta.eq("numero", numero) : consulta.or(`ncf.ilike.${patronIlike(q)}`);

  const { data, error } = await consulta.limit(LIMITE_IDS_BUSQUEDA);

  if (error) throw new Error(error.message);
  return (data ?? []).map((factura) => factura.id);
}

/** Ids de pagos recibidos aplicados a alguna de esas facturas. */
export async function pagosRecibidosQueCubrenFacturas(
  supabase: Cliente,
  idsFacturas: readonly string[],
): Promise<string[]> {
  if (idsFacturas.length === 0) return [];

  const { data, error } = await supabase
    .from("pago_recibido_aplicaciones")
    .select("pago_id")
    .in("factura_id", idsFacturas)
    .limit(LIMITE_IDS_BUSQUEDA);

  if (error) throw new Error(error.message);
  return [...new Set((data ?? []).map((aplicacion) => aplicacion.pago_id))];
}
