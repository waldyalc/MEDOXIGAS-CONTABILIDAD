import type { CuentaCajaBanco, CuentaContable, CuentaGasto } from "./tipos";

function resumirCuenta(cuenta: CuentaContable): CuentaGasto {
  return { id: cuenta.id, codigo: cuenta.codigo, nombre: cuenta.nombre };
}

export function filtrarCuentasGasto(cuentas: CuentaContable[]): CuentaGasto[] {
  return cuentas
    .filter((cuenta) => cuenta.tipo === "gasto" && cuenta.acepta_movimientos && cuenta.activa)
    .map(resumirCuenta);
}

export function filtrarCuentasCajaBanco(cuentas: CuentaContable[]): CuentaCajaBanco[] {
  return cuentas
    .filter((cuenta) => cuenta.es_caja_banco && cuenta.acepta_movimientos && cuenta.activa)
    .map(resumirCuenta);
}

export function elegirCuentaGastoPorDefecto(cuentas: CuentaGasto[]): CuentaGasto | null {
  return cuentas.find((cuenta) => cuenta.codigo === "6101") ?? cuentas[0] ?? null;
}

export function elegirCuentaPagoPorDefecto(cuentas: CuentaCajaBanco[]): CuentaCajaBanco | null {
  return (
    cuentas.find((cuenta) => cuenta.codigo === "1106") ??
    cuentas.find((cuenta) => cuenta.codigo === "1101") ??
    cuentas[0] ??
    null
  );
}

export function etiquetaCuenta(cuenta: { codigo: string; nombre: string }): string {
  return `${cuenta.codigo} ${cuenta.nombre}`;
}
