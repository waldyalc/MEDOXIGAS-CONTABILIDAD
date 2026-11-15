import { z } from "zod";

import type { CuentaEditable } from "@/lib/contabilidad/validacion";
import { valorACentavos } from "@/lib/facturacion/calculo";
import { paginarConsulta } from "@/lib/supabase/paginar";
import { createClient } from "@/lib/supabase/server";

export type CuentaCabecera = CuentaEditable;

interface AsientoResumen {
  id: string;
  numero: number;
  fecha: string;
}

interface ContactoResumen {
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
  asientos: AsientoResumen;
  contactos: ContactoResumen | null;
}

export interface MovimientoCuenta {
  id: string;
  asiento_id: string;
  numero: number;
  fecha: string;
  descripcion: string | null;
  debitoCentavos: number;
  creditoCentavos: number;
  saldoCentavos: number;
  contacto: ContactoResumen | null;
}

export interface DetalleCuenta {
  cuenta: CuentaCabecera;
  movimientos: MovimientoCuenta[];
  tieneMovimientos: boolean;
  saldoCentavos: number;
  totalDebitoCentavos: number;
  totalCreditoCentavos: number;
}

const FORMATO_FECHA = /^\d{4}-\d{2}-\d{2}$/;

export function normalizarFecha(valor: string | undefined): string | undefined {
  if (valor == null || !FORMATO_FECHA.test(valor)) return undefined;
  return valor;
}

interface LineaConAsiento {
  linea: LineaConJoin;
  asiento: AsientoResumen;
}

export async function obtenerCuentaDetalle(id: string, desde?: string, hasta?: string): Promise<DetalleCuenta | null> {
  if (!z.uuid().safeParse(id).success) return null;

  const cliente = await createClient();
  const { data: cuenta, error } = await cliente
    .from("cuentas")
    .select("id, codigo, nombre, tipo, naturaleza, padre_id, acepta_movimientos, es_caja_banco, activa")
    .eq("id", id)
    .maybeSingle()
    .returns<CuentaCabecera | null>();

  if (error) throw new Error(error.message);
  if (!cuenta) return null;

  const { data: lineas, error: errorLineas } = await paginarConsulta((inicio, fin) => {
    const base = cliente
      .from("asiento_lineas")
      .select(
        "id, asiento_id, contacto_id, descripcion, debito, credito, asientos!inner(id, numero, fecha), contactos(id, nombre)",
      )
      .eq("cuenta_id", id)
      .order("id")
      .range(inicio, fin);
    return (hasta == null ? base : base.lte("asientos.fecha", hasta)).returns<LineaConJoin[]>();
  });

  if (errorLineas) throw new Error(errorLineas.message);

  const filas = lineas ?? [];

  const ordenadas = filas
    .flatMap((linea) => {
      const asiento = linea.asientos;
      return [{ linea, asiento }];
    })
    .sort(
      (a, b) =>
        a.asiento.fecha.localeCompare(b.asiento.fecha) ||
        a.asiento.numero - b.asiento.numero ||
        a.linea.id.localeCompare(b.linea.id),
    );

  const resultado = calcularMovimientos(ordenadas, cuenta.naturaleza === "credito", desde, hasta);

  return { cuenta, tieneMovimientos: filas.length > 0, ...resultado };
}

function calcularMovimientos(
  ordenadas: readonly LineaConAsiento[],
  usaCredito: boolean,
  desde?: string,
  hasta?: string,
) {
  const movimientos: MovimientoCuenta[] = [];
  let acumulado = 0;
  let totalDebitoCentavos = 0;
  let totalCreditoCentavos = 0;

  for (const { linea, asiento } of ordenadas) {
    if (hasta != null && asiento.fecha > hasta) continue;

    const debitoCentavos = valorACentavos(linea.debito);
    const creditoCentavos = valorACentavos(linea.credito);
    acumulado += usaCredito ? creditoCentavos - debitoCentavos : debitoCentavos - creditoCentavos;

    if (desde != null && asiento.fecha < desde) continue;

    totalDebitoCentavos += debitoCentavos;
    totalCreditoCentavos += creditoCentavos;

    movimientos.push({
      id: linea.id,
      asiento_id: asiento.id,
      numero: asiento.numero,
      fecha: asiento.fecha,
      descripcion: linea.descripcion,
      debitoCentavos,
      creditoCentavos,
      saldoCentavos: acumulado,
      contacto: linea.contactos,
    });
  }

  return { movimientos, saldoCentavos: acumulado, totalDebitoCentavos, totalCreditoCentavos };
}
