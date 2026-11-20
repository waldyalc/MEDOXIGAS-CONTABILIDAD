import { rutaCompra, rutaFactura, rutaGasto, rutaNotaCreditoVenta } from "@/lib/enlaces";
import { getImpuestosActivos } from "@/lib/impuestos/consultas";
import { etiquetaImpuesto, type Impuesto } from "@/lib/impuestos/tipos";
import { centavos } from "@/lib/reportes/dinero";
import { consultarEnLotes } from "@/lib/supabase/lotes";
import { paginarConsulta } from "@/lib/supabase/paginar";
import { createClient } from "@/lib/supabase/server";

import { type CatalogoCuentasDgii, resolverClasificacionCuenta, valorPrincipal } from "./clasificacion";
import { formasPagoVenta, itbisNotaCredito } from "./comun";
import { MOTIVO_SIN_TIPO_INGRESO, motivoCuentaSinClasificar } from "./excluidos";
import type { DetalleImpuesto, DocumentoFiscal, RespuestaFiscal } from "./tipos";
import { formasPagoVacias } from "./tipos";

export interface ContactoDb {
  nombre: string;
  rnc_cedula: string | null;
}

export type ContactoEmbed = ContactoDb | ContactoDb[] | null;

interface ProductoDgiiDb {
  tipo: string;
  inventariable: boolean;
  cuenta_ingreso_id: string | null;
  cuenta_inventario_id: string | null;
  cuenta_costo_id: string | null;
}

type ProductoEmbed = ProductoDgiiDb | ProductoDgiiDb[] | null;

interface LineaVentaDb {
  subtotal: number | string;
  itbis: number | string;
  itbis_tasa: number | string;
  impuesto_id: string | null;
  producto_id?: string | null;
  productos?: ProductoEmbed;
}

interface LineaCompraDb extends LineaVentaDb {
  cuenta_id: string | null;
  producto_id: string | null;
  productos: ProductoEmbed;
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
  retenido: number | string;
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
  pagado: number | string;
  retenido: number | string;
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
  cuenta_gasto_id: string;
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
  facturas: { ncf: string; fecha: string } | { ncf: string; fecha: string }[] | null;
  nota_credito_venta_lineas: LineaVentaDb[] | null;
}

interface PagoVenta {
  id: string;
  factura_id: string | null;
  metodo: string;
  monto: number | string;
  fecha: string;
}

interface PagoDb extends PagoVenta {
  facturas: { numero: number } | { numero: number }[] | null;
}

interface AplicacionDb {
  id: string;
  pago_id: string;
  factura_id: string;
  monto: number | string;
  pagos_recibidos: { metodo: string; estado: string; fecha: string } | null;
}

interface RetencionPagoDb {
  pago_id: string;
  monto: number | string;
  retenciones: { tipo: string } | { tipo: string }[] | null;
}

interface RetencionAplicacionDb {
  aplicacion_id: string;
  monto: number | string;
  retenciones: { tipo: string } | { tipo: string }[] | null;
}

interface PagoCompraDb {
  id: string;
  factura_proveedor_id: string | null;
  fecha: string;
  monto: number | string;
  estado: string;
}

interface AplicacionCompraDb {
  factura_proveedor_id: string;
  monto: number | string;
  pago_id: string;
  pagos_proveedor: { fecha: string; estado: string } | { fecha: string; estado: string }[] | null;
}

interface RetencionFactura {
  itbis: number;
  renta: number;
  fecha: string | null;
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

function productoDeLinea(valor: ProductoEmbed | undefined): ProductoDgiiDb | null {
  if (Array.isArray(valor)) return valor[0] ?? null;
  return valor ?? null;
}

function ncfFactura(valor: NotaDb["facturas"]): string | null {
  if (Array.isArray(valor)) return valor[0]?.ncf ?? null;
  return valor?.ncf ?? null;
}

function fechaFacturaNota(valor: NotaDb["facturas"]): string | null {
  if (Array.isArray(valor)) return valor[0]?.fecha ?? null;
  return valor?.fecha ?? null;
}

function tipoRetencion(valor: { tipo: string } | { tipo: string }[] | null): string | null {
  if (Array.isArray(valor)) return valor[0]?.tipo ?? null;
  return valor?.tipo ?? null;
}

function fechaPagoCompra(valor: AplicacionCompraDb["pagos_proveedor"]): string | null {
  if (Array.isArray(valor)) return valor[0]?.fecha ?? null;
  return valor?.fecha ?? null;
}

function estadoPagoCompra(valor: AplicacionCompraDb["pagos_proveedor"]): string | null {
  if (Array.isArray(valor)) return valor[0]?.estado ?? null;
  return valor?.estado ?? null;
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

async function getCatalogoCuentasDgii(): Promise<CatalogoCuentasDgii> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("cuentas")
    .select("id, codigo, nombre, padre_id, categoria_dgii, tipo_compra, tipo_ingreso")
    .order("codigo");

  if (error) throw new Error(error.message);
  return new Map((data ?? []).map((cuenta) => [cuenta.id, cuenta]));
}

async function getConfigContable(): Promise<ReadonlyMap<string, string>> {
  const supabase = await createClient();
  const { data, error } = await supabase.from("config_contable").select("clave, cuenta_id");

  if (error) throw new Error(error.message);
  return new Map((data ?? []).map((fila) => [fila.clave, fila.cuenta_id]));
}

function cuentaCompra(linea: LineaCompraDb, config: ReadonlyMap<string, string>): string | null {
  if (linea.cuenta_id != null) return linea.cuenta_id;

  const producto = productoDeLinea(linea.productos);
  if (producto == null) return config.get("gastos_generales") ?? null;
  if (producto.inventariable) return producto.cuenta_inventario_id ?? config.get("inventario") ?? null;
  return producto.cuenta_costo_id ?? config.get("gastos_generales") ?? null;
}

function cuentaVenta(linea: LineaVentaDb, config: ReadonlyMap<string, string>): string | null {
  const producto = productoDeLinea(linea.productos);
  if (producto?.cuenta_ingreso_id != null) return producto.cuenta_ingreso_id;

  const clave = producto?.tipo === "servicio" ? "ventas_servicios" : "ventas";
  return config.get(clave) ?? config.get("ventas") ?? null;
}

interface ClasificacionCompra {
  baseBienes: number;
  baseServicios: number;
  tipoBienes: string | null;
  exclusion: string | null;
}

/** Clasifica los renglones del 606 por la cuenta contable de cada línea. */
function clasificarCompra(
  lineas: readonly LineaCompraDb[],
  catalogo: CatalogoCuentasDgii,
  config: ReadonlyMap<string, string>,
  subtotal: number | string,
): ClasificacionCompra {
  let baseBienes = 0;
  let baseServicios = 0;
  let exclusion: string | null = null;
  let cuentaSinClasificar: string | null = null;
  const porCategoria = new Map<string, number>();

  for (const linea of lineas) {
    const clasificacion = resolverClasificacionCuenta(catalogo, cuentaCompra(linea, config));
    const monto = centavos(linea.subtotal);

    if (clasificacion == null || clasificacion.categoriaDgii == null || clasificacion.tipoCompra == null) {
      cuentaSinClasificar ??= clasificacion?.nombre ?? "del documento";
      continue;
    }

    if (clasificacion.tipoCompra === "bienes") baseBienes += monto;
    else baseServicios += monto;

    porCategoria.set(clasificacion.categoriaDgii, (porCategoria.get(clasificacion.categoriaDgii) ?? 0) + monto);
  }

  if (lineas.length === 0) cuentaSinClasificar ??= "del documento";
  if (cuentaSinClasificar != null) exclusion = motivoCuentaSinClasificar(cuentaSinClasificar);
  if (baseBienes + baseServicios === 0) baseServicios = centavos(subtotal);

  return {
    baseBienes,
    baseServicios,
    tipoBienes: valorPrincipal(porCategoria),
    exclusion,
  };
}

interface ClasificacionVenta {
  tipoIngreso: string | null;
  exclusion: string | null;
}

/** Clasifica los renglones del 607 por el tipo de ingreso de la cuenta. */
function clasificarVenta(
  lineas: readonly LineaVentaDb[],
  catalogo: CatalogoCuentasDgii,
  config: ReadonlyMap<string, string>,
): ClasificacionVenta {
  let exclusion: string | null = null;
  const porTipo = new Map<string, number>();

  const cuentas: (string | null)[] =
    lineas.length === 0 ? [config.get("ventas") ?? null] : lineas.map((linea) => cuentaVenta(linea, config));

  for (const [indice, cuentaId] of cuentas.entries()) {
    const clasificacion = resolverClasificacionCuenta(catalogo, cuentaId);
    const monto = lineas[indice] == null ? 0 : centavos(lineas[indice]?.subtotal ?? 0);

    if (clasificacion?.tipoIngreso == null) {
      exclusion = MOTIVO_SIN_TIPO_INGRESO;
      continue;
    }

    porTipo.set(clasificacion.tipoIngreso, (porTipo.get(clasificacion.tipoIngreso) ?? 0) + monto);
  }

  return { tipoIngreso: valorPrincipal(porTipo), exclusion };
}

/** Suma las retenciones por factura: ITBIS, renta y fecha de la primera retención. */
function acumularRetencion(
  mapa: Map<string, RetencionFactura>,
  facturaId: string | null,
  tipo: string | null,
  monto: number,
  fecha: string | null,
): void {
  if (facturaId == null || tipo == null) return;

  const actual = mapa.get(facturaId) ?? { itbis: 0, renta: 0, fecha: null };
  if (tipo === "itbis") actual.itbis += monto;
  else if (tipo === "isr") actual.renta += monto;
  if (fecha != null && (actual.fecha == null || fecha < actual.fecha)) actual.fecha = fecha;
  mapa.set(facturaId, actual);
}

interface PagosVenta {
  pagosPorFactura: Map<string, { metodo: string; monto: number }[]>;
  retencionesPorFactura: Map<string, RetencionFactura>;
}

interface PagosVentaBase {
  pagosPorFactura: Map<string, { metodo: string; monto: number }[]>;
  fechaPago: Map<string, string>;
  pagoPorFactura: Map<string, string | null>;
  facturaPorAplicacion: Map<string, string>;
  pagoPorAplicacion: Map<string, string>;
  idsPagoDirecto: string[];
  idsAplicacion: string[];
}

type ClienteSupabase = Awaited<ReturnType<typeof createClient>>;

async function getPagosVentaBase(
  supabase: ClienteSupabase,
  desde: string,
  hasta: string,
  facturas: readonly FacturaDb[],
): Promise<PagosVentaBase> {
  const pagosPorFactura = new Map<string, { metodo: string; monto: number }[]>();
  const fechaPago = new Map<string, string>();

  if (facturas.length === 0) {
    return {
      pagosPorFactura,
      fechaPago,
      pagoPorFactura: new Map(),
      facturaPorAplicacion: new Map(),
      pagoPorAplicacion: new Map(),
      idsPagoDirecto: [],
      idsAplicacion: [],
    };
  }

  const [pagosRes, aplicacionesRes] = await Promise.all([
    paginarConsulta((inicio, fin) =>
      supabase
        .from("pagos_recibidos")
        .select("id, factura_id, metodo, monto, fecha, facturas!inner(numero)")
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
        .select("id, pago_id, factura_id, monto, pagos_recibidos(metodo, estado, fecha), facturas!inner(numero)")
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

  const agregarPago = (facturaId: string | null, metodo: string, monto: string | number) => {
    if (facturaId == null) return;
    const lista = pagosPorFactura.get(facturaId) ?? [];
    lista.push({ metodo, monto: centavos(monto) });
    pagosPorFactura.set(facturaId, lista);
  };

  const pagosDirectos = (pagosRes.data ?? []).filter((pago) => !conAplicaciones.has(pago.id));
  for (const pago of pagosDirectos) {
    agregarPago(pago.factura_id, pago.metodo, pago.monto);
    fechaPago.set(pago.id, pago.fecha);
  }

  for (const aplicacion of aplicaciones) {
    const fecha = aplicacion.pagos_recibidos?.fecha ?? "";
    agregarPago(aplicacion.factura_id, aplicacion.pagos_recibidos?.metodo ?? "efectivo", aplicacion.monto);
    fechaPago.set(aplicacion.pago_id, fecha);
  }

  return {
    pagosPorFactura,
    fechaPago,
    pagoPorFactura: new Map((pagosRes.data ?? []).map((pago) => [pago.id, pago.factura_id])),
    facturaPorAplicacion: new Map(aplicaciones.map((aplicacion) => [aplicacion.id, aplicacion.factura_id] as const)),
    pagoPorAplicacion: new Map(aplicaciones.map((aplicacion) => [aplicacion.id, aplicacion.pago_id] as const)),
    idsPagoDirecto: pagosDirectos.map((pago) => pago.id),
    idsAplicacion: aplicaciones.map((aplicacion) => aplicacion.id),
  };
}

async function getRetencionesVenta(
  supabase: ClienteSupabase,
  base: PagosVentaBase,
): Promise<Map<string, RetencionFactura>> {
  const retencionesPorFactura = new Map<string, RetencionFactura>();

  const [retencionesPago, retencionesAplicacion] = await Promise.all([
    consultarEnLotes(base.idsPagoDirecto, (lote) =>
      supabase
        .from("pago_recibido_retenciones")
        .select("pago_id, monto, retenciones(tipo)")
        .in("pago_id", lote)
        .order("id")
        .returns<RetencionPagoDb[]>(),
    ),
    consultarEnLotes(base.idsAplicacion, (lote) =>
      supabase
        .from("pago_recibido_aplicacion_retenciones")
        .select("aplicacion_id, monto, retenciones(tipo)")
        .in("aplicacion_id", lote)
        .order("id")
        .returns<RetencionAplicacionDb[]>(),
    ),
  ]);

  // Una retención que no se pueda leer no tumba el reporte: se deja sin detalle.
  for (const fila of retencionesPago.data ?? []) {
    acumularRetencion(
      retencionesPorFactura,
      base.pagoPorFactura.get(fila.pago_id) ?? null,
      tipoRetencion(fila.retenciones),
      centavos(fila.monto),
      base.fechaPago.get(fila.pago_id) ?? null,
    );
  }
  for (const fila of retencionesAplicacion.data ?? []) {
    const pagoId = base.pagoPorAplicacion.get(fila.aplicacion_id);
    acumularRetencion(
      retencionesPorFactura,
      base.facturaPorAplicacion.get(fila.aplicacion_id) ?? null,
      tipoRetencion(fila.retenciones),
      centavos(fila.monto),
      pagoId == null ? null : (base.fechaPago.get(pagoId) ?? null),
    );
  }

  return retencionesPorFactura;
}

async function getPagosVenta(desde: string, hasta: string, facturas: readonly FacturaDb[]): Promise<PagosVenta> {
  const supabase = await createClient();
  const base = await getPagosVentaBase(supabase, desde, hasta, facturas);
  const retencionesPorFactura = await getRetencionesVenta(supabase, base);

  return { pagosPorFactura: base.pagosPorFactura, retencionesPorFactura };
}

export interface DatosVentas {
  documentos: DocumentoFiscal[];
  detalles: DetalleImpuesto[];
}

export async function obtenerVentas(desde: string, hasta: string): Promise<RespuestaFiscal<DatosVentas>> {
  const supabase = await createClient();
  const [{ data, error }, catalogo, cuentasDgii, config] = await Promise.all([
    paginarConsulta((inicio, fin) =>
      supabase
        .from("facturas")
        .select(
          "id, numero, ncf, fecha, subtotal, itbis, otros_impuestos, propina, total, pagado, credito, retenido, estado, tipo_comprobante, contacto_id, contactos(nombre, rnc_cedula), factura_lineas(subtotal, itbis, itbis_tasa, impuesto_id, producto_id, productos(tipo, cuenta_ingreso_id))",
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
    getCatalogoCuentasDgii(),
    getConfigContable(),
  ]);

  if (error) return { datos: { documentos: [], detalles: [] }, error: error.message };

  const facturas = data ?? [];
  const { pagosPorFactura, retencionesPorFactura } = await getPagosVenta(desde, hasta, facturas);

  const documentos: DocumentoFiscal[] = [];
  const detalles: DetalleImpuesto[] = [];

  for (const factura of facturas) {
    const total = centavos(factura.total);
    const pagado = centavos(factura.pagado);
    const pagosFactura = pagosPorFactura.get(factura.id) ?? [];
    const retencion = retencionesPorFactura.get(factura.id);
    const retenidoTotal = retencion == null ? centavos(factura.retenido) : retencion.itbis + retencion.renta;
    const clasificacion = clasificarVenta(factura.factura_lineas ?? [], cuentasDgii, config);

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
      credito: centavos(factura.credito),
      estado: factura.estado,
      clase: "venta",
      ruta: rutaFactura(factura.id),
      pagos: formasPagoVenta(total, retenidoTotal, pagado, pagosFactura),
      tipoIngreso: clasificacion.tipoIngreso,
      itbisRetenido: retencion?.itbis ?? 0,
      retencionRenta: retencion?.renta ?? 0,
      fechaRetencion: retencion?.fecha ?? null,
      exclusion: clasificacion.exclusion,
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

/** Fecha del primer pago y estado de pago de las compras (para la forma de pago 606). */
async function getPagosCompra(compras: readonly FacturaCompraDb[]): Promise<Map<string, string>> {
  const supabase = await createClient();
  const fechas = new Map<string, string>();
  const ids = compras.map((compra) => compra.id);
  if (ids.length === 0) return fechas;

  const [directos, aplicaciones] = await Promise.all([
    consultarEnLotes(ids, (lote) =>
      supabase
        .from("pagos_proveedor")
        .select("id, factura_proveedor_id, fecha, monto, estado")
        .in("factura_proveedor_id", lote)
        .eq("estado", "activo")
        .order("fecha")
        .returns<PagoCompraDb[]>(),
    ),
    consultarEnLotes(ids, (lote) =>
      supabase
        .from("pago_proveedor_aplicaciones")
        .select("factura_proveedor_id, monto, pago_id, pagos_proveedor(fecha, estado)")
        .in("factura_proveedor_id", lote)
        .order("pago_id")
        .returns<AplicacionCompraDb[]>(),
    ),
  ]);

  const registrar = (facturaId: string | null, fecha: string | null) => {
    if (facturaId == null || fecha == null || fecha === "") return;
    const anterior = fechas.get(facturaId);
    if (anterior == null || fecha < anterior) fechas.set(facturaId, fecha);
  };

  for (const pago of directos.data ?? []) registrar(pago.factura_proveedor_id, pago.fecha);
  for (const aplicacion of aplicaciones.data ?? []) {
    if (estadoPagoCompra(aplicacion.pagos_proveedor) !== "activo") continue;
    registrar(aplicacion.factura_proveedor_id, fechaPagoCompra(aplicacion.pagos_proveedor));
  }

  return fechas;
}

function convertirCompra(
  compra: FacturaCompraDb,
  catalogo: ReadonlyMap<string, Impuesto>,
  cuentasDgii: CatalogoCuentasDgii,
  config: ReadonlyMap<string, string>,
  fechaPago: string | null,
): { documento: DocumentoFiscal; detalles: DetalleImpuesto[] } {
  const clasificacion = clasificarCompra(compra.facturas_proveedor_lineas ?? [], cuentasDgii, config, compra.subtotal);
  const pagada = compra.estado === "pagada";

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
    baseBienes: clasificacion.baseBienes,
    baseServicios: clasificacion.baseServicios,
    itbis: centavos(compra.itbis),
    otrosImpuestos: centavos(compra.otros_impuestos),
    propina: centavos(compra.propina),
    total: centavos(compra.total),
    pagado: centavos(compra.pagado),
    credito: 0,
    estado: compra.estado,
    clase: "compra",
    ruta: rutaCompra(compra.id),
    pagos: formasPagoVacias(),
    tipoBienes: clasificacion.tipoBienes,
    fechaPago: pagada ? (fechaPago ?? compra.fecha) : null,
    exclusion: clasificacion.exclusion,
  };

  return {
    documento,
    detalles: agruparDetalles(
      compra.facturas_proveedor_lineas ?? [],
      documento,
      "Factura de proveedor",
      clasificacion.baseBienes,
      clasificacion.baseServicios,
      catalogo,
    ),
  };
}

function convertirGasto(
  gasto: GastoDb,
  catalogo: ReadonlyMap<string, Impuesto>,
  cuentasDgii: CatalogoCuentasDgii,
  config: ReadonlyMap<string, string>,
): { documento: DocumentoFiscal; detalles: DetalleImpuesto[] } {
  const clasificacion = clasificarCompra(
    [
      {
        subtotal: gasto.subtotal,
        itbis: gasto.itbis,
        itbis_tasa: gasto.itbis_tasa,
        impuesto_id: gasto.impuesto_id,
        producto_id: null,
        productos: null,
        cuenta_id: gasto.cuenta_gasto_id,
      },
    ],
    cuentasDgii,
    config,
    gasto.subtotal,
  );

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
    baseBienes: clasificacion.baseBienes,
    baseServicios: clasificacion.baseServicios,
    itbis: centavos(gasto.itbis),
    otrosImpuestos: centavos(gasto.otros_impuestos),
    propina: centavos(gasto.propina),
    total: centavos(gasto.total),
    pagado: centavos(gasto.total),
    credito: 0,
    estado: gasto.estado,
    clase: "gasto",
    ruta: rutaGasto(gasto.id),
    pagos: formasPagoVacias(),
    tipoBienes: clasificacion.tipoBienes,
    // El gasto menor se paga de caja al registrarse: contado y fecha del gasto.
    fechaPago: gasto.fecha,
    exclusion: clasificacion.exclusion,
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
              baseBienes: clasificacion.baseBienes,
              baseServicios: clasificacion.baseServicios,
            },
          ],
  };
}

export async function obtenerCompras(desde: string, hasta: string): Promise<RespuestaFiscal<DatosCompras>> {
  const supabase = await createClient();
  const [compras, gastos, catalogo, cuentasDgii, config] = await Promise.all([
    paginarConsulta((inicio, fin) =>
      supabase
        .from("facturas_proveedor")
        .select(
          "id, numero, ncf, fecha, subtotal, itbis, otros_impuestos, propina, total, pagado, retenido, estado, contacto_id, contactos(nombre, rnc_cedula), facturas_proveedor_lineas(subtotal, itbis, itbis_tasa, impuesto_id, producto_id, cuenta_id, productos(tipo, inventariable, cuenta_inventario_id, cuenta_costo_id))",
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
          "id, numero, ncf, fecha, subtotal, itbis, otros_impuestos, propina, itbis_tasa, impuesto_id, total, estado, contacto_id, cuenta_gasto_id, descripcion, contactos(nombre, rnc_cedula)",
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
    getCatalogoCuentasDgii(),
    getConfigContable(),
  ]);

  const error = compras.error?.message ?? gastos.error?.message ?? null;
  if (error) return { datos: { documentos: [], detalles: [] }, error };

  const fechasPago = await getPagosCompra(compras.data ?? []);
  const documentos: DocumentoFiscal[] = [];
  const detalles: DetalleImpuesto[] = [];

  for (const compra of compras.data ?? []) {
    const convertida = convertirCompra(compra, catalogo, cuentasDgii, config, fechasPago.get(compra.id) ?? null);
    documentos.push(convertida.documento);
    detalles.push(...convertida.detalles);
  }

  for (const gasto of gastos.data ?? []) {
    const convertido = convertirGasto(gasto, catalogo, cuentasDgii, config);
    documentos.push(convertido.documento);
    detalles.push(...convertido.detalles);
  }

  return { datos: { documentos, detalles }, error: null };
}

export async function obtenerDevolucionesVentas(desde: string, hasta: string): Promise<RespuestaFiscal<DatosVentas>> {
  const supabase = await createClient();
  const [{ data, error }, catalogo, cuentasDgii, config] = await Promise.all([
    paginarConsulta((inicio, fin) =>
      supabase
        .from("notas_credito_venta")
        .select(
          "id, numero, ncf, fecha, subtotal, itbis, otros_impuestos, propina, total, estado, contacto_id, contactos(nombre, rnc_cedula), facturas(ncf, fecha), nota_credito_venta_lineas(subtotal, itbis, itbis_tasa, impuesto_id, producto_id, productos(tipo, cuenta_ingreso_id))",
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
    getCatalogoCuentasDgii(),
    getConfigContable(),
  ]);

  if (error) return { datos: { documentos: [], detalles: [] }, error: error.message };

  const documentos: DocumentoFiscal[] = [];
  const detalles: DetalleImpuesto[] = [];

  for (const nota of data ?? []) {
    const fechaFactura = fechaFacturaNota(nota.facturas);
    const clasificacion = clasificarVenta(nota.nota_credito_venta_lineas ?? [], cuentasDgii, config);
    const itbis = itbisNotaCredito(centavos(nota.itbis), fechaFactura, nota.fecha);

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
      itbis,
      otrosImpuestos: centavos(nota.otros_impuestos),
      propina: centavos(nota.propina),
      total: centavos(nota.total),
      pagado: 0,
      credito: 0,
      estado: nota.estado,
      clase: "devolucion-venta",
      ruta: rutaNotaCreditoVenta(nota.id),
      pagos: formasPagoVacias(),
      tipoIngreso: clasificacion.tipoIngreso,
      exclusion: clasificacion.exclusion,
    };

    documentos.push(documento);
    detalles.push(
      ...agruparDetalles(nota.nota_credito_venta_lineas ?? [], documento, "Nota de crédito", 0, 0, catalogo),
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
