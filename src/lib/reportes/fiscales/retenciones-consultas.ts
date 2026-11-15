import { centavos } from "@/lib/reportes/dinero";
import { paginarConsulta } from "@/lib/supabase/paginar";
import { createClient } from "@/lib/supabase/server";

import type { RetencionProveedor } from "./ir17";

interface ContactoEmbed {
  nombre: string;
  rnc_cedula: string | null;
}

interface FacturaEmbed {
  numero: number;
  ncf: string | null;
}

interface RetencionEmbed {
  nombre: string;
  tipo: string;
}

interface DetalleDb {
  id: string;
  base: number | string;
  monto: number | string;
  retenciones: RetencionEmbed | RetencionEmbed[] | null;
}

interface AplicacionDb {
  id: string;
  facturas_proveedor: FacturaEmbed | FacturaEmbed[] | null;
  pago_proveedor_aplicacion_retenciones: DetalleDb[] | null;
}

interface PagoDb {
  numero: number;
  fecha: string;
  contacto_id: string;
  contactos: ContactoEmbed | ContactoEmbed[] | null;
  facturas_proveedor: FacturaEmbed | FacturaEmbed[] | null;
  pago_proveedor_retenciones: DetalleDb[] | null;
  pago_proveedor_aplicaciones: AplicacionDb[] | null;
}

export interface RespuestaRetencionesProveedor {
  filas: RetencionProveedor[];
  error: string | null;
}

function unico<T>(valor: T | T[] | null): T | null {
  return Array.isArray(valor) ? (valor[0] ?? null) : valor;
}

function tipoValido(tipo: string): tipo is "itbis" | "isr" {
  return tipo === "itbis" || tipo === "isr";
}

function filaRetencion(
  pago: PagoDb,
  contacto: ContactoEmbed | null,
  factura: FacturaEmbed | null,
  detalle: DetalleDb,
): RetencionProveedor | null {
  const retencion = unico(detalle.retenciones);
  const tipo = retencion?.tipo;
  if (retencion == null || tipo == null || !tipoValido(tipo)) return null;

  return {
    id: detalle.id,
    contactoId: pago.contacto_id,
    proveedor: contacto?.nombre ?? "—",
    rnc: contacto?.rnc_cedula ?? null,
    tipo,
    nombre: retencion.nombre,
    base: centavos(detalle.base),
    monto: centavos(detalle.monto),
    fecha: pago.fecha,
    facturaNumero: factura?.numero ?? 0,
    facturaNcf: factura?.ncf ?? null,
  };
}

function filasDePago(pago: PagoDb): RetencionProveedor[] {
  const contacto = unico(pago.contactos);
  const filas: RetencionProveedor[] = [];
  const aplicaciones = pago.pago_proveedor_aplicaciones ?? [];

  if (aplicaciones.length === 0) {
    const factura = unico(pago.facturas_proveedor);
    for (const detalle of pago.pago_proveedor_retenciones ?? []) {
      const fila = filaRetencion(pago, contacto, factura, detalle);
      if (fila) filas.push(fila);
    }
    return filas;
  }

  for (const aplicacion of aplicaciones) {
    const factura = unico(aplicacion.facturas_proveedor);
    for (const detalle of aplicacion.pago_proveedor_aplicacion_retenciones ?? []) {
      const fila = filaRetencion(pago, contacto, factura, detalle);
      if (fila) filas.push(fila);
    }
  }

  return filas;
}

export async function obtenerRetencionesProveedores(
  desde: string,
  hasta: string,
): Promise<RespuestaRetencionesProveedor> {
  const supabase = await createClient();
  const { data, error } = await paginarConsulta((inicio, fin) =>
    supabase
      .from("pagos_proveedor")
      .select(
        "numero, fecha, contacto_id, contactos(nombre, rnc_cedula), facturas_proveedor(numero, ncf), pago_proveedor_retenciones(id, base, monto, retenciones(nombre, tipo)), pago_proveedor_aplicaciones(id, facturas_proveedor(numero, ncf), pago_proveedor_aplicacion_retenciones(id, base, monto, retenciones(nombre, tipo)))",
      )
      .eq("estado", "activo")
      .gte("fecha", desde)
      .lte("fecha", hasta)
      .order("fecha")
      .order("numero")
      .range(inicio, fin)
      .returns<PagoDb[]>(),
  );

  if (error) return { filas: [], error: error.message };

  return { filas: (data ?? []).flatMap(filasDePago), error: null };
}
