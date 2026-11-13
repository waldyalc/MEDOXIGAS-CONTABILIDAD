import { z } from "zod";

import { valorACentavos } from "@/lib/facturacion/calculo";
import { createClient } from "@/lib/supabase/server";

type Cliente = Awaited<ReturnType<typeof createClient>>;

export interface CuentaCabecera {
  id: string;
  codigo: string;
  nombre: string;
  tipo: string;
  naturaleza: string;
}

interface LineaFila {
  id: string;
  asiento_id: string;
  contacto_id: string | null;
  descripcion: string | null;
  debito: number;
  credito: number;
}

interface AsientoResumen {
  id: string;
  numero: number;
  fecha: string;
}

interface ContactoResumen {
  id: string;
  nombre: string;
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
  saldoCentavos: number;
  totalDebitoCentavos: number;
  totalCreditoCentavos: number;
}

const FORMATO_FECHA = /^\d{4}-\d{2}-\d{2}$/;

export function normalizarFecha(valor: string | undefined): string | undefined {
  if (valor == null || !FORMATO_FECHA.test(valor)) return undefined;
  return valor;
}

async function cargarAsientos(cliente: Cliente, ids: string[]): Promise<Map<string, AsientoResumen>> {
  if (ids.length === 0) return new Map();

  const { data, error } = await cliente.from("asientos").select("id, numero, fecha").in("id", ids);
  if (error) throw new Error(error.message);

  return new Map((data ?? []).map((asiento) => [asiento.id, asiento]));
}

async function cargarContactos(cliente: Cliente, ids: string[]): Promise<Map<string, ContactoResumen>> {
  if (ids.length === 0) return new Map();

  const { data, error } = await cliente.from("contactos").select("id, nombre").in("id", ids);
  if (error) throw new Error(error.message);

  return new Map((data ?? []).map((contacto) => [contacto.id, contacto]));
}

interface LineaConAsiento {
  linea: LineaFila;
  asiento: AsientoResumen;
}

export async function obtenerCuentaDetalle(id: string, desde?: string, hasta?: string): Promise<DetalleCuenta | null> {
  if (!z.uuid().safeParse(id).success) return null;

  const cliente = await createClient();
  const { data: cuenta, error } = await cliente
    .from("cuentas")
    .select("id, codigo, nombre, tipo, naturaleza")
    .eq("id", id)
    .maybeSingle()
    .returns<CuentaCabecera | null>();

  if (error) throw new Error(error.message);
  if (!cuenta) return null;

  const { data: lineas, error: errorLineas } = await cliente
    .from("asiento_lineas")
    .select("id, asiento_id, contacto_id, descripcion, debito, credito")
    .eq("cuenta_id", id)
    .returns<LineaFila[]>();

  if (errorLineas) throw new Error(errorLineas.message);

  const filas = lineas ?? [];
  const asientoIds = [...new Set(filas.map((linea) => linea.asiento_id))];
  const contactoIds = [...new Set(filas.flatMap((linea) => (linea.contacto_id == null ? [] : [linea.contacto_id])))];

  const [asientos, contactos] = await Promise.all([
    cargarAsientos(cliente, asientoIds),
    cargarContactos(cliente, contactoIds),
  ]);

  const ordenadas = filas
    .flatMap((linea) => {
      const asiento = asientos.get(linea.asiento_id);
      return asiento == null ? [] : [{ linea, asiento }];
    })
    .sort(
      (a, b) =>
        a.asiento.fecha.localeCompare(b.asiento.fecha) ||
        a.asiento.numero - b.asiento.numero ||
        a.linea.id.localeCompare(b.linea.id),
    );

  const resultado = calcularMovimientos(ordenadas, contactos, cuenta.naturaleza === "credito", desde, hasta);

  return { cuenta, ...resultado };
}

function calcularMovimientos(
  ordenadas: readonly LineaConAsiento[],
  contactos: Map<string, ContactoResumen>,
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
      contacto: linea.contacto_id == null ? null : (contactos.get(linea.contacto_id) ?? null),
    });
  }

  return { movimientos, saldoCentavos: acumulado, totalDebitoCentavos, totalCreditoCentavos };
}
