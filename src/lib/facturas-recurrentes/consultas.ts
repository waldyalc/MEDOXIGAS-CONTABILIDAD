import { z } from "zod";

import { getContactosClientes, getEmpresa, getProductosActivos } from "@/lib/facturacion/consultas";
import type { TipoComprobante } from "@/lib/facturacion/tipos";
import { createClient } from "@/lib/supabase/server";

import type {
  DatosFormularioRecurrente,
  FacturaRecurrenteLinea,
  FacturaRecurrenteLista,
  FacturaRecurrenteVista,
  GeneracionRecurrente,
} from "./tipos";

interface RecurrenteFila {
  id: string;
  numero: number;
  contacto_id: string;
  tipo_comprobante: TipoComprobante;
  fecha_inicio: string;
  vigencia_hasta: string | null;
  frecuencia_meses: number;
  plazo_dias: number;
}

export async function getFacturasRecurrentesLista(): Promise<FacturaRecurrenteLista[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("facturas_recurrentes")
    .select("id, numero, contacto_id, tipo_comprobante, fecha_inicio, vigencia_hasta, frecuencia_meses, plazo_dias")
    .order("numero", { ascending: false })
    .limit(300)
    .returns<RecurrenteFila[]>();

  if (error) throw new Error(error.message);
  if (data.length === 0) return [];

  const contactoIds = [...new Set(data.map((fila) => fila.contacto_id))];
  const recurrenteIds = data.map((fila) => fila.id);

  const [contactos, generaciones] = await Promise.all([
    supabase.from("contactos").select("id, nombre").in("id", contactoIds).returns<{ id: string; nombre: string }[]>(),
    supabase
      .from("factura_recurrente_generaciones")
      .select("recurrente_id, periodo")
      .in("recurrente_id", recurrenteIds)
      .order("periodo", { ascending: false })
      .returns<{ recurrente_id: string; periodo: string }[]>(),
  ]);

  if (contactos.error) throw new Error(contactos.error.message);
  if (generaciones.error) throw new Error(generaciones.error.message);

  const nombres = new Map(contactos.data.map((contacto) => [contacto.id, contacto.nombre]));
  const conteo = new Map<string, number>();
  const ultimo = new Map<string, string>();

  for (const generacion of generaciones.data) {
    conteo.set(generacion.recurrente_id, (conteo.get(generacion.recurrente_id) ?? 0) + 1);
    const actual = ultimo.get(generacion.recurrente_id);
    if (!actual || generacion.periodo > actual) ultimo.set(generacion.recurrente_id, generacion.periodo);
  }

  return data.map((fila) => ({
    ...fila,
    cliente_nombre: nombres.get(fila.contacto_id) ?? "—",
    generaciones: conteo.get(fila.id) ?? 0,
    ultimo_periodo: ultimo.get(fila.id) ?? null,
  }));
}

export async function getFacturaRecurrenteVista(id: string): Promise<FacturaRecurrenteVista | null> {
  if (!z.uuid().safeParse(id).success) return null;

  const supabase = await createClient();
  const recurrente = await supabase
    .from("facturas_recurrentes")
    .select(
      "id, numero, contacto_id, tipo_comprobante, fecha_inicio, vigencia_hasta, frecuencia_meses, plazo_dias, notas, terminos, pie",
    )
    .eq("id", id)
    .maybeSingle<Omit<FacturaRecurrenteVista, "cliente_nombre" | "lineas" | "generaciones">>();

  if (recurrente.error) throw new Error(recurrente.error.message);
  if (!recurrente.data) return null;

  const [contacto, lineas, generaciones] = await Promise.all([
    supabase
      .from("contactos")
      .select("nombre")
      .eq("id", recurrente.data.contacto_id)
      .maybeSingle()
      .returns<{ nombre: string } | null>(),
    supabase
      .from("factura_recurrente_lineas")
      .select("id, producto_id, descripcion, cantidad, precio, descuento_pct, itbis_tasa")
      .eq("recurrente_id", id)
      .order("id")
      .returns<FacturaRecurrenteLinea[]>(),
    supabase
      .from("factura_recurrente_generaciones")
      .select("id, periodo, factura_id")
      .eq("recurrente_id", id)
      .order("periodo", { ascending: false })
      .returns<{ id: string; periodo: string; factura_id: string }[]>(),
  ]);

  if (contacto.error) throw new Error(contacto.error.message);
  if (lineas.error) throw new Error(lineas.error.message);
  if (generaciones.error) throw new Error(generaciones.error.message);

  const facturaIds = generaciones.data.map((generacion) => generacion.factura_id);
  const facturas =
    facturaIds.length > 0
      ? await supabase
          .from("facturas")
          .select("id, numero, ncf, fecha, total, estado")
          .in("id", facturaIds)
          .returns<{ id: string; numero: number; ncf: string | null; fecha: string; total: number; estado: string }[]>()
      : { data: [], error: null };

  if (facturas.error) throw new Error(facturas.error.message);

  const facturasPorId = new Map(facturas.data.map((factura) => [factura.id, factura]));
  const generacionesVista: GeneracionRecurrente[] = generaciones.data.map((generacion) => {
    const factura = facturasPorId.get(generacion.factura_id);
    return {
      id: generacion.id,
      periodo: generacion.periodo,
      factura_id: generacion.factura_id,
      factura_numero: factura?.numero ?? 0,
      factura_ncf: factura?.ncf ?? null,
      factura_fecha: factura?.fecha ?? generacion.periodo,
      factura_total: factura?.total ?? 0,
      factura_estado: factura?.estado ?? "—",
    };
  });

  return {
    ...recurrente.data,
    cliente_nombre: contacto.data?.nombre ?? "—",
    lineas: lineas.data,
    generaciones: generacionesVista,
  };
}

export async function getDatosFormularioRecurrente(): Promise<DatosFormularioRecurrente> {
  const [empresa, contactos, productos] = await Promise.all([
    getEmpresa(),
    getContactosClientes(),
    getProductosActivos(),
  ]);
  return { empresa, contactos, productos };
}
