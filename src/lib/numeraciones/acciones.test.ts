import { beforeEach, describe, expect, test, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  getRol: vi.fn(),
  createClient: vi.fn(),
  revalidatePath: vi.fn(),
}));

vi.mock("@/lib/auth/rol", () => ({ getRol: mocks.getRol }));
vi.mock("@/lib/supabase/server", () => ({ createClient: mocks.createClient }));
vi.mock("next/cache", () => ({ revalidatePath: mocks.revalidatePath }));

const { actualizarNumeracion, crearNumeracion } = await import("./acciones");

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

const entradaCrear = {
  tipo_comprobante: "15",
  nombre: "Gubernamental alterna",
  prefijo: "",
  siguiente: "50",
  hasta: "100000",
  vence: "",
  activa: true,
};

describe("crearNumeracion", () => {
  test("llama la RPC directo con el payload validado y devuelve ok", async () => {
    const rpc = vi.fn().mockResolvedValue({ error: null });
    mocks.createClient.mockResolvedValue({ rpc });

    await expect(crearNumeracion(entradaCrear)).resolves.toEqual({ ok: true });
    expect(rpc).toHaveBeenCalledWith("crear_numeracion", {
      p: {
        tipo_comprobante: "15",
        nombre: "Gubernamental alterna",
        prefijo: null,
        siguiente: 50,
        hasta: 100000,
        vence: null,
        activa: true,
      },
    });
    expect(mocks.revalidatePath).toHaveBeenCalledWith("/dashboard/contabilidad/numeraciones");
    expect(mocks.revalidatePath).toHaveBeenCalledWith("/dashboard/facturacion");
  });

  test("una numeración sin NCF envía su prefijo", async () => {
    const rpc = vi.fn().mockResolvedValue({ error: null });
    mocks.createClient.mockResolvedValue({ rpc });

    await expect(crearNumeracion({ ...entradaCrear, tipo_comprobante: "00", prefijo: "  zz  " })).resolves.toEqual({
      ok: true,
    });
    expect(rpc).toHaveBeenCalledWith("crear_numeracion", {
      p: expect.objectContaining({ tipo_comprobante: "00", prefijo: "zz" }),
    });
  });

  test("una numeración sin NCF exige el prefijo", async () => {
    await expect(crearNumeracion({ ...entradaCrear, tipo_comprobante: "00", prefijo: " " })).resolves.toEqual({
      ok: false,
      error: "El prefijo es obligatorio",
    });
    expect(mocks.createClient).not.toHaveBeenCalled();
  });

  test("devuelve en español el error de validación sin tocar la RPC", async () => {
    await expect(crearNumeracion({ ...entradaCrear, nombre: "   " })).resolves.toEqual({
      ok: false,
      error: "El nombre es obligatorio",
    });
    expect(mocks.createClient).not.toHaveBeenCalled();
  });

  test("rechaza un tipo fuera de la lista válida sin tocar la RPC", async () => {
    await expect(crearNumeracion({ ...entradaCrear, tipo_comprobante: "99" })).resolves.toEqual({
      ok: false,
      error: "El tipo de documento no es válido",
    });
    expect(mocks.createClient).not.toHaveBeenCalled();
  });

  test("devuelve en español el error de la RPC", async () => {
    mocks.createClient.mockResolvedValue({
      rpc: vi.fn().mockResolvedValue({
        error: { message: "ya existe una numeración para ese tipo y prefijo", code: "22023" },
      }),
    });

    await expect(crearNumeracion(entradaCrear)).resolves.toEqual({
      ok: false,
      error: "Ya existe una numeración para ese tipo y prefijo",
    });
  });

  test("un lector no puede crear", async () => {
    mocks.getRol.mockResolvedValue("lector");

    await expect(crearNumeracion(entradaCrear)).resolves.toEqual({
      ok: false,
      error: "No tienes permiso para crear numeraciones.",
    });
    expect(mocks.createClient).not.toHaveBeenCalled();
  });
});
