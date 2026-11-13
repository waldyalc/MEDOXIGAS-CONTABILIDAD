import { z } from "zod";

import { createClient } from "@/lib/supabase/server";

import type { PagoEstadoCuenta } from "./estado-cuenta";
import type { ContactoFicha, DocumentoFicha } from "./ficha";
import { obtenerContactoFicha } from "./ficha-consultas";

const UUID = z.uuid();

export interface DatosEstadoCuentaContacto {
  contacto: ContactoFicha;
  facturas: DocumentoFicha[];
  pagos: PagoEstadoCuenta[];
}

export async function obtenerEstadoCuentaContacto(id: string): Promise<DatosEstadoCuentaContacto | null> {
  if (!UUID.safeParse(id).success) return null;

  const contacto = await obtenerContactoFicha(id);
  if (!contacto) return null;

  const supabase = await createClient();
  const [facturasRes, pagosRes] = await Promise.all([
    supabase
      .from("facturas")
      .select("id, numero, ncf, fecha, vencimiento, total, pagado, estado")
      .eq("contacto_id", id)
      .order("fecha")
      .order("numero")
      .returns<DocumentoFicha[]>(),
    supabase
      .from("pagos_recibidos")
      .select("factura_id, fecha, monto, estado")
      .eq("contacto_id", id)
      .returns<PagoEstadoCuenta[]>(),
  ]);

  if (facturasRes.error) throw new Error(facturasRes.error.message);
  if (pagosRes.error) throw new Error(pagosRes.error.message);

  return {
    contacto,
    facturas: facturasRes.data ?? [],
    pagos: pagosRes.data ?? [],
  };
}
