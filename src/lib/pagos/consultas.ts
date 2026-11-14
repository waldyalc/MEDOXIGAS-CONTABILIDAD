import { getCentrosCostoActivos } from "@/lib/centros-costo/consultas";
import { getRetencionesActivas } from "@/lib/configuracion/consultas";
import { getContactosClientes, getCuentasCajaBanco, getEmpresa } from "@/lib/facturacion/consultas";
import { saldoDeFactura } from "@/lib/facturacion/formato";
import { createClient } from "@/lib/supabase/server";

import type { DatosFormularioPago, FacturaAbierta, PagoLista } from "./tipos";

export async function getFacturasAbiertas(): Promise<FacturaAbierta[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("facturas")
    .select("id, numero, ncf, contacto_id, fecha, vencimiento, subtotal, itbis, total, pagado, credito, retenido")
    .eq("estado", "abierta")
    .order("vencimiento")
    .order("numero")
    .limit(300)
    .returns<FacturaAbierta[]>();

  if (error) throw new Error(error.message);
  return data.filter((factura) => saldoDeFactura(factura.total, factura.pagado, factura.credito, factura.retenido) > 0);
}

export async function getCuentasIngreso(): Promise<{ id: string; codigo: string; nombre: string }[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("cuentas")
    .select("id, codigo, nombre")
    .eq("tipo", "ingreso")
    .eq("acepta_movimientos", true)
    .eq("activa", true)
    .order("codigo")
    .returns<{ id: string; codigo: string; nombre: string }[]>();

  if (error) throw new Error(error.message);
  return data ?? [];
}

export async function getSiguienteNumeroPago(): Promise<number> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("pagos_recibidos")
    .select("numero")
    .order("numero", { ascending: false })
    .limit(1)
    .maybeSingle<{ numero: number }>();

  if (error) throw new Error(error.message);
  return (data?.numero ?? 0) + 1;
}

export async function getDatosFormularioPago(): Promise<DatosFormularioPago> {
  const [empresa, contactos, facturas, cuentas, cuentasIngreso, centrosCosto, retenciones, siguienteNumero] =
    await Promise.all([
      getEmpresa(),
      getContactosClientes(),
      getFacturasAbiertas(),
      getCuentasCajaBanco(),
      getCuentasIngreso(),
      getCentrosCostoActivos(),
      getRetencionesActivas(),
      getSiguienteNumeroPago(),
    ]);

  return { empresa, contactos, facturas, cuentas, cuentasIngreso, centrosCosto, retenciones, siguienteNumero };
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
  const pagoIds = data.map((pago) => pago.id);

  const [contactos, facturas, aplicaciones] = await Promise.all([
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
    pagoIds.length > 0
      ? supabase
          .from("pago_recibido_aplicaciones")
          .select("pago_id")
          .in("pago_id", pagoIds)
          .returns<{ pago_id: string }[]>()
      : Promise.resolve({ data: [], error: null }),
  ]);

  if (contactos.error) throw new Error(contactos.error.message);
  if (facturas.error) throw new Error(facturas.error.message);
  if (aplicaciones.error) throw new Error(aplicaciones.error.message);

  const nombres = new Map(contactos.data.map((contacto) => [contacto.id, contacto.nombre]));
  const facturasPorId = new Map(facturas.data.map((factura) => [factura.id, factura]));
  const aplicacionesPorPago = new Map<string, number>();
  for (const aplicacion of aplicaciones.data ?? []) {
    aplicacionesPorPago.set(aplicacion.pago_id, (aplicacionesPorPago.get(aplicacion.pago_id) ?? 0) + 1);
  }

  return data.map((pago) => {
    const factura = pago.factura_id ? facturasPorId.get(pago.factura_id) : undefined;
    return {
      ...pago,
      cliente_nombre: nombres.get(pago.contacto_id) ?? "—",
      factura_numero: factura?.numero ?? null,
      factura_ncf: factura?.ncf ?? null,
      aplicaciones: aplicacionesPorPago.get(pago.id) ?? 0,
    };
  });
}
