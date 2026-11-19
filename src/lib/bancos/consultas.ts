import type { SupabaseClient } from "@supabase/supabase-js";
import { z } from "zod";

import {
  rutaAsiento,
  rutaCompra,
  rutaConciliacion,
  rutaFactura,
  rutaGasto,
  rutaNotaCreditoCompra,
  rutaNotaCreditoVenta,
  rutaNotaDebitoVenta,
  rutaPagoProveedor,
  rutaPagoRecibido,
  rutaTransferencia,
} from "@/lib/enlaces";
import { hoyRD } from "@/lib/facturacion/formato";
import { obtenerSaldosCajaBanco } from "@/lib/reportes/saldos";
import { consultarEnLotes } from "@/lib/supabase/lotes";
import { paginarConsulta } from "@/lib/supabase/paginar";
import { createClient } from "@/lib/supabase/server";

import {
  calcularMovimientosBanco,
  type DocumentoVinculado,
  type LineaBanco,
  type MovimientoBanco,
} from "./movimientos";
import type { ConciliacionResumen, CuentaBanco, CuentaSeleccion } from "./tipos";

type Cliente = Awaited<ReturnType<typeof createClient>>;

interface CuentaFila {
  id: string;
  codigo: string;
  nombre: string;
  activa: boolean;
  acepta_movimientos: boolean;
  es_caja_banco: boolean;
  tipo_banco: string | null;
  numero_cuenta: string | null;
  descripcion: string | null;
}

interface AsientoFila {
  id: string;
  numero: number;
  fecha: string;
  origen_tipo: string;
  origen_id: string | null;
}

interface ContactoFila {
  id: string;
  nombre: string;
}

interface LineaConJoin {
  id: string;
  asiento_id: string;
  contacto_id: string | null;
  descripcion: string | null;
  debito: number;
  credito: number;
  asientos: AsientoFila;
  contactos: ContactoFila | null;
}

interface ConciliacionFila {
  id: string;
  cuenta_id: string;
  estado: string;
  fecha_hasta: string;
  creado_en: string;
}

const ETIQUETAS_DOCUMENTO: Record<string, string> = {
  factura: "Factura",
  pago_recibido: "Pago recibido",
  factura_proveedor: "Compra",
  pago_proveedor: "Pago a proveedor",
  gasto_menor: "Gasto",
  nota_credito_venta: "Nota de crédito",
  nota_credito_compra: "Nota de crédito de compra",
  nota_debito: "Nota de débito",
  transferencia: "Transferencia",
  deposito: "Depósito",
  conciliacion: "Conciliación",
  manual: "Asiento manual",
  anulacion: "Anulación",
};

async function getCuentas(): Promise<CuentaFila[]> {
  const supabase = (await createClient()) as unknown as SupabaseClient;
  const { data, error } = await supabase
    .from("cuentas")
    .select("id, codigo, nombre, activa, acepta_movimientos, es_caja_banco, tipo_banco, numero_cuenta, descripcion")
    .order("codigo")
    .returns<CuentaFila[]>();

  if (error) throw new Error(error.message);
  return data;
}

function resumirCuenta(cuenta: CuentaFila): CuentaSeleccion {
  return { id: cuenta.id, codigo: cuenta.codigo, nombre: cuenta.nombre };
}

export interface DatosBancos {
  cuentas: CuentaBanco[];
  cuentasCajaBanco: CuentaSeleccion[];
  cuentasMovimiento: CuentaSeleccion[];
}

function elegirConciliacion(actual: ConciliacionResumen | null, siguiente: ConciliacionResumen): ConciliacionResumen {
  if (actual == null) return siguiente;
  if (actual.estado !== "borrador" && siguiente.estado === "borrador") return siguiente;
  return actual;
}

export async function getDatosBancos(): Promise<DatosBancos> {
  const supabase = (await createClient()) as unknown as SupabaseClient;
  const [saldos, cuentas, conciliaciones] = await Promise.all([
    obtenerSaldosCajaBanco(),
    getCuentas(),
    supabase
      .from("conciliaciones")
      .select("id, cuenta_id, estado, fecha_hasta, creado_en")
      .order("creado_en", { ascending: false })
      .returns<ConciliacionFila[]>(),
  ]);

  if (saldos.error) throw new Error(saldos.error);
  if (conciliaciones.error) throw new Error(conciliaciones.error.message);

  const detalle = new Map(cuentas.map((cuenta) => [cuenta.id, cuenta]));
  const resumenPorCuenta = new Map<string, ConciliacionResumen>();

  for (const conciliacion of conciliaciones.data ?? []) {
    const actual = resumenPorCuenta.get(conciliacion.cuenta_id) ?? null;
    resumenPorCuenta.set(
      conciliacion.cuenta_id,
      elegirConciliacion(actual, {
        id: conciliacion.id,
        estado: conciliacion.estado,
        fechaHasta: conciliacion.fecha_hasta,
      }),
    );
  }

  return {
    cuentas: saldos.filas.map((fila) => {
      const cuenta = detalle.get(fila.cuenta_id);
      return {
        id: fila.cuenta_id,
        codigo: fila.codigo,
        nombre: fila.nombre,
        saldo: fila.saldo,
        tipoBanco: cuenta?.tipo_banco ?? null,
        numeroCuenta: cuenta?.numero_cuenta ?? null,
        conciliacion: resumenPorCuenta.get(fila.cuenta_id) ?? null,
      };
    }),
    cuentasCajaBanco: cuentas
      .filter((cuenta) => cuenta.es_caja_banco && cuenta.activa && cuenta.acepta_movimientos)
      .map(resumirCuenta),
    cuentasMovimiento: cuentas.filter((cuenta) => cuenta.activa && cuenta.acepta_movimientos).map(resumirCuenta),
  };
}

export async function getCuentasCajaBanco(): Promise<CuentaSeleccion[]> {
  const cuentas = await getCuentas();
  return cuentas
    .filter((cuenta) => cuenta.es_caja_banco && cuenta.activa && cuenta.acepta_movimientos)
    .map(resumirCuenta);
}

const RUTAS_DOCUMENTO: Record<string, (id: string) => string> = {
  factura: rutaFactura,
  factura_proveedor: rutaCompra,
  pago_recibido: rutaPagoRecibido,
  pago_proveedor: rutaPagoProveedor,
  gasto_menor: rutaGasto,
  nota_credito_venta: rutaNotaCreditoVenta,
  nota_credito_compra: rutaNotaCreditoCompra,
  nota_debito: rutaNotaDebitoVenta,
  conciliacion: rutaConciliacion,
};

function rutaDocumento(tipo: string, origenId: string | null, asientoId: string): string | null {
  if (tipo === "transferencia" || tipo === "deposito") return rutaTransferencia(asientoId);
  if (tipo === "manual" || tipo === "anulacion") return rutaAsiento(asientoId);
  if (origenId == null) return null;

  return RUTAS_DOCUMENTO[tipo]?.(origenId) ?? null;
}

async function numerosDocumento(cliente: Cliente, tipo: string, ids: string[]): Promise<Map<string, number>> {
  const mapa = new Map<string, number>();
  if (ids.length === 0) return mapa;

  let filas: { id: string; numero: number }[] = [];

  switch (tipo) {
    case "factura": {
      const { data } = await consultarEnLotes(ids, (lote) =>
        cliente.from("facturas").select("id, numero").in("id", lote),
      );
      filas = data ?? [];
      break;
    }
    case "factura_proveedor": {
      const { data } = await consultarEnLotes(ids, (lote) =>
        cliente.from("facturas_proveedor").select("id, numero").in("id", lote),
      );
      filas = data ?? [];
      break;
    }
    case "pago_recibido": {
      const { data } = await consultarEnLotes(ids, (lote) =>
        cliente.from("pagos_recibidos").select("id, numero").in("id", lote),
      );
      filas = data ?? [];
      break;
    }
    case "pago_proveedor": {
      const { data } = await consultarEnLotes(ids, (lote) =>
        cliente.from("pagos_proveedor").select("id, numero").in("id", lote),
      );
      filas = data ?? [];
      break;
    }
    case "gasto_menor": {
      const { data } = await consultarEnLotes(ids, (lote) =>
        cliente.from("gastos_menores").select("id, numero").in("id", lote),
      );
      filas = data ?? [];
      break;
    }
    case "nota_credito_venta": {
      const { data } = await consultarEnLotes(ids, (lote) =>
        cliente.from("notas_credito_venta").select("id, numero").in("id", lote),
      );
      filas = data ?? [];
      break;
    }
    case "nota_credito_compra": {
      const { data } = await consultarEnLotes(ids, (lote) =>
        cliente.from("notas_credito_compra").select("id, numero").in("id", lote),
      );
      filas = data ?? [];
      break;
    }
    case "nota_debito": {
      const { data } = await consultarEnLotes(ids, (lote) =>
        cliente.from("notas_debito_venta").select("id, numero").in("id", lote),
      );
      filas = data ?? [];
      break;
    }
    default:
      break;
  }

  for (const fila of filas) mapa.set(fila.id, fila.numero);
  return mapa;
}

async function cargarDocumentos(cliente: Cliente, asientos: AsientoFila[]): Promise<Map<string, DocumentoVinculado>> {
  const idsPorTipo = new Map<string, Set<string>>();

  for (const asiento of asientos) {
    if (asiento.origen_id == null) continue;
    const ids = idsPorTipo.get(asiento.origen_tipo) ?? new Set<string>();
    ids.add(asiento.origen_id);
    idsPorTipo.set(asiento.origen_tipo, ids);
  }

  const numerosPorTipo = new Map<string, Map<string, number>>();
  await Promise.all(
    [...idsPorTipo.entries()].map(async ([tipo, ids]) => {
      numerosPorTipo.set(tipo, await numerosDocumento(cliente, tipo, [...ids]));
    }),
  );

  const documentos = new Map<string, DocumentoVinculado>();

  for (const asiento of asientos) {
    const base = ETIQUETAS_DOCUMENTO[asiento.origen_tipo] ?? "Documento";
    const numero = asiento.origen_id ? numerosPorTipo.get(asiento.origen_tipo)?.get(asiento.origen_id) : undefined;

    documentos.set(asiento.id, {
      etiqueta: numero != null ? `${base} #${numero}` : base,
      href: rutaDocumento(asiento.origen_tipo, asiento.origen_id, asiento.id),
    });
  }

  return documentos;
}

export async function cargarLineasCuenta(cliente: Cliente, cuentaId: string, hasta?: string): Promise<LineaBanco[]> {
  const consulta = (inicio: number, fin: number) => {
    const base = cliente
      .from("asiento_lineas")
      .select(
        "id, asiento_id, contacto_id, descripcion, debito, credito, asientos!inner(id, numero, fecha, origen_tipo, origen_id), contactos(id, nombre)",
      )
      .eq("cuenta_id", cuentaId)
      .order("id")
      .range(inicio, fin);
    return (hasta == null ? base : base.lte("asientos.fecha", hasta)).returns<LineaConJoin[]>();
  };

  const { data: lineas, error } = await paginarConsulta(consulta);

  if (error) throw new Error(error.message);
  if (lineas == null || lineas.length === 0) return [];

  const documentos = await cargarDocumentos(
    cliente,
    lineas.map((linea) => linea.asientos),
  );

  return lineas
    .flatMap((linea) => {
      const asiento = linea.asientos;

      return [
        {
          id: linea.id,
          asientoId: asiento.id,
          asientoNumero: asiento.numero,
          fecha: asiento.fecha,
          descripcion: linea.descripcion,
          debito: linea.debito,
          credito: linea.credito,
          documento: documentos.get(asiento.id) ?? { etiqueta: "Documento", href: null },
          tercero: linea.contactos,
        },
      ];
    })
    .sort((a, b) => a.fecha.localeCompare(b.fecha) || a.asientoNumero - b.asientoNumero || a.id.localeCompare(b.id));
}

export interface DetalleCuentaBanco {
  cuenta: {
    id: string;
    codigo: string;
    nombre: string;
    tipoBanco: string | null;
    numeroCuenta: string | null;
    descripcion: string | null;
    tipo: string;
    naturaleza: string;
    padreId: string | null;
    aceptaMovimientos: boolean;
    activa: boolean;
  };
  saldoActualCentavos: number;
  movimientos: MovimientoBanco[];
  saldoCentavos: number;
  totalEntradasCentavos: number;
  totalSalidasCentavos: number;
  tieneMovimientos: boolean;
}

function centavosSaldo(valor: number | string | null | undefined): number {
  if (valor == null) return 0;
  const numero = typeof valor === "number" ? valor : Number(valor);
  return Number.isFinite(numero) ? Math.round(numero * 100) : 0;
}

export async function getDetalleCuentaBanco(
  id: string,
  desde?: string,
  hasta?: string,
): Promise<DetalleCuentaBanco | null> {
  if (!z.uuid().safeParse(id).success) return null;

  const cliente = await createClient();
  const { data: cuenta, error } = await cliente
    .from("cuentas")
    .select(
      "id, codigo, nombre, tipo_banco, numero_cuenta, descripcion, es_caja_banco, tipo, naturaleza, padre_id, acepta_movimientos, activa",
    )
    .eq("id", id)
    .maybeSingle()
    .returns<{
      id: string;
      codigo: string;
      nombre: string;
      tipo_banco: string | null;
      numero_cuenta: string | null;
      descripcion: string | null;
      es_caja_banco: boolean;
      tipo: string;
      naturaleza: string;
      padre_id: string | null;
      acepta_movimientos: boolean;
      activa: boolean;
    } | null>();

  if (error) throw new Error(error.message);
  if (!cuenta?.es_caja_banco) return null;

  const [lineas, saldos] = await Promise.all([cargarLineasCuenta(cliente, id, hasta), obtenerSaldosCajaBanco()]);
  if (saldos.error) throw new Error(saldos.error);

  const saldoActual = saldos.filas.find((fila) => fila.cuenta_id === id);

  return {
    cuenta: {
      id: cuenta.id,
      codigo: cuenta.codigo,
      nombre: cuenta.nombre,
      tipoBanco: cuenta.tipo_banco,
      numeroCuenta: cuenta.numero_cuenta,
      descripcion: cuenta.descripcion,
      tipo: cuenta.tipo,
      naturaleza: cuenta.naturaleza,
      padreId: cuenta.padre_id,
      aceptaMovimientos: cuenta.acepta_movimientos,
      activa: cuenta.activa,
    },
    saldoActualCentavos: centavosSaldo(saldoActual?.saldo),
    tieneMovimientos: lineas.length > 0,
    ...calcularMovimientosBanco(lineas, desde, hasta),
  };
}

export function normalizarFecha(valor: string | undefined): string | undefined {
  if (valor == null || !/^\d{4}-\d{2}-\d{2}$/.test(valor)) return undefined;
  return valor;
}

interface LineaAsientoFila {
  id: string;
  descripcion: string | null;
  debito: number;
  credito: number;
  cuentas: { id: string; codigo: string; nombre: string } | null;
  contactos: { id: string; nombre: string } | null;
  centros_costo: { nombre: string } | null;
}

export interface LineaAsientoBanco {
  id: string;
  descripcion: string | null;
  debito: number;
  credito: number;
  cuenta: { id: string; codigo: string; nombre: string } | null;
  contacto: { id: string; nombre: string } | null;
  centroCosto: string | null;
}

export interface AsientoBanco {
  id: string;
  numero: number;
  fecha: string;
  descripcion: string;
  lineas: LineaAsientoBanco[];
}

/** Asiento completo de un movimiento de la cuenta, para la sección de la ficha. */
export async function getAsientoBanco(asientoId: string): Promise<AsientoBanco | null> {
  if (!z.uuid().safeParse(asientoId).success) return null;

  const cliente = await createClient();
  const { data: asiento, error } = await cliente
    .from("asientos")
    .select("id, numero, fecha, descripcion")
    .eq("id", asientoId)
    .maybeSingle()
    .returns<{ id: string; numero: number; fecha: string; descripcion: string } | null>();

  if (error) throw new Error(error.message);
  if (!asiento) return null;

  const { data: lineas, error: errorLineas } = await cliente
    .from("asiento_lineas")
    .select(
      "id, descripcion, debito, credito, cuentas(id, codigo, nombre), contactos(id, nombre), centros_costo(nombre)",
    )
    .eq("asiento_id", asientoId)
    .order("id")
    .returns<LineaAsientoFila[]>();

  if (errorLineas) throw new Error(errorLineas.message);

  return {
    id: asiento.id,
    numero: asiento.numero,
    fecha: asiento.fecha,
    descripcion: asiento.descripcion,
    lineas: (lineas ?? []).map((linea) => ({
      id: linea.id,
      descripcion: linea.descripcion,
      debito: linea.debito,
      credito: linea.credito,
      cuenta: linea.cuentas,
      contacto: linea.contactos,
      centroCosto: linea.centros_costo?.nombre ?? null,
    })),
  };
}

/**
 * Asiento que muestra la ficha: el del movimiento elegido (?asiento=) si toca
 * la cuenta, si no el del último movimiento del período.
 */
export async function resolverAsientoCuenta(
  movimientos: MovimientoBanco[],
  cuentaId: string,
  asientoParam: string | undefined,
): Promise<AsientoBanco | null> {
  const ultimo = movimientos[movimientos.length - 1] ?? null;
  const elegido = asientoParam != null && z.uuid().safeParse(asientoParam).success ? asientoParam : ultimo?.asientoId;
  if (!elegido) return null;

  const asiento = await getAsientoBanco(elegido);
  if (asiento?.lineas.some((linea) => linea.cuenta?.id === cuentaId)) return asiento;
  if (ultimo && elegido !== ultimo.asientoId) return getAsientoBanco(ultimo.asientoId);
  return null;
}

export interface PuntoIngresosGastos {
  /** "2026-11" */
  clave: string;
  /** "Noviembre" */
  mes: string;
  ingresosCentavos: number;
  gastosCentavos: number;
}

const NOMBRES_MES = [
  "Enero",
  "Febrero",
  "Marzo",
  "Abril",
  "Mayo",
  "Junio",
  "Julio",
  "Agosto",
  "Septiembre",
  "Octubre",
  "Noviembre",
  "Diciembre",
];

interface AsientoFechaFila {
  id: string;
  fecha: string;
}

interface LineaIngresoGasto {
  asiento_id: string;
  debito: number;
  credito: number;
}

/**
 * Entradas y salidas de las cuentas de caja/banco por mes, últimos 6 meses
 * (gráfica de la lista de bancos). Las transferencias entre cuentas propias
 * se excluyen: sumarían la misma plata como ingreso y como gasto.
 *
 * Se lee en dos pasos indexados: primero los asientos del rango (índice por
 * fecha) y luego solo sus líneas (índice asiento_id, cuenta_id). Filtrar
 * `asientos.fecha` desde `asiento_lineas` obligaba a recorrer el histórico
 * completo y agotaba el statement_timeout.
 */
export async function getIngresosGastosMensual(): Promise<PuntoIngresosGastos[]> {
  const hoy = hoyRD();
  const anio = Number(hoy.slice(0, 4));
  const mes = Number(hoy.slice(5, 7));

  const puntos: PuntoIngresosGastos[] = [];
  for (let atras = 5; atras >= 0; atras--) {
    const indice = anio * 12 + (mes - 1) - atras;
    const anioMes = Math.floor(indice / 12);
    const numeroMes = (indice % 12) + 1;
    puntos.push({
      clave: `${anioMes}-${String(numeroMes).padStart(2, "0")}`,
      mes: NOMBRES_MES[numeroMes - 1] ?? "",
      ingresosCentavos: 0,
      gastosCentavos: 0,
    });
  }

  const cliente = await createClient();
  const cuentas = await getCuentas();
  const ids = cuentas.filter((cuenta) => cuenta.es_caja_banco).map((cuenta) => cuenta.id);
  if (ids.length === 0) return puntos;

  const desde = `${puntos[0]?.clave}-01`;
  const { data: asientos, error: errorAsientos } = await paginarConsulta((inicio, fin) =>
    cliente
      .from("asientos")
      .select("id, fecha")
      .gte("fecha", desde)
      .neq("origen_tipo", "transferencia")
      .order("fecha", { ascending: true })
      .order("id", { ascending: true })
      .range(inicio, fin)
      .returns<AsientoFechaFila[]>(),
  );

  if (errorAsientos) throw new Error(errorAsientos.message);
  if (!asientos || asientos.length === 0) return puntos;

  const fechaPorAsiento = new Map(asientos.map((asiento) => [asiento.id, asiento.fecha]));
  const { data: lineas, error } = await consultarEnLotes(
    asientos.map((asiento) => asiento.id),
    (lote) =>
      paginarConsulta((inicio, fin) =>
        cliente
          .from("asiento_lineas")
          .select("asiento_id, debito, credito")
          .in("asiento_id", lote)
          .in("cuenta_id", ids)
          .order("id")
          .range(inicio, fin)
          .returns<LineaIngresoGasto[]>(),
      ),
  );

  if (error) throw new Error(error.message);

  const porMes = new Map(puntos.map((punto) => [punto.clave, punto]));
  for (const linea of lineas ?? []) {
    const fecha = fechaPorAsiento.get(linea.asiento_id);
    const punto = fecha ? porMes.get(fecha.slice(0, 7)) : undefined;
    if (!punto) continue;
    punto.ingresosCentavos += centavosSaldo(linea.debito);
    punto.gastosCentavos += centavosSaldo(linea.credito);
  }

  return puntos;
}
