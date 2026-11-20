import { centavos } from "@/lib/reportes/dinero";
import { paginarConsulta } from "@/lib/supabase/paginar";
import { createClient } from "@/lib/supabase/server";

import { type ContactoEmbed, nombreContacto, rncContacto } from "./consultas";
import type { DocumentoFiscal, RespuestaFiscal } from "./tipos";
import { formasPagoVacias } from "./tipos";

interface MotivoAnulacionEmbed {
  codigo_dgii: string;
}

interface AnuladoDb {
  id: string;
  numero: number;
  ncf: string | null;
  fecha: string;
  fecha_anulacion: string | null;
  total: number | string;
  contacto_id: string | null;
  contactos: ContactoEmbed;
  motivos_anulacion: MotivoAnulacionEmbed | MotivoAnulacionEmbed[] | null;
}

/** Documento fiscal anulado con la fecha y el código DGII que necesita el 608. */
export interface DocumentoAnulado extends DocumentoFiscal {
  /** Fecha en que se anuló (null en anulaciones anteriores al motivo obligatorio). */
  fechaAnulacion: string | null;
  /** Código del motivo en `motivos_anulacion` ('01'…'10'); null si no se registró. */
  codigoAnulacion: string | null;
}

const COLUMNAS =
  "id, numero, ncf, fecha, fecha_anulacion, total, contacto_id, contactos(nombre, rnc_cedula), motivos_anulacion(codigo_dgii)";

function codigoMotivo(embed: MotivoAnulacionEmbed | MotivoAnulacionEmbed[] | null): string | null {
  if (Array.isArray(embed)) return embed[0]?.codigo_dgii ?? null;
  return embed?.codigo_dgii ?? null;
}

/**
 * El 608 del mes lista las anulaciones hechas en el período (fecha_anulacion),
 * no las facturas fechadas en el período; el renglón exporta la fecha del
 * comprobante. Las anulaciones viejas sin fecha_anulacion siguen entrando por
 * la fecha del documento para no perderlas.
 */
function periodoAnulacion(desde: string, hasta: string): string {
  return `and(fecha_anulacion.is.null,fecha.gte.${desde},fecha.lte.${hasta}),and(fecha_anulacion.gte.${desde},fecha_anulacion.lte.${hasta})`;
}

/** Comprobantes anulados del período (facturas, gastos menores y notas de crédito de venta). */
export async function obtenerAnulados(desde: string, hasta: string): Promise<RespuestaFiscal<DocumentoAnulado[]>> {
  const supabase = await createClient();
  const [facturas, gastos, notas] = await Promise.all([
    paginarConsulta((inicio, fin) =>
      supabase
        .from("facturas")
        .select(COLUMNAS)
        .eq("estado", "anulada")
        .or(periodoAnulacion(desde, hasta))
        .order("fecha")
        .order("numero")
        .range(inicio, fin)
        .returns<AnuladoDb[]>(),
    ),
    paginarConsulta((inicio, fin) =>
      supabase
        .from("gastos_menores")
        .select(COLUMNAS)
        .eq("estado", "anulada")
        .or(periodoAnulacion(desde, hasta))
        .order("fecha")
        .order("numero")
        .range(inicio, fin)
        .returns<AnuladoDb[]>(),
    ),
    paginarConsulta((inicio, fin) =>
      supabase
        .from("notas_credito_venta")
        .select(COLUMNAS)
        .eq("estado", "anulada")
        .or(periodoAnulacion(desde, hasta))
        .order("fecha")
        .order("numero")
        .range(inicio, fin)
        .returns<AnuladoDb[]>(),
    ),
  ]);

  const error = facturas.error?.message ?? gastos.error?.message ?? notas.error?.message ?? null;
  if (error) return { datos: [], error };

  const convertir = (fila: AnuladoDb, clase: DocumentoFiscal["clase"]): DocumentoAnulado => ({
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
    fechaAnulacion: fila.fecha_anulacion,
    codigoAnulacion: codigoMotivo(fila.motivos_anulacion),
  });

  const documentos = [
    ...(facturas.data ?? []).map((fila) => convertir(fila, "venta")),
    ...(gastos.data ?? []).map((fila) => convertir(fila, "gasto")),
    ...(notas.data ?? []).map((fila) => convertir(fila, "devolucion-venta")),
  ].filter((documento) => documento.ncf.trim() !== "");

  return { datos: documentos, error: null };
}
