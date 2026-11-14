import { rutaCompra, rutaFactura, rutaGasto, rutaNotaCreditoVenta } from "@/lib/enlaces";
import { centavos } from "@/lib/reportes/dinero";
import { createClient } from "@/lib/supabase/server";

import { formasPagoVenta } from "./comun";
import type { DetalleImpuesto, DocumentoFiscal, RespuestaFiscal } from "./tipos";
import { formasPagoVacias } from "./tipos";

interface ContactoDb {
  nombre: string;
  rnc_cedula: string | null;
}

type ContactoEmbed = ContactoDb | ContactoDb[] | null;

interface LineaVentaDb {
  subtotal: number | string;
  itbis: number | string;
  itbis_tasa: number | string;
}

interface LineaCompraDb extends LineaVentaDb {
  producto_id: string | null;
  productos: { tipo: string } | { tipo: string }[] | null;
}

interface FacturaDb {
  id: string;
  numero: number;
  ncf: string;
  fecha: string;
  subtotal: number | string;
  itbis: number | string;
  total: number | string;
  pagado: number | string;
  credito: number | string;
  estado: string;
  tipo_comprobante: string;
  contacto_id: string;
  contactos: ContactoEmbed;
  factura_lineas: LineaVentaDb[] | null;
}

interface FacturaCompraDb {
  id: string;
  numero: number;
  ncf: string | null;
  fecha: string;
  subtotal: number | string;
  itbis: number | string;
  total: number | string;
  estado: string;
  contacto_id: string;
  contactos: ContactoEmbed;
  facturas_proveedor_lineas: LineaCompraDb[] | null;
}

interface GastoDb {
  id: string;
  numero: number;
  ncf: string | null;
  fecha: string;
  subtotal: number | string;
  itbis: number | string;
  itbis_tasa: number | string;
  total: number | string;
  estado: string;
  contacto_id: string | null;
  descripcion: string;
  contactos: ContactoEmbed;
}

interface NotaDb {
  id: string;
  numero: number;
  ncf: string;
  fecha: string;
  subtotal: number | string;
  itbis: number | string;
  total: number | string;
  estado: string;
  contacto_id: string;
  contactos: ContactoEmbed;
  facturas: { ncf: string } | { ncf: string }[] | null;
  nota_credito_venta_lineas: LineaVentaDb[] | null;
}

interface PagoDb {
  id: string;
  factura_id: string | null;
  metodo: string;
  monto: number | string;
}

interface AplicacionDb {
  pago_id: string;
  factura_id: string;
  monto: number | string;
  pagos_recibidos: { metodo: string; estado: string } | null;
}

interface AnuladoDb {
  id: string;
  numero: number;
  ncf: string | null;
  fecha: string;
  total: number | string;
  contacto_id: string | null;
  contactos: ContactoEmbed;
}

function nombreContacto(valor: ContactoEmbed): string {
  if (Array.isArray(valor)) return valor[0]?.nombre ?? "";
  if (valor == null) return "";
  return valor.nombre;
}

function rncContacto(valor: ContactoEmbed): string | null {
  if (Array.isArray(valor)) return valor[0]?.rnc_cedula ?? null;
  return valor?.rnc_cedula ?? null;
}

function tipoProducto(valor: { tipo: string } | { tipo: string }[] | null): string | null {
  if (Array.isArray(valor)) return valor[0]?.tipo ?? null;
  return valor?.tipo ?? null;
}

function ncfFactura(valor: { ncf: string } | { ncf: string }[] | null): string | null {
  if (Array.isArray(valor)) return valor[0]?.ncf ?? null;
  return valor?.ncf ?? null;
}

function tasa(valor: number | string): number {
  return Math.round(Number(valor));
}

function agruparDetalles(
  lineas: readonly { subtotal: number | string; itbis: number | string; itbis_tasa: number | string }[],
  documento: DocumentoFiscal,
  tipoDocumento: string,
  baseBienes: number,
  baseServicios: number,
): DetalleImpuesto[] {
  const porTasa = new Map<number, { base: number; impuesto: number }>();

  for (const linea of lineas) {
    const clave = tasa(linea.itbis_tasa);
    const grupo = porTasa.get(clave) ?? { base: 0, impuesto: 0 };
    grupo.base += centavos(linea.subtotal);
    grupo.impuesto += centavos(linea.itbis);
    porTasa.set(clave, grupo);
  }

  return [...porTasa.entries()].map(([clave, grupo]) => ({
    documentoId: documento.id,
    numero: documento.numero,
    ncf: documento.ncf,
    tipoDocumento,
    contactoId: documento.contactoId,
    contactoNombre: documento.contactoNombre,
    fecha: documento.fecha,
    tasa: clave,
    base: grupo.base,
    impuesto: grupo.impuesto,
    ruta: documento.ruta,
    tieneNcf: documento.ncf.trim() !== "",
    baseBienes,
    baseServicios,
  }));
}

export interface DatosVentas {
  documentos: DocumentoFiscal[];
  detalles: DetalleImpuesto[];
}

export async function obtenerVentas(desde: string, hasta: string): Promise<RespuestaFiscal<DatosVentas>> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("facturas")
    .select(
      "id, numero, ncf, fecha, subtotal, itbis, total, pagado, credito, estado, tipo_comprobante, contacto_id, contactos(nombre, rnc_cedula), factura_lineas(subtotal, itbis, itbis_tasa)",
    )
    .neq("estado", "anulada")
    .gte("fecha", desde)
    .lte("fecha", hasta)
    .order("fecha")
    .order("numero")
    .returns<FacturaDb[]>();

  if (error) return { datos: { documentos: [], detalles: [] }, error: error.message };

  const facturas = data ?? [];
  const ids = facturas.map((factura) => factura.id);
  const [pagosRes, aplicacionesRes] =
    ids.length === 0
      ? [{ data: [] as PagoDb[] }, { data: [] as AplicacionDb[] }]
      : await Promise.all([
          supabase
            .from("pagos_recibidos")
            .select("id, factura_id, metodo, monto")
            .in("factura_id", ids)
            .eq("estado", "activo")
            .returns<PagoDb[]>(),
          supabase
            .from("pago_recibido_aplicaciones")
            .select("pago_id, factura_id, monto, pagos_recibidos(metodo, estado)")
            .in("factura_id", ids)
            .returns<AplicacionDb[]>(),
        ]);

  const aplicaciones = (aplicacionesRes.data ?? []).filter(
    (aplicacion) => aplicacion.pagos_recibidos?.estado === "activo",
  );
  const conAplicaciones = new Set(aplicaciones.map((aplicacion) => aplicacion.pago_id));
  const pagosPorFactura = new Map<string, PagoDb[]>();
  const agregarPago = (pago: PagoDb) => {
    if (pago.factura_id == null) return;
    const lista = pagosPorFactura.get(pago.factura_id) ?? [];
    lista.push(pago);
    pagosPorFactura.set(pago.factura_id, lista);
  };

  for (const pago of pagosRes.data ?? []) {
    if (conAplicaciones.has(pago.id)) continue;
    agregarPago(pago);
  }
  for (const aplicacion of aplicaciones) {
    agregarPago({
      id: aplicacion.pago_id,
      factura_id: aplicacion.factura_id,
      metodo: aplicacion.pagos_recibidos?.metodo ?? "efectivo",
      monto: aplicacion.monto,
    });
  }

  const documentos: DocumentoFiscal[] = [];
  const detalles: DetalleImpuesto[] = [];

  for (const factura of facturas) {
    const total = centavos(factura.total);
    const pagado = centavos(factura.pagado);
    const credito = centavos(factura.credito);
    const pagosFactura = (pagosPorFactura.get(factura.id) ?? []).map((pago) => ({
      metodo: pago.metodo,
      monto: centavos(pago.monto),
    }));

    const documento: DocumentoFiscal = {
      id: factura.id,
      numero: factura.numero,
      ncf: factura.ncf,
      ncfModificado: null,
      fecha: factura.fecha,
      tipoComprobante: factura.tipo_comprobante,
      contactoId: factura.contacto_id,
      contactoNombre: nombreContacto(factura.contactos),
      rnc: rncContacto(factura.contactos),
      base: centavos(factura.subtotal),
      baseBienes: 0,
      baseServicios: 0,
      itbis: centavos(factura.itbis),
      total,
      pagado,
      credito,
      estado: factura.estado,
      clase: "venta",
      ruta: rutaFactura(factura.id),
      pagos: formasPagoVenta(total, pagado, credito, pagosFactura),
    };

    documentos.push(documento);
    detalles.push(...agruparDetalles(factura.factura_lineas ?? [], documento, "Venta", 0, 0));
  }

  return { datos: { documentos, detalles }, error: null };
}

export interface DatosCompras {
  documentos: DocumentoFiscal[];
  detalles: DetalleImpuesto[];
}

function convertirCompra(compra: FacturaCompraDb): { documento: DocumentoFiscal; detalles: DetalleImpuesto[] } {
  let baseBienes = 0;
  let baseServicios = 0;

  for (const linea of compra.facturas_proveedor_lineas ?? []) {
    const esBien = linea.producto_id != null && tipoProducto(linea.productos) === "producto";
    if (esBien) baseBienes += centavos(linea.subtotal);
    else baseServicios += centavos(linea.subtotal);
  }

  if (baseBienes + baseServicios === 0) baseServicios = centavos(compra.subtotal);

  const documento: DocumentoFiscal = {
    id: compra.id,
    numero: compra.numero,
    ncf: compra.ncf ?? "",
    ncfModificado: null,
    fecha: compra.fecha,
    tipoComprobante: "",
    contactoId: compra.contacto_id,
    contactoNombre: nombreContacto(compra.contactos),
    rnc: rncContacto(compra.contactos),
    base: centavos(compra.subtotal),
    baseBienes,
    baseServicios,
    itbis: centavos(compra.itbis),
    total: centavos(compra.total),
    pagado: 0,
    credito: 0,
    estado: compra.estado,
    clase: "compra",
    ruta: rutaCompra(compra.id),
    pagos: formasPagoVacias(),
  };

  return {
    documento,
    detalles: agruparDetalles(
      compra.facturas_proveedor_lineas ?? [],
      documento,
      "Factura de proveedor",
      baseBienes,
      baseServicios,
    ),
  };
}

function convertirGasto(gasto: GastoDb): { documento: DocumentoFiscal; detalles: DetalleImpuesto[] } {
  const documento: DocumentoFiscal = {
    id: gasto.id,
    numero: gasto.numero,
    ncf: gasto.ncf ?? "",
    ncfModificado: null,
    fecha: gasto.fecha,
    tipoComprobante: "13",
    contactoId: gasto.contacto_id,
    contactoNombre: nombreContacto(gasto.contactos),
    rnc: rncContacto(gasto.contactos),
    base: centavos(gasto.subtotal),
    baseBienes: 0,
    baseServicios: centavos(gasto.subtotal),
    itbis: centavos(gasto.itbis),
    total: centavos(gasto.total),
    pagado: 0,
    credito: 0,
    estado: gasto.estado,
    clase: "gasto",
    ruta: rutaGasto(gasto.id),
    pagos: formasPagoVacias(),
  };

  return {
    documento,
    detalles: [
      {
        documentoId: documento.id,
        numero: documento.numero,
        ncf: documento.ncf,
        tipoDocumento: "Gasto menor",
        contactoId: documento.contactoId,
        contactoNombre: documento.contactoNombre || gasto.descripcion,
        fecha: documento.fecha,
        tasa: tasa(gasto.itbis_tasa),
        base: documento.base,
        impuesto: documento.itbis,
        ruta: documento.ruta,
        tieneNcf: documento.ncf.trim() !== "",
        baseBienes: 0,
        baseServicios: documento.base,
      },
    ],
  };
}

export async function obtenerCompras(desde: string, hasta: string): Promise<RespuestaFiscal<DatosCompras>> {
  const supabase = await createClient();
  const [compras, gastos] = await Promise.all([
    supabase
      .from("facturas_proveedor")
      .select(
        "id, numero, ncf, fecha, subtotal, itbis, total, estado, contacto_id, contactos(nombre, rnc_cedula), facturas_proveedor_lineas(subtotal, itbis, itbis_tasa, producto_id, productos(tipo))",
      )
      .neq("estado", "anulada")
      .gte("fecha", desde)
      .lte("fecha", hasta)
      .order("fecha")
      .order("numero")
      .returns<FacturaCompraDb[]>(),
    supabase
      .from("gastos_menores")
      .select(
        "id, numero, ncf, fecha, subtotal, itbis, itbis_tasa, total, estado, contacto_id, descripcion, contactos(nombre, rnc_cedula)",
      )
      .neq("estado", "anulada")
      .gte("fecha", desde)
      .lte("fecha", hasta)
      .order("fecha")
      .order("numero")
      .returns<GastoDb[]>(),
  ]);

  const error = compras.error?.message ?? gastos.error?.message ?? null;
  if (error) return { datos: { documentos: [], detalles: [] }, error };

  const documentos: DocumentoFiscal[] = [];
  const detalles: DetalleImpuesto[] = [];

  for (const compra of compras.data ?? []) {
    const convertida = convertirCompra(compra);
    documentos.push(convertida.documento);
    detalles.push(...convertida.detalles);
  }

  for (const gasto of gastos.data ?? []) {
    const convertido = convertirGasto(gasto);
    documentos.push(convertido.documento);
    detalles.push(...convertido.detalles);
  }

  return { datos: { documentos, detalles }, error: null };
}

export async function obtenerDevolucionesVentas(desde: string, hasta: string): Promise<RespuestaFiscal<DatosVentas>> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("notas_credito_venta")
    .select(
      "id, numero, ncf, fecha, subtotal, itbis, total, estado, contacto_id, contactos(nombre, rnc_cedula), facturas(ncf), nota_credito_venta_lineas(subtotal, itbis, itbis_tasa)",
    )
    .eq("estado", "activa")
    .gte("fecha", desde)
    .lte("fecha", hasta)
    .order("fecha")
    .order("numero")
    .returns<NotaDb[]>();

  if (error) return { datos: { documentos: [], detalles: [] }, error: error.message };

  const documentos: DocumentoFiscal[] = [];
  const detalles: DetalleImpuesto[] = [];

  for (const nota of data ?? []) {
    const documento: DocumentoFiscal = {
      id: nota.id,
      numero: nota.numero,
      ncf: nota.ncf,
      ncfModificado: ncfFactura(nota.facturas),
      fecha: nota.fecha,
      tipoComprobante: "04",
      contactoId: nota.contacto_id,
      contactoNombre: nombreContacto(nota.contactos),
      rnc: rncContacto(nota.contactos),
      base: centavos(nota.subtotal),
      baseBienes: 0,
      baseServicios: 0,
      itbis: centavos(nota.itbis),
      total: centavos(nota.total),
      pagado: 0,
      credito: 0,
      estado: nota.estado,
      clase: "devolucion-venta",
      ruta: rutaNotaCreditoVenta(nota.id),
      pagos: formasPagoVacias(),
    };

    documentos.push(documento);
    detalles.push(...agruparDetalles(nota.nota_credito_venta_lineas ?? [], documento, "Nota de crédito", 0, 0));
  }

  return { datos: { documentos, detalles }, error: null };
}

export async function obtenerDevolucionesCompras(): Promise<RespuestaFiscal<DatosVentas>> {
  return { datos: { documentos: [], detalles: [] }, error: null };
}

export async function obtenerAnulados(desde: string, hasta: string): Promise<RespuestaFiscal<DocumentoFiscal[]>> {
  const supabase = await createClient();
  const [facturas, gastos, notas] = await Promise.all([
    supabase
      .from("facturas")
      .select("id, numero, ncf, fecha, total, contacto_id, contactos(nombre, rnc_cedula)")
      .eq("estado", "anulada")
      .gte("fecha", desde)
      .lte("fecha", hasta)
      .returns<AnuladoDb[]>(),
    supabase
      .from("gastos_menores")
      .select("id, numero, ncf, fecha, total, contacto_id, contactos(nombre, rnc_cedula)")
      .eq("estado", "anulada")
      .gte("fecha", desde)
      .lte("fecha", hasta)
      .returns<AnuladoDb[]>(),
    supabase
      .from("notas_credito_venta")
      .select("id, numero, ncf, fecha, total, contacto_id, contactos(nombre, rnc_cedula)")
      .eq("estado", "anulada")
      .gte("fecha", desde)
      .lte("fecha", hasta)
      .returns<AnuladoDb[]>(),
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

export interface DatosEmpresa {
  nombre: string;
  rnc: string | null;
  correo: string | null;
  telefono: string | null;
}

export async function obtenerEmpresa(): Promise<RespuestaFiscal<DatosEmpresa>> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("empresa")
    .select("nombre, rnc, correo, telefono")
    .eq("id", 1)
    .maybeSingle();

  const vacia: DatosEmpresa = { nombre: "MEDOXIGAS ALC, SRL", rnc: null, correo: null, telefono: null };
  if (error) return { datos: vacia, error: error.message };

  return {
    datos: {
      nombre: data?.nombre ?? vacia.nombre,
      rnc: data?.rnc ?? null,
      correo: data?.correo ?? null,
      telefono: data?.telefono ?? null,
    },
    error: null,
  };
}
