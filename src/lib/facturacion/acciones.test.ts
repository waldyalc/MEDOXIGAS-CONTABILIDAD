import { beforeEach, describe, expect, test, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  getRol: vi.fn(),
  createClient: vi.fn(),
  revalidatePath: vi.fn(),
}));

vi.mock("@/lib/auth/rol", () => ({ getRol: mocks.getRol }));
vi.mock("@/lib/supabase/server", () => ({ createClient: mocks.createClient }));
vi.mock("next/cache", () => ({ revalidatePath: mocks.revalidatePath }));

const { anularFactura, obtenerMotivosAnulacion } = await import("./acciones");
const { hoyEnRd } = await import("@/lib/fechas/rangos");

const FACTURA = "11111111-1111-4111-8111-111111111111";
const MOTIVO = "22222222-2222-4222-8222-222222222222";
const HOY = hoyEnRd();

function fechaManana(): string {
  const anio = Number(HOY.slice(0, 4));
  const mes = Number(HOY.slice(5, 7));
  const dia = Number(HOY.slice(8, 10));
  return new Date(Date.UTC(anio, mes - 1, dia + 1)).toISOString().slice(0, 10);
}

beforeEach(() => {
  vi.clearAllMocks();
  mocks.getRol.mockResolvedValue("admin");
});

describe("anularFactura", () => {
  test("envía la fecha y el motivo en p_info por la RPC directa", async () => {
    const rpc = vi.fn().mockResolvedValue({ error: null });
    mocks.createClient.mockResolvedValue({ rpc });

    await expect(anularFactura(FACTURA, { fecha: HOY, motivo: MOTIVO })).resolves.toEqual({
      ok: true,
      id: FACTURA,
    });
    expect(rpc).toHaveBeenCalledWith("anular_documento", {
      p_tipo: "factura",
      p_id: FACTURA,
      p_info: { fecha: HOY, motivo: MOTIVO },
    });
    expect(mocks.revalidatePath).toHaveBeenCalledWith("/dashboard/facturacion");
    expect(mocks.revalidatePath).toHaveBeenCalledWith(`/dashboard/facturacion/${FACTURA}`);
  });

  test("exige la fecha con formato ISO y el motivo como UUID", async () => {
    await expect(anularFactura(FACTURA, { fecha: "20/11/2026", motivo: MOTIVO })).resolves.toEqual({
      ok: false,
      error: "La fecha de anulación no es válida.",
    });
    await expect(anularFactura(FACTURA, { fecha: HOY, motivo: "no-es-uuid" })).resolves.toEqual({
      ok: false,
      error: "Selecciona el motivo de anulación.",
    });
    expect(mocks.createClient).not.toHaveBeenCalled();
  });

  test("rechaza una fecha futura sin tocar la RPC", async () => {
    await expect(anularFactura(FACTURA, { fecha: fechaManana(), motivo: MOTIVO })).resolves.toEqual({
      ok: false,
      error: "La fecha de anulación no puede ser futura.",
    });
    expect(mocks.createClient).not.toHaveBeenCalled();
  });

  test("rechaza una factura inválida sin tocar la RPC", async () => {
    await expect(anularFactura("factura-1", { fecha: HOY, motivo: MOTIVO })).resolves.toEqual({
      ok: false,
      error: "Factura inválida.",
    });
    expect(mocks.createClient).not.toHaveBeenCalled();
  });

  test("devuelve en español el error de la RPC", async () => {
    mocks.createClient.mockResolvedValue({
      rpc: vi.fn().mockResolvedValue({
        error: { message: "El motivo de anulación no existe o está inactivo.", code: "22023" },
      }),
    });

    await expect(anularFactura(FACTURA, { fecha: HOY, motivo: MOTIVO })).resolves.toEqual({
      ok: false,
      error: "El motivo de anulación no existe o está inactivo.",
    });
  });

  test("un lector no puede anular", async () => {
    mocks.getRol.mockResolvedValue("lector");

    await expect(anularFactura(FACTURA, { fecha: HOY, motivo: MOTIVO })).resolves.toEqual({
      ok: false,
      error: "No tienes permiso para anular facturas.",
    });
    expect(mocks.createClient).not.toHaveBeenCalled();
  });
});

describe("obtenerMotivosAnulacion", () => {
  test("devuelve los motivos activos ordenados por código DGII", async () => {
    const orden = vi.fn().mockResolvedValue({
      data: [
        { id: MOTIVO, nombre: "Devolución de productos", codigo_dgii: "06" },
        { id: FACTURA, nombre: "Pérdida o hurto de talonario(s)", codigo_dgii: "10" },
      ],
      error: null,
    });
    const eq = vi.fn().mockReturnValue({ order: orden });
    const select = vi.fn().mockReturnValue({ eq });
    const from = vi.fn().mockReturnValue({ select });
    mocks.createClient.mockResolvedValue({ from });

    await expect(obtenerMotivosAnulacion()).resolves.toEqual({
      ok: true,
      motivos: [
        { id: MOTIVO, nombre: "Devolución de productos", codigo: "06" },
        { id: FACTURA, nombre: "Pérdida o hurto de talonario(s)", codigo: "10" },
      ],
    });
    expect(from).toHaveBeenCalledWith("motivos_anulacion");
    expect(select).toHaveBeenCalledWith("id, nombre, codigo_dgii");
    expect(eq).toHaveBeenCalledWith("activo", true);
    expect(orden).toHaveBeenCalledWith("codigo_dgii");
  });

  test("devuelve un error en español si la consulta falla", async () => {
    const orden = vi.fn().mockResolvedValue({ data: null, error: { message: "boom" } });
    const eq = vi.fn().mockReturnValue({ order: orden });
    const select = vi.fn().mockReturnValue({ eq });
    mocks.createClient.mockResolvedValue({ from: vi.fn().mockReturnValue({ select }) });

    await expect(obtenerMotivosAnulacion()).resolves.toEqual({
      ok: false,
      error: "No se pudieron cargar los motivos de anulación.",
    });
  });

  test("un lector no puede cargar los motivos", async () => {
    mocks.getRol.mockResolvedValue("lector");

    await expect(obtenerMotivosAnulacion()).resolves.toEqual({
      ok: false,
      error: "No tienes permiso para anular facturas.",
    });
    expect(mocks.createClient).not.toHaveBeenCalled();
  });
});
