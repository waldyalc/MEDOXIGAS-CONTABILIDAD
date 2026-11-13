import { sinAcentos } from "./filas";
import type { CuentaEstado } from "./tipos";

export type SeccionCuenta = "corriente" | "no-corriente";

export function mapaCuentas(cuentas: readonly CuentaEstado[]): Map<string, CuentaEstado> {
  return new Map(cuentas.map((cuenta) => [cuenta.id, cuenta]));
}

/** Devuelve el hijo directo de la raíz (por ejemplo 11 o 22) usando padre_id. */
export function grupoCuenta(cuenta: CuentaEstado, porId: ReadonlyMap<string, CuentaEstado>): CuentaEstado {
  let actual = cuenta;
  let hijo = cuenta;

  while (actual.padre_id != null) {
    const padre = porId.get(actual.padre_id);
    if (padre == null) break;
    hijo = actual;
    actual = padre;
  }

  return hijo;
}

export function seccionCuenta(cuenta: CuentaEstado, porId: ReadonlyMap<string, CuentaEstado>): SeccionCuenta {
  const grupo = grupoCuenta(cuenta, porId);

  if (grupo.codigo.startsWith("12") || grupo.codigo.startsWith("22")) return "no-corriente";
  if (grupo.codigo.startsWith("11") || grupo.codigo.startsWith("21")) return "corriente";
  return sinAcentos(grupo.nombre).includes("no corriente") ? "no-corriente" : "corriente";
}

export function perteneceGrupo(
  cuenta: CuentaEstado,
  prefijo: string,
  porId: ReadonlyMap<string, CuentaEstado>,
): boolean {
  const grupo = grupoCuenta(cuenta, porId);
  return grupo.codigo.startsWith(prefijo) || cuenta.codigo.startsWith(prefijo);
}
