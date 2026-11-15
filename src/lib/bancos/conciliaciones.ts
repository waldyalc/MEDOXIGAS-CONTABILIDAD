import { z } from "zod";

import { createClient } from "@/lib/supabase/server";

import { diaAnterior } from "./conciliacion";
import { cargarLineasCuenta } from "./consultas";
import { calcularMovimientosBanco, type MovimientoBanco } from "./movimientos";
import type { CuentaSeleccion } from "./tipos";

interface ConciliacionFila {
  id: string;
  cuenta_id: string;
  fecha_desde: string;
  fecha_hasta: string;
  saldo_bancario: number | null;
  estado: string;
  asiento_id: string | null;
  creado_en: string;
  conciliado_en: string | null;
}

interface CuentaFila {
  id: string;
  codigo: string;
  nombre: string;
}

export interface ConciliacionLista {
  id: string;
  cuentaId: string;
  cuentaNombre: string;
  fechaDesde: string;
  fechaHasta: string;
  saldoCentavos: number | null;
  estado: string;
  asientoId: string | null;
  creadoEn: string;
}

export interface DatosNuevaConciliacion {
  cuentas: CuentaSeleccion[];
  borradores: Record<string, string>;
}

export interface DetalleConciliacion {
  id: string;
  cuenta: CuentaSeleccion;
  fechaDesde: string;
  fechaHasta: string;
  saldoCentavos: number;
  gastosCentavos: number;
  entradasBancariasCentavos: number;
  estado: string;
  asientoId: string | null;
  asientoNumero: number | null;
  conciliadoEn: string | null;
  movimientos: MovimientoBanco[];
  seleccionados: string[];
  bloqueados: Record<string, string>;
  saldoAnteriorCentavos: number;
}

export interface InicioConciliacion {
  borradorId: string | null;
  ultimoCorte: string | null;
  primerMovimiento: string | null;
}

function centavosSaldo(valor: number | string | null | undefined): number {
  if (valor == null) return 0;
  const numero = typeof valor === "number" ? valor : Number(valor);
  return Number.isFinite(numero) ? Math.round(numero * 100) : 0;
}

export async function getListaConciliaciones(): Promise<ConciliacionLista[]> {
  const cliente = await createClient();
  const { data: conciliaciones, error } = await cliente
    .from("conciliaciones")
    .select("id, cuenta_id, fecha_desde, fecha_hasta, saldo_bancario, estado, asiento_id, creado_en, conciliado_en")
    .order("creado_en", { ascending: false })
    .returns<ConciliacionFila[]>();

  if (error) throw new Error(error.message);
  if (conciliaciones.length === 0) return [];

  const cuentaIds = [...new Set(conciliaciones.map((conciliacion) => conciliacion.cuenta_id))];
  const { data: cuentas, error: errorCuentas } = await cliente
    .from("cuentas")
    .select("id, codigo, nombre")
    .in("id", cuentaIds)
    .returns<CuentaFila[]>();

  if (errorCuentas) throw new Error(errorCuentas.message);

  const cuentasPorId = new Map((cuentas ?? []).map((cuenta) => [cuenta.id, cuenta]));

  return conciliaciones.map((conciliacion) => ({
    id: conciliacion.id,
    cuentaId: conciliacion.cuenta_id,
    cuentaNombre: cuentasPorId.get(conciliacion.cuenta_id)?.nombre ?? "Cuenta",
    fechaDesde: conciliacion.fecha_desde,
    fechaHasta: conciliacion.fecha_hasta,
    saldoCentavos: conciliacion.saldo_bancario == null ? null : centavosSaldo(conciliacion.saldo_bancario),
    estado: conciliacion.estado,
    asientoId: conciliacion.asiento_id,
    creadoEn: conciliacion.creado_en,
  }));
}

export async function getDatosNuevaConciliacion(): Promise<DatosNuevaConciliacion> {
  const cliente = await createClient();
  const [cuentas, borradores] = await Promise.all([
    cliente
      .from("cuentas")
      .select("id, codigo, nombre, es_caja_banco, activa, acepta_movimientos")
      .order("codigo")
      .returns<(CuentaFila & { es_caja_banco: boolean; activa: boolean; acepta_movimientos: boolean })[]>(),
    cliente
      .from("conciliaciones")
      .select("id, cuenta_id")
      .eq("estado", "borrador")
      .returns<{ id: string; cuenta_id: string }[]>(),
  ]);

  if (cuentas.error) throw new Error(cuentas.error.message);
  if (borradores.error) throw new Error(borradores.error.message);

  return {
    cuentas: (cuentas.data ?? [])
      .filter((cuenta) => cuenta.es_caja_banco && cuenta.activa && cuenta.acepta_movimientos)
      .map((cuenta) => ({ id: cuenta.id, codigo: cuenta.codigo, nombre: cuenta.nombre })),
    borradores: Object.fromEntries((borradores.data ?? []).map((borrador) => [borrador.cuenta_id, borrador.id])),
  };
}

export async function getDetalleConciliacion(id: string): Promise<DetalleConciliacion | null> {
  if (!z.uuid().safeParse(id).success) return null;

  const cliente = await createClient();
  const { data: conciliacion, error } = await cliente
    .from("conciliaciones")
    .select(
      "id, cuenta_id, fecha_desde, fecha_hasta, saldo_bancario, estado, asiento_id, creado_en, conciliado_en, gastos_bancarios, entradas_bancarias",
    )
    .eq("id", id)
    .maybeSingle()
    .returns<(ConciliacionFila & { gastos_bancarios: number; entradas_bancarias: number }) | null>();

  if (error) throw new Error(error.message);
  if (!conciliacion) return null;

  const [cuentaResultado, lineas, movimientosResultado, otras] = await Promise.all([
    cliente
      .from("cuentas")
      .select("id, codigo, nombre")
      .eq("id", conciliacion.cuenta_id)
      .maybeSingle()
      .returns<CuentaFila | null>(),
    cargarLineasCuenta(cliente, conciliacion.cuenta_id, conciliacion.fecha_hasta),
    cliente
      .from("conciliacion_movimientos")
      .select("asiento_linea_id")
      .eq("conciliacion_id", conciliacion.id)
      .returns<{ asiento_linea_id: string }[]>(),
    cliente
      .from("conciliaciones")
      .select("id")
      .eq("cuenta_id", conciliacion.cuenta_id)
      .neq("id", conciliacion.id)
      .returns<{ id: string }[]>(),
  ]);

  if (cuentaResultado.error) throw new Error(cuentaResultado.error.message);
  if (!cuentaResultado.data) return null;
  if (movimientosResultado.error) throw new Error(movimientosResultado.error.message);
  if (otras.error) throw new Error(otras.error.message);

  const otrasIds = (otras.data ?? []).map((otra) => otra.id);
  let bloqueados: Record<string, string> = {};

  if (otrasIds.length > 0) {
    const { data: movimientosBloqueados, error: errorBloqueados } = await cliente
      .from("conciliacion_movimientos")
      .select("conciliacion_id, asiento_linea_id")
      .in("conciliacion_id", otrasIds)
      .returns<{ conciliacion_id: string; asiento_linea_id: string }[]>();

    if (errorBloqueados) throw new Error(errorBloqueados.message);

    bloqueados = Object.fromEntries(
      (movimientosBloqueados ?? []).map((movimiento) => [movimiento.asiento_linea_id, movimiento.conciliacion_id]),
    );
  }

  let asientoNumero: number | null = null;
  if (conciliacion.asiento_id != null) {
    const { data: asiento } = await cliente
      .from("asientos")
      .select("numero")
      .eq("id", conciliacion.asiento_id)
      .maybeSingle()
      .returns<{ numero: number } | null>();
    asientoNumero = asiento?.numero ?? null;
  }

  const saldoAnterior = calcularMovimientosBanco(lineas, undefined, diaAnterior(conciliacion.fecha_desde));
  const periodo = calcularMovimientosBanco(lineas, conciliacion.fecha_desde, conciliacion.fecha_hasta);

  return {
    id: conciliacion.id,
    cuenta: {
      id: cuentaResultado.data.id,
      codigo: cuentaResultado.data.codigo,
      nombre: cuentaResultado.data.nombre,
    },
    fechaDesde: conciliacion.fecha_desde,
    fechaHasta: conciliacion.fecha_hasta,
    saldoCentavos: centavosSaldo(conciliacion.saldo_bancario),
    gastosCentavos: centavosSaldo(conciliacion.gastos_bancarios),
    entradasBancariasCentavos: centavosSaldo(conciliacion.entradas_bancarias),
    estado: conciliacion.estado,
    asientoId: conciliacion.asiento_id,
    asientoNumero,
    conciliadoEn: conciliacion.conciliado_en,
    movimientos: periodo.movimientos,
    seleccionados: (movimientosResultado.data ?? []).map((movimiento) => movimiento.asiento_linea_id),
    bloqueados,
    saldoAnteriorCentavos: saldoAnterior.saldoCentavos,
  };
}

export async function getInicioConciliacion(cuentaId: string): Promise<InicioConciliacion> {
  const cliente = await createClient();
  const [borrador, ultima, lineas] = await Promise.all([
    cliente
      .from("conciliaciones")
      .select("id")
      .eq("cuenta_id", cuentaId)
      .eq("estado", "borrador")
      .maybeSingle()
      .returns<{ id: string } | null>(),
    cliente
      .from("conciliaciones")
      .select("fecha_hasta")
      .eq("cuenta_id", cuentaId)
      .eq("estado", "conciliada")
      .order("fecha_hasta", { ascending: false })
      .limit(1)
      .maybeSingle()
      .returns<{ fecha_hasta: string } | null>(),
    cargarLineasCuenta(cliente, cuentaId),
  ]);

  if (borrador.error) throw new Error(borrador.error.message);
  if (ultima.error) throw new Error(ultima.error.message);

  return {
    borradorId: borrador.data?.id ?? null,
    ultimoCorte: ultima.data?.fecha_hasta ?? null,
    primerMovimiento: lineas[0]?.fecha ?? null,
  };
}
