import { getContactosClientes, getCuentasCajaBanco } from "@/lib/facturacion/consultas";
import { saldoDeFactura } from "@/lib/facturacion/formato";
import { createClient } from "@/lib/supabase/server";

import type { DatosFormularioPago, FacturaAbierta, PagoLista } from "./tipos";

export async function getFacturasAbiertas(): Promise<FacturaAbierta[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("facturas")
    .select("id, numero, ncf, contacto_id, fecha, total, pagado")
    .eq("estado", "abierta")
    .order("numero", { ascending: false })
    .limit(300)
    .returns<FacturaAbierta[]>();

  if (error) throw new Error(error.message);
  return data.filter((factura) => saldoDeFactura(factura.total, factura.pagado) > 0);
}

export async function getDatosFormularioPago(): Promise<DatosFormularioPago> {
  const [contactos, facturas, cuentas] = await Promise.all([
    getContactosClientes(),
    getFacturasAbiertas(),
    getCuentasCajaBanco(),
  ]);

  return { contactos, facturas, cuentas };
}

export async function getPagosLista(): Promise<PagoLista[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("pagos_recibidos")
    .select("id, numero, fecha, contacto_id, factura_id, monto, metodo, estado")
    .order("numero", { ascending: false })
    .limit(300)
    .returns<
      {
        id: string;
        numero: number;
        fecha: string;
        contacto_id: string;
        factura_id: string | null;
        monto: number;
        metodo: PagoLista["metodo"];
        estado: PagoLista["estado"];
      }[]
    >();

  if (error) throw new Error(error.message);

  const contactoIds = [...new Set(data.map((pago) => pago.contacto_id))];
  const facturaIds = [...new Set(data.map((pago) => pago.factura_id).filter((id): id is string => id !== null))];

  const [contactos, facturas] = await Promise.all([
    contactoIds.length > 0
      ? supabase
          .from("contactos")
          .select("id, nombre")
          .in("id", contactoIds)
          .returns<{ id: string; nombre: string }[]>()
      : Promise.resolve({ data: [], error: null }),
    facturaIds.length > 0
      ? supabase
          .from("facturas")
          .select("id, numero, ncf")
          .in("id", facturaIds)
          .returns<{ id: string; numero: number; ncf: string | null }[]>()
      : Promise.resolve({ data: [], error: null }),
  ]);

  if (contactos.error) throw new Error(contactos.error.message);
  if (facturas.error) throw new Error(facturas.error.message);

  const nombres = new Map(contactos.data.map((contacto) => [contacto.id, contacto.nombre]));
  const facturasPorId = new Map(facturas.data.map((factura) => [factura.id, factura]));

  return data.map((pago) => {
    const factura = pago.factura_id ? facturasPorId.get(pago.factura_id) : undefined;
    return {
      ...pago,
      cliente_nombre: nombres.get(pago.contacto_id) ?? "—",
      factura_numero: factura?.numero ?? null,
      factura_ncf: factura?.ncf ?? null,
    };
  });
}
