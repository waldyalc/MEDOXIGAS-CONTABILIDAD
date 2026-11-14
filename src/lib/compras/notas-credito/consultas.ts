import { z } from "zod";

import { createClient } from "@/lib/supabase/server";

import type {
  AsientoNota,
  DatosFormularioNotaCompra,
  EstadoNotaCreditoCompra,
  FacturaParaNotaCompra,
  LineaAcreditableCompra,
  LineaAsientoNota,
  NotaCreditoCompraLinea,
  NotaCreditoCompraLista,
  NotaCreditoCompraVista,
} from "./tipos";

interface FacturaLineaAcreditable {
  id: string;
  producto_id: string | null;
  cuenta_id: string | null;
  descripcion: string;
  cantidad: number;
  costo: number;
  itbis_tasa: number;
  subtotal: number;
  itbis: number;
  total: number;
}

function redondear(valor: number) {
  return Math.round(valor * 100) / 100;
}

export async function getNotasCreditoCompraLista(): Promise<NotaCreditoCompraLista[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("notas_credito_compra")
    .select("id, numero, ncf, fecha, total, estado, factura_proveedor_id, contacto_id")
    .order("numero", { ascending: false })
    .limit(300)
    .returns<
      {
        id: string;
        numero: number;
        ncf: string;
        fecha: string;
        total: number;
        estado: EstadoNotaCreditoCompra;
        factura_proveedor_id: string;
        contacto_id: string;
      }[]
    >();

  if (error) throw new Error(error.message);
  if (data.length === 0) return [];

  const contactoIds = [...new Set(data.map((nota) => nota.contacto_id))];
  const facturaIds = [...new Set(data.map((nota) => nota.factura_proveedor_id))];

  const [contactos, facturas] = await Promise.all([
    supabase.from("contactos").select("id, nombre").in("id", contactoIds).returns<{ id: string; nombre: string }[]>(),
    supabase
      .from("facturas_proveedor")
      .select("id, numero, ncf")
      .in("id", facturaIds)
      .returns<{ id: string; numero: number; ncf: string | null }[]>(),
  ]);

  if (contactos.error) throw new Error(contactos.error.message);
  if (facturas.error) throw new Error(facturas.error.message);

  const nombres = new Map(contactos.data.map((contacto) => [contacto.id, contacto.nombre]));
  const facturasPorId = new Map(facturas.data.map((factura) => [factura.id, factura]));

  return data.map((nota) => {
    const factura = facturasPorId.get(nota.factura_proveedor_id);
    return {
      ...nota,
      proveedor_nombre: nombres.get(nota.contacto_id) ?? "—",
      factura_numero: factura?.numero ?? 0,
      factura_ncf: factura?.ncf ?? null,
    };
  });
}

export async function getNotaCreditoCompraVista(id: string): Promise<NotaCreditoCompraVista | null> {
  if (!z.uuid().safeParse(id).success) return null;

  const supabase = await createClient();
  const nota = await supabase
    .from("notas_credito_compra")
    .select(
      "id, numero, ncf, fecha, subtotal, itbis, total, devuelve_inventario, estado, notas, asiento_id, factura_proveedor_id, contacto_id",
    )
    .eq("id", id)
    .maybeSingle<
      Omit<
        NotaCreditoCompraVista,
        "proveedor_nombre" | "factura_numero" | "factura_ncf" | "lineas" | "asiento" | "lineasAsiento"
      >
    >();

  if (nota.error) throw new Error(nota.error.message);
  if (!nota.data) return null;

  const [lineas, contacto, factura] = await Promise.all([
    supabase
      .from("nota_credito_compra_lineas")
      .select(
        "id, producto_id, productos(nombre), cuenta_id, cuentas(codigo, nombre), descripcion, cantidad, costo, itbis_tasa, subtotal, itbis, total",
      )
      .eq("nota_id", id)
      .order("id")
      .returns<NotaCreditoCompraLinea[]>(),
    supabase
      .from("contactos")
      .select("nombre")
      .eq("id", nota.data.contacto_id)
      .maybeSingle()
      .returns<{ nombre: string } | null>(),
    supabase
      .from("facturas_proveedor")
      .select("numero, ncf")
      .eq("id", nota.data.factura_proveedor_id)
      .maybeSingle()
      .returns<{ numero: number; ncf: string | null } | null>(),
  ]);

  if (lineas.error) throw new Error(lineas.error.message);
  if (contacto.error) throw new Error(contacto.error.message);
  if (factura.error) throw new Error(factura.error.message);

  const { asiento, lineasAsiento } = await cargarAsiento(nota.data.asiento_id);

  return {
    ...nota.data,
    proveedor_nombre: contacto.data?.nombre ?? "—",
    factura_numero: factura.data?.numero ?? 0,
    factura_ncf: factura.data?.ncf ?? null,
    lineas: lineas.data,
    asiento,
    lineasAsiento,
  };
}

async function cargarAsiento(
  asientoId: string | null,
): Promise<{ asiento: AsientoNota | null; lineasAsiento: LineaAsientoNota[] }> {
  if (!asientoId) return { asiento: null, lineasAsiento: [] };

  const supabase = await createClient();
  const [cabecera, detalle] = await Promise.all([
    supabase
      .from("asientos")
      .select("id, numero, fecha, descripcion, total")
      .eq("id", asientoId)
      .maybeSingle<AsientoNota>(),
    supabase
      .from("asiento_lineas")
      .select("id, cuenta_id, descripcion, debito, credito, cuentas(codigo, nombre)")
      .eq("asiento_id", asientoId)
      .order("debito", { ascending: false })
      .returns<LineaAsientoNota[]>(),
  ]);

  if (cabecera.error) throw new Error(cabecera.error.message);
  if (detalle.error) throw new Error(detalle.error.message);

  return { asiento: cabecera.data ?? null, lineasAsiento: detalle.data ?? [] };
}

export async function getDatosFormularioNotaCompra(facturaId: string): Promise<DatosFormularioNotaCompra | null> {
  if (!z.uuid().safeParse(facturaId).success) return null;

  const supabase = await createClient();
  const factura = await supabase
    .from("facturas_proveedor")
    .select("id, numero, ncf, fecha, total, pagado, credito, estado, contacto_id")
    .eq("id", facturaId)
    .maybeSingle<Omit<FacturaParaNotaCompra, "proveedor_nombre">>();

  if (factura.error) throw new Error(factura.error.message);
  if (!factura.data) return null;

  const [lineas, contacto, notas] = await Promise.all([
    supabase
      .from("facturas_proveedor_lineas")
      .select("id, producto_id, cuenta_id, descripcion, cantidad, costo, itbis_tasa, subtotal, itbis, total")
      .eq("factura_proveedor_id", facturaId)
      .order("id")
      .returns<FacturaLineaAcreditable[]>(),
    supabase
      .from("contactos")
      .select("nombre")
      .eq("id", factura.data.contacto_id)
      .maybeSingle()
      .returns<{ nombre: string } | null>(),
    supabase
      .from("notas_credito_compra")
      .select("id")
      .eq("factura_proveedor_id", facturaId)
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
          .from("nota_credito_compra_lineas")
          .select("factura_proveedor_linea_id, cantidad")
          .in("nota_id", notaIds)
          .returns<{ factura_proveedor_linea_id: string; cantidad: number }[]>()
      : { data: [], error: null };

  if (acreditadas.error) throw new Error(acreditadas.error.message);

  const acreditadoPorLinea = new Map<string, number>();
  for (const linea of acreditadas.data) {
    acreditadoPorLinea.set(
      linea.factura_proveedor_linea_id,
      (acreditadoPorLinea.get(linea.factura_proveedor_linea_id) ?? 0) + linea.cantidad,
    );
  }

  const lineasVista: LineaAcreditableCompra[] = lineas.data.map((linea) => {
    const acreditado = redondear(acreditadoPorLinea.get(linea.id) ?? 0);
    return {
      ...linea,
      acreditado,
      pendiente: Math.max(0, redondear(linea.cantidad - acreditado)),
    };
  });

  return {
    factura: { ...factura.data, proveedor_nombre: contacto.data?.nombre ?? "—" },
    lineas: lineasVista,
  };
}
