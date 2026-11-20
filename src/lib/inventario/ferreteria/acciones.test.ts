import { beforeEach, describe, expect, test, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  getRol: vi.fn(),
  createClient: vi.fn(),
  revalidatePath: vi.fn(),
}));

vi.mock("@/lib/auth/rol", () => ({ getRol: mocks.getRol }));
vi.mock("@/lib/supabase/server", () => ({ createClient: mocks.createClient }));
vi.mock("next/cache", () => ({ revalidatePath: mocks.revalidatePath }));

const {
  anularConteo,
  aplicarConteo,
  crearConteo,
  guardarCodigosBarra,
  guardarDatosFerreteriaProducto,
  guardarLineasConteo,
  guardarRecetaCombo,
  guardarUnidadesProducto,
} = await import("./acciones");

const PRODUCTO = "11111111-1111-4111-8111-111111111111";
const COMBO = "22222222-2222-4222-8222-222222222222";
const COMPONENTE = "33333333-3333-4333-8333-333333333333";
const CONTEO = "44444444-4444-4444-8444-444444444444";
const AJUSTE = "55555555-5555-4555-8555-555555555555";

function conRpc(resultado: { data?: unknown; error?: unknown }) {
  const rpc = vi.fn().mockResolvedValue(resultado);
  mocks.createClient.mockResolvedValue({ rpc });
  return rpc;
}

beforeEach(() => {
  vi.clearAllMocks();
  mocks.getRol.mockResolvedValue("admin");
});

describe("guardarDatosFerreteriaProducto", () => {
  test("solo envía los campos presentes", async () => {
    const rpc = conRpc({ error: null });

    await expect(guardarDatosFerreteriaProducto(PRODUCTO, { favorito_pos: true })).resolves.toEqual({
      ok: true,
      id: PRODUCTO,
    });
    expect(rpc).toHaveBeenCalledWith("actualizar_producto", {
      p_id: PRODUCTO,
      p: { favorito_pos: true },
    });
    expect(mocks.revalidatePath).toHaveBeenCalledWith(`/dashboard/productos/${PRODUCTO}`);
  });

  test("marca en blanco limpia el campo y la ubicación va recortada", async () => {
    const rpc = conRpc({ error: null });

    await guardarDatosFerreteriaProducto(PRODUCTO, { marca: "   ", ubicacion: " Pasillo 2 " });
    expect(rpc).toHaveBeenCalledWith("actualizar_producto", {
      p_id: PRODUCTO,
      p: { marca: "", ubicacion: "Pasillo 2" },
    });
  });

  test("rechaza un producto inválido sin tocar la RPC", async () => {
    await expect(guardarDatosFerreteriaProducto("no-es-uuid", {})).resolves.toEqual({
      ok: false,
      error: "El producto no es válido.",
    });
    expect(mocks.createClient).not.toHaveBeenCalled();
  });

  test("un lector no puede editar el producto", async () => {
    mocks.getRol.mockResolvedValue("lector");

    await expect(guardarDatosFerreteriaProducto(PRODUCTO, {})).resolves.toEqual({
      ok: false,
      error: "No tienes permiso para editar datos del producto.",
    });
  });
});

describe("guardarCodigosBarra", () => {
  test("llama la RPC directo con el conjunto validado y normalizado", async () => {
    const rpc = conRpc({ error: null });

    await expect(
      guardarCodigosBarra(PRODUCTO, {
        codigos: [{ codigo: "  7501234567890 ", unidad_id: "", principal: true }],
      }),
    ).resolves.toEqual({ ok: true, id: PRODUCTO });

    expect(rpc).toHaveBeenCalledWith("actualizar_producto", {
      p_id: PRODUCTO,
      p: {
        codigos_barra: [{ codigo: "7501234567890", unidad_id: null, principal: true }],
      },
    });
    expect(mocks.revalidatePath).toHaveBeenCalledWith("/dashboard/productos");
    expect(mocks.revalidatePath).toHaveBeenCalledWith(`/dashboard/productos/${PRODUCTO}`);
  });

  test("devuelve en español el código vacío sin tocar la RPC", async () => {
    await expect(guardarCodigosBarra(PRODUCTO, { codigos: [{ codigo: "   " }] })).resolves.toEqual({
      ok: false,
      error: "El código de barra es obligatorio.",
    });
    expect(mocks.createClient).not.toHaveBeenCalled();
  });

  test("rechaza códigos repetidos y más de un principal", async () => {
    await expect(guardarCodigosBarra(PRODUCTO, { codigos: [{ codigo: "A" }, { codigo: "a" }] })).resolves.toEqual({
      ok: false,
      error: "Repetiste un código de barra en la lista.",
    });

    await expect(
      guardarCodigosBarra(PRODUCTO, {
        codigos: [
          { codigo: "A", principal: true },
          { codigo: "B", principal: true },
        ],
      }),
    ).resolves.toEqual({ ok: false, error: "Solo un código de barra puede ser el principal." });
    expect(mocks.createClient).not.toHaveBeenCalled();
  });

  test("traduce el error de la RPC al español capitalizado", async () => {
    conRpc({ error: { message: "el código de barra ya está registrado en otro producto", code: "22023" } });

    await expect(guardarCodigosBarra(PRODUCTO, { codigos: [{ codigo: "750" }] })).resolves.toEqual({
      ok: false,
      error: "El código de barra ya está registrado en otro producto",
    });
  });

  test("un lector no puede guardar códigos", async () => {
    mocks.getRol.mockResolvedValue("lector");

    await expect(guardarCodigosBarra(PRODUCTO, { codigos: [] })).resolves.toEqual({
      ok: false,
      error: "No tienes permiso para guardar códigos de barra.",
    });
  });
});

describe("guardarUnidadesProducto", () => {
  test("envía el factor y el precio como texto, con los defaults de la base", async () => {
    const rpc = conRpc({ error: null });

    await expect(
      guardarUnidadesProducto(PRODUCTO, {
        unidades: [{ nombre: "Caja 50 lb", factor_base: "50", precio: "3200", es_compra: true }],
      }),
    ).resolves.toEqual({ ok: true, id: PRODUCTO });

    expect(rpc).toHaveBeenCalledWith("actualizar_producto", {
      p_id: PRODUCTO,
      p: {
        unidades: [
          {
            nombre: "Caja 50 lb",
            factor_base: "50",
            precio: "3200",
            es_compra: true,
            es_venta: true,
            activa: true,
          },
        ],
      },
    });
    expect(mocks.revalidatePath).toHaveBeenCalledWith("/dashboard/facturacion/nueva");
  });

  test("conserva el id de la unidad existente y deja el precio nulo", async () => {
    const rpc = conRpc({ error: null });

    await guardarUnidadesProducto(PRODUCTO, {
      unidades: [{ id: COMPONENTE, nombre: "Libra", factor_base: 1, precio: "" }],
    });

    expect(rpc).toHaveBeenCalledWith("actualizar_producto", {
      p_id: PRODUCTO,
      p: {
        unidades: [
          {
            id: COMPONENTE,
            nombre: "Libra",
            factor_base: "1",
            precio: null,
            es_compra: false,
            es_venta: true,
            activa: true,
          },
        ],
      },
    });
  });

  test("rechaza factor cero y nombres repetidos sin tocar la RPC", async () => {
    await expect(
      guardarUnidadesProducto(PRODUCTO, { unidades: [{ nombre: "Caja", factor_base: 0 }] }),
    ).resolves.toEqual({ ok: false, error: "El factor de la unidad debe ser mayor a cero." });

    await expect(
      guardarUnidadesProducto(PRODUCTO, {
        unidades: [
          { nombre: "Caja", factor_base: 1 },
          { nombre: "CAJA", factor_base: 2 },
        ],
      }),
    ).resolves.toEqual({ ok: false, error: "Repetiste el nombre de una unidad." });
    expect(mocks.createClient).not.toHaveBeenCalled();
  });

  test("un lector no puede guardar unidades", async () => {
    mocks.getRol.mockResolvedValue("lector");

    await expect(guardarUnidadesProducto(PRODUCTO, { unidades: [] })).resolves.toEqual({
      ok: false,
      error: "No tienes permiso para guardar unidades de medida.",
    });
  });
});

describe("guardarRecetaCombo", () => {
  test("envía componente y cantidad validados, sin el tipo del formulario", async () => {
    const rpc = conRpc({ error: null });

    await expect(
      guardarRecetaCombo(COMBO, {
        componentes: [{ componente_id: COMPONENTE, cantidad: "2", tipo: "producto" }],
      }),
    ).resolves.toEqual({ ok: true, id: COMBO });

    expect(rpc).toHaveBeenCalledWith("actualizar_producto", {
      p_id: COMBO,
      p: { componentes: [{ componente_id: COMPONENTE, cantidad: "2" }] },
    });
  });

  test("rechaza auto-referencia, combo anidado y cantidad cero", async () => {
    await expect(guardarRecetaCombo(COMBO, { componentes: [{ componente_id: COMBO, cantidad: 1 }] })).resolves.toEqual({
      ok: false,
      error: "Un combo no puede ser componente de sí mismo.",
    });

    await expect(
      guardarRecetaCombo(COMBO, {
        componentes: [{ componente_id: COMPONENTE, cantidad: 1, tipo: "combo" }],
      }),
    ).resolves.toEqual({ ok: false, error: "Un combo no puede tener componentes que sean combos." });

    await expect(
      guardarRecetaCombo(COMBO, { componentes: [{ componente_id: COMPONENTE, cantidad: 0 }] }),
    ).resolves.toEqual({ ok: false, error: "La cantidad del componente debe ser mayor a cero." });
    expect(mocks.createClient).not.toHaveBeenCalled();
  });

  test("traduce el error de combo anidado de la RPC", async () => {
    conRpc({ error: { message: "un combo no puede tener componentes que sean combos", code: "22023" } });

    await expect(
      guardarRecetaCombo(COMBO, { componentes: [{ componente_id: COMPONENTE, cantidad: 1 }] }),
    ).resolves.toEqual({ ok: false, error: "Un combo no puede tener componentes que sean combos" });
  });

  test("un lector no puede editar combos", async () => {
    mocks.getRol.mockResolvedValue("lector");

    await expect(guardarRecetaCombo(COMBO, { componentes: [] })).resolves.toEqual({
      ok: false,
      error: "No tienes permiso para editar combos.",
    });
  });
});

describe("crearConteo", () => {
  test("llama la RPC con la cabecera y las líneas validadas", async () => {
    const rpc = conRpc({ data: CONTEO, error: null });

    await expect(
      crearConteo({
        almacen_id: PRODUCTO,
        fecha: "2026-11-25",
        notas: "Conteo de pasillo 1",
        lineas: [{ producto_id: COMPONENTE, cantidad_contada: 7 }],
      }),
    ).resolves.toEqual({ ok: true, id: CONTEO });

    expect(rpc).toHaveBeenCalledWith("crear_conteo_inventario", {
      p: {
        almacen_id: PRODUCTO,
        fecha: "2026-11-25",
        notas: "Conteo de pasillo 1",
        lineas: [{ producto_id: COMPONENTE, cantidad_contada: "7" }],
      },
    });
    expect(mocks.revalidatePath).toHaveBeenCalledWith("/dashboard/inventario/conteos");
  });

  test("omite notas vacías y permite crear sin líneas", async () => {
    const rpc = conRpc({ data: CONTEO, error: null });

    await crearConteo({ almacen_id: PRODUCTO, fecha: "2026-11-25", notas: "  " });

    expect(rpc).toHaveBeenCalledWith("crear_conteo_inventario", {
      p: { almacen_id: PRODUCTO, fecha: "2026-11-25", lineas: [] },
    });
  });

  test("rechaza cantidad negativa, producto repetido y almacén inválido", async () => {
    await expect(
      crearConteo({
        almacen_id: PRODUCTO,
        fecha: "2026-11-25",
        lineas: [{ producto_id: COMPONENTE, cantidad_contada: -1 }],
      }),
    ).resolves.toEqual({ ok: false, error: "La cantidad contada no puede ser negativa." });

    await expect(
      crearConteo({
        almacen_id: PRODUCTO,
        fecha: "2026-11-25",
        lineas: [
          { producto_id: COMPONENTE, cantidad_contada: 1 },
          { producto_id: COMPONENTE, cantidad_contada: 2 },
        ],
      }),
    ).resolves.toEqual({ ok: false, error: "Repetiste un producto en el conteo." });

    await expect(crearConteo({ almacen_id: "almacen", fecha: "2026-11-25" })).resolves.toEqual({
      ok: false,
      error: "Selecciona el almacén del conteo.",
    });
    expect(mocks.createClient).not.toHaveBeenCalled();
  });

  test("avisa si la RPC no devuelve el id", async () => {
    conRpc({ data: null, error: null });

    await expect(crearConteo({ almacen_id: PRODUCTO, fecha: "2026-11-25" })).resolves.toEqual({
      ok: false,
      error: "No se pudo crear el conteo de inventario.",
    });
  });

  test("un lector no puede crear conteos", async () => {
    mocks.getRol.mockResolvedValue("lector");

    await expect(crearConteo({ almacen_id: PRODUCTO, fecha: "2026-11-25" })).resolves.toEqual({
      ok: false,
      error: "No tienes permiso para crear conteos.",
    });
  });
});

describe("guardarLineasConteo", () => {
  test("llama la RPC con el payload validado", async () => {
    const rpc = conRpc({ data: CONTEO, error: null });

    await expect(
      guardarLineasConteo(CONTEO, { lineas: [{ producto_id: COMPONENTE, cantidad_contada: "0", notas: " vacío " }] }),
    ).resolves.toEqual({ ok: true, id: CONTEO });

    expect(rpc).toHaveBeenCalledWith("guardar_lineas_conteo", {
      p_id: CONTEO,
      p: { lineas: [{ producto_id: COMPONENTE, cantidad_contada: "0", notas: "vacío" }] },
    });
  });

  test("permite vaciar las líneas de un borrador", async () => {
    const rpc = conRpc({ data: CONTEO, error: null });

    await guardarLineasConteo(CONTEO, { lineas: [] });

    expect(rpc).toHaveBeenCalledWith("guardar_lineas_conteo", { p_id: CONTEO, p: { lineas: [] } });
  });

  test("rechaza un conteo inválido o una cantidad negativa sin tocar la RPC", async () => {
    await expect(guardarLineasConteo("123", { lineas: [] })).resolves.toEqual({
      ok: false,
      error: "El conteo no es válido.",
    });

    await expect(
      guardarLineasConteo(CONTEO, { lineas: [{ producto_id: COMPONENTE, cantidad_contada: -2 }] }),
    ).resolves.toEqual({ ok: false, error: "La cantidad contada no puede ser negativa." });
    expect(mocks.createClient).not.toHaveBeenCalled();
  });

  test("devuelve en español el error de un conteo aplicado", async () => {
    conRpc({ error: { message: "solo se pueden editar las líneas de un conteo en borrador", code: "22023" } });

    await expect(guardarLineasConteo(CONTEO, { lineas: [] })).resolves.toEqual({
      ok: false,
      error: "Solo se pueden editar las líneas de un conteo en borrador",
    });
  });
});

describe("aplicarConteo", () => {
  test("sin diferencias, la RPC devuelve null y el conteo queda aplicado", async () => {
    conRpc({ data: null, error: null });

    await expect(aplicarConteo(CONTEO)).resolves.toEqual({ ok: true, id: CONTEO, ajusteId: null });
    expect(mocks.revalidatePath).toHaveBeenCalledWith("/dashboard/inventario/ajustes");
    expect(mocks.revalidatePath).toHaveBeenCalledWith("/dashboard/inventario/conteos");
  });

  test("con diferencias devuelve el id del ajuste generado", async () => {
    conRpc({ data: AJUSTE, error: null });

    await expect(aplicarConteo(CONTEO)).resolves.toEqual({ ok: true, id: CONTEO, ajusteId: AJUSTE });
  });

  test("traduce el error de un conteo sin líneas", async () => {
    conRpc({ error: { message: "el conteo no tiene líneas", code: "22023" } });

    await expect(aplicarConteo(CONTEO)).resolves.toEqual({ ok: false, error: "El conteo no tiene líneas" });
  });

  test("un lector no puede aplicar conteos", async () => {
    mocks.getRol.mockResolvedValue("lector");

    await expect(aplicarConteo(CONTEO)).resolves.toEqual({
      ok: false,
      error: "No tienes permiso para aplicar conteos.",
    });
  });
});

describe("anularConteo", () => {
  test("llama la RPC directo y revalida el detalle", async () => {
    const rpc = conRpc({ error: null });

    await expect(anularConteo(CONTEO)).resolves.toEqual({ ok: true, id: CONTEO });
    expect(rpc).toHaveBeenCalledWith("anular_conteo_inventario", { p_id: CONTEO });
    expect(mocks.revalidatePath).toHaveBeenCalledWith(`/dashboard/inventario/conteos/${CONTEO}`);
  });

  test("traduce el error de un conteo aplicado", async () => {
    conRpc({ error: { message: "un conteo aplicado se revierte anulando su ajuste de inventario", code: "22023" } });

    await expect(anularConteo(CONTEO)).resolves.toEqual({
      ok: false,
      error: "Un conteo aplicado se revierte anulando su ajuste de inventario",
    });
  });

  test("rechaza un conteo inválido sin tocar la RPC", async () => {
    await expect(anularConteo("x")).resolves.toEqual({ ok: false, error: "El conteo no es válido." });
    expect(mocks.createClient).not.toHaveBeenCalled();
  });
});
