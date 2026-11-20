import { rutaCompra, rutaFactura, rutaGasto, rutaNotaCreditoVenta } from "@/lib/enlaces";
import { getImpuestosActivos } from "@/lib/impuestos/consultas";
import { etiquetaImpuesto, type Impuesto } from "@/lib/impuestos/tipos";
import { centavos } from "@/lib/reportes/dinero";
import { paginarConsulta } from "@/lib/supabase/paginar";
import { createClient } from "@/lib/supabase/server";

import { formasPagoVenta } from "./comun";
import type { DetalleImpuesto, DocumentoFiscal, RespuestaFiscal } from "./tipos";
import { formasPagoVacias } from "./tipos";

export interface ContactoDb {
  nombre: string;
  rnc_cedula: string | null;
}

export type ContactoEmbed = ContactoDb | ContactoDb[] | null;

interface LineaVentaDb {
  subtotal: number | string;
  itbis: number | string;
  itbis_tasa: number | string;
  impuesto_id: string | null;
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
  otros_impuestos: number | string;
  propina: number | string;
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
  otros_impuestos: number | string;
  propina: number | string;
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
  otros_impuestos: number | string;
  propina: number | string;
  itbis_tasa: number | string;
  impuesto_id: string | null;
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
  otros_impuestos: number | string;
  propina: number | string;
  total: number | string;
  estado: string;
  contacto_id: string;
  contactos: ContactoEmbed;
  facturas: { ncf: string } | { ncf: string }[] | null;
  nota_credito_venta_lineas: LineaVentaDb[] | null;
}

interface PagoVenta {
  id: string;
  factura_id: string | null;
  metodo: string;
  monto: number | string;
}

interface PagoDb extends PagoVenta {
  facturas: { numero: number } | { numero: number }[] | null;
}

interface AplicacionDb {
  id: string;
  pago_id: string;
  factura_id: string;
  monto: number | string;
  facturas: { numero: number } | { numero: number }[] | null;
  pagos_recibidos: { metodo: string; estado: string } | null;
}

export function nombreContacto(valor: ContactoEmbed): string {
  if (Array.isArray(valor)) return valor[0]?.nombre ?? "";
  if (valor == null) return "";
  return valor.nombre;
}

export function rncContacto(valor: ContactoEmbed): string | null {
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

interface ImpuestoLinea {
  tipo: DetalleImpuesto["tipo"];
  nombre: string;
  tasa: number | null;
}

function impuestoDeLinea(
  linea: { impuesto_id: string | null; itbis_tasa: number | string },
  catalogo: ReadonlyMap<string, Impuesto>,
): ImpuestoLinea | null {
  const impuesto = linea.impuesto_id ? catalogo.get(linea.impuesto_id) : undefined;
  if (impuesto) {
    if (impuesto.tipo === "ninguno") return null;
    return {
      tipo: impuesto.tipo,
      nombre: etiquetaImpuesto(impuesto),
      tasa: impuesto.tipo === "exento" ? null : impuesto.tarifa,
    };
  }

  const tarifa = tasa(linea.itbis_tasa);
  if (tarifa === 2) return { tipo: "otro", nombre: "CDT (2.00%)", tasa: 2 };
  if (tarifa === 10) return { tipo: "propina", nombre: "Propina (10.00%)", tasa: 10 };
  return { tipo: "itbis", nombre: `ITBIS (${tarifa.toFixed(2)}%)`, tasa: tarifa };
}

function agruparDetalles(
  lineas: readonly LineaVentaDb[],
  documento: DocumentoFiscal,
  tipoDocumento: string,
  baseBienes: number,
  baseServicios: number,
  catalogo: ReadonlyMap<string, Impuesto>,
): DetalleImpuesto[] {
  const grupos = new Map<string, { impuesto: ImpuestoLinea; base: number; impuestoTotal: number }>();

  for (const linea of lineas) {
    const impuesto = impuestoDeLinea(linea, catalogo);
    if (impuesto == null) continue;
    const clave = `${impuesto.tipo}:${impuesto.tasa ?? "exento"}:${impuesto.nombre}`;
    const grupo = grupos.get(clave) ?? { impuesto, base: 0, impuestoTotal: 0 };
    grupo.base += centavos(linea.subtotal);
    grupo.impuestoTotal += centavos(linea.itbis);
    grupos.set(clave, grupo);
  }

  return [...grupos.values()].map((grupo) => ({
    documentoId: documento.id,
    numero: documento.numero,
    ncf: documento.ncf,
    tipoDocumento,
    contactoId: documento.contactoId,
    contactoNombre: documento.contactoNombre,
    fecha: documento.fecha,
    tasa: grupo.impuesto.tasa,
    tipo: grupo.impuesto.tipo,
    impuestoNombre: grupo.impuesto.nombre,
    base: grupo.base,
    impuesto: grupo.impuestoTotal,
    ruta: documento.ruta,
    tieneNcf: documento.ncf.trim() !== "",
    baseBienes,
    baseServicios,
  }));
}

async function getCatalogoImpuestos(): Promise<Map<string, Impuesto>> {
  const impuestos = await getImpuestosActivos();
  return new Map(impuestos.map((impuesto) => [impuesto.id, impuesto]));
}

export interface DatosVentas {
  documentos: DocumentoFiscal[];
  detalles: DetalleImpuesto[];
}

export async function obtenerVentas(desde: string, hasta: string): Promise<RespuestaFiscal<DatosVentas>> {
  const supabase = await createClient();
  const [{ data, error }, catalogo] = await Promise.all([
    paginarConsulta((inicio, fin) =>
      supabase
        .from("facturas")
        .select(
          "id, numero, ncf, fecha, subtotal, itbis, otros_impuestos, propina, total, pagado, credito, estado, tipo_comprobante, contacto_id, contactos(nombre, rnc_cedula), factura_lineas(subtotal, itbis, itbis_tasa, impuesto_id)",
        )
        .neq("estado", "anulada")
        .gte("fecha", desde)
        .lte("fecha", hasta)
        .order("fecha")
        .order("numero")
        .range(inicio, fin)
        .returns<FacturaDb[]>(),
    ),
    getCatalogoImpuestos(),
  ]);

  if (error) return { datos: { documentos: [], detalles: [] }, error: error.message };

  const facturas = data ?? [];
  const [pagosRes, aplicacionesRes] =
    facturas.length === 0
      ? [{ data: [] as PagoDb[] }, { data: [] as AplicacionDb[] }]
      : await Promise.all([
          paginarConsulta((inicio, fin) =>
            supabase
              .from("pagos_recibidos")
              .select("id, factura_id, metodo, monto, facturas!inner(numero)")
              .eq("estado", "activo")
              .gte("facturas.fecha", desde)
              .lte("facturas.fecha", hasta)
              .neq("facturas.estado", "anulada")
              .order("numero")
              .range(inicio, fin)
              .returns<PagoDb[]>(),
          ),
          paginarConsulta((inicio, fin) =>
            supabase
              .from("pago_recibido_aplicaciones")
              .select("id, pago_id, factura_id, monto, pagos_recibidos(metodo, estado), facturas!inner(numero)")
              .gte("facturas.fecha", desde)
              .lte("facturas.fecha", hasta)
              .neq("facturas.estado", "anulada")
              .order("id")
              .range(inicio, fin)
              .returns<AplicacionDb[]>(),
          ),
        ]);

  const aplicaciones = (aplicacionesRes.data ?? []).filter(
    (aplicacion) => aplicacion.pagos_recibidos?.estado === "activo",
  );
  const conAplicaciones = new Set(aplicaciones.map((aplicacion) => aplicacion.pago_id));
  const pagosPorFactura = new Map<string, PagoVenta[]>();
  const agregarPago = (pago: PagoVenta) => {
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
      otrosImpuestos: centavos(factura.otros_impuestos),
      propina: centavos(factura.propina),
      total,
      pagado,
      credito,
      estado: factura.estado,
      clase: "venta",
      ruta: rutaFactura(factura.id),
      pagos: formasPagoVenta(total, pagado, credito, pagosFactura),
    };

    documentos.push(documento);
    detalles.push(...agruparDetalles(factura.factura_lineas ?? [], documento, "Venta", 0, 0, catalogo));
  }

  return { datos: { documentos, detalles }, error: null };
}

export interface DatosCompras {
  documentos: DocumentoFiscal[];
  detalles: DetalleImpuesto[];
}

function convertirCompra(
  compra: FacturaCompraDb,
  catalogo: ReadonlyMap<string, Impuesto>,
): { documento: DocumentoFiscal; detalles: DetalleImpuesto[] } {
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
    otrosImpuestos: centavos(compra.otros_impuestos),
    propina: centavos(compra.propina),
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
      catalogo,
    ),
  };
}

function convertirGasto(
  gasto: GastoDb,
  catalogo: ReadonlyMap<string, Impuesto>,
): { documento: DocumentoFiscal; detalles: DetalleImpuesto[] } {
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
    otrosImpuestos: centavos(gasto.otros_impuestos),
    propina: centavos(gasto.propina),
    total: centavos(gasto.total),
    pagado: 0,
    credito: 0,
    estado: gasto.estado,
    clase: "gasto",
    ruta: rutaGasto(gasto.id),
    pagos: formasPagoVacias(),
  };

  const impuesto = impuestoDeLinea(gasto, catalogo);

  return {
    documento,
    detalles:
      impuesto == null
        ? []
        : [
            {
              documentoId: documento.id,
              numero: documento.numero,
              ncf: documento.ncf,
              tipoDocumento: "Gasto menor",
              contactoId: documento.contactoId,
              contactoNombre: documento.contactoNombre || gasto.descripcion,
              fecha: documento.fecha,
              tasa: impuesto.tasa,
              tipo: impuesto.tipo,
              impuestoNombre: impuesto.nombre,
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
  const [compras, gastos, catalogo] = await Promise.all([
    paginarConsulta((inicio, fin) =>
      supabase
        .from("facturas_proveedor")
        .select(
          "id, numero, ncf, fecha, subtotal, itbis, otros_impuestos, propina, total, estado, contacto_id, contactos(nombre, rnc_cedula), facturas_proveedor_lineas(subtotal, itbis, itbis_tasa, impuesto_id, producto_id, productos(tipo))",
        )
        .neq("estado", "anulada")
        .gte("fecha", desde)
        .lte("fecha", hasta)
        .order("fecha")
        .order("numero")
        .range(inicio, fin)
        .returns<FacturaCompraDb[]>(),
    ),
    paginarConsulta((inicio, fin) =>
      supabase
        .from("gastos_menores")
        .select(
          "id, numero, ncf, fecha, subtotal, itbis, otros_impuestos, propina, itbis_tasa, impuesto_id, total, estado, contacto_id, descripcion, contactos(nombre, rnc_cedula)",
        )
        .neq("estado", "anulada")
        .gte("fecha", desde)
        .lte("fecha", hasta)
        .order("fecha")
        .order("numero")
        .range(inicio, fin)
        .returns<GastoDb[]>(),
    ),
    getCatalogoImpuestos(),
  ]);

  const error = compras.error?.message ?? gastos.error?.message ?? null;
  if (error) return { datos: { documentos: [], detalles: [] }, error };

  const documentos: DocumentoFiscal[] = [];
  const detalles: DetalleImpuesto[] = [];

  for (const compra of compras.data ?? []) {
    const convertida = convertirCompra(compra, catalogo);
    documentos.push(convertida.documento);
    detalles.push(...convertida.detalles);
  }

  for (const gasto of gastos.data ?? []) {
    const convertido = convertirGasto(gasto, catalogo);
    documentos.push(convertido.documento);
    detalles.push(...convertido.detalles);
  }

  return { datos: { documentos, detalles }, error: null };
}

export async function obtenerDevolucionesVentas(desde: string, hasta: string): Promise<RespuestaFiscal<DatosVentas>> {
  const supabase = await createClient();
  const [{ data, error }, catalogo] = await Promise.all([
    paginarConsulta((inicio, fin) =>
      supabase
        .from("notas_credito_venta")
        .select(
          "id, numero, ncf, fecha, subtotal, itbis, otros_impuestos, propina, total, estado, contacto_id, contactos(nombre, rnc_cedula), facturas(ncf), nota_credito_venta_lineas(subtotal, itbis, itbis_tasa, impuesto_id)",
        )
        .eq("estado", "activa")
        .gte("fecha", desde)
        .lte("fecha", hasta)
        .order("fecha")
        .order("numero")
        .range(inicio, fin)
        .returns<NotaDb[]>(),
    ),
    getCatalogoImpuestos(),
  ]);

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
      otrosImpuestos: centavos(nota.otros_impuestos),
      propina: centavos(nota.propina),
      total: centavos(nota.total),
      pagado: 0,
      credito: 0,
      estado: nota.estado,
      clase: "devolucion-venta",
      ruta: rutaNotaCreditoVenta(nota.id),
      pagos: formasPagoVacias(),
    };

    documentos.push(documento);
    detalles.push(
      ...agruparDetalles(nota.nota_credito_venta_lineas ?? [], documento, "Nota de crAcdito", 0, 0, catalogo),
    );
  }

  return { datos: { documentos, detalles }, error: null };
}

export async function obtenerDevolucionesCompras(): Promise<RespuestaFiscal<DatosVentas>> {
  return { datos: { documentos: [], detalles: [] }, error: null };
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
