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
}

async function getCuentas(): Promise<CuentaFila[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("cuentas")
    .select("id, codigo, nombre, activa, acepta_movimientos, es_caja_banco")
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

  return {
    cuentas: saldos.filas.map((fila) => ({
      id: fila.cuenta_id,
      codigo: fila.codigo,
      nombre: fila.nombre,
      saldo: fila.saldo,
    })),
    cuentasCajaBanco: cuentas
      .filter((cuenta) => cuenta.es_caja_banco && cuenta.activa && cuenta.acepta_movimientos)
      .map(resumirCuenta),
    cuentasMovimiento: cuentas.filter((cuenta) => cuenta.activa && cuenta.acepta_movimientos).map(resumirCuenta),
  };
}
