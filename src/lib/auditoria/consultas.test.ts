import { beforeEach, describe, expect, test, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  createClient: vi.fn(),
}));

vi.mock("@/lib/supabase/server", () => ({ createClient: mocks.createClient }));

const { consultarAuditoria } = await import("./consultas");

const respuestaValida = {
  total: 1,
  entradas: [
    {
      id: "11111111-1111-4111-8111-111111111111",
      usuario_id: "22222222-2222-4222-8222-222222222222",
      usuario_nombre: "Waldy",
      accion: "modificar",
      entidad: "factura",
      entidad_id: "33333333-3333-4333-8333-333333333333",
      entidad_etiqueta: "B0100000001",
      cambios: [{ campo: "total", anterior: "1300.00", nuevo: "1534.00" }],
      creado_en: "2026-11-20T14:30:00+00:00",
    },
  ],
  usuarios: [{ id: "22222222-2222-4222-8222-222222222222", nombre: "Waldy" }],
};

const respuestaVacia = { total: 0, entradas: [], usuarios: [] };

beforeEach(() => {
  vi.clearAllMocks();
});

describe("consultarAuditoria", () => {
  test("llama la RPC directa con el payload de filtros y devuelve la respuesta validada", async () => {
    const rpc = vi.fn().mockResolvedValue({ data: respuestaValida, error: null });
    mocks.createClient.mockResolvedValue({ rpc });

    const resultado = await consultarAuditoria({
      entidad: "factura",
      entidadId: "33333333-3333-4333-8333-333333333333",
      usuarioId: "22222222-2222-4222-8222-222222222222",
      accion: "modificar",
      desde: "2026-11-01",
      hasta: "2026-11-30",
      limite: 25,
      desplazamiento: 25,
      usuarios: true,
    });

    expect(rpc).toHaveBeenCalledTimes(1);
    expect(rpc).toHaveBeenCalledWith("obtener_auditoria", {
      p: {
        entidad: "factura",
        entidad_id: "33333333-3333-4333-8333-333333333333",
        usuario_id: "22222222-2222-4222-8222-222222222222",
        accion: "modificar",
        desde: "2026-11-01",
        hasta: "2026-11-30",
        limite: 25,
        desplazamiento: 25,
        usuarios: true,
      },
    });
    expect(resultado).toEqual(respuestaValida);
  });

  test("descarta filtros inválidos (uuid, fecha, acción) y consulta solo con los válidos", async () => {
    const rpc = vi.fn().mockResolvedValue({ data: respuestaVacia, error: null });
    mocks.createClient.mockResolvedValue({ rpc });

    const resultado = await consultarAuditoria({
      entidad: "factura",
      entidadId: "no-es-uuid",
      desde: "20/11/2026",
      accion: "borrar",
    });

    expect(rpc).toHaveBeenCalledWith("obtener_auditoria", { p: { entidad: "factura" } });
    expect(resultado?.total).toBe(0);
  });

  test("ajusta el límite al tope de 100", async () => {
    const rpc = vi.fn().mockResolvedValue({ data: respuestaVacia, error: null });
    mocks.createClient.mockResolvedValue({ rpc });

    await consultarAuditoria({ limite: 500 });

    expect(rpc).toHaveBeenCalledWith("obtener_auditoria", { p: { limite: 100 } });
  });

  test("devuelve null cuando la RPC falla", async () => {
    mocks.createClient.mockResolvedValue({
      rpc: vi.fn().mockResolvedValue({ data: null, error: { message: "permission denied", code: "42501" } }),
    });

    await expect(consultarAuditoria({})).resolves.toBeNull();
  });

  test("devuelve null cuando la respuesta no pasa la validación", async () => {
    mocks.createClient.mockResolvedValue({
      rpc: vi.fn().mockResolvedValue({ data: { total: "muchos" }, error: null }),
    });

    await expect(consultarAuditoria({})).resolves.toBeNull();
  });
});
