import { z } from "zod";

import { getContactosClientes, getEmpresa, getProductosActivos } from "@/lib/facturacion/consultas";
import { createClient } from "@/lib/supabase/server";

import type {
  DatosFormularioNotaDebito,
  EstadoNotaDebito,
  FacturaParaNotaDebito,
  NotaDebitoLinea,
  NotaDebitoLista,
  NotaDebitoVista,
  TipoNotaDebito,
} from "./tipos";

export async function getNotasDebitoLista(): Promise<NotaDebitoLista[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("notas_debito_venta")
    .select("id, numero, ncf, fecha, tipo, total, estado, factura_id, contacto_id")
    .order("numero", { ascending: false })
    .limit(300)
    .returns<
      {
        id: string;
        numero: number;
        ncf: string;
        fecha: string;
        tipo: TipoNotaDebito;
        total: number;
        estado: EstadoNotaDebito;
        factura_id: string;
        contacto_id: string;
      }[]
    >();

  if (error) throw new Error(error.message);
  if (data.length === 0) return [];

  const contactoIds = [...new Set(data.map((nota) => nota.contacto_id))];
  const facturaIds = [...new Set(data.map((nota) => nota.factura_id))];

  const [contactos, facturas] = await Promise.all([
    supabase.from("contactos").select("id, nombre").in("id", contactoIds).returns<{ id: string; nombre: string }[]>(),
    supabase
      .from("facturas")
      .select("id, numero, ncf")
      .in("id", facturaIds)
      .returns<{ id: string; numero: number; ncf: string | null }[]>(),
  ]);

  if (contactos.error) throw new Error(contactos.error.message);
  if (facturas.error) throw new Error(facturas.error.message);

  const nombres = new Map(contactos.data.map((contacto) => [contacto.id, contacto.nombre]));
  const facturasPorId = new Map(facturas.data.map((factura) => [factura.id, factura]));

  return data.map((nota) => {
    const factura = facturasPorId.get(nota.factura_id);
    return {
      ...nota,
      cliente_nombre: nombres.get(nota.contacto_id) ?? "—",
      factura_numero: factura?.numero ?? 0,
      factura_ncf: factura?.ncf ?? null,
    };
  });
}

export async function getNotaDebitoVista(id: string): Promise<NotaDebitoVista | null> {
  if (!z.uuid().safeParse(id).success) return null;

  const supabase = await createClient();
  const nota = await supabase
    .from("notas_debito_venta")
    .select(
      "id, numero, ncf, tipo, fecha, subtotal, descuento, itbis, total, estado, notas, asiento_id, factura_id, contacto_id",
    )
    .eq("id", id)
    .maybeSingle<Omit<NotaDebitoVista, "cliente_nombre" | "factura_numero" | "factura_ncf" | "lineas">>();

  if (nota.error) throw new Error(nota.error.message);
  if (!nota.data) return null;

  const [lineas, contacto, factura] = await Promise.all([
    supabase
      .from("nota_debito_venta_lineas")
      .select("id, descripcion, cantidad, precio, descuento_pct, itbis_tasa, subtotal, itbis, total")
      .eq("nota_id", id)
      .order("id")
      .returns<NotaDebitoLinea[]>(),
    supabase
      .from("contactos")
      .select("nombre")
      .eq("id", nota.data.contacto_id)
      .maybeSingle()
      .returns<{ nombre: string } | null>(),
    supabase
      .from("facturas")
      .select("numero, ncf")
      .eq("id", nota.data.factura_id)
      .maybeSingle()
      .returns<{ numero: number; ncf: string | null } | null>(),
  ]);

  if (lineas.error) throw new Error(lineas.error.message);
  if (contacto.error) throw new Error(contacto.error.message);
  if (factura.error) throw new Error(factura.error.message);

  return {
    ...nota.data,
    cliente_nombre: contacto.data?.nombre ?? "—",
    factura_numero: factura.data?.numero ?? 0,
    factura_ncf: factura.data?.ncf ?? null,
    lineas: lineas.data,
  };
}

export async function getDatosFormularioNotaDebito(): Promise<DatosFormularioNotaDebito> {
  const supabase = await createClient();
  const [empresa, contactos, productos, facturas] = await Promise.all([
    getEmpresa(),
    getContactosClientes(),
    getProductosActivos(),
    supabase
      .from("facturas")
      .select("id, numero, ncf, fecha, total, estado, contacto_id")
      .neq("estado", "anulada")
      .order("numero", { ascending: false })
      .limit(500)
      .returns<FacturaParaNotaDebito[]>(),
  ]);

  if (facturas.error) throw new Error(facturas.error.message);

  return { empresa, contactos, productos, facturas: facturas.data };
}
