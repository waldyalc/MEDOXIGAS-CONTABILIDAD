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

import { derivarEstadoEmisionFactura, type EnvioEcfFactura, type FiltroEmisionFactura } from "./emision-ecf";
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
  envio: EnvioEcfFactura | null;
}

interface FacturaListaConContacto extends FacturaLista {
  contactos: { nombre: string } | null;
}

type ClienteSupabase = Awaited<ReturnType<typeof createClient>>;

export interface OpcionesFacturasLista extends OpcionesLista {
  emision?: FiltroEmisionFactura;
}

export interface ResumenEmisionFacturas {
  sinEmision: number;
  enProceso: number;
}

// cache() dedupe la consulta de la empresa dentro de la misma petición.
export const getEmpresa = cache(async (): Promise<Empresa | null> => {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("empresa")
    .select("*")
    .eq("id", 1)
    .maybeSingle()
    .returns<Empresa | null>();

  if (error) throw new Error(error.message);
  return data;
});

/**
 * Todos los clientes activos, sin el tope de 1,000 filas de PostgREST: el POS
 * los guarda completos en IndexedDB y busca en local sin pedir nada al servidor.
 */
export async function getContactosClientes(): Promise<ContactoResumen[]> {
  const supabase = await createClient();
  const { data, error } = await paginarConsulta((inicio, fin) =>
    supabase
      .from("contactos")
      .select("id, nombre, rnc_cedula, direccion, telefono, lista_precio_id")
      .eq("activo", true)
      .in("tipo", ["cliente", "ambos"])
      .order("nombre")
      .order("id")
      .range(inicio, fin)
      .returns<ContactoResumen[]>(),
  );

  if (error) throw new Error(error.message);
  return data ?? [];
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

const TAMANO_LOTE_ELECTRONICAS = 500;

const CAMPOS_ENVIO_ECF =
  "id, rnc_emisor, documento_tipo, documento_id, tipo_ecf, encf, es_rfce, ambiente, estado, track_id, codigo_seguridad, url_qr, fecha_hora_firma, mensajes, intentos, ultimo_intento_at, updated_at";

function agruparEnviosRecientes(filas: readonly EnvioEcfFactura[]): Map<string, EnvioEcfFactura> {
  const envios = new Map<string, EnvioEcfFactura>();
  for (const envio of filas) {
    if (!envio.documento_id) continue;
    const actual = envios.get(envio.documento_id);
    if (!actual || envio.updated_at >= actual.updated_at) envios.set(envio.documento_id, envio);
  }
  return envios;
}

async function getEnviosFacturas(
  supabase: ClienteSupabase,
  ids: readonly string[],
): Promise<Map<string, EnvioEcfFactura>> {
  if (ids.length === 0) return new Map();
  const resultado = await consultarEnLotes(ids, (lote) =>
    supabase
      .from("ecf_envios")
      .select(CAMPOS_ENVIO_ECF)
      .eq("documento_tipo", "factura")
      .in("documento_id", lote)
      .order("updated_at", { ascending: false })
      .returns<EnvioEcfFactura[]>(),
  );
  if (resultado.error) throw new Error(resultado.error.message);
  return agruparEnviosRecientes(resultado.data ?? []);
}

function serializarFilas(
  filas: readonly FacturaListaConContacto[],
  envios: Map<string, EnvioEcfFactura>,
): FacturaFila[] {
  return filas.map(({ contactos, ...factura }) => ({
    ...factura,
    cliente_nombre: contactos?.nombre ?? "—",
    envio: envios.get(factura.id) ?? null,
  }));
}

function paginarFilasFacturas(
  filas: readonly FacturaListaConContacto[],
  envios: Map<string, EnvioEcfFactura>,
  opciones: OpcionesFacturasLista,
): ResultadoPagina<FacturaFila> {
  const resumen = resumirPagina(opciones.pagina, opciones.tamano, filas.length);
  const inicio = (resumen.pagina - 1) * opciones.tamano;
  return { filas: serializarFilas(filas.slice(inicio, inicio + opciones.tamano), envios), resumen };
}

export async function getResumenEmisionFacturas(): Promise<ResumenEmisionFacturas> {
  const supabase = await createClient();
  const [electronicas, activos, procesos] = await Promise.all([
    supabase.from("facturas").select("id", { count: "exact", head: true }).ilike("ncf", "E%"),
    supabase
      .from("ecf_envios")
      .select("id", { count: "exact", head: true })
      .eq("documento_tipo", "factura")
      .not("documento_id", "is", null)
      .in("estado", ["pendiente", "en_proceso", "aceptado", "aceptado_condicional"]),
    supabase
      .from("ecf_envios")
      .select("id", { count: "exact", head: true })
      .eq("documento_tipo", "factura")
      .not("documento_id", "is", null)
      .in("estado", ["pendiente", "en_proceso"]),
  ]);

  if (electronicas.error) throw new Error(electronicas.error.message);
  if (activos.error) throw new Error(activos.error.message);
  if (procesos.error) throw new Error(procesos.error.message);

  return {
    sinEmision: Math.max(0, (electronicas.count ?? 0) - (activos.count ?? 0)),
    enProceso: procesos.count ?? 0,
  };
}

// biome-ignore lint/complexity/noExcessiveCognitiveComplexity: La lista aplica búsqueda, paginación y los dos filtros operativos de emisión sin consultas N+1; los caminos deben compartir el mismo mapeo de filas.
export async function getFacturasLista(
  opciones: OpcionesFacturasLista = OPCIONES_LISTA_DEFECTO,
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

  if (opciones.emision === "en_proceso") {
    const enviosRes = await paginarConsulta((inicio, fin) =>
      supabase
        .from("ecf_envios")
        .select(CAMPOS_ENVIO_ECF)
        .eq("documento_tipo", "factura")
        .not("documento_id", "is", null)
        .in("estado", ["pendiente", "en_proceso"])
        .order("documento_id")
        .order("id")
        .range(inicio, fin)
        .returns<EnvioEcfFactura[]>(),
    );
    if (enviosRes.error) throw new Error(enviosRes.error.message);

    const envios = agruparEnviosRecientes(enviosRes.data ?? []);
    const ids = [...envios.keys()];
    if (ids.length === 0) return paginarFilasFacturas([], envios, opciones);

    const candidatas = await consultarEnLotes(ids, (lote) => {
      let consultaLote = supabase.from("facturas").select(CAMPOS_FACTURA_LISTA).in("id", lote);
      if (filtro) consultaLote = consultaLote.or(filtro);
      return consultaLote.order("numero", { ascending: false }).returns<FacturaListaConContacto[]>();
    });
    if (candidatas.error) throw new Error(candidatas.error.message);

    const filtradas = (candidatas.data ?? [])
      .filter((factura) => derivarEstadoEmisionFactura(factura.ncf, envios.get(factura.id)) === "en_proceso")
      .sort((a, b) => b.numero - a.numero);
    return paginarFilasFacturas(filtradas, envios, opciones);
  }

  if (opciones.emision === "sin_emision") {
    const filtradas: FacturaListaConContacto[] = [];
    const envios = new Map<string, EnvioEcfFactura>();
    let anterior: number | null = null;

    for (;;) {
      let consultaLote = supabase
        .from("facturas")
        .select(CAMPOS_FACTURA_LISTA)
        .ilike("ncf", "E%")
        .order("numero", { ascending: false })
        .limit(TAMANO_LOTE_ELECTRONICAS);
      if (filtro) consultaLote = consultaLote.or(filtro);
      if (anterior !== null) consultaLote = consultaLote.lt("numero", anterior);

      const { data, error } = await consultaLote.returns<FacturaListaConContacto[]>();
      if (error) throw new Error(error.message);
      const lote = data ?? [];
      if (lote.length === 0) break;

      const enviosLote = await getEnviosFacturas(
        supabase,
        lote.map((factura) => factura.id),
      );
      for (const [id, envio] of enviosLote) envios.set(id, envio);
      for (const factura of lote) {
        const estado = derivarEstadoEmisionFactura(factura.ncf, enviosLote.get(factura.id));
        if (estado === "sin_emision" || estado === "rechazada") filtradas.push(factura);
      }

      if (lote.length < TAMANO_LOTE_ELECTRONICAS) break;
      anterior = lote[lote.length - 1]?.numero ?? null;
      if (anterior === null) break;
    }

    return paginarFilasFacturas(filtradas, envios, opciones);
  }

  const primera = await consultar(opciones.pagina);
  const resumen = resumirPagina(opciones.pagina, opciones.tamano, primera.total);
  const filas =
    resumen.pagina !== opciones.pagina && primera.filas.length === 0
      ? (await consultar(resumen.pagina)).filas
      : primera.filas;
  const envios = await getEnviosFacturas(
    supabase,
    filas.map((factura) => factura.id),
  );

  return { filas: serializarFilas(filas, envios), resumen };
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

// biome-ignore lint/complexity/noExcessiveCognitiveComplexity: El detalle agrega en paralelo las relaciones contables, comerciales, adjuntos y de emisión necesarias para renderizar la factura completa.
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
    envioRes,
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
    supabase
      .from("ecf_envios")
      .select(`${CAMPOS_ENVIO_ECF}, xml_firmado`)
      .eq("documento_tipo", "factura")
      .eq("documento_id", id)
      .order("updated_at", { ascending: false })
      .limit(1)
      .maybeSingle()
      .returns<(EnvioEcfFactura & { xml_firmado: string | null }) | null>(),
  ]);

  if (lineas.error) throw new Error(lineas.error.message);
  if (contacto.error) throw new Error(contacto.error.message);
  if (numeraciones.error) throw new Error(numeraciones.error.message);
  if (pagos.error) throw new Error(pagos.error.message);
  if (aplicaciones.error) throw new Error(aplicaciones.error.message);
  if (notasCredito.error) throw new Error(notasCredito.error.message);
  if (notasDebito.error) throw new Error(notasDebito.error.message);
  if (adjuntosRes.error) throw new Error(adjuntosRes.error.message);
  if (envioRes.error) throw new Error(envioRes.error.message);
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

  const envio = envioRes.data
    ? (() => {
        const { xml_firmado: xmlFirmado, ...resto } = envioRes.data;
        return { ...resto, tiene_xml: Boolean(xmlFirmado?.trim()) };
      })()
    : null;

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
    envio,
  };
}
