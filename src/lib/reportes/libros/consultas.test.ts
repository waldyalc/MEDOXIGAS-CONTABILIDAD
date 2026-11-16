import { beforeEach, describe, expect, test, vi } from "vitest";

import type { FilaMovimiento } from "./tipos";

const mocks = vi.hoisted(() => ({ createClient: vi.fn() }));

vi.mock("@/lib/supabase/server", () => ({ createClient: mocks.createClient }));

const { calcularAgrupado } = await import("./agrupado");
const { obtenerMovimientos, obtenerSaldosCuentas } = await import("./consultas");

interface Llamada {
  nombre: string;
  orden: string[];
  desde: number;
  hasta: number;
}

interface ConstructorFalso<T> {
  order(columna: string): ConstructorFalso<T>;
  range(desde: number, hasta: number): Promise<{ data: T[]; error: null }>;
}

function clienteFalso<T>(filas: readonly T[], llamadas: Llamada[]) {
  return {
    rpc(nombre: string) {
      const orden: string[] = [];
      const consulta: ConstructorFalso<T> = {
        order(columna) {
          orden.push(columna);
          return consulta;
        },
        range(desde, hasta) {
          llamadas.push({ nombre, orden: [...orden], desde, hasta });
          return Promise.resolve({ data: filas.slice(desde, hasta + 1), error: null });
        },
      };
      return consulta;
    },
  };
}

function movimiento(indice: number): FilaMovimiento {
  return {
    asiento_id: `asiento-${indice}`,
    asiento_numero: indice,
    fecha: "2026-11-01",
    estado: "Contabilizado",
    origen_tipo: "factura",
    documento: null,
    contacto_id: "contacto-1",
    tercero: "Cliente Uno",
    cuenta_id: "cuenta-1103",
    cuenta_codigo: "1103",
    cuenta_nombre: "Cuentas por cobrar clientes",
    cuenta_naturaleza: "debito",
    debito: "10.00",
    credito: "0.00",
  };
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe("obtenerMovimientos paginado", () => {
  test("lee más de 1,000 líneas y el agrupado las suma todas", async () => {
    const filas = Array.from({ length: 2500 }, (_, indice) => movimiento(indice + 1));
    const llamadas: Llamada[] = [];
    mocks.createClient.mockResolvedValue(clienteFalso(filas, llamadas));

    const { filas: resultado, error } = await obtenerMovimientos({
      desde: "2026-01-01",
      hasta: "2026-12-31",
    });

    expect(error).toBeNull();
    expect(resultado).toHaveLength(2500);
    expect(llamadas.map(({ desde, hasta }) => [desde, hasta])).toEqual([
      [0, 999],
      [1000, 1999],
      [2000, 2999],
    ]);
    expect(llamadas.every(({ nombre }) => nombre === "reporte_movimientos")).toBe(true);

    const agrupado = calcularAgrupado(resultado, [], [], "cuenta");

    expect(agrupado.total.debito).toBe(2_500_000);
    expect(agrupado.total.credito).toBe(0);
    expect(agrupado.total.neto).toBe(2_500_000);
    expect(agrupado.grupos).toHaveLength(1);
    expect(agrupado.grupos[0]?.detalles).toHaveLength(2500);
  });
});

describe("obtenerSaldosCuentas paginado", () => {
  test("lee más de 1,000 cuentas", async () => {
    const filas = Array.from({ length: 1250 }, (_, indice) => ({
      cuenta_id: `cuenta-${indice}`,
      cuenta_codigo: String(indice).padStart(4, "0"),
    }));
    const llamadas: Llamada[] = [];
    mocks.createClient.mockResolvedValue(clienteFalso(filas, llamadas));

    const { filas: resultado, error } = await obtenerSaldosCuentas("2026-01-01", "2026-12-31", false);

    expect(error).toBeNull();
    expect(resultado).toHaveLength(1250);
    expect(llamadas.map(({ desde, hasta }) => [desde, hasta])).toEqual([
      [0, 999],
      [1000, 1999],
    ]);
    expect(llamadas[0]?.nombre).toBe("reporte_saldos_cuentas");
    expect(llamadas[0]?.orden).toEqual(["cuenta_codigo", "cuenta_id"]);
  });
});
