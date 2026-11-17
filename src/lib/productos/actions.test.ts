import { beforeEach, describe, expect, test, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  createClient: vi.fn(),
  revalidatePath: vi.fn(),
}));

vi.mock("@/lib/supabase/server", () => ({ createClient: mocks.createClient }));
vi.mock("next/cache", () => ({ revalidatePath: mocks.revalidatePath }));

const { actualizarProducto, crearProducto } = await import("./actions");

const PRODUCTO = "44444444-4444-4444-8444-444444444444";
const ALMACEN = "33333333-3333-4333-8333-333333333333";

function formulario(campos: Record<string, string> = {}) {
  const datos = new FormData();
  const base: Record<string, string> = {
    nombre: "Cilindro de oxígeno",
    tipo: "producto",
    precio: "2500",
    itbis_tasa: "18",
    inventariable: "true",
    cantidad: "5",
    costo: "1000",
  };

  for (const [campo, valor] of Object.entries({ ...base, ...campos })) datos.set(campo, valor);
  return datos;
}

function payloadDe(rpc: ReturnType<typeof vi.fn>) {
  const llamada = rpc.mock.calls[0] as [string, { p: Record<string, unknown> }] | undefined;
  return llamada?.[1].p;
}

beforeEach(() => {
  vi.clearAllMocks();
  mocks.createClient.mockResolvedValue({ rpc: vi.fn().mockResolvedValue({ error: null }) });
});

describe("actualizarProducto", () => {
  test("envía unidad, almacén, venta en negativo, imagen y mínimos por almacén", async () => {
    const rpc = vi.fn().mockResolvedValue({ error: null });
    mocks.createClient.mockResolvedValue({ rpc });

    const resultado = await actualizarProducto(
      PRODUCTO,
      formulario({
        unidad_medida: " Caja ",
        almacen_id: ALMACEN,
        vende_negativo: "true",
        imagen_path: "producto/imagen.png",
        [`existencia_minimo_${ALMACEN}`]: "2",
        [`existencia_maximo_${ALMACEN}`]: "10",
      }),
    );

    expect(resultado).toEqual({ ok: true });
    expect(rpc).toHaveBeenCalledWith("actualizar_producto", {
      p_id: PRODUCTO,
      p: expect.objectContaining({
        unidad_medida: "Caja",
        almacen_id: ALMACEN,
        vende_negativo: true,
        imagen_path: "producto/imagen.png",
        existencias: [{ almacen_id: ALMACEN, minimo: 2, maximo: 10 }],
      }),
    });
    expect(mocks.revalidatePath).toHaveBeenCalledWith("/dashboard/productos");
  });

  test("no envía los campos nuevos si el formulario no los manda", async () => {
    const rpc = vi.fn().mockResolvedValue({ error: null });
    mocks.createClient.mockResolvedValue({ rpc });

    await actualizarProducto(PRODUCTO, formulario());

    const payload = payloadDe(rpc);
    expect(payload).toBeDefined();
    for (const campo of [
      "unidad_medida",
      "almacen_id",
      "vende_negativo",
      "imagen_path",
      "minimo",
      "maximo",
      "existencias",
    ]) {
      expect(payload && campo in payload).toBe(false);
    }
  });

  test("un máximo vacío viaja como null y el mínimo vacío como 0", async () => {
    const rpc = vi.fn().mockResolvedValue({ error: null });
    mocks.createClient.mockResolvedValue({ rpc });

    await actualizarProducto(
      PRODUCTO,
      formulario({
        [`existencia_minimo_${ALMACEN}`]: "",
        [`existencia_maximo_${ALMACEN}`]: "",
      }),
    );

    expect(payloadDe(rpc)?.existencias).toEqual([{ almacen_id: ALMACEN, minimo: 0, maximo: null }]);
  });

  test("rechaza una unidad de medida en blanco sin llamar la RPC", async () => {
    const rpc = vi.fn();
    mocks.createClient.mockResolvedValue({ rpc });

    await expect(actualizarProducto(PRODUCTO, formulario({ unidad_medida: "  " }))).resolves.toEqual({
      ok: false,
      error: "La unidad de medida es obligatoria",
    });
    expect(rpc).not.toHaveBeenCalled();
  });

  test("ignora mínimos de almacenes con id inválido", async () => {
    const rpc = vi.fn().mockResolvedValue({ error: null });
    mocks.createClient.mockResolvedValue({ rpc });

    await actualizarProducto(PRODUCTO, formulario({ existencia_minimo_no_es_uuid: "3" }));

    const payload = payloadDe(rpc) ?? {};
    expect("existencias" in payload).toBe(false);
  });
});

describe("crearProducto", () => {
  test("devuelve el id y manda la imagen y la unidad", async () => {
    const rpc = vi.fn().mockResolvedValue({ data: PRODUCTO, error: null });
    mocks.createClient.mockResolvedValue({ rpc });

    const resultado = await crearProducto(
      formulario({
        unidad_medida: "Unidad",
        almacen_id: ALMACEN,
        vende_negativo: "false",
        imagen_path: "",
      }),
    );

    expect(resultado).toEqual({ ok: true, id: PRODUCTO });
    expect(rpc).toHaveBeenCalledWith("crear_producto", {
      p: expect.objectContaining({
        unidad_medida: "Unidad",
        almacen_id: ALMACEN,
        vende_negativo: false,
        imagen_path: null,
      }),
    });
  });
});
