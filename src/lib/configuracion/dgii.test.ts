import { beforeEach, describe, expect, test, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  getRol: vi.fn(),
  createClient: vi.fn(),
  revalidatePath: vi.fn(),
}));

vi.mock("@/lib/auth/rol", () => ({ getRol: mocks.getRol }));
vi.mock("@/lib/supabase/server", () => ({ createClient: mocks.createClient }));
vi.mock("next/cache", () => ({ revalidatePath: mocks.revalidatePath }));

const { actualizarClasificacionDgii } = await import("./dgii-acciones");
const { etiquetaCategoriaDgii, etiquetaTipoCompra, etiquetaTipoIngreso } = await import("./dgii");

const cuentaId = "11111111-1111-4111-8111-111111111111";

beforeEach(() => {
  vi.clearAllMocks();
  mocks.getRol.mockResolvedValue("contador");
});

describe("actualizarClasificacionDgii", () => {
  test("llama la RPC directo con los tres campos y recarga los reportes", async () => {
    const rpc = vi.fn().mockResolvedValue({ error: null });
    mocks.createClient.mockResolvedValue({ rpc });

    await expect(
      actualizarClasificacionDgii({
        cuentaId,
        categoriaDgii: "09",
        tipoCompra: "bienes",
        tipoIngreso: null,
      }),
    ).resolves.toEqual({ ok: true });

    expect(rpc).toHaveBeenCalledWith("actualizar_clasificacion_dgii", {
      p: { cuenta_id: cuentaId, categoria_dgii: "09", tipo_compra: "bienes", tipo_ingreso: null },
    });
    expect(mocks.revalidatePath).toHaveBeenCalledWith("/dashboard/configuracion/reportes-dgii");
    expect(mocks.revalidatePath).toHaveBeenCalledWith("/dashboard/reportes/606");
    expect(mocks.revalidatePath).toHaveBeenCalledWith("/dashboard/reportes/607");
  });

  test("limpia la clasificación con null", async () => {
    const rpc = vi.fn().mockResolvedValue({ error: null });
    mocks.createClient.mockResolvedValue({ rpc });

    await actualizarClasificacionDgii({ cuentaId, categoriaDgii: "", tipoCompra: "", tipoIngreso: "" });

    expect(rpc).toHaveBeenCalledWith("actualizar_clasificacion_dgii", {
      p: { cuenta_id: cuentaId, categoria_dgii: null, tipo_compra: null, tipo_ingreso: null },
    });
  });

  test("devuelve en español los errores de validación sin tocar la RPC", async () => {
    await expect(
      actualizarClasificacionDgii({ cuentaId, categoriaDgii: "99", tipoCompra: "bienes", tipoIngreso: null }),
    ).resolves.toEqual({ ok: false, error: "La categoría DGII no es válida" });
    expect(mocks.createClient).not.toHaveBeenCalled();

    await expect(
      actualizarClasificacionDgii({ cuentaId, categoriaDgii: "02", tipoCompra: "otro", tipoIngreso: null }),
    ).resolves.toEqual({ ok: false, error: "El tipo de compra no es válido" });

    await expect(
      actualizarClasificacionDgii({ cuentaId, categoriaDgii: "02", tipoCompra: null, tipoIngreso: "7" }),
    ).resolves.toEqual({ ok: false, error: "El tipo de ingreso no es válido" });
  });

  test("un lector no puede clasificar", async () => {
    mocks.getRol.mockResolvedValue("lector");

    await expect(
      actualizarClasificacionDgii({ cuentaId, categoriaDgii: "02", tipoCompra: null, tipoIngreso: null }),
    ).resolves.toEqual({
      ok: false,
      error: "No tienes permiso para clasificar las cuentas de los reportes DGII.",
    });
    expect(mocks.createClient).not.toHaveBeenCalled();
  });

  test("traduce el error de la RPC", async () => {
    mocks.createClient.mockResolvedValue({
      rpc: vi.fn().mockResolvedValue({ error: { message: "solo se clasifican cuentas de movimiento", code: "22023" } }),
    });

    const resultado = await actualizarClasificacionDgii({
      cuentaId,
      categoriaDgii: "02",
      tipoCompra: null,
      tipoIngreso: null,
    });

    expect(resultado.ok).toBe(false);
    if (!resultado.ok) expect(resultado.error.length).toBeGreaterThan(0);
  });
});

describe("etiquetas DGII", () => {
  test("muestra los textos de Alegra", () => {
    expect(etiquetaCategoriaDgii("09")).toBe("09 · Compras y gastos que hacen parte del costo de venta");
    expect(etiquetaTipoCompra("bienes")).toBe("Bienes");
    expect(etiquetaTipoIngreso("1")).toBe("1 · Ingresos por operaciones (No financieros)");
    expect(etiquetaCategoriaDgii(null)).toBe("Sin clasificar");
  });
});
