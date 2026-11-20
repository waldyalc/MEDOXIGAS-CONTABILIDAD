import { centavos } from "@/lib/reportes/dinero";
import { paginarConsulta } from "@/lib/supabase/paginar";
import { createClient } from "@/lib/supabase/server";

import { type ContactoEmbed, nombreContacto, rncContacto } from "./consultas";
import type { DocumentoFiscal, RespuestaFiscal } from "./tipos";
import { formasPagoVacias } from "./tipos";

interface AnuladoDb {
  id: string;
  numero: number;
  ncf: string | null;
  fecha: string;
  total: number | string;
  contacto_id: string | null;
  contactos: ContactoEmbed;
}

/** Comprobantes anulados del período (facturas, gastos menores y notas de crédito de venta). */
export async function obtenerAnulados(desde: string, hasta: string): Promise<RespuestaFiscal<DocumentoFiscal[]>> {
  const supabase = await createClient();
  const [facturas, gastos, notas] = await Promise.all([
    paginarConsulta((inicio, fin) =>
      supabase
        .from("facturas")
        .select("id, numero, ncf, fecha, total, contacto_id, contactos(nombre, rnc_cedula)")
        .eq("estado", "anulada")
        .gte("fecha", desde)
        .lte("fecha", hasta)
        .order("fecha")
        .order("numero")
        .range(inicio, fin)
        .returns<AnuladoDb[]>(),
    ),
    paginarConsulta((inicio, fin) =>
      supabase
        .from("gastos_menores")
        .select("id, numero, ncf, fecha, total, contacto_id, contactos(nombre, rnc_cedula)")
        .eq("estado", "anulada")
        .gte("fecha", desde)
        .lte("fecha", hasta)
        .order("fecha")
        .order("numero")
        .range(inicio, fin)
        .returns<AnuladoDb[]>(),
    ),
    paginarConsulta((inicio, fin) =>
      supabase
        .from("notas_credito_venta")
        .select("id, numero, ncf, fecha, total, contacto_id, contactos(nombre, rnc_cedula)")
        .eq("estado", "anulada")
        .gte("fecha", desde)
        .lte("fecha", hasta)
        .order("fecha")
        .order("numero")
        .range(inicio, fin)
        .returns<AnuladoDb[]>(),
    ),
  ]);

  const error = facturas.error?.message ?? gastos.error?.message ?? notas.error?.message ?? null;
  if (error) return { datos: [], error };

  const convertir = (fila: AnuladoDb, clase: DocumentoFiscal["clase"]): DocumentoFiscal => ({
    id: fila.id,
    numero: fila.numero,
    ncf: fila.ncf ?? "",
    ncfModificado: null,
    fecha: fila.fecha,
    tipoComprobante: "",
    contactoId: fila.contacto_id,
    contactoNombre: nombreContacto(fila.contactos),
    rnc: rncContacto(fila.contactos),
    base: 0,
    baseBienes: 0,
    baseServicios: 0,
    itbis: 0,
    otrosImpuestos: 0,
    propina: 0,
    total: centavos(fila.total),
    pagado: 0,
    credito: 0,
    estado: "anulada",
    clase,
    ruta: null,
    pagos: formasPagoVacias(),
  });

  const documentos = [
    ...(facturas.data ?? []).map((fila) => convertir(fila, "venta")),
    ...(gastos.data ?? []).map((fila) => convertir(fila, "gasto")),
    ...(notas.data ?? []).map((fila) => convertir(fila, "devolucion-venta")),
  ].filter((documento) => documento.ncf.trim() !== "");

  return { datos: documentos, error: null };
}
