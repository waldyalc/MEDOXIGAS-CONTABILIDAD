import { beforeEach, describe, expect, test, vi } from "vitest";

const mocks = vi.hoisted(() => ({ createClient: vi.fn() }));

vi.mock("@/lib/supabase/server", () => ({ createClient: mocks.createClient }));

const { getAsientosLista } = await import("./consultas");

interface ConstructorFalso {
  select(columnas: string, opciones?: unknown): ConstructorFalso;
  gte(columna: string, valor: string): ConstructorFalso;
  lte(columna: string, valor: string): ConstructorFalso;
  or(filtro: string): ConstructorFalso;
  order(columna: string, opciones?: unknown): ConstructorFalso;
  range(desde: number, hasta: number): ConstructorFalso;
  returns(): Promise<{ data: never[]; error: null; count: number }>;
}

/** Cadena mínima de PostgREST que guarda los filtros `.or()` recibidos. */
function clienteFalso(filtros: string[]) {
  const consulta: ConstructorFalso = {
    select: () => consulta,
    gte: () => consulta,
    lte: () => consulta,
    or: (filtro) => {
      filtros.push(filtro);
      return consulta;
    },
    order: () => consulta,
    range: () => consulta,
    returns: () => Promise.resolve({ data: [], error: null, count: 0 }),
  };

  return { from: () => consulta };
}

const OPCIONES = { pagina: 1, tamano: 25, q: "" };

beforeEach(() => {
  vi.clearAllMocks();
});

describe("getAsientosLista", () => {
  test("busca el código visible aunque no sea numérico", async () => {
    const filtros: string[] = [];
    mocks.createClient.mockResolvedValue(clienteFalso(filtros));

    await getAsientosLista({ ...OPCIONES, q: "AC-12" });

    expect(filtros).toEqual(['codigo.ilike."%AC-12%",descripcion.ilike."%AC-12%"']);
  });

  test("agrega el número cuando el término es numérico", async () => {
    const filtros: string[] = [];
    mocks.createClient.mockResolvedValue(clienteFalso(filtros));

    await getAsientosLista({ ...OPCIONES, q: "12" });

    expect(filtros).toEqual(['codigo.ilike."%12%",descripcion.ilike."%12%",numero.eq.12']);
  });

  test("sin búsqueda no agrega filtro de texto", async () => {
    const filtros: string[] = [];
    mocks.createClient.mockResolvedValue(clienteFalso(filtros));

    await getAsientosLista(OPCIONES);

    expect(filtros).toEqual([]);
  });
});
