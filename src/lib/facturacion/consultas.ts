import { cache } from "react";

import { z } from "zod";

import { listarAdjuntos } from "@/lib/adjuntos/consultas";
import { getImpuestosActivos } from "@/lib/impuestos/consultas";
import { limpiarBusqueda, numeroDocumento } from "@/lib/listas/busqueda";
import { contactosQueCoinciden } from "@/lib/listas/coincidencias";
import { condicionesDocumento } from "@/lib/listas/documento";
import {
  type OpcionesLista,
  type ResultadoPagina,
  rangoPagina,
  resumirPagina,
  TAMANO_PAGINA_DEFECTO,
} from "@/lib/listas/parametros";
import { consultarEnLotes } from "@/lib/supabase/lotes";
import { paginarConsulta } from "@/lib/supabase/paginar";
import { createClient } from "@/lib/supabase/server";

import type {
  AsientoResumen,
  AsientoVista,
  ContactoResumen,
  CotizacionOrigenVista,
  CuentaCajaBanco,
  Empresa,
  EstadoDocumento,
  FacturaDetalle,
  FacturaLinea,
  FacturaLista,
  FacturaVista,
  ListaPrecioResumen,
  MetodoPagoVista,
  NotaVentaResumen,
  PagoFacturaVista,
  ProductoResumen,
} from "./tipos";

export interface FacturaFila extends FacturaLista {
  cliente_nombre: string;
}

interface FacturaListaConContacto extends FacturaLista {
  contactos: { nombre: string } | null;
}

// cache() dedupe la consulta de la empresa dentro de la misma petición.
export const getEmpresa = cache(async (): Promise<Empresa | null> => {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("empresa")
    .select("id, nombre, rnc, direccion, telefono, correo, logo_url")
    .eq("id", 1)
    .maybeSingle()
    .returns<Empresa | null>();

  if (error) throw new Error(error.message);
  return data;
});

export async function getContactosClientes(): Promise<ContactoResumen[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("contactos")
    .select("id, nombre, rnc_cedula, direccion, telefono, lista_precio_id")
    .eq("activo", true)
    .in("tipo", ["cliente", "ambos"])
    .order("nombre")
    .returns<ContactoResumen[]>();

  if (error) throw new Error(error.message);
  return data;
}

export async function getProductosActivos(): Promise<ProductoResumen[]> {
  const supabase = await createClient();
  const { data, error } = await paginarConsulta((inicio, fin) =>
    supabase
      .from("productos")
      .select("id, nombre, referencia, precio, itbis_tasa, impuesto_id")
      .eq("activo", true)
      .order("nombre")
      .order("id")
      .range(inicio, fin)
      .returns<Omit<ProductoResumen, "precios">[]>(),
  );

  if (error) throw new Error(error.message);
  if (data == null || data.length === 0) return [];

  const preciosRes = await consultarEnLotes(
    data.map((producto) => producto.id),
    (lote) =>
      supabase
        .from("producto_precios")
        .select("producto_id, lista_id, precio")
        .in("producto_id", lote)
        .returns<{ producto_id: string; lista_id: string; precio: number }[]>(),
  );

  if (preciosRes.error) throw new Error(preciosRes.error.message);

  const preciosPorProducto = new Map<string, { lista_id: string; precio: number }[]>();
  for (const fila of preciosRes.data ?? []) {
    const actuales = preciosPorProducto.get(fila.producto_id) ?? [];
    actuales.push({ lista_id: fila.lista_id, precio: fila.precio });
    preciosPorProducto.set(fila.producto_id, actuales);
  }

  return data.map((producto) => ({ ...producto, precios: preciosPorProducto.get(producto.id) ?? [] }));
}

export async function getListasPrecios(): Promise<ListaPrecioResumen[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("listas_precios")
    .select("id, nombre, es_principal, tipo")
    .eq("activo", true)
    .order("es_principal", { ascending: false })
    .order("nombre")
    .returns<ListaPrecioResumen[]>();

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

const CAMPOS_FACTURA_LISTA =
  "id, numero, ncf, tipo_comprobante, contacto_id, fecha, vencimiento, total, pagado, credito, retenido, estado, contactos(nombre)";

const OPCIONES_LISTA_DEFECTO: OpcionesLista = { pagina: 1, tamano: TAMANO_PAGINA_DEFECTO, q: "" };

export async function getFacturasLista(
  opciones: OpcionesLista = OPCIONES_LISTA_DEFECTO,
): Promise<ResultadoPagina<FacturaFila>> {
  const supabase = await createClient();
  const q = limpiarBusqueda(opciones.q);
  const numero = numeroDocumento(q);
  const idsContactos = q && numero == null ? await contactosQueCoinciden(supabase, q, ["cliente", "ambos"]) : [];
  const filtro = condicionesDocumento({ q, idsContactos });

  const consultar = async (pagina: number) => {
    const { desde, hasta } = rangoPagina(pagina, opciones.tamano);
    let consulta = supabase.from("facturas").select(CAMPOS_FACTURA_LISTA, { count: "exact" });

    if (filtro) consulta = consulta.or(filtro);

    // Un solo viaje: el nombre del cliente viene en el join en vez de una
    // segunda consulta que dependía de los ids de la primera.
    const { data, error, count } = await consulta
      .order("numero", { ascending: false })
      .range(desde, hasta)
      .returns<FacturaListaConContacto[]>();

    if (error) throw new Error(error.message);
    return { filas: data ?? [], total: count ?? 0 };
  };

  const primera = await consultar(opciones.pagina);
  const resumen = resumirPagina(opciones.pagina, opciones.tamano, primera.total);
  const filas =
    resumen.pagina !== opciones.pagina && primera.filas.length === 0
      ? (await consultar(resumen.pagina)).filas
      : primera.filas;

  return {
    filas: filas.map(({ contactos, ...factura }) => ({
      ...factura,
      cliente_nombre: contactos?.nombre ?? "—",
    })),
    resumen,
  };
}

interface AsientoLineaConCuenta {
  id: string;
  cuenta_id: string;
  descripcion: string;
  debito: number;
  credito: number;
  cuentas: { codigo: string; nombre: string } | null;
}

async function getAsiento(asientoId: string | null): Promise<AsientoVista> {
  if (!asientoId) return { asiento: null, lineas: [] };

  const supabase = await createClient();
  const [asiento, lineasRes] = await Promise.all([
    supabase
      .from("asientos")
      .select("id, numero, fecha, descripcion")
      .eq("id", asientoId)
      .maybeSingle()
      .returns<AsientoResumen | null>(),
    supabase
      .from("asiento_lineas")
      .select("id, cuenta_id, descripcion, debito, credito, cuentas(codigo, nombre)")
      .eq("asiento_id", asientoId)
      .order("id")
      .returns<AsientoLineaConCuenta[]>(),
  ]);

  if (asiento.error) throw new Error(asiento.error.message);
  if (lineasRes.error) throw new Error(lineasRes.error.message);
  if (!asiento.data) return { asiento: null, lineas: [] };

  return {
    asiento: asiento.data,
    lineas: lineasRes.data.map((linea) => ({
      id: linea.id,
      cuenta_id: linea.cuenta_id,
      codigo: linea.cuentas?.codigo ?? "—",
      nombre: linea.cuentas?.nombre ?? "—",
      descripcion: linea.descripcion,
      debito: linea.debito,
      credito: linea.credito,
    })),
  };
}

/**
 * Cotización que originó la factura: `pos_completar_venta` la marca como
 * convertida y le escribe `factura_id`. El detalle de la factura usa esta
 * relación (ya indexada) para mostrar el enlace inverso a la cotización.
 */
export async function getCotizacionOrigen(facturaId: string): Promise<CotizacionOrigenVista | null> {
  if (!z.uuid().safeParse(facturaId).success) return null;

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("cotizaciones")
    .select("id, numero, fecha, total, estado")
    .eq("factura_id", facturaId)
    .order("numero")
    .limit(1)
    .maybeSingle()
    .returns<CotizacionOrigenVista | null>();

  if (error) throw new Error(error.message);
  return data;
}

export async function getFacturaVista(id: string): Promise<FacturaVista | null> {
  if (!z.uuid().safeParse(id).success) return null;

  const supabase = await createClient();
  const empresaP = getEmpresa();
  const impuestosP = getImpuestosActivos();
  const factura = await supabase
    .from("facturas")
    .select(
      "id, numero, ncf, tipo_comprobante, contacto_id, vendedor_id, centro_costo_id, fecha, vencimiento, subtotal, descuento, itbis, otros_impuestos, propina, total, pagado, credito, retenido, estado, notas, terminos, pie, asiento_id",
    )
    .eq("id", id)
    .maybeSingle()
    .returns<FacturaDetalle | null>();

  if (factura.error) throw new Error(factura.error.message);
  if (!factura.data) return null;

  const [
    lineas,
    contacto,
    empresa,
    impuestos,
    asiento,
    numeraciones,
    pagos,
    aplicaciones,
    notasCredito,
    notasDebito,
    adjuntosRes,
    cotizacionOrigen,
  ] = await Promise.all([
    supabase
      .from("factura_lineas")
      .select(
        "id, producto_id, descripcion, cantidad, precio, descuento_pct, itbis_tasa, impuesto_id, subtotal, itbis, total",
      )
      .eq("factura_id", id)
      .order("id")
      .returns<FacturaLinea[]>(),
    supabase
      .from("contactos")
      .select("id, nombre, rnc_cedula, direccion, telefono")
      .eq("id", factura.data.contacto_id)
      .maybeSingle()
      .returns<ContactoResumen | null>(),
    empresaP,
    impuestosP,
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
    supabase
      .from("pago_recibido_aplicaciones")
      .select("pago_id, monto, pagos_recibidos(id, numero, fecha, metodo, estado)")
      .eq("factura_id", id)
      .returns<
        {
          pago_id: string;
          monto: number;
          pagos_recibidos: {
            id: string;
            numero: number;
            fecha: string;
            metodo: string;
            estado: EstadoDocumento;
          } | null;
        }[]
      >(),
    supabase
      .from("notas_credito_venta")
      .select("id, numero, ncf, fecha, total, estado")
      .eq("factura_id", id)
      .order("fecha")
      .returns<NotaVentaResumen[]>(),
    supabase
      .from("notas_debito_venta")
      .select("id, numero, ncf, fecha, total, estado")
      .eq("factura_id", id)
      .order("fecha")
      .returns<NotaVentaResumen[]>(),
    listarAdjuntos(supabase, "factura", id),
    getCotizacionOrigen(id),
  ]);

  if (lineas.error) throw new Error(lineas.error.message);
  if (contacto.error) throw new Error(contacto.error.message);
  if (numeraciones.error) throw new Error(numeraciones.error.message);
  if (pagos.error) throw new Error(pagos.error.message);
  if (aplicaciones.error) throw new Error(aplicaciones.error.message);
  if (notasCredito.error) throw new Error(notasCredito.error.message);
  if (notasDebito.error) throw new Error(notasDebito.error.message);
  if (adjuntosRes.error) throw new Error(adjuntosRes.error.message);
  if (!contacto.data) return null;

  const pagosAplicados: PagoFacturaVista[] = (aplicaciones.data ?? []).flatMap((aplicacion) => {
    const pago = aplicacion.pagos_recibidos;
    if (!pago) return [];
    return [
      {
        id: pago.id,
        numero: pago.numero,
        fecha: pago.fecha,
        metodo: pago.metodo as MetodoPagoVista,
        monto: aplicacion.monto,
        estado: pago.estado,
      },
    ];
  });
  const idsAplicados = new Set(pagosAplicados.map((pago) => pago.id));
  const pagosFactura = [...pagos.data.filter((pago) => !idsAplicados.has(pago.id)), ...pagosAplicados].sort(
    (a, b) => a.fecha.localeCompare(b.fecha) || a.numero - b.numero,
  );

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
    impuestos,
    contacto: contacto.data,
    empresa,
    asiento,
    ncfVence: numeracion?.vence ?? null,
    pagos: pagosFactura,
    notasCredito: notasCredito.data,
    notasDebito: notasDebito.data,
    adjuntos: adjuntosRes.data ?? [],
    cotizacionOrigen,
  };
}
