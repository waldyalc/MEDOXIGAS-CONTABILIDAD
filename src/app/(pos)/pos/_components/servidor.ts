import { cache } from "react";

import { cookies } from "next/headers";

import { getPerfil, type Perfil } from "@/lib/auth/rol";
import { patronIlike } from "@/lib/listas/busqueda";
import { contactosQueCoinciden } from "@/lib/listas/coincidencias";
import { condicionesDocumento } from "@/lib/listas/documento";
import { type ResultadoPagina, rangoPagina, resumirPagina, TAMANO_PAGINA_DEFECTO } from "@/lib/listas/parametros";
import { centavosATexto, centavosDeDecimal } from "@/lib/pos/calculo";
import { getTerminales, getTurnoAbierto } from "@/lib/pos/consultas";
import { type FilaTurno, mapearTurno } from "@/lib/pos/mapeo";
import type { TerminalPOS, TurnoPOS } from "@/lib/pos/tipos";
import { consultarEnLotes } from "@/lib/supabase/lotes";
import { createClient } from "@/lib/supabase/server";

import type {
  DatosDevolucionPOS,
  DetalleVentaPOS,
  DevolucionPOSDetalle,
  DevolucionPOSFila,
  FacturaCandidataPOS,
  LineaDevolucionDetalle,
  PagoDetallePOS,
  TurnoDetallePOS,
} from "./tipos";

/**
 * Lecturas del shell y de las pantallas del POS que la capa 2B no expone
 * (listas de cierres, notas de crédito del POS y datos del detalle).
 *
 * Todas usan el cliente de servidor con RLS (`createClient`), son de solo
 * lectura y viven aquí, junto a la ruta que las consume, para no tocar
 * `src/lib/**` (propiedad de 2B).
 */

export const COOKIE_TERMINAL = "pos_terminal_id";

export type EstadoPOS = "ok" | "no-instalado" | "sin-terminales" | "error";

export interface ContextoPOS {
  perfil: Perfil | null;
  estado: EstadoPOS;
  terminales: TerminalPOS[];
  terminal: TerminalPOS | null;
  turno: TurnoPOS | null;
}

const COLUMNAS_TURNO =
  "id, numero, terminal_id, abierto_por, cerrado_por, abierto_en, cerrado_en, estado, base_inicial, " +
  "efectivo_esperado, efectivo_real, diferencia, asiento_diferencia_id, observaciones";

/** Sesión, terminal activa (cookie `pos_terminal_id`) y turno abierto. */
export const getContextoPOS = cache(async (): Promise<ContextoPOS> => {
  const perfil = await getPerfil();
  const supabase = await createClient();

  // Sondeo barato: distingue «POS no instalado» (42P01/42883) de un fallo de red.
  const sonda = await supabase.from("pos_terminales").select("id").limit(1);
  const noInstalado =
    sonda.error?.code === "42P01" ||
    sonda.error?.code === "42883" ||
    sonda.error?.code === "PGRST205" ||
    /could not find the table|does not exist/i.test(sonda.error?.message ?? "");
  if (noInstalado) {
    return { perfil, estado: "no-instalado", terminales: [], terminal: null, turno: null };
  }
  if (sonda.error) {
    return { perfil, estado: "error", terminales: [], terminal: null, turno: null };
  }

  let terminales: TerminalPOS[];

  try {
    terminales = await getTerminales();
  } catch {
    return { perfil, estado: "error", terminales: [], terminal: null, turno: null };
  }

  const activas = terminales.filter((terminal) => terminal.activa);
  const cookie = (await cookies()).get(COOKIE_TERMINAL)?.value;
  const terminal = activas.find((candidata) => candidata.id === cookie) ?? activas[0] ?? null;

  if (!terminal) {
    return { perfil, estado: "sin-terminales", terminales, terminal: null, turno: null };
  }

  let turno: TurnoPOS | null = null;
  try {
    turno = await getTurnoAbierto(terminal.id);
  } catch {
    // El turno se puede volver a consultar desde la pantalla de Turnos.
  }

  return { perfil, estado: "ok", terminales, terminal, turno };
});

/** Terminales activas e inactivas, sin lanzar si el POS no está instalado. */
export async function getTerminalesSeguro(): Promise<TerminalPOS[]> {
  try {
    return await getTerminales();
  } catch {
    return [];
  }
}

export interface CuentaPOS {
  id: string;
  codigo: string;
  nombre: string;
  tipo: string;
  es_caja_banco: boolean;
}

/** Cuentas de detalle activas que aceptan movimientos (turno y gastos). */
export async function getCuentasPOS(): Promise<CuentaPOS[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("cuentas")
    .select("id, codigo, nombre, tipo, es_caja_banco")
    .eq("activa", true)
    .eq("acepta_movimientos", true)
    .order("codigo")
    .returns<CuentaPOS[]>();

  if (error) throw new Error(error.message);
  return data;
}

/** Último turno de la terminal, abierto o cerrado. */
export async function getUltimoTurno(terminalId: string): Promise<TurnoPOS | null> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("pos_turnos")
    .select(COLUMNAS_TURNO)
    .eq("terminal_id", terminalId)
    .order("numero", { ascending: false })
    .limit(1)
    .maybeSingle<FilaTurno>();

  if (error) throw new Error(error.message);
  return data ? mapearTurno(data) : null;
}

export interface OpcionesCierresPOS {
  terminalId: string;
  todas: boolean;
  pagina: number;
  tamano: number;
}

/** Cierres de turno paginados (esta terminal o todas). */
export async function getCierresPOS(opciones: OpcionesCierresPOS): Promise<ResultadoPagina<TurnoPOS>> {
  const supabase = await createClient();
  let consulta = supabase.from("pos_turnos").select(COLUMNAS_TURNO, { count: "exact" }).eq("estado", "cerrado");

  if (!opciones.todas) consulta = consulta.eq("terminal_id", opciones.terminalId);

  const { desde, hasta } = rangoPagina(opciones.pagina, opciones.tamano);
  const { data, error, count } = await consulta
    .order("numero", { ascending: false })
    .range(desde, hasta)
    .returns<FilaTurno[]>();

  if (error) throw new Error(error.message);

  const filas = (data ?? []).map(mapearTurno);
  return { filas, resumen: resumirPagina(opciones.pagina, opciones.tamano, count ?? filas.length) };
}

export interface FiltrosDevolucionesPOS {
  q?: string;
  desde?: string;
  hasta?: string;
  estado?: "activa" | "anulada";
  pagina?: number;
  tamano?: number;
}

interface FilaDevolucion {
  id: string;
  numero: number;
  ncf: string;
  fecha: string;
  total: number;
  estado: string;
  factura_id: string;
  contacto_id: string;
  turno_id: string | null;
  tipo_reembolso: string;
  monto_reembolso_efectivo: number;
  facturas: { numero: number; ncf: string | null } | null;
  contactos: { nombre: string } | null;
  pos_turnos: { numero: number } | null;
}

function tipoReembolsoPOS(valor: string): "credito_factura" | "efectivo" | "combinado" {
  return valor === "efectivo" || valor === "combinado" ? valor : "credito_factura";
}

/** Notas de crédito creadas desde el POS (`turno_id` no nulo). */
export async function getDevolucionesPOS(
  filtros: FiltrosDevolucionesPOS = {},
): Promise<ResultadoPagina<DevolucionPOSFila>> {
  const pagina = filtros.pagina ?? 1;
  const tamano = filtros.tamano ?? TAMANO_PAGINA_DEFECTO;
  const supabase = await createClient();
  const q = filtros.q?.trim() ?? "";
  const [idsContactos, idsFacturas] = q
    ? await Promise.all([
        contactosQueCoinciden(supabase, q, ["cliente", "ambos"]),
        supabase
          .from("facturas")
          .select("id")
          .or(`ncf.ilike.${patronIlike(q)}`)
          .limit(200)
          .then((resultado) => (resultado.data ?? []).map((fila) => fila.id)),
      ])
    : [[], []];
  const filtro = condicionesDocumento({ q, idsContactos, idsFacturas });

  let consulta = supabase
    .from("notas_credito_venta")
    .select(
      "id, numero, ncf, fecha, total, estado, factura_id, contacto_id, turno_id, tipo_reembolso, " +
        "monto_reembolso_efectivo, facturas(numero, ncf), contactos(nombre), pos_turnos(numero)",
      { count: "exact" },
    )
    .not("turno_id", "is", null);

  if (filtros.desde) consulta = consulta.gte("fecha", filtros.desde);
  if (filtros.hasta) consulta = consulta.lte("fecha", filtros.hasta);
  if (filtros.estado) consulta = consulta.eq("estado", filtros.estado);
  if (filtro) consulta = consulta.or(filtro);

  const { desde, hasta } = rangoPagina(pagina, tamano);
  const { data, error, count } = await consulta
    .order("numero", { ascending: false })
    .range(desde, hasta)
    .returns<FilaDevolucion[]>();

  if (error) throw new Error(error.message);

  const filas = (data ?? []).map<DevolucionPOSFila>((fila) => ({
    id: fila.id,
    numero: fila.numero,
    ncf: fila.ncf,
    fecha: fila.fecha,
    total: centavosATexto(centavosDeDecimal(String(fila.total)) ?? 0),
    estado: fila.estado === "anulada" ? "anulada" : "activa",
    factura_id: fila.factura_id,
    factura_numero: fila.facturas?.numero ?? 0,
    factura_ncf: fila.facturas?.ncf ?? null,
    contacto_id: fila.contacto_id,
    cliente_nombre: fila.contactos?.nombre ?? "—",
    tipo_reembolso: tipoReembolsoPOS(fila.tipo_reembolso),
    monto_reembolso_efectivo: centavosATexto(centavosDeDecimal(String(fila.monto_reembolso_efectivo)) ?? 0),
    turno_numero: fila.pos_turnos?.numero ?? null,
  }));

  return { filas, resumen: resumirPagina(pagina, tamano, count ?? filas.length) };
}

interface FilaDevolucionDetalle {
  id: string;
  numero: number;
  ncf: string;
  fecha: string;
  subtotal: number;
  itbis: number;
  total: number;
  estado: string;
  tipo_reembolso: string;
  monto_reembolso_efectivo: number;
  cuenta_reembolso_id: string | null;
  turno_id: string | null;
  notas: string | null;
  factura_id: string;
  contacto_id: string;
  facturas: {
    numero: number;
    ncf: string | null;
    total: number;
    pagado: number;
    credito: number;
    estado: string;
  } | null;
  contactos: { nombre: string; rnc_cedula: string | null } | null;
  pos_turnos: { numero: number } | null;
}

interface FilaDevolucionLinea {
  id: string;
  factura_linea_id: string;
  producto_id: string | null;
  descripcion: string;
  cantidad: number;
  unidad_nombre: string | null;
  factor_base: number;
  precio: number;
  descuento_pct: number;
  itbis_tasa: number;
  subtotal: number;
  itbis: number;
  total: number;
  costo_unitario: number;
}

function decimalDeNumero(valor: number | string | null | undefined): string {
  return centavosATexto(centavosDeDecimal(String(valor ?? 0)) ?? 0);
}

/** Detalle completo de una nota de crédito del POS para el Sheet y el ticket. */
export async function getDevolucionPOS(id: string): Promise<DevolucionPOSDetalle | null> {
  if (!/^[0-9a-f-]{36}$/i.test(id)) return null;

  const supabase = await createClient();
  const [nota, lineas] = await Promise.all([
    supabase
      .from("notas_credito_venta")
      .select(
        "id, numero, ncf, fecha, subtotal, itbis, total, estado, tipo_reembolso, monto_reembolso_efectivo, " +
          "cuenta_reembolso_id, turno_id, notas, factura_id, contacto_id, " +
          "facturas(numero, ncf, total, pagado, credito, estado), contactos(nombre, rnc_cedula), pos_turnos(numero)",
      )
      .eq("id", id)
      .maybeSingle<FilaDevolucionDetalle>(),
    supabase
      .from("nota_credito_venta_lineas")
      .select(
        "id, factura_linea_id, producto_id, descripcion, cantidad, unidad_nombre, factor_base, precio, " +
          "descuento_pct, itbis_tasa, subtotal, itbis, total, costo_unitario",
      )
      .eq("nota_id", id)
      .order("orden")
      .returns<FilaDevolucionLinea[]>(),
  ]);

  if (nota.error) throw new Error(nota.error.message);
  if (lineas.error) throw new Error(lineas.error.message);
  if (!nota.data) return null;

  const fila = nota.data;
  const factura = fila.facturas;
  const totalFactura = centavosDeDecimal(String(factura?.total ?? 0)) ?? 0;
  const pagado = centavosDeDecimal(String(factura?.pagado ?? 0)) ?? 0;
  const credito = centavosDeDecimal(String(factura?.credito ?? 0)) ?? 0;

  const detalleLineas: LineaDevolucionDetalle[] = lineas.data.map((linea) => ({
    id: linea.id,
    factura_linea_id: linea.factura_linea_id,
    producto_id: linea.producto_id,
    descripcion: linea.descripcion,
    cantidad: decimalDeNumero(linea.cantidad),
    unidad_nombre: linea.unidad_nombre,
    factor_base: linea.factor_base == null ? null : decimalDeNumero(linea.factor_base),
    precio: decimalDeNumero(linea.precio),
    descuento_pct: decimalDeNumero(linea.descuento_pct),
    itbis_tasa: decimalDeNumero(linea.itbis_tasa),
    subtotal: decimalDeNumero(linea.subtotal),
    itbis: decimalDeNumero(linea.itbis),
    total: decimalDeNumero(linea.total),
    costo_unitario: linea.costo_unitario == null ? null : decimalDeNumero(linea.costo_unitario),
  }));

  return {
    nota: {
      id: fila.id,
      numero: fila.numero,
      ncf: fila.ncf,
      fecha: fila.fecha,
      subtotal: decimalDeNumero(fila.subtotal),
      itbis: decimalDeNumero(fila.itbis),
      total: decimalDeNumero(fila.total),
      estado: fila.estado === "anulada" ? "anulada" : "activa",
      tipo_reembolso: tipoReembolsoPOS(fila.tipo_reembolso),
      monto_reembolso_efectivo: decimalDeNumero(fila.monto_reembolso_efectivo),
      cuenta_reembolso_id: fila.cuenta_reembolso_id,
      turno_id: fila.turno_id,
      turno_numero: fila.pos_turnos?.numero ?? null,
      notas: fila.notas,
      factura_id: fila.factura_id,
      contacto_id: fila.contacto_id,
    },
    factura: {
      id: fila.factura_id,
      numero: factura?.numero ?? 0,
      ncf: factura?.ncf ?? null,
      total: decimalDeNumero(factura?.total),
      pagado: decimalDeNumero(factura?.pagado),
      credito: decimalDeNumero(factura?.credito),
      estado: factura?.estado === "anulada" || factura?.estado === "pagada" ? factura.estado : "abierta",
      saldo: centavosATexto(totalFactura - pagado - credito),
    },
    contacto: fila.contactos
      ? { id: fila.contacto_id, nombre: fila.contactos.nombre, rnc_cedula: fila.contactos.rnc_cedula }
      : null,
    lineas: detalleLineas,
  };
}

interface FilaFacturaCandidata {
  id: string;
  numero: number;
  ncf: string | null;
  fecha: string;
  total: number;
  pagado: number;
  credito: number;
  retenido: number;
  estado: string;
  origen: string;
  contactos: { nombre: string } | null;
}

/** Facturas no anuladas para devolver o cobrar desde el turno. */
export async function getFacturasCandidatasPOS(q: string): Promise<FacturaCandidataPOS[]> {
  const supabase = await createClient();
  const termino = q.trim();
  const idsContactos = termino === "" ? [] : await contactosQueCoinciden(supabase, termino, ["cliente", "ambos"]);
  const filtro = termino === "" ? null : condicionesDocumento({ q: termino, idsContactos });

  let consulta = supabase
    .from("facturas")
    .select("id, numero, ncf, fecha, total, pagado, credito, retenido, estado, origen, contactos(nombre)")
    .neq("estado", "anulada");

  if (filtro) consulta = consulta.or(filtro);

  const { data, error } = await consulta
    .order("numero", { ascending: false })
    .limit(25)
    .returns<FilaFacturaCandidata[]>();

  if (error) throw new Error(error.message);

  return data.map((fila) => {
    const total = centavosDeDecimal(String(fila.total)) ?? 0;
    const pagado = centavosDeDecimal(String(fila.pagado)) ?? 0;
    const credito = centavosDeDecimal(String(fila.credito)) ?? 0;
    const retenido = centavosDeDecimal(String(fila.retenido)) ?? 0;

    return {
      id: fila.id,
      numero: fila.numero,
      ncf: fila.ncf,
      fecha: fila.fecha,
      total: centavosATexto(total),
      pagado: centavosATexto(pagado),
      credito: centavosATexto(credito),
      retenido: centavosATexto(retenido),
      saldo: centavosATexto(total - pagado - credito - retenido),
      estado: fila.estado === "anulada" || fila.estado === "pagada" ? fila.estado : "abierta",
      origen: fila.origen,
      cliente_nombre: fila.contactos?.nombre ?? "—",
    };
  });
}

/** Efectivo ya devuelto en notas activas de la factura (límite del reembolso). */
export async function getEfectivoDevueltoPOS(facturaId: string): Promise<string> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("notas_credito_venta")
    .select("monto_reembolso_efectivo")
    .eq("factura_id", facturaId)
    .eq("estado", "activa")
    .neq("tipo_reembolso", "credito_factura")
    .returns<{ monto_reembolso_efectivo: number }[]>();

  if (error) throw new Error(error.message);
  const total = data.reduce((suma, fila) => suma + (centavosDeDecimal(String(fila.monto_reembolso_efectivo)) ?? 0), 0);
  return centavosATexto(total);
}

/** Líneas y cabecera de una factura para el paso 2 del wizard. */
export async function getDatosDevolucionPOS(facturaId: string): Promise<DatosDevolucionPOS | null> {
  const supabase = await createClient();
  const factura = await supabase
    .from("facturas")
    .select("id, numero, ncf, fecha, total, pagado, credito, retenido, estado, origen, contactos(nombre)")
    .eq("id", facturaId)
    .maybeSingle<FilaFacturaCandidata>();

  if (factura.error) throw new Error(factura.error.message);
  if (!factura.data || factura.data.estado === "anulada") return null;

  const [lineas, notas, efectivoDevuelto] = await Promise.all([
    supabase
      .from("factura_lineas")
      .select("id, producto_id, descripcion, cantidad, precio, descuento_pct, itbis_tasa, subtotal, itbis, total")
      .eq("factura_id", facturaId)
      .order("id")
      .returns<
        {
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
        }[]
      >(),
    supabase
      .from("notas_credito_venta")
      .select("id")
      .eq("factura_id", facturaId)
      .eq("estado", "activa")
      .returns<{ id: string }[]>(),
    getEfectivoDevueltoPOS(facturaId),
  ]);

  if (lineas.error) throw new Error(lineas.error.message);
  if (notas.error) throw new Error(notas.error.message);

  const idsNotas = notas.data.map((nota) => nota.id);
  const acreditadas =
    idsNotas.length > 0
      ? await consultarEnLotes(idsNotas, (lote) =>
          supabase.from("nota_credito_venta_lineas").select("factura_linea_id, cantidad").in("nota_id", lote),
        )
      : { data: [], error: null };

  if (acreditadas.error) throw new Error(acreditadas.error.message);

  const devuelto = new Map<string, number>();
  for (const linea of acreditadas.data ?? []) {
    devuelto.set(
      linea.factura_linea_id,
      (devuelto.get(linea.factura_linea_id) ?? 0) + (centavosDeDecimal(String(linea.cantidad)) ?? 0),
    );
  }

  const total = centavosDeDecimal(String(factura.data.total)) ?? 0;
  const pagado = centavosDeDecimal(String(factura.data.pagado)) ?? 0;
  const credito = centavosDeDecimal(String(factura.data.credito)) ?? 0;
  const retenido = centavosDeDecimal(String(factura.data.retenido)) ?? 0;

  return {
    factura: {
      id: factura.data.id,
      numero: factura.data.numero,
      ncf: factura.data.ncf,
      fecha: factura.data.fecha,
      total: centavosATexto(total),
      pagado: centavosATexto(pagado),
      credito: centavosATexto(credito),
      retenido: centavosATexto(retenido),
      saldo: centavosATexto(total - pagado - credito - retenido),
      estado: factura.data.estado === "pagada" ? "pagada" : "abierta",
      origen: factura.data.origen,
      cliente_nombre: factura.data.contactos?.nombre ?? "—",
    },
    lineas: lineas.data.map((linea) => {
      const pendiente = (centavosDeDecimal(String(linea.cantidad)) ?? 0) - (devuelto.get(linea.id) ?? 0);
      return {
        id: linea.id,
        producto_id: linea.producto_id,
        descripcion: linea.descripcion,
        cantidad: decimalDeNumero(linea.cantidad),
        precio: decimalDeNumero(linea.precio),
        descuento_pct: decimalDeNumero(linea.descuento_pct),
        itbis_tasa: decimalDeNumero(linea.itbis_tasa),
        subtotal: decimalDeNumero(linea.subtotal),
        itbis: decimalDeNumero(linea.itbis),
        total: decimalDeNumero(linea.total),
        pendiente: centavosATexto(Math.max(0, pendiente)),
      };
    }),
    efectivo_devuelto_previo: efectivoDevuelto,
  };
}

interface FilaPagoRecibido {
  id: string;
  numero: number;
  fecha: string;
  metodo: string;
  monto: number;
  cuenta_id: string;
  estado: string;
  cuentas: { nombre: string } | null;
}

function metodoPos(metodo: string, cuentaId: string, terminal: TerminalPOS | null): PagoDetallePOS["metodo_pos"] {
  if (metodo === "efectivo") return "efectivo";
  if (metodo === "transferencia") return "transferencia";
  if (metodo === "tarjeta") {
    if (terminal && cuentaId === terminal.cuenta_tarjeta_credito_id) return "tarjeta_credito";
    return "tarjeta_debito";
  }
  return "transferencia";
}

/** Turno al que pertenece la factura. */
async function getTurnoDeFactura(facturaId: string): Promise<TurnoDetallePOS | null> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("facturas")
    .select(
      "turno_id, pos_turnos(numero, abierto_en, cerrado_en, base_inicial, efectivo_esperado, efectivo_real, diferencia, pos_terminales(nombre))",
    )
    .eq("id", facturaId)
    .maybeSingle<{
      turno_id: string | null;
      pos_turnos: {
        numero: number;
        abierto_en: string;
        cerrado_en: string | null;
        base_inicial: number;
        efectivo_esperado: number | null;
        efectivo_real: number | null;
        diferencia: number | null;
        pos_terminales: { nombre: string } | null;
      } | null;
    }>();

  if (error) throw new Error(error.message);
  const turno = data?.pos_turnos;
  if (!data?.turno_id || !turno) return null;

  return {
    id: data.turno_id,
    numero: turno.numero,
    abierto_en: turno.abierto_en,
    cerrado_en: turno.cerrado_en,
    base_inicial: decimalDeNumero(turno.base_inicial),
    efectivo_esperado: turno.efectivo_esperado == null ? null : decimalDeNumero(turno.efectivo_esperado),
    efectivo_real: turno.efectivo_real == null ? null : decimalDeNumero(turno.efectivo_real),
    diferencia: turno.diferencia == null ? null : decimalDeNumero(turno.diferencia),
    terminal_nombre: turno.pos_terminales?.nombre ?? null,
  };
}

/** Pagos activos de una factura con su cuenta y método del POS. */
export async function getPagosPOS(facturaId: string, terminal: TerminalPOS | null): Promise<PagoDetallePOS[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("pagos_recibidos")
    .select("id, numero, fecha, metodo, monto, cuenta_id, estado, cuentas(nombre)")
    .eq("factura_id", facturaId)
    .eq("estado", "activo")
    .order("numero")
    .returns<FilaPagoRecibido[]>();

  if (error) throw new Error(error.message);

  return data.map((pago) => ({
    id: pago.id,
    numero: pago.numero,
    fecha: pago.fecha,
    metodo: pago.metodo,
    metodo_pos: metodoPos(pago.metodo, pago.cuenta_id, terminal),
    cuenta_id: pago.cuenta_id,
    cuenta_nombre: pago.cuentas?.nombre ?? null,
    monto: decimalDeNumero(pago.monto),
    monto_recibido: "0.00",
    cambio: "0.00",
    estado: pago.estado,
  }));
}

/** Cajero que creó la factura (nombre del perfil, nunca el UUID). */
async function getCajeroDeFactura(facturaId: string): Promise<string | null> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("facturas")
    .select("creado_por")
    .eq("id", facturaId)
    .maybeSingle<{ creado_por: string | null }>();

  if (!data?.creado_por) return null;

  const { data: perfil } = await supabase
    .from("perfiles")
    .select("nombre")
    .eq("user_id", data.creado_por)
    .maybeSingle<{ nombre: string | null }>();

  return perfil?.nombre ?? null;
}

async function getVendedor(facturaId: string): Promise<string | null> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("facturas")
    .select("vendedor_id")
    .eq("id", facturaId)
    .maybeSingle<{ vendedor_id: string | null }>();

  if (!data?.vendedor_id) return null;

  const { data: vendedor } = await supabase
    .from("vendedores")
    .select("nombre")
    .eq("id", data.vendedor_id)
    .maybeSingle<{ nombre: string | null }>();

  return vendedor?.nombre ?? null;
}

export interface ContextoVentaPOS {
  turno: TurnoDetallePOS | null;
  pagos: PagoDetallePOS[];
  cajero: string | null;
  vendedor: string | null;
  creado_en: string | null;
  origen: string;
  monto_recibido: string | null;
  cambio: string | null;
}

/** Datos complementarios del detalle de una venta del POS. */
export async function getContextoVentaPOS(facturaId: string, terminal: TerminalPOS | null): Promise<ContextoVentaPOS> {
  const supabase = await createClient();
  const [turno, pagos, cajero, vendedor, cabecera] = await Promise.all([
    getTurnoDeFactura(facturaId),
    getPagosPOS(facturaId, terminal),
    getCajeroDeFactura(facturaId),
    getVendedor(facturaId),
    supabase.from("facturas").select("creado_en, origen, monto_recibido, cambio").eq("id", facturaId).maybeSingle<{
      creado_en: string | null;
      origen: string;
      monto_recibido: number | null;
      cambio: number | null;
    }>(),
  ]);

  return {
    turno,
    pagos,
    cajero,
    vendedor,
    creado_en: cabecera.data?.creado_en ?? null,
    origen: cabecera.data?.origen ?? "pos",
    monto_recibido: cabecera.data?.monto_recibido == null ? null : decimalDeNumero(cabecera.data.monto_recibido),
    cambio: cabecera.data?.cambio == null ? null : decimalDeNumero(cabecera.data.cambio),
  };
}

export type { DetalleVentaPOS };
