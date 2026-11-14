import { z } from "zod";

import { createClient } from "@/lib/supabase/server";

interface AsientoFila {
  id: string;
  numero: number;
  fecha: string;
  descripcion: string;
  origen_tipo: string;
  numeracion_ingreso: string | null;
  numeracion_egreso: string | null;
}

interface LineaFila {
  id: string;
  cuenta_id: string;
  descripcion: string | null;
  debito: number;
  credito: number;
}

interface CuentaFila {
  id: string;
  codigo: string;
  nombre: string;
}

export interface LineaTransferencia {
  id: string;
  descripcion: string | null;
  debito: number;
  credito: number;
  cuenta: CuentaFila | null;
}

export interface DetalleTransferencia {
  id: string;
  numero: number;
  fecha: string;
  descripcion: string;
  origenTipo: "transferencia" | "deposito";
  numeracionIngreso: string | null;
  numeracionEgreso: string | null;
  lineas: LineaTransferencia[];
}

export async function getDetalleTransferencia(id: string): Promise<DetalleTransferencia | null> {
  if (!z.uuid().safeParse(id).success) return null;

  const cliente = await createClient();
  const { data: asiento, error } = await cliente
    .from("asientos")
    .select("id, numero, fecha, descripcion, origen_tipo, numeracion_ingreso, numeracion_egreso")
    .eq("id", id)
    .maybeSingle()
    .returns<AsientoFila | null>();

  if (error) throw new Error(error.message);
  if (!asiento) return null;
  if (asiento.origen_tipo !== "transferencia" && asiento.origen_tipo !== "deposito") return null;

  const { data: lineas, error: errorLineas } = await cliente
    .from("asiento_lineas")
    .select("id, cuenta_id, descripcion, debito, credito")
    .eq("asiento_id", id)
    .order("id")
    .returns<LineaFila[]>();

  if (errorLineas) throw new Error(errorLineas.message);

  const cuentaIds = [...new Set((lineas ?? []).map((linea) => linea.cuenta_id))];
  const { data: cuentas, error: errorCuentas } =
    cuentaIds.length === 0
      ? { data: [] as CuentaFila[], error: null }
      : await cliente.from("cuentas").select("id, codigo, nombre").in("id", cuentaIds).returns<CuentaFila[]>();

  if (errorCuentas) throw new Error(errorCuentas.message);

  const cuentasPorId = new Map((cuentas ?? []).map((cuenta) => [cuenta.id, cuenta]));

  return {
    id: asiento.id,
    numero: asiento.numero,
    fecha: asiento.fecha,
    descripcion: asiento.descripcion,
    origenTipo: asiento.origen_tipo,
    numeracionIngreso: asiento.numeracion_ingreso,
    numeracionEgreso: asiento.numeracion_egreso,
    lineas: (lineas ?? []).map((linea) => ({
      id: linea.id,
      descripcion: linea.descripcion,
      debito: linea.debito,
      credito: linea.credito,
      cuenta: cuentasPorId.get(linea.cuenta_id) ?? null,
    })),
  };
}
