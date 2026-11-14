import { createClient } from "@/lib/supabase/server";

import { centavos } from "../../dinero";
import type { ClienteOpcion, FilaEstadoCuenta, FilaVentaCliente, FilaVentaVendedor } from "./tipos";

export interface Respuesta<T> {
  filas: T[];
  error: string | null;
}

interface FacturaVentaCruda {
  id: string;
  numero: number;
  contacto_id: string;
  fecha: string;
  subtotal: number;
  descuento: number;
  itbis: number;
  total: number;
}

interface FacturaEstadoCruda {
  id: string;
  numero: number;
  ncf: string | null;
  fecha: string;
  vencimiento: string;
  total: number;
}

interface PagoCrudo {
  factura_id: string | null;
  monto: number;
  retenido: number;
}

interface FacturaVendedorCruda {
  id: string;
  fecha: string;
  subtotal: number;
  itbis: number;
  total: number;
  vendedor_id: string | null;
}

interface VendedorCrudo {
  id: string;
  nombre: string;
}

export async function obtenerVentasVendedor(
  desde: string,
  hasta: string,
  vendedorId?: string | null,
): Promise<Respuesta<FilaVentaVendedor>> {
  const supabase = await createClient();
  let consulta = supabase
    .from("facturas")
    .select("id, fecha, subtotal, itbis, total, vendedor_id")
    .gte("fecha", desde)
    .lte("fecha", hasta)
    .neq("estado", "anulada");

  if (vendedorId) consulta = consulta.eq("vendedor_id", vendedorId);

  const { data, error } = await consulta.order("fecha").order("numero").returns<FacturaVendedorCruda[]>();

  if (error) return { filas: [], error: error.message };

  const ids = [...new Set(data.map((factura) => factura.vendedor_id).filter((id): id is string => id != null))];
  if (ids.length === 0) return { filas: [], error: null };

  const vendedores = await supabase.from("vendedores").select("id, nombre").in("id", ids).returns<VendedorCrudo[]>();

  if (vendedores.error) return { filas: [], error: vendedores.error.message };

  const nombres = new Map(vendedores.data.map((vendedor) => [vendedor.id, vendedor.nombre]));

  return {
    filas: data.map((factura) => ({
      vendedor: factura.vendedor_id ? (nombres.get(factura.vendedor_id) ?? null) : null,
      subtotal: factura.subtotal,
      itbis: factura.itbis,
      total: factura.total,
    })),
    error: null,
  };
}

export async function obtenerVentasCliente(desde: string, hasta: string): Promise<Respuesta<FilaVentaCliente>> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("facturas")
    .select("id, numero, contacto_id, fecha, subtotal, descuento, itbis, total")
    .gte("fecha", desde)
    .lte("fecha", hasta)
    .neq("estado", "anulada")
    .order("fecha")
    .order("numero")
    .returns<FacturaVentaCruda[]>();

  if (error) return { filas: [], error: error.message };

  const ids = [...new Set(data.map((factura) => factura.contacto_id))];
  if (ids.length === 0) return { filas: [], error: null };

  const contactos = await supabase.from("contactos").select("id, nombre").in("id", ids).returns<ClienteOpcion[]>();

  if (contactos.error) return { filas: [], error: contactos.error.message };

  const nombres = new Map(contactos.data.map((contacto) => [contacto.id, contacto.nombre]));

  return {
    filas: data.map((factura) => ({
      facturaId: factura.id,
      contactoId: factura.contacto_id,
      contactoNombre: nombres.get(factura.contacto_id) ?? "—",
      subtotal: factura.subtotal,
      descuento: factura.descuento,
      itbis: factura.itbis,
      total: factura.total,
    })),
    error: null,
  };
}

export async function listarClientes(): Promise<Respuesta<ClienteOpcion>> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("contactos")
    .select("id, nombre")
    .eq("activo", true)
    .in("tipo", ["cliente", "ambos"])
    .order("nombre")
    .returns<ClienteOpcion[]>();

  if (error) return { filas: [], error: error.message };
  return { filas: data, error: null };
}

export async function obtenerEstadoCuentaCliente(
  contactoId: string,
  corte: string,
): Promise<Respuesta<FilaEstadoCuenta> & { clienteNombre: string | null }> {
  const supabase = await createClient();
  const { data: facturas, error } = await supabase
    .from("facturas")
    .select("id, numero, ncf, fecha, vencimiento, total")
    .eq("contacto_id", contactoId)
    .lte("fecha", corte)
    .neq("estado", "anulada")
    .order("fecha", { ascending: false })
    .order("numero", { ascending: false })
    .returns<FacturaEstadoCruda[]>();

  if (error) return { filas: [], error: error.message, clienteNombre: null };

  const contacto = await supabase
    .from("contactos")
    .select("id, nombre")
    .eq("id", contactoId)
    .maybeSingle()
    .returns<ClienteOpcion | null>();

  const ids = facturas.map((factura) => factura.id);
  const pagos =
    ids.length > 0
      ? await supabase
          .from("pagos_recibidos")
          .select("factura_id, monto, retenido")
          .in("factura_id", ids)
          .eq("estado", "activo")
          .lte("fecha", corte)
          .returns<PagoCrudo[]>()
      : { data: [] as PagoCrudo[], error: null };

  if (pagos.error) return { filas: [], error: pagos.error.message, clienteNombre: contacto.data?.nombre ?? null };

  const cobradoPorFactura = new Map<string, number>();
  const retenidoPorFactura = new Map<string, number>();
  for (const pago of pagos.data) {
    if (pago.factura_id == null) continue;
    cobradoPorFactura.set(pago.factura_id, (cobradoPorFactura.get(pago.factura_id) ?? 0) + centavos(pago.monto));
    retenidoPorFactura.set(pago.factura_id, (retenidoPorFactura.get(pago.factura_id) ?? 0) + centavos(pago.retenido));
  }

  return {
    filas: facturas.map((factura) => ({
      facturaId: factura.id,
      numero: factura.numero,
      ncf: factura.ncf,
      fecha: factura.fecha,
      vencimiento: factura.vencimiento,
      total: factura.total,
      cobrado: (cobradoPorFactura.get(factura.id) ?? 0) / 100,
      retenido: (retenidoPorFactura.get(factura.id) ?? 0) / 100,
    })),
    error: null,
    clienteNombre: contacto.data?.nombre ?? null,
  };
}
