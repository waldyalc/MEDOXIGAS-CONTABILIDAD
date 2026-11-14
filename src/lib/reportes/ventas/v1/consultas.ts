import { createClient } from "@/lib/supabase/server";

import type { FacturaVenta, NumeracionOpcion } from "./tipos";

const TAMANO_LOTE = 1000;

const CAMPOS_FACTURA =
  "id, numero, ncf, tipo_comprobante, contacto_id, fecha, subtotal, descuento, itbis, total, pagado, estado, contactos(nombre)";

interface FacturaVentaConContacto extends FacturaVenta {
  contactos: { nombre: string } | null;
}

export interface RespuestaVentas {
  facturas: FacturaVenta[];
  clientes: Record<string, string>;
  numeraciones: NumeracionOpcion[];
  error: string | null;
}

interface LoteFacturas {
  facturas: FacturaVentaConContacto[];
  error: string | null;
}

async function consultarFacturas(
  cliente: Awaited<ReturnType<typeof createClient>>,
  desde: string,
  hasta: string,
): Promise<LoteFacturas> {
  const facturas: FacturaVentaConContacto[] = [];
  let inicio = 0;

  for (;;) {
    const { data, error } = await cliente
      .from("facturas")
      .select(CAMPOS_FACTURA)
      .gte("fecha", desde)
      .lte("fecha", hasta)
      .order("fecha", { ascending: true })
      .order("numero", { ascending: true })
      .range(inicio, inicio + TAMANO_LOTE - 1)
      .returns<FacturaVentaConContacto[]>();

    if (error) return { facturas: [], error: error.message };

    const lote = data ?? [];
    facturas.push(...lote);

    if (lote.length < TAMANO_LOTE) return { facturas, error: null };
    inicio += TAMANO_LOTE;
  }
}

function numeracionesUnicas(filas: readonly NumeracionOpcion[]): NumeracionOpcion[] {
  const porTipo = new Map<string, NumeracionOpcion>();

  for (const fila of filas) {
    if (!porTipo.has(fila.tipo_comprobante)) porTipo.set(fila.tipo_comprobante, fila);
  }

  return [...porTipo.values()];
}

export async function obtenerVentas(desde: string, hasta: string): Promise<RespuestaVentas> {
  const cliente = await createClient();
  const [{ facturas, error }, numeraciones] = await Promise.all([
    consultarFacturas(cliente, desde, hasta),
    cliente.from("numeraciones").select("tipo_comprobante, nombre, prefijo").order("prefijo"),
  ]);

  if (error) return { facturas: [], clientes: {}, numeraciones: [], error };
  if (numeraciones.error) return { facturas: [], clientes: {}, numeraciones: [], error: numeraciones.error.message };

  // El nombre del cliente viene en el mismo viaje (join); antes era una
  // segunda consulta después de conocer los ids.
  const clientes: Record<string, string> = {};
  for (const factura of facturas) {
    clientes[factura.contacto_id] = factura.contactos?.nombre ?? "—";
  }

  return {
    facturas,
    clientes,
    numeraciones: numeracionesUnicas((numeraciones.data ?? []) as unknown as NumeracionOpcion[]),
    error: null,
  };
}
