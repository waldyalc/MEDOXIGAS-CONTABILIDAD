import { z } from "zod";

import { createClient } from "@/lib/supabase/server";

import type {
  AsientoLineaVista,
  AsientoResumen,
  AsientoVista,
  ContactoResumen,
  CuentaCajaBanco,
  Empresa,
  FacturaDetalle,
  FacturaLinea,
  FacturaLista,
  FacturaVista,
  PagoFacturaVista,
  ProductoResumen,
} from "./tipos";

export interface FacturaFila extends FacturaLista {
  cliente_nombre: string;
}

export async function getEmpresa(): Promise<Empresa | null> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("empresa")
    .select("id, nombre, rnc, direccion, telefono, correo, logo_url")
    .eq("id", 1)
    .maybeSingle()
    .returns<Empresa | null>();

  if (error) throw new Error(error.message);
  return data;
}

export async function getContactosClientes(): Promise<ContactoResumen[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("contactos")
    .select("id, nombre, rnc_cedula, direccion, telefono")
    .eq("activo", true)
    .in("tipo", ["cliente", "ambos"])
    .order("nombre")
    .returns<ContactoResumen[]>();

  if (error) throw new Error(error.message);
  return data;
}

export async function getProductosActivos(): Promise<ProductoResumen[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("productos")
    .select("id, nombre, referencia, precio, itbis_tasa")
    .eq("activo", true)
    .order("nombre")
    .returns<ProductoResumen[]>();

  if (error) throw new Error(error.message);
  return data;
}

export async function getCuentasCajaBanco(): Promise<CuentaCajaBanco[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("cuentas")
    .select("id, codigo, nombre")
    .eq("activa", true)
    .eq("es_caja_banco", true)
    .order("codigo")
    .returns<CuentaCajaBanco[]>();

  if (error) throw new Error(error.message);
  return data;
}

export async function getFacturasLista(): Promise<FacturaFila[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("facturas")
    .select("id, numero, ncf, tipo_comprobante, contacto_id, fecha, vencimiento, total, pagado, credito, estado")
    .order("numero", { ascending: false })
    .limit(300)
    .returns<FacturaLista[]>();

  if (error) throw new Error(error.message);

  const ids = [...new Set(data.map((factura) => factura.contacto_id))];
  if (ids.length === 0) return [];

  const contactos = await supabase
    .from("contactos")
    .select("id, nombre")
    .in("id", ids)
    .returns<{ id: string; nombre: string }[]>();

  if (contactos.error) throw new Error(contactos.error.message);

  const nombres = new Map(contactos.data.map((contacto) => [contacto.id, contacto.nombre]));
  return data.map((factura) => ({ ...factura, cliente_nombre: nombres.get(factura.contacto_id) ?? "—" }));
}

async function getAsiento(asientoId: string | null): Promise<AsientoVista> {
  if (!asientoId) return { asiento: null, lineas: [] };

  const supabase = await createClient();
  const [asiento, lineas] = await Promise.all([
    supabase
      .from("asientos")
      .select("id, numero, fecha, descripcion")
      .eq("id", asientoId)
      .maybeSingle()
      .returns<AsientoResumen | null>(),
    supabase
      .from("asiento_lineas")
      .select("id, cuenta_id, descripcion, debito, credito")
      .eq("asiento_id", asientoId)
      .order("id")
      .returns<{ id: string; cuenta_id: string; descripcion: string; debito: number; credito: number }[]>(),
  ]);

  if (asiento.error) throw new Error(asiento.error.message);
  if (lineas.error) throw new Error(lineas.error.message);
  if (!asiento.data) return { asiento: null, lineas: [] };

  const cuentaIds = [...new Set(lineas.data.map((linea) => linea.cuenta_id))];
  const cuentas =
    cuentaIds.length > 0
      ? await supabase
          .from("cuentas")
          .select("id, codigo, nombre")
          .in("id", cuentaIds)
          .returns<{ id: string; codigo: string; nombre: string }[]>()
      : { data: [], error: null };

  if (cuentas.error) throw new Error(cuentas.error.message);

  const porId = new Map(cuentas.data.map((cuenta) => [cuenta.id, cuenta]));
  const lineasVista: AsientoLineaVista[] = lineas.data.map((linea) => {
    const cuenta = porId.get(linea.cuenta_id);
    return {
      id: linea.id,
      cuenta_id: linea.cuenta_id,
      codigo: cuenta?.codigo ?? "—",
      nombre: cuenta?.nombre ?? "—",
      descripcion: linea.descripcion,
      debito: linea.debito,
      credito: linea.credito,
    };
  });

  return { asiento: asiento.data, lineas: lineasVista };
}

export async function getFacturaVista(id: string): Promise<FacturaVista | null> {
  if (!z.uuid().safeParse(id).success) return null;

  const supabase = await createClient();
  const factura = await supabase
    .from("facturas")
    .select(
      "id, numero, ncf, tipo_comprobante, contacto_id, fecha, vencimiento, subtotal, descuento, itbis, total, pagado, credito, estado, notas, terminos, pie, asiento_id",
    )
    .eq("id", id)
    .maybeSingle()
    .returns<FacturaDetalle | null>();

  if (factura.error) throw new Error(factura.error.message);
  if (!factura.data) return null;

  const [lineas, contacto, empresa, asiento, numeraciones, pagos] = await Promise.all([
    supabase
      .from("factura_lineas")
      .select("id, producto_id, descripcion, cantidad, precio, descuento_pct, itbis_tasa, subtotal, itbis, total")
      .eq("factura_id", id)
      .order("id")
      .returns<FacturaLinea[]>(),
    supabase
      .from("contactos")
      .select("id, nombre, rnc_cedula, direccion, telefono")
      .eq("id", factura.data.contacto_id)
      .maybeSingle()
      .returns<ContactoResumen | null>(),
    getEmpresa(),
    getAsiento(factura.data.asiento_id),
    supabase
      .from("numeraciones")
      .select("prefijo, vence, siguiente")
      .eq("tipo_comprobante", factura.data.tipo_comprobante)
      .order("siguiente")
      .returns<{ prefijo: string; vence: string | null; siguiente: number }[]>(),
    supabase
      .from("pagos_recibidos")
      .select("id, numero, fecha, metodo, monto, estado")
      .eq("factura_id", id)
      .order("fecha")
      .returns<PagoFacturaVista[]>(),
  ]);

  if (lineas.error) throw new Error(lineas.error.message);
  if (contacto.error) throw new Error(contacto.error.message);
  if (numeraciones.error) throw new Error(numeraciones.error.message);
  if (pagos.error) throw new Error(pagos.error.message);
  if (!contacto.data) return null;

  const ncf = factura.data.ncf;
  const numeracion = ncf
    ? (numeraciones.data.find((fila) => {
        if (!ncf.startsWith(fila.prefijo)) return false;
        const numero = Number(ncf.slice(fila.prefijo.length));
        return Number.isFinite(numero) && numero < fila.siguiente;
      }) ?? numeraciones.data.find((fila) => ncf.startsWith(fila.prefijo)))
    : undefined;

  return {
    factura: factura.data,
    lineas: lineas.data,
    contacto: contacto.data,
    empresa,
    asiento,
    ncfVence: numeracion?.vence ?? null,
    pagos: pagos.data,
  };
}
