import { beforeEach, describe, expect, test, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  getRol: vi.fn(),
  createClient: vi.fn(),
  revalidatePath: vi.fn(),
}));

vi.mock("@/lib/auth/rol", () => ({ getRol: mocks.getRol }));
vi.mock("@/lib/supabase/server", () => ({ createClient: mocks.createClient }));
vi.mock("next/cache", () => ({ revalidatePath: mocks.revalidatePath }));

const { crearTipoEntrada, actualizarTipoEntrada } = await import("./acciones");

const ID = "11111111-1111-4111-8111-111111111111";
const entrada = { nombre: "Ajuste de prueba", prefijo: "ajc", activo: true };

beforeEach(() => {
  vi.clearAllMocks();
  mocks.getRol.mockResolvedValue("admin");
});

describe("crearTipoEntrada", () => {
  test("llama la RPC directo con el payload validado y devuelve ok", async () => {
    const rpc = vi.fn().mockResolvedValue({ data: ID, error: null });
    mocks.createClient.mockResolvedValue({ rpc });

    await expect(crearTipoEntrada(entrada)).resolves.toEqual({ ok: true, id: ID });
    expect(rpc).toHaveBeenCalledWith("crear_tipo_entrada_diario", {
      p: { nombre: "Ajuste de prueba", prefijo: "ajc", activo: true },
    });
    expect(mocks.revalidatePath).toHaveBeenCalledWith("/dashboard/configuracion/tipos-entrada-diario");
    expect(mocks.revalidatePath).toHaveBeenCalledWith("/dashboard/contabilidad/asientos");
  });

  test("devuelve en español el error de validación sin tocar la RPC", async () => {
    await expect(crearTipoEntrada({ ...entrada, prefijo: "1x" })).resolves.toEqual({
      ok: false,
      error: "El prefijo usa solo letras y números, sin espacios (máx. 10)",
    });
    expect(mocks.createClient).not.toHaveBeenCalled();
  });

  test("devuelve en español el error de la RPC", async () => {
    mocks.createClient.mockResolvedValue({
      rpc: vi.fn().mockResolvedValue({
        data: null,
        error: { message: "ya existe un tipo de entrada con ese prefijo", code: "22023" },
      }),
    });

    await expect(crearTipoEntrada(entrada)).resolves.toEqual({
      ok: false,
      error: "Ya existe un tipo de entrada con ese prefijo",
    });
  });

  test("un lector no puede crear", async () => {
    mocks.getRol.mockResolvedValue("lector");

    await expect(crearTipoEntrada(entrada)).resolves.toEqual({
      ok: false,
      error: "No tienes permiso para crear tipos de entrada.",
    });
    expect(mocks.createClient).not.toHaveBeenCalled();
  });
});

describe("actualizarTipoEntrada", () => {
  test("llama la RPC directo con el id y el payload validado", async () => {
    const rpc = vi.fn().mockResolvedValue({ data: ID, error: null });
    mocks.createClient.mockResolvedValue({ rpc });

    await expect(actualizarTipoEntrada(ID, { ...entrada, activo: false })).resolves.toEqual({ ok: true, id: ID });
    expect(rpc).toHaveBeenCalledWith("actualizar_tipo_entrada_diario", {
      p_id: ID,
      p: { nombre: "Ajuste de prueba", prefijo: "ajc", activo: false },
    });
  });

  test("rechaza un id inválido sin tocar la RPC", async () => {
    await expect(actualizarTipoEntrada("no-uuid", entrada)).resolves.toEqual({
      ok: false,
      error: "Tipo de entrada inválido.",
    });
    expect(mocks.createClient).not.toHaveBeenCalled();
  });

  test("un contador sí puede desactivar", async () => {
    mocks.getRol.mockResolvedValue("contador");
    const rpc = vi.fn().mockResolvedValue({ data: ID, error: null });
    mocks.createClient.mockResolvedValue({ rpc });

    await expect(actualizarTipoEntrada(ID, { ...entrada, activo: false })).resolves.toEqual({ ok: true, id: ID });
  });
});
