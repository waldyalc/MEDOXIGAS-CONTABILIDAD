import { z } from "zod";

import { paginarConsulta } from "@/lib/supabase/paginar";
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
  const [facturasRes, pagosRes, aplicacionesRes] = await Promise.all([
    paginarConsulta((inicio, fin) =>
      supabase
        .from("facturas")
        .select("id, numero, ncf, fecha, vencimiento, total, pagado, estado")
        .eq("contacto_id", id)
        .order("fecha")
        .order("numero")
        .range(inicio, fin)
        .returns<DocumentoFicha[]>(),
    ),
    paginarConsulta((inicio, fin) =>
      supabase
        .from("pagos_recibidos")
        .select("id, factura_id, fecha, monto, estado")
        .eq("contacto_id", id)
        .order("id")
        .range(inicio, fin)
        .returns<(PagoEstadoCuenta & { id: string })[]>(),
    ),
    paginarConsulta((inicio, fin) =>
      supabase
        .from("pago_recibido_aplicaciones")
        .select("pago_id, factura_id, monto, pagos_recibidos!inner(contacto_id)")
        .eq("pagos_recibidos.contacto_id", id)
        .order("pago_id")
        .order("factura_id")
        .range(inicio, fin)
        .returns<{ pago_id: string; factura_id: string; monto: number; pagos_recibidos: { contacto_id: string } }[]>(),
    ),
  ]);

  if (facturasRes.error) throw new Error(facturasRes.error.message);
  if (pagosRes.error) throw new Error(pagosRes.error.message);
  if (aplicacionesRes.error) throw new Error(aplicacionesRes.error.message);

  const pagos = pagosRes.data ?? [];
  const aplicaciones = aplicacionesRes.data ?? [];

  const pagosPorId = new Map(pagos.map((pago) => [pago.id, pago]));
  const conAplicaciones = new Set(aplicaciones.map((aplicacion) => aplicacion.pago_id));
  const aplicados: PagoEstadoCuenta[] = aplicaciones.flatMap((aplicacion) => {
    const pago = pagosPorId.get(aplicacion.pago_id);
    if (!pago) return [];
    return [
      {
        factura_id: aplicacion.factura_id,
        fecha: pago.fecha,
        monto: aplicacion.monto,
        estado: pago.estado,
      },
    ];
  });
  const legados: PagoEstadoCuenta[] = pagos
    .filter((pago) => !conAplicaciones.has(pago.id))
    .map((pago) => ({
      factura_id: pago.factura_id,
      fecha: pago.fecha,
      monto: pago.monto,
      estado: pago.estado,
    }));

  return {
    contacto,
    facturas: facturasRes.data ?? [],
    pagos: [...legados, ...aplicados],
  };
}
