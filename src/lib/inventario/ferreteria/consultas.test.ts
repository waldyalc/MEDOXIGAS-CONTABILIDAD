import { beforeEach, describe, expect, test, vi } from "vitest";

const mocks = vi.hoisted(() => ({ createClient: vi.fn() }));

vi.mock("@/lib/supabase/server", () => ({ createClient: mocks.createClient }));

const { buscarProductoPorCodigoBarra, listarCatalogoPos } = await import("./consultas");

const PRODUCTO = "11111111-1111-4111-8111-111111111111";
const ALMACEN = "22222222-2222-4222-8222-222222222222";

beforeEach(() => {
  vi.clearAllMocks();
});

describe("buscarProductoPorCodigoBarra", () => {
  test("llama la RPC con el código recortado y el almacén", async () => {
    const rpc = vi.fn().mockResolvedValue({
      data: [
        {
          producto_id: PRODUCTO,
          nombre: "Cemento gris",
          referencia: null,
          marca: "Ferretería X",
          tipo: "producto",
          unidad_id: null,
          unidad_nombre: "Caja 50 lb",
          factor_base: 5,
          precio: 3200,
          itbis_tasa: 18,
          stock: 10,
          disponible: 10,
          imagen_path: null,
          favorito_pos: true,
          codigo: "7501234567890",
        },
      ],
      error: null,
    });
    mocks.createClient.mockResolvedValue({ rpc });

    const producto = await buscarProductoPorCodigoBarra({ codigo: "  7501234567890 ", almacen_id: ALMACEN });

    expect(rpc).toHaveBeenCalledWith("pos_buscar_por_codigo_barra", {
      p_codigo: "7501234567890",
      p_almacen_id: ALMACEN,
    });
    expect(producto?.precio).toBe("3200");
    expect(producto?.factor_base).toBe("5");
  });

  test("sin almacén ni lista no manda esos argumentos", async () => {
    const rpc = vi.fn().mockResolvedValue({ data: [], error: null });
    mocks.createClient.mockResolvedValue({ rpc });

    await expect(buscarProductoPorCodigoBarra({ codigo: "123" })).resolves.toBeNull();
    expect(rpc).toHaveBeenCalledWith("pos_buscar_por_codigo_barra", { p_codigo: "123" });
  });

  test("un código vacío no llega a la base", async () => {
    await expect(buscarProductoPorCodigoBarra({ codigo: "   " })).resolves.toBeNull();
    expect(mocks.createClient).not.toHaveBeenCalled();
  });
});

describe("listarCatalogoPos", () => {
  test("manda los filtros y los topes por defecto", async () => {
    const rpc = vi.fn().mockResolvedValue({
      data: [
        {
          producto_id: PRODUCTO,
          nombre: "Alambre",
          referencia: "AL-1",
          marca: null,
          tipo: "producto",
          categoria_id: null,
          favorito_pos: false,
          imagen_path: null,
          unidad_medida: "Metro",
          precio: 100,
          itbis_tasa: 18,
          stock: 3,
          disponible: 3,
          unidades: [{ id: PRODUCTO, nombre: "Rollo 100 m", factor_base: 100, precio: 9500 }],
        },
      ],
      error: null,
    });
    mocks.createClient.mockResolvedValue({ rpc });

    const productos = await listarCatalogoPos({});
    expect(rpc).toHaveBeenCalledWith("pos_catalogo_productos", {
      p_solo_favoritos: false,
      p_limit: 50,
      p_offset: 0,
    });
    expect(productos[0]?.unidades[0]?.factor_base).toBe("100");

    await listarCatalogoPos({
      almacen_id: ALMACEN,
      busqueda: "  cemento ",
      solo_favoritos: true,
      limit: 10,
      offset: 20,
    });
    expect(rpc).toHaveBeenLastCalledWith("pos_catalogo_productos", {
      p_solo_favoritos: true,
      p_limit: 10,
      p_offset: 20,
      p_almacen_id: ALMACEN,
      p_busqueda: "cemento",
    });
  });

  test("un límite fuera de rango no llega a la base", async () => {
    await expect(listarCatalogoPos({ limit: 0 })).resolves.toEqual([]);
    expect(mocks.createClient).not.toHaveBeenCalled();
  });
});
