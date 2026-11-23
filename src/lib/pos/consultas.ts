import { cache } from "react";

import { mensajeErrorRpc } from "@/lib/facturacion/errores";
import { buscarProductoPorCodigoBarra, listarCatalogoPos } from "@/lib/inventario/ferreteria/consultas";
import { decimal, textoONulo } from "@/lib/inventario/ferreteria/mapeo";
import { numeroDocumento, patronIlike } from "@/lib/listas/busqueda";
import { contactosQueCoinciden } from "@/lib/listas/coincidencias";
import {
  type ResultadoPagina,
  rangoPagina,
  resumirPagina,
  TAMANO_PAGINA_DEFECTO,
  TAMANOS_PAGINA,
} from "@/lib/listas/parametros";
import { consultarEnLotes } from "@/lib/supabase/lotes";
import { paginarConsulta } from "@/lib/supabase/paginar";
import { createClient } from "@/lib/supabase/server";

import { normalizarRnc, RNC_CONSUMIDOR_FINAL } from "./consumidor-final";
import {
  esquemaBusquedaCodigoPOS,
  esquemaCatalogoPOS,
  esquemaCotizacionesAbiertas,
  esquemaFiltrosHistorial,
  idSchema,
} from "./esquemas";
import {
  esquemasRpcPOS,
  type FilaCotizacionAbierta,
  type FilaHistorialPOS,
  type FilaTerminal,
  type FilaTurno,
  mapearCotizacionAbierta,
  mapearHistorialPOS,
  mapearResumenTurnoVista,
  mapearTerminal,
  mapearTurno,
  metodoPagoDB,
} from "./mapeo";
import {
  type CotizacionAbiertaPOS,
  type Decimal,
  type HistorialPOSFila,
  type MetodoPagoDB,
  MOTIVOS_MOVIMIENTO_POS,
  type MotivoMovimientoPOS,
  type ProductoPOS,
  type ProductoPOSCodigo,
  type ResumenTurnoVista,
  type TerminalPOS,
  type TipoMovimientoPOS,
  type TurnoPOS,
} from "./tipos";

/**
 * Error de una lectura del POS. Conserva el SQLSTATE para que la UI distinga
 * «POS no instalado» (`42P01`, `42883`) de un fallo de red o de RLS.
 */
export class ErrorPOS extends Error {
  readonly codigo: string | null;

  constructor(mensaje: string, codigo?: string | null) {
    super(mensaje);
    this.name = "ErrorPOS";
    this.codigo = codigo ?? null;
  }
}

const COLUMNAS_TERMINAL =
  "id, nombre, almacen_id, cuenta_efectivo_id, cuenta_tarjeta_debito_id, cuenta_tarjeta_credito_id, " +
  "cuenta_transferencia_id, numeracion_defecto_id, lista_precio_defecto_id, contacto_defecto_id, " +
  "centro_costo_id, plantilla_ticket, activa, creado_en, actualizado_en";

const COLUMNAS_TURNO =
  "id, numero, terminal_id, abierto_por, cerrado_por, abierto_en, cerrado_en, estado, base_inicial, " +
  "efectivo_esperado, efectivo_real, diferencia, asiento_diferencia_id, observaciones";

/** Todas las terminales, activas e inactivas, ordenadas por nombre. */
export async function getTerminales(): Promise<TerminalPOS[]> {
  const supabase = await createClient();
  const { data, error } = await paginarConsulta((inicio, fin) =>
    supabase
      .from("pos_terminales")
      .select(COLUMNAS_TERMINAL)
      .order("nombre")
      .order("id")
      .range(inicio, fin)
      .returns<FilaTerminal[]>(),
  );

  if (error) throw new ErrorPOS(mensajeErrorRpc(error));

  return (data ?? []).map(mapearTerminal);
}

/** Una terminal por id; `null` si no existe o el id no es válido. */
export async function getTerminal(id: string): Promise<TerminalPOS | null> {
  if (!idSchema.safeParse(id).success) return null;

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("pos_terminales")
    .select(COLUMNAS_TERMINAL)
    .eq("id", id)
    .maybeSingle<FilaTerminal>();

  if (error) throw new ErrorPOS(mensajeErrorRpc(error), error.code);
  return data ? mapearTerminal(data) : null;
}

/**
 * Id del contacto «Consumidor final» por su RNC normalizado. Es el cliente con
 * el que arranca toda venta nueva del POS, como Alegra. Si la lectura falla o
 * el contacto no existe, el POS cae al contacto por defecto de la terminal.
 */
export const getConsumidorFinalId = cache(async (): Promise<string | null> => {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("contactos")
    .select("id, rnc_cedula")
    .eq("activo", true)
    .in("tipo", ["cliente", "ambos"])
    .eq("rnc_cedula", RNC_CONSUMIDOR_FINAL)
    .order("nombre")
    .limit(1)
    .maybeSingle<{ id: string; rnc_cedula: string | null }>();

  if (error || !data) return null;
  return normalizarRnc(data.rnc_cedula) === RNC_CONSUMIDOR_FINAL ? data.id : null;
});

/** Turno abierto de la terminal; `null` si no hay. El índice único garantiza uno solo. */
export async function getTurnoAbierto(terminalId: string): Promise<TurnoPOS | null> {
  if (!idSchema.safeParse(terminalId).success) return null;

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("pos_turnos")
    .select(COLUMNAS_TURNO)
    .eq("terminal_id", terminalId)
    .eq("estado", "abierto")
    .maybeSingle<FilaTurno>();

  if (error) throw new ErrorPOS(mensajeErrorRpc(error), error.code);
  return data ? mapearTurno(data) : null;
}

/**
 * Resumen del turno con la fórmula del servidor (`pos_resumen_turno`). Si el
 * turno está cerrado, el esperado viene congelado y `congelado = true`.
 */
export async function getResumenTurno(turnoId: string): Promise<ResumenTurnoVista | null> {
  if (!idSchema.safeParse(turnoId).success) return null;

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("pos_resumen_turno", { p_turno_id: turnoId });

  if (error) throw new ErrorPOS(mensajeErrorRpc(error), error.code);

  const resultado = esquemasRpcPOS.resumen.safeParse(data);
  if (!resultado.success) throw new ErrorPOS("La respuesta del turno no tiene el formato esperado.");

  return mapearResumenTurnoVista(resultado.data);
}

/**
 * Facturas del POS paginadas. Los métodos de pago de la página se leen en un
 * segundo lote por ids (nunca una consulta por factura).
 */
export async function getHistorialPOS(filtros: unknown = {}): Promise<ResultadoPagina<HistorialPOSFila>> {
  const resultado = esquemaFiltrosHistorial.safeParse(filtros ?? {});
  if (!resultado.success) {
    return { filas: [], resumen: resumirPagina(1, TAMANO_PAGINA_DEFECTO, 0) };
  }

  const datos = resultado.data;
  const supabase = await createClient();

  const turnoEmbed = datos.terminal_id
    ? "pos_turnos!inner(numero, pos_terminales!inner(id, nombre))"
    : "pos_turnos(numero, pos_terminales(id, nombre))";

  let consulta = supabase
    .from("facturas")
    .select(
      "id, numero, ncf, tipo_comprobante, fecha, creado_en, contacto_id, turno_id, estado, total, pagado, " +
        `retenido, credito, contactos(nombre), ${turnoEmbed}`,
      { count: "exact" },
    )
    .eq("origen", "pos");

  if (datos.desde) consulta = consulta.gte("fecha", datos.desde);
  if (datos.hasta) consulta = consulta.lte("fecha", datos.hasta);
  if (datos.estado) consulta = consulta.eq("estado", datos.estado);
  if (datos.terminal_id) consulta = consulta.eq("pos_turnos.terminal_id", datos.terminal_id);

  if (datos.q) {
    const condiciones = [`ncf.ilike.${patronIlike(datos.q)}`];
    const numero = numeroDocumento(datos.q);
    if (numero != null) condiciones.push(`numero.eq.${numero}`);

    const contactos = await contactosQueCoinciden(supabase, datos.q, ["cliente", "ambos"]);
    if (contactos.length > 0) condiciones.push(`contacto_id.in.(${contactos.join(",")})`);

    consulta = consulta.or(condiciones.join(","));
  }

  const { desde, hasta } = rangoPagina(datos.pagina, datos.tamano);
  const { data, error, count } = await consulta
    .order("fecha", { ascending: false })
    .order("numero", { ascending: false })
    .order("id", { ascending: false })
    .range(desde, hasta)
    .returns<FilaHistorialPOS[]>();

  if (error) throw new ErrorPOS(mensajeErrorRpc(error), error.code);

  const filas = data ?? [];
  const metodos = await metodosDeFacturas(filas.map((fila) => fila.id));

  return {
    filas: filas.map((fila) => mapearHistorialPOS(fila, metodos.get(fila.id) ?? [])),
    resumen: resumirPagina(datos.pagina, datos.tamano, count ?? filas.length),
  };
}

/** Métodos de pago activos de varias facturas, agrupados por factura. */
async function metodosDeFacturas(ids: readonly string[]): Promise<Map<string, MetodoPagoDB[]>> {
  const mapa = new Map<string, MetodoPagoDB[]>();
  if (ids.length === 0) return mapa;

  const supabase = await createClient();
  const { data, error } = await consultarEnLotes(ids, (lote) =>
    supabase.from("pagos_recibidos").select("factura_id, metodo, estado").in("factura_id", lote).eq("estado", "activo"),
  );

  if (error) throw new ErrorPOS(mensajeErrorRpc(error));

  for (const pago of data ?? []) {
    if (!pago.factura_id) continue;
    const lista = mapa.get(pago.factura_id) ?? [];
    lista.push(metodoPagoDB(pago.metodo));
    mapa.set(pago.factura_id, lista);
  }

  return mapa;
}

/** Cotizaciones abiertas para cargarlas en el carrito del POS. */
export async function getCotizacionesAbiertas(filtros: unknown = {}): Promise<CotizacionAbiertaPOS[]> {
  const resultado = esquemaCotizacionesAbiertas.safeParse(filtros ?? {});
  if (!resultado.success) return [];

  const datos = resultado.data;
  const supabase = await createClient();

  let consulta = supabase
    .from("cotizaciones")
    .select("id, numero, contacto_id, fecha, vencimiento, total, estado, vendedor_id, contactos(nombre)")
    .eq("estado", "abierta");

  if (datos.contacto_id) consulta = consulta.eq("contacto_id", datos.contacto_id);

  if (datos.q) {
    const numero = numeroDocumento(datos.q);
    const contactos = await contactosQueCoinciden(supabase, datos.q, ["cliente", "ambos"]);

    if (numero != null) {
      consulta = consulta.eq("numero", numero);
    } else if (contactos.length > 0) {
      consulta = consulta.in("contacto_id", contactos);
    } else {
      return [];
    }
  }

  const { data, error } = await paginarConsulta((inicio, fin) =>
    consulta
      .order("fecha", { ascending: false })
      .order("numero", { ascending: false })
      .order("id")
      .range(inicio, fin)
      .returns<FilaCotizacionAbierta[]>(),
  );

  if (error) throw new ErrorPOS(mensajeErrorRpc(error));

  return (data ?? []).map(mapearCotizacionAbierta);
}

/**
 * Catálogo del POS: reutiliza `pos_catalogo_productos` de la fase 1. Si la UI
 * manda `terminal_id`, el almacén y la lista salen de la terminal (la RPC cae
 * al almacén principal solo cuando no recibe ninguno).
 */
export async function getProductosPOS(entrada: unknown = {}): Promise<ProductoPOS[]> {
  const resultado = esquemaCatalogoPOS.safeParse(entrada ?? {});
  if (!resultado.success) return [];

  const datos = resultado.data;
  let almacenId = datos.almacen_id;
  let listaId = datos.lista_precio_id;

  if (datos.terminal_id && (!almacenId || !listaId)) {
    const terminal = await getTerminal(datos.terminal_id);
    if (terminal) {
      almacenId = almacenId ?? terminal.almacen_id;
      listaId = listaId ?? terminal.lista_precio_defecto_id ?? undefined;
    }
  }

  return listarCatalogoPos({
    busqueda: datos.busqueda,
    categoria_id: datos.categoria_id,
    solo_favoritos: datos.solo_favoritos,
    limit: datos.limit,
    offset: datos.offset,
    ...(almacenId ? { almacen_id: almacenId } : {}),
    ...(listaId ? { lista_precio_id: listaId } : {}),
  });
}

/** Pistola del POS: código exacto. `null` cuando no hay coincidencia. */
export async function buscarProductoPorCodigo(entrada: unknown): Promise<ProductoPOSCodigo | null> {
  const resultado = esquemaBusquedaCodigoPOS.safeParse(entrada);
  if (!resultado.success) return null;

  const datos = resultado.data;
  let almacenId = datos.almacen_id;
  let listaId = datos.lista_precio_id;

  if (datos.terminal_id && (!almacenId || !listaId)) {
    const terminal = await getTerminal(datos.terminal_id);
    if (terminal) {
      almacenId = almacenId ?? terminal.almacen_id;
      listaId = listaId ?? terminal.lista_precio_defecto_id ?? undefined;
    }
  }

  return buscarProductoPorCodigoBarra({
    codigo: datos.codigo,
    ...(almacenId ? { almacen_id: almacenId } : {}),
    ...(listaId ? { lista_precio_id: listaId } : {}),
  });
}

// ---------------------------------------------------------------------------
// Registro de pagos (v1: recibos de caja de la terminal)
// ---------------------------------------------------------------------------

/** Filtros del listado paginado de `pos_turno_movimientos` de una terminal. */
export interface FiltrosPagosPOS {
  terminalId: string;
  /** Ingresos = `ingreso`; Egresos = `retiro`. Cualquier otro valor cae a `ingreso`. */
  tipo: TipoMovimientoPOS;
  /** Número de recibo; un texto sin dígitos devuelve una página vacía. */
  q?: string;
  pagina?: number;
  tamano?: number;
}

/** Recibo de ingreso/egreso del turno en el Registro de pagos. */
export interface PagoPOSFila {
  id: string;
  numero: number;
  turno_id: string;
  turno_numero: number | null;
  tipo: TipoMovimientoPOS;
  motivo: MotivoMovimientoPOS;
  monto: Decimal;
  cuenta_contrapartida_id: string;
  cuenta_nombre: string | null;
  contacto_id: string | null;
  contacto_nombre: string | null;
  factura_id: string | null;
  factura_numero: number | null;
  factura_ncf: string | null;
  gasto_menor_id: string | null;
  pago_recibido_id: string | null;
  asiento_id: string;
  notas: string | null;
  creado_en: string;
  creado_por: string;
  /** Los recibos con su pago o gasto anulado quedan fuera de los totales. */
  vigente: boolean;
}

interface FilaPagoPOS {
  id: string;
  numero: number;
  turno_id: string;
  tipo: string;
  motivo: string;
  monto: number | string;
  cuenta_contrapartida_id: string;
  contacto_id: string | null;
  factura_id: string | null;
  gasto_menor_id: string | null;
  pago_recibido_id: string | null;
  asiento_id: string;
  notas: string | null;
  creado_en: string;
  creado_por: string;
  pos_turnos: { numero: number } | null;
  cuentas: { nombre: string } | null;
  contactos: { nombre: string } | null;
  facturas: { numero: number; ncf: string | null } | null;
  pagos_recibidos: { estado: string } | null;
  gastos_menores: { estado: string } | null;
}

function motivoPagoPOS(valor: string): MotivoMovimientoPOS {
  return MOTIVOS_MOVIMIENTO_POS.find((motivo) => motivo === valor) ?? "otro";
}

function mapearPagoPOS(fila: FilaPagoPOS): PagoPOSFila {
  const vigente =
    (fila.pago_recibido_id === null || fila.pagos_recibidos?.estado === "activo") &&
    (fila.gasto_menor_id === null || fila.gastos_menores?.estado === "activo");

  return {
    id: fila.id,
    numero: fila.numero,
    turno_id: fila.turno_id,
    turno_numero: fila.pos_turnos?.numero ?? null,
    tipo: fila.tipo === "retiro" ? "retiro" : "ingreso",
    motivo: motivoPagoPOS(fila.motivo),
    monto: decimal(fila.monto),
    cuenta_contrapartida_id: fila.cuenta_contrapartida_id,
    cuenta_nombre: textoONulo(fila.cuentas?.nombre),
    contacto_id: fila.contacto_id,
    contacto_nombre: textoONulo(fila.contactos?.nombre),
    factura_id: fila.factura_id,
    factura_numero: fila.facturas?.numero ?? null,
    factura_ncf: textoONulo(fila.facturas?.ncf),
    gasto_menor_id: fila.gasto_menor_id,
    pago_recibido_id: fila.pago_recibido_id,
    asiento_id: fila.asiento_id,
    notas: textoONulo(fila.notas),
    creado_en: fila.creado_en,
    creado_por: fila.creado_por,
    vigente,
  };
}

/**
 * Recibos de caja de la terminal (de todos sus turnos), del más nuevo al más
 * viejo, paginados con conteo exacto como el resto de listas. La vigencia
 * replica la regla de `pos_resumen_turno`: un recibo ligado a un pago o a un
 * gasto anulado ya no suma en el efectivo esperado.
 */
export async function getPagosPOS(filtros: FiltrosPagosPOS): Promise<ResultadoPagina<PagoPOSFila>> {
  const pagina = Math.max(1, Math.trunc(filtros.pagina ?? 1));
  const tamano = TAMANOS_PAGINA.find((opcion) => opcion === filtros.tamano) ?? TAMANO_PAGINA_DEFECTO;
  const vacia = { filas: [], resumen: resumirPagina(pagina, tamano, 0) };

  if (!idSchema.safeParse(filtros.terminalId).success) return vacia;

  const numero = filtros.q?.trim() ? numeroDocumento(filtros.q) : null;
  if (filtros.q?.trim() && numero === null) return vacia;

  const supabase = await createClient();
  let consulta = supabase
    .from("pos_turno_movimientos")
    .select(
      "id, numero, turno_id, tipo, motivo, monto, cuenta_contrapartida_id, contacto_id, factura_id, " +
        "pago_recibido_id, gasto_menor_id, asiento_id, notas, creado_en, creado_por, " +
        "pos_turnos!inner(numero), cuentas(nombre), contactos(nombre), facturas(numero, ncf), " +
        "pagos_recibidos(estado), gastos_menores(estado)",
      { count: "exact" },
    )
    .eq("pos_turnos.terminal_id", filtros.terminalId)
    .eq("tipo", filtros.tipo === "retiro" ? "retiro" : "ingreso");

  if (numero !== null) consulta = consulta.eq("numero", numero);

  const { desde, hasta } = rangoPagina(pagina, tamano);
  const { data, error, count } = await consulta
    .order("numero", { ascending: false })
    .range(desde, hasta)
    .returns<FilaPagoPOS[]>();

  if (error) throw new ErrorPOS(mensajeErrorRpc(error), error.code);

  const filas = data ?? [];
  return { filas: filas.map(mapearPagoPOS), resumen: resumirPagina(pagina, tamano, count ?? filas.length) };
}
