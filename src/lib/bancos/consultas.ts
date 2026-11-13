import type { SupabaseClient } from "@supabase/supabase-js";

import { obtenerSaldosCajaBanco } from "@/lib/reportes/saldos";
import { createClient } from "@/lib/supabase/server";

import type { CuentaBanco, CuentaSeleccion } from "./tipos";

interface CuentaFila {
  id: string;
  codigo: string;
  nombre: string;
  activa: boolean;
  acepta_movimientos: boolean;
  es_caja_banco: boolean;
  tipo_banco: string | null;
  numero_cuenta: string | null;
}

async function getCuentas(): Promise<CuentaFila[]> {
  const supabase = (await createClient()) as unknown as SupabaseClient;
  const { data, error } = await supabase
    .from("cuentas")
    .select("id, codigo, nombre, activa, acepta_movimientos, es_caja_banco, tipo_banco, numero_cuenta")
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

export async function getDatosBancos(): Promise<DatosBancos> {
  const [saldos, cuentas] = await Promise.all([obtenerSaldosCajaBanco(), getCuentas()]);
  if (saldos.error) throw new Error(saldos.error);

  const detalle = new Map(cuentas.map((cuenta) => [cuenta.id, cuenta]));

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
      };
    }),
    cuentasCajaBanco: cuentas
      .filter((cuenta) => cuenta.es_caja_banco && cuenta.activa && cuenta.acepta_movimientos)
      .map(resumirCuenta),
    cuentasMovimiento: cuentas.filter((cuenta) => cuenta.activa && cuenta.acepta_movimientos).map(resumirCuenta),
  };
}
