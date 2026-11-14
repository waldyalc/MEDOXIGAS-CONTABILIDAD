import type { SupabaseClient } from "@supabase/supabase-js";
import { z } from "zod";

import { getEmpresa } from "@/lib/facturacion/consultas";
import { getImpuestosActivos } from "@/lib/impuestos/consultas";
import { createClient } from "@/lib/supabase/server";

import type {
  DocumentoDetalle,
  DocumentoFila,
  DocumentoLinea,
  DocumentoResumen,
  DocumentoVista,
  FacturaRelacionada,
  TipoDocumento,
} from "./tipos";

interface Tablas {
  documento: string;
  lineas: string;
  claveLineas: string;
}

const TABLAS: Record<TipoDocumento, Tablas> = {
  cotizacion: {
    documento: "cotizaciones",
    lineas: "cotizacion_lineas",
    claveLineas: "cotizacion_id",
  },
  remision: {
    documento: "remisiones",
    lineas: "remision_lineas",
    claveLineas: "remision_id",
  },
};

const COLUMNAS_RESUMEN = "id, numero, contacto_id, fecha, vencimiento, total, estado, factura_id";
const COLUMNAS_DETALLE_BASE =
  "id, numero, contacto_id, fecha, vencimiento, subtotal, itbis, otros_impuestos, propina, total, estado, factura_id, notas";
const COLUMNAS_LINEAS =
  "id, producto_id, descripcion, cantidad, precio, descuento_pct, itbis_tasa, impuesto_id, subtotal, itbis, total";

async function cliente(): Promise<SupabaseClient> {
  return (await createClient()) as unknown as SupabaseClient;
}

export async function getDocumentosLista(tipo: TipoDocumento): Promise<DocumentoFila[]> {
  const supabase = await cliente();
  const { data, error } = await supabase
    .from(TABLAS[tipo].documento)
    .select(COLUMNAS_RESUMEN)
    .order("numero", { ascending: false })
    .limit(300);

  if (error) throw new Error(error.message);

  const documentos = (data ?? []) as unknown as DocumentoResumen[];
  const ids = [...new Set(documentos.map((documento) => documento.contacto_id))];
  if (ids.length === 0) return [];

  const contactos = await supabase.from("contactos").select("id, nombre").in("id", ids);

  if (contactos.error) throw new Error(contactos.error.message);

  const nombres = new Map(
    ((contactos.data ?? []) as unknown as { id: string; nombre: string }[]).map((contacto) => [
      contacto.id,
      contacto.nombre,
    ]),
  );

  return documentos.map((documento) => ({
    ...documento,
    cliente_nombre: nombres.get(documento.contacto_id) ?? "—",
  }));
}

export async function getDocumentoVista(tipo: TipoDocumento, id: string): Promise<DocumentoVista | null> {
  if (!z.uuid().safeParse(id).success) return null;

  const supabase = await cliente();
  const columnas = tipo === "cotizacion" ? `${COLUMNAS_DETALLE_BASE}, descuento` : `${COLUMNAS_DETALLE_BASE}`;
  const documento = await supabase.from(TABLAS[tipo].documento).select(columnas).eq("id", id).maybeSingle();

  if (documento.error) throw new Error(documento.error.message);
  if (!documento.data) return null;

  const detalle = documento.data as unknown as DocumentoDetalle;
  if (tipo === "remision") detalle.descuento = 0;

  const [lineas, contacto, empresa, impuestos, factura] = await Promise.all([
    supabase.from(TABLAS[tipo].lineas).select(COLUMNAS_LINEAS).eq(TABLAS[tipo].claveLineas, id).order("id"),
    supabase
      .from("contactos")
      .select("id, nombre, rnc_cedula, direccion, telefono")
      .eq("id", detalle.contacto_id)
      .maybeSingle(),
    getEmpresa(),
    getImpuestosActivos(),
    detalle.factura_id
      ? supabase
          .from("facturas")
          .select("id, numero, ncf, fecha, total, estado")
          .eq("id", detalle.factura_id)
          .maybeSingle()
          .returns<FacturaRelacionada | null>()
      : Promise.resolve({ data: null, error: null }),
  ]);

  if (lineas.error) throw new Error(lineas.error.message);
  if (contacto.error) throw new Error(contacto.error.message);
  if (factura.error) throw new Error(factura.error.message);
  if (!contacto.data) return null;

  return {
    documento: detalle,
    lineas: (lineas.data ?? []) as unknown as DocumentoLinea[],
    impuestos,
    contacto: contacto.data as unknown as DocumentoVista["contacto"],
    empresa,
    facturaRelacionada: factura.data,
  };
}
