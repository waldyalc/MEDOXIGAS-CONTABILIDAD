import { paginarConsulta } from "@/lib/supabase/paginar";
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
  contactos: { nombre: string } | null;
}

interface FacturaVendedorJoin {
  id: string;
  fecha: string;
  subtotal: number;
  itbis: number;
  total: number;
  vendedor_id: string | null;
  vendedores: { nombre: string } | null;
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
  id: string;
  factura_id: string | null;
  monto: number;
  retenido: number;
}

interface AplicacionCruda {
  pago_id: string;
  factura_id: string;
  monto: number;
  retenido: number;
  pagos_recibidos: { fecha: string; estado: string } | null;
  facturas: { id: string };
}

export async function obtenerVentasVendedor(
  desde: string,
  hasta: string,
  vendedorId?: string | null,
): Promise<Respuesta<FilaVentaVendedor>> {
  const supabase = await createClient();
  const { data, error } = await paginarConsulta((inicio, fin) => {
    let consulta = supabase
      .from("facturas")
      .select("id, fecha, subtotal, itbis, total, vendedor_id, vendedores(nombre)")
      .gte("fecha", desde)
      .lte("fecha", hasta)
      .neq("estado", "anulada");

    if (vendedorId) consulta = consulta.eq("vendedor_id", vendedorId);

    return consulta.order("fecha").order("numero").range(inicio, fin).returns<FacturaVendedorJoin[]>();
  });

  if (error) return { filas: [], error: error.message };

  return {
    filas: (data ?? []).map((factura) => ({
      vendedor: factura.vendedores?.nombre ?? null,
      subtotal: factura.subtotal,
      itbis: factura.itbis,
      total: factura.total,
    })),
    error: null,
  };
}

export async function obtenerVentasCliente(desde: string, hasta: string): Promise<Respuesta<FilaVentaCliente>> {
  const supabase = await createClient();
  const { data, error } = await paginarConsulta((inicio, fin) =>
    supabase
      .from("facturas")
      .select("id, numero, contacto_id, fecha, subtotal, descuento, itbis, total, contactos(nombre)")
      .gte("fecha", desde)
      .lte("fecha", hasta)
      .neq("estado", "anulada")
      .order("fecha")
      .order("numero")
      .range(inicio, fin)
      .returns<FacturaVentaCruda[]>(),
  );

  if (error) return { filas: [], error: error.message };

  return {
    filas: (data ?? []).map((factura) => ({
      facturaId: factura.id,
      contactoId: factura.contacto_id,
      contactoNombre: factura.contactos?.nombre ?? "—",
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
  const [facturasRes, contacto, pagosRes, aplicacionesRes] = await Promise.all([
    paginarConsulta((inicio, fin) =>
      supabase
        .from("facturas")
        .select("id, numero, ncf, fecha, vencimiento, total")
        .eq("contacto_id", contactoId)
        .lte("fecha", corte)
        .neq("estado", "anulada")
        .order("fecha", { ascending: false })
        .order("numero", { ascending: false })
        .range(inicio, fin)
        .returns<FacturaEstadoCruda[]>(),
    ),
    supabase.from("contactos").select("id, nombre").eq("id", contactoId).maybeSingle().returns<ClienteOpcion | null>(),
    paginarConsulta((inicio, fin) =>
      supabase
        .from("pagos_recibidos")
        .select("id, factura_id, monto, retenido")
        .eq("contacto_id", contactoId)
        .eq("estado", "activo")
        .lte("fecha", corte)
        .order("id")
        .range(inicio, fin)
        .returns<PagoCrudo[]>(),
    ),
    paginarConsulta((inicio, fin) =>
      supabase
        .from("pago_recibido_aplicaciones")
        .select("pago_id, factura_id, monto, retenido, pagos_recibidos(fecha, estado), facturas!inner(id)")
        .eq("facturas.contacto_id", contactoId)
        .lte("facturas.fecha", corte)
        .neq("facturas.estado", "anulada")
        .order("pago_id")
        .order("factura_id")
        .range(inicio, fin)
        .returns<AplicacionCruda[]>(),
    ),
  ]);

  const { data: facturasData, error } = facturasRes;
  if (error) return { filas: [], error: error.message, clienteNombre: null };
  const facturas = facturasData ?? [];

  const pagos = pagosRes;
  const aplicaciones = aplicacionesRes;

  if (pagos.error) return { filas: [], error: pagos.error.message, clienteNombre: contacto.data?.nombre ?? null };
  if (aplicaciones.error) {
    return { filas: [], error: aplicaciones.error.message, clienteNombre: contacto.data?.nombre ?? null };
  }

  const aplicacionesValidas = (aplicaciones.data ?? []).filter(
    (aplicacion) =>
      aplicacion.pagos_recibidos?.estado === "activo" && aplicacion.pagos_recibidos.fecha.slice(0, 10) <= corte,
  );
  const conAplicaciones = new Set(aplicacionesValidas.map((aplicacion) => aplicacion.pago_id));
  const cobradoPorFactura = new Map<string, number>();
  const retenidoPorFactura = new Map<string, number>();
  const sumar = (facturaId: string, monto: number, retenido: number) => {
    cobradoPorFactura.set(facturaId, (cobradoPorFactura.get(facturaId) ?? 0) + centavos(monto));
    retenidoPorFactura.set(facturaId, (retenidoPorFactura.get(facturaId) ?? 0) + centavos(retenido));
  };

  for (const pago of pagos.data ?? []) {
    if (pago.factura_id == null || conAplicaciones.has(pago.id)) continue;
    sumar(pago.factura_id, pago.monto, pago.retenido);
  }
  for (const aplicacion of aplicacionesValidas) {
    sumar(aplicacion.factura_id, aplicacion.monto, aplicacion.retenido);
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
