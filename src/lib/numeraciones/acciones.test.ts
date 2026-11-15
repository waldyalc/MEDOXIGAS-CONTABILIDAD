import { beforeEach, describe, expect, test, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  getRol: vi.fn(),
  createClient: vi.fn(),
  revalidatePath: vi.fn(),
}));

vi.mock("@/lib/auth/rol", () => ({ getRol: mocks.getRol }));
vi.mock("@/lib/supabase/server", () => ({ createClient: mocks.createClient }));
vi.mock("next/cache", () => ({ revalidatePath: mocks.revalidatePath }));

const { actualizarNumeracion } = await import("./acciones");

const entrada = {
  id: "11111111-1111-4111-8111-111111111111",
  nombre: "Exportaciones",
  siguiente: "1",
  hasta: "100000",
  vence: "",
  activa: true,
};

beforeEach(() => {
  vi.clearAllMocks();
  mocks.getRol.mockResolvedValue("admin");
});

describe("actualizarNumeracion", () => {
  test("llama la RPC directo con el payload validado y devuelve ok", async () => {
    const rpc = vi.fn().mockResolvedValue({ error: null });
    mocks.createClient.mockResolvedValue({ rpc });

    await expect(actualizarNumeracion(entrada)).resolves.toEqual({ ok: true });
    expect(rpc).toHaveBeenCalledWith("actualizar_numeracion", {
      p: {
        id: entrada.id,
        nombre: "Exportaciones",
        siguiente: 1,
        hasta: 100000,
        vence: null,
        activa: true,
      },
    });
    expect(mocks.revalidatePath).toHaveBeenCalledWith("/dashboard/contabilidad/numeraciones");
    expect(mocks.revalidatePath).toHaveBeenCalledWith("/dashboard/facturacion");
  });

  test("devuelve en español el error de validación sin tocar la RPC", async () => {
    await expect(actualizarNumeracion({ ...entrada, nombre: "   " })).resolves.toEqual({
      ok: false,
      error: "El nombre es obligatorio",
    });
    expect(mocks.createClient).not.toHaveBeenCalled();
  });

  test("devuelve en español el error de la RPC", async () => {
    mocks.createClient.mockResolvedValue({
      rpc: vi.fn().mockResolvedValue({
        error: { message: "duplicate key value violates unique constraint", code: "23505" },
      }),
    });

    await expect(actualizarNumeracion(entrada)).resolves.toEqual({
      ok: false,
      error: "Ese registro ya existe.",
    });
  });

  test("un lector no puede guardar", async () => {
    mocks.getRol.mockResolvedValue("lector");

    await expect(actualizarNumeracion(entrada)).resolves.toEqual({
      ok: false,
      error: "No tienes permiso para editar numeraciones.",
    });
    expect(mocks.createClient).not.toHaveBeenCalled();
  });
});
