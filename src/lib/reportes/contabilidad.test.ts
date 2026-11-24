import { describe, expect, test } from "vitest";

import { construirArbolCuentas } from "./contabilidad";
import type { CuentaContable } from "./tipos";

function cuenta(
  id: string,
  codigo: string,
  nombre: string,
  tipo: string,
  naturaleza: string,
  padreId: string | null,
): CuentaContable {
  return {
    id,
    codigo,
    nombre,
    tipo,
    naturaleza,
    padre_id: padreId,
    acepta_movimientos: padreId != null,
    activa: true,
  };
}

const CUENTAS: CuentaContable[] = [
  cuenta("activos", "1", "Activos", "activo", "debito", null),
  cuenta("no-corrientes", "12", "Activos no corrientes", "activo", "debito", "activos"),
  cuenta("equipos", "1201", "Equipos", "activo", "debito", "no-corrientes"),
  cuenta("depreciacion", "1211", "Depreciación acumulada", "activo", "credito", "no-corrientes"),
  cuenta("pasivos", "2", "Pasivos", "pasivo", "credito", null),
  cuenta("cxp", "2101", "Cuentas por pagar", "pasivo", "credito", "pasivos"),
  cuenta("anticipos", "2102", "Anticipos por aplicar", "pasivo", "debito", "pasivos"),
];

describe("construirArbolCuentas con contra-cuentas", () => {
  test("una hija de naturaleza distinta resta del padre en vez de inflarlo", () => {
    const arbol = construirArbolCuentas(CUENTAS, {
      "1201": 100000,
      "1211": 25000,
      "2101": 70000,
      "2102": 5000,
    });

    const activos = arbol[0];
    const noCorrientes = activos?.hijos[0];
    const equipos = noCorrientes?.hijos[0];
    const depreciacion = noCorrientes?.hijos[1];
    const pasivos = arbol[1];

    // 1211 es contra-cuenta de 12: 100,000 de equipos menos 25,000 de depreciación.
    expect(noCorrientes?.saldo).toBe(75000);
    expect(activos?.saldo).toBe(75000);
    // La cuenta hija conserva su saldo en su naturaleza (crédito).
    expect(depreciacion?.saldo).toBe(25000);
    expect(equipos?.saldo).toBe(100000);
    // Contra-pasivo: 70,000 por pagar menos 5,000 de anticipos.
    expect(pasivos?.saldo).toBe(65000);
  });

  test("sin contra-cuentas sigue sumando los hijos en todos los niveles", () => {
    const arbol = construirArbolCuentas(CUENTAS, { "1201": 100000, "2101": 70000 });

    expect(arbol[0]?.hijos[0]?.saldo).toBe(100000);
    expect(arbol[0]?.saldo).toBe(100000);
    expect(arbol[1]?.saldo).toBe(70000);
  });
});
