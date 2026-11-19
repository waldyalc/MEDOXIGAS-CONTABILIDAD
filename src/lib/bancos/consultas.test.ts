import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";

import { readFileSync } from "node:fs";
import { join } from "node:path";

const mocks = vi.hoisted(() => ({ createClient: vi.fn() }));

vi.mock("@/lib/supabase/server", () => ({ createClient: mocks.createClient }));

const { getIngresosGastosMensual } = await import("./consultas");

type Fila = Record<string, unknown>;

interface Filtro {
  operacion: "gte" | "neq" | "in";
  columna: string;
  valor: unknown;
}

interface Consulta {
  tabla: string;
  columnas: string | null;
  filtros: Filtro[];
  orden: string[];
  desde: number | null;
  hasta: number | null;
}

function clienteFalso(filas: Record<string, Fila[]>, consultas: Consulta[], errores: Record<string, string> = {}) {
  return {
    from(tabla: string) {
      const consulta: Consulta = {
        tabla,
        columnas: null,
        filtros: [],
        orden: [],
        desde: null,
        hasta: null,
      };
      consultas.push(consulta);

      const consultaFalsa = {
        select(columnas: string) {
          consulta.columnas = columnas;
          return consultaFalsa;
        },
        gte(columna: string, valor: unknown) {
          consulta.filtros.push({ operacion: "gte", columna, valor });
          return consultaFalsa;
        },
        neq(columna: string, valor: unknown) {
          consulta.filtros.push({ operacion: "neq", columna, valor });
          return consultaFalsa;
        },
        in(columna: string, valor: unknown) {
          consulta.filtros.push({ operacion: "in", columna, valor });
          return consultaFalsa;
        },
        order(columna: string) {
          consulta.orden.push(columna);
          return consultaFalsa;
        },
        range(desde: number, hasta: number) {
          consulta.desde = desde;
          consulta.hasta = hasta;
          return consultaFalsa;
        },
        returns() {
          const mensaje = errores[tabla];
          if (mensaje) return Promise.resolve({ data: null, error: { message: mensaje } });
          const todas = filas[tabla] ?? [];
          const desde = consulta.desde ?? 0;
          const hasta = consulta.hasta ?? todas.length - 1;
          return Promise.resolve({ data: todas.slice(desde, hasta + 1), error: null });
        },
      };

      return consultaFalsa;
    },
  };
}

const CUENTA_BANCO: Fila = {
  id: "cuenta-banco",
  codigo: "1101",
  nombre: "Banco",
  activa: true,
  acepta_movimientos: true,
  es_caja_banco: true,
  tipo_banco: "banco",
  numero_cuenta: null,
  descripcion: null,
};

function filtro(consulta: Consulta | undefined, operacion: Filtro["operacion"], columna: string): unknown {
  return consulta?.filtros.find((item) => item.operacion === operacion && item.columna === columna)?.valor;
}

function tabla(consultas: Consulta[], nombre: string): Consulta[] {
  return consultas.filter((consulta) => consulta.tabla === nombre);
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.useFakeTimers({ toFake: ["Date"] });
  // El 19 de noviembre en RD: la ventana de la gráfica es junio–noviembre 2026.
  vi.setSystemTime(new Date("2026-11-19T12:00:00Z"));
});

afterEach(() => {
  vi.useRealTimers();
});

describe("getIngresosGastosMensual", () => {
  test("consulta asientos por fecha antes de sus líneas, sin join asientos!inner", async () => {
    const consultas: Consulta[] = [];
    mocks.createClient.mockResolvedValue(
      clienteFalso(
        {
          cuentas: [CUENTA_BANCO],
          asientos: [{ id: "asiento-1", fecha: "2026-11-10" }],
          asiento_lineas: [{ asiento_id: "asiento-1", debito: 10, credito: 0 }],
        },
        consultas,
      ),
    );

    await getIngresosGastosMensual();

    const [asiento] = tabla(consultas, "asientos");
    expect(asiento).toBeDefined();
    expect(asiento?.columnas).toBe("id, fecha");
    expect(filtro(asiento, "gte", "fecha")).toBe("2026-06-01");
    expect(filtro(asiento, "neq", "origen_tipo")).toBe("transferencia");
    expect(asiento?.orden).toEqual(["fecha", "id"]);

    const lineas = tabla(consultas, "asiento_lineas");
    expect(lineas).toHaveLength(1);
    expect(lineas[0]?.columnas).toBe("asiento_id, debito, credito");
    expect(lineas[0]?.columnas).not.toContain("asientos!inner");
    expect(filtro(lineas[0], "in", "asiento_id")).toEqual(["asiento-1"]);
    expect(filtro(lineas[0], "in", "cuenta_id")).toEqual(["cuenta-banco"]);

    const orden = consultas.map((consulta) => consulta.tabla);
    expect(orden.indexOf("asientos")).toBeLessThan(orden.indexOf("asiento_lineas"));
  });

  test("sin asientos en la ventana devuelve 6 meses en cero y no consulta líneas", async () => {
    const consultas: Consulta[] = [];
    mocks.createClient.mockResolvedValue(
      clienteFalso({ cuentas: [CUENTA_BANCO], asientos: [], asiento_lineas: [] }, consultas),
    );

    const puntos = await getIngresosGastosMensual();

    expect(puntos.map((punto) => punto.clave)).toEqual([
      "2026-06",
      "2026-07",
      "2026-08",
      "2026-09",
      "2026-10",
      "2026-11",
    ]);
    expect(puntos.every((punto) => punto.ingresosCentavos === 0 && punto.gastosCentavos === 0)).toBe(true);
    expect(tabla(consultas, "asiento_lineas")).toHaveLength(0);
  });

  test("suma débitos como ingresos y créditos como gastos en su mes e ignora meses fuera", async () => {
    mocks.createClient.mockResolvedValue(
      clienteFalso(
        {
          cuentas: [CUENTA_BANCO],
          asientos: [
            { id: "asiento-noviembre", fecha: "2026-11-10" },
            { id: "asiento-junio", fecha: "2026-06-05" },
            { id: "asiento-mayo", fecha: "2026-05-31" },
            { id: "asiento-diciembre", fecha: "2026-12-01" },
          ],
          asiento_lineas: [
            { asiento_id: "asiento-noviembre", debito: 1500.5, credito: 0 },
            { asiento_id: "asiento-noviembre", debito: 0, credito: "200.25" },
            { asiento_id: "asiento-junio", debito: 100, credito: 0 },
            { asiento_id: "asiento-mayo", debito: 999, credito: 0 },
            { asiento_id: "asiento-diciembre", debito: 888, credito: 0 },
            { asiento_id: "asiento-fantasma", debito: 777, credito: 0 },
          ],
        },
        [],
      ),
    );

    const puntos = await getIngresosGastosMensual();
    const porClave = new Map(puntos.map((punto) => [punto.clave, punto]));

    expect(puntos).toHaveLength(6);
    expect(puntos[0]?.mes).toBe("Junio");
    expect(puntos[5]?.mes).toBe("Noviembre");
    expect(porClave.get("2026-11")).toMatchObject({ ingresosCentavos: 150_050, gastosCentavos: 20_025 });
    expect(porClave.get("2026-06")).toMatchObject({ ingresosCentavos: 10_000, gastosCentavos: 0 });
    expect(porClave.get("2026-05")).toBeUndefined();
    expect(porClave.get("2026-12")).toBeUndefined();
    expect(puntos.reduce((total, punto) => total + punto.ingresosCentavos, 0)).toBe(160_050);
    expect(puntos.reduce((total, punto) => total + punto.gastosCentavos, 0)).toBe(20_025);
  });

  test("propaga el error al leer asientos y no consulta líneas", async () => {
    const consultas: Consulta[] = [];
    mocks.createClient.mockResolvedValue(
      clienteFalso({ cuentas: [CUENTA_BANCO], asiento_lineas: [] }, consultas, {
        asientos: "canceling statement due to statement timeout",
      }),
    );

    await expect(getIngresosGastosMensual()).rejects.toThrow("canceling statement due to statement timeout");
    expect(tabla(consultas, "asiento_lineas")).toHaveLength(0);
  });

  test("propaga el error al leer las líneas", async () => {
    mocks.createClient.mockResolvedValue(
      clienteFalso(
        {
          cuentas: [CUENTA_BANCO],
          asientos: [{ id: "asiento-1", fecha: "2026-11-10" }],
        },
        [],
        { asiento_lineas: "boom" },
      ),
    );

    await expect(getIngresosGastosMensual()).rejects.toThrow("boom");
  });
});

describe("candado: la gráfica de bancos no vuelve al join lento", () => {
  function cuerpoDeLaFuncion(): string {
    const codigo = readFileSync(join(process.cwd(), "src/lib/bancos/consultas.ts"), "utf8");
    const inicio = codigo.indexOf("export async function getIngresosGastosMensual");
    if (inicio === -1) throw new Error("No existe getIngresosGastosMensual en src/lib/bancos/consultas.ts");
    const siguiente = codigo.indexOf("\nexport ", inicio + 1);
    return siguiente === -1 ? codigo.slice(inicio) : codigo.slice(inicio, siguiente);
  }

  test("prohíbe asientos!inner y filtrar asientos.fecha desde asiento_lineas", () => {
    const cuerpo = cuerpoDeLaFuncion();

    expect(
      cuerpo,
      "getIngresosGastosMensual debe leer asientos primero y luego sus líneas con consultarEnLotes",
    ).toMatch(/\.from\("asientos"\)/);
    expect(cuerpo, "Excluye las transferencias en la consulta de asientos").toMatch(
      /neq\("origen_tipo", "transferencia"\)/,
    );
    expect(
      cuerpo,
      "No vuelvas al join asientos!inner: recorre el histórico completo y agota el statement_timeout",
    ).not.toMatch(/asientos!inner/);
    expect(
      cuerpo,
      "No filtres asientos.fecha desde asiento_lineas: usa el rango de fechas en la consulta de asientos",
    ).not.toMatch(/\.gte\("asientos\.fecha"/);
  });
});
