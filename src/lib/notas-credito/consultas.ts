import { z } from "zod";

import { createClient } from "@/lib/supabase/server";

import type {
  DatosFormularioNota,
  EstadoNotaCredito,
  LineaAcreditable,
  NotaCreditoLinea,
  NotaCreditoLista,
  NotaCreditoVista,
} from "./tipos";

interface FacturaLineaAcreditable {
  id: string;
  producto_id: string | null;
  descripcion: string;
  cantidad: number;
  precio: number;
  descuento_pct: number;
  itbis_tasa: number;
  subtotal: number;
  itbis: number;
  total: number;
}

function redondear(valor: number) {
  return Math.round(valor * 100) / 100;
}

export async function getNotasCreditoLista(): Promise<NotaCreditoLista[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("notas_credito_venta")
    .select("id, numero, ncf, fecha, total, estado, factura_id, contacto_id")
    .order("numero", { ascending: false })
    .limit(300)
    .returns<
      {
        id: string;
        numero: number;
        ncf: string;
        fecha: string;
        total: number;
        estado: EstadoNotaCredito;
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

export async function getNotaCreditoVista(id: string): Promise<NotaCreditoVista | null> {
  if (!z.uuid().safeParse(id).success) return null;

  const supabase = await createClient();
  const nota = await supabase
    .from("notas_credito_venta")
    .select(
      "id, numero, ncf, fecha, subtotal, itbis, total, devuelve_inventario, estado, notas, asiento_id, factura_id, contacto_id",
    )
    .eq("id", id)
    .maybeSingle<Omit<NotaCreditoVista, "cliente_nombre" | "factura_numero" | "factura_ncf" | "lineas">>();

  if (nota.error) throw new Error(nota.error.message);
  if (!nota.data) return null;

  const [lineas, contacto, factura] = await Promise.all([
    supabase
      .from("nota_credito_venta_lineas")
      .select("id, descripcion, cantidad, precio, descuento_pct, itbis_tasa, subtotal, itbis, total")
      .eq("nota_id", id)
      .order("id")
      .returns<NotaCreditoLinea[]>(),
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

export async function getDatosFormularioNota(facturaId: string): Promise<DatosFormularioNota | null> {
  if (!z.uuid().safeParse(facturaId).success) return null;

  const supabase = await createClient();
  const factura = await supabase
    .from("facturas")
    .select("id, numero, ncf, fecha, total, pagado, credito, estado, contacto_id")
    .eq("id", facturaId)
    .maybeSingle<Omit<DatosFormularioNota["factura"], "cliente_nombre">>();

  if (factura.error) throw new Error(factura.error.message);
  if (!factura.data) return null;

  const [lineas, contacto, notas] = await Promise.all([
    supabase
      .from("factura_lineas")
      .select("id, producto_id, descripcion, cantidad, precio, descuento_pct, itbis_tasa, subtotal, itbis, total")
      .eq("factura_id", facturaId)
      .order("id")
      .returns<FacturaLineaAcreditable[]>(),
    supabase
      .from("contactos")
      .select("nombre")
      .eq("id", factura.data.contacto_id)
      .maybeSingle()
      .returns<{ nombre: string } | null>(),
    supabase
      .from("notas_credito_venta")
      .select("id")
      .eq("factura_id", facturaId)
      .eq("estado", "activa")
      .returns<{ id: string }[]>(),
  ]);

  if (lineas.error) throw new Error(lineas.error.message);
  if (contacto.error) throw new Error(contacto.error.message);
  if (notas.error) throw new Error(notas.error.message);

  const notaIds = notas.data.map((nota) => nota.id);
  const acreditadas =
    notaIds.length > 0
      ? await supabase
          .from("nota_credito_venta_lineas")
          .select("factura_linea_id, cantidad")
          .in("nota_id", notaIds)
          .returns<{ factura_linea_id: string; cantidad: number }[]>()
      : { data: [], error: null };

  if (acreditadas.error) throw new Error(acreditadas.error.message);

  const acreditadoPorLinea = new Map<string, number>();
  for (const linea of acreditadas.data) {
    acreditadoPorLinea.set(
      linea.factura_linea_id,
      (acreditadoPorLinea.get(linea.factura_linea_id) ?? 0) + linea.cantidad,
    );
  }

  const lineasVista: LineaAcreditable[] = lineas.data.map((linea) => {
    const acreditado = redondear(acreditadoPorLinea.get(linea.id) ?? 0);
    return {
      ...linea,
      acreditado,
      pendiente: Math.max(0, redondear(linea.cantidad - acreditado)),
    };
  });

  return {
    factura: { ...factura.data, cliente_nombre: contacto.data?.nombre ?? "—" },
    lineas: lineasVista,
  };
}
