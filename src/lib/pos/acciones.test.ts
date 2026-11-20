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
  abrirTurno,
  actualizarTerminal,
  cerrarTurno,
  completarVenta,
  crearCotizacionPOS,
  crearDevolucionPOS,
  crearTerminal,
  registrarMovimientoTurno,
} = await import("./acciones");

import {
  aperturaJson,
  cierreJson,
  cotizacionJson,
  devolucionJson,
  ID_CONTACTO,
  ID_CUENTA,
  ID_FACTURA,
  ID_LINEA,
  ID_TERMINAL,
  ID_TURNO,
  movimientoJson,
  ventaJson,
} from "./pruebas/ejemplos";

const ALMACEN = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const NUMERACION = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
const PRODUCTO = "cccccccc-cccc-4ccc-8ccc-cccccccccccc";
const CUENTA_GASTO = "dddddddd-dddd-4ddd-8ddd-dddddddddddd";

function conRpc(resultado: { data?: unknown; error?: unknown }) {
  const rpc = vi.fn().mockResolvedValue(resultado);
  mocks.createClient.mockResolvedValue({ rpc });
  return rpc;
}

beforeEach(() => {
  vi.clearAllMocks();
  mocks.getRol.mockResolvedValue("admin");
});

describe("crearTerminal", () => {
  test("llama la RPC con el payload validado y la plantilla parcial", async () => {
    const rpc = conRpc({ data: ID_TERMINAL, error: null });

    await expect(
      crearTerminal({
        nombre: "  Caja 1 ",
        almacen_id: ALMACEN,
        cuenta_efectivo_id: ID_CUENTA,
        numeracion_defecto_id: NUMERACION,
        contacto_defecto_id: ID_CONTACTO,
        plantilla_ticket: { ancho_mm: 57 },
      }),
    ).resolves.toEqual({ ok: true, data: { id: ID_TERMINAL } });

    expect(rpc).toHaveBeenCalledWith("pos_crear_terminal", {
      p: {
        nombre: "Caja 1",
        almacen_id: ALMACEN,
        cuenta_efectivo_id: ID_CUENTA,
        numeracion_defecto_id: NUMERACION,
        contacto_defecto_id: ID_CONTACTO,
        activa: true,
        plantilla_ticket: { ancho_mm: 57 },
      },
    });
    expect(mocks.revalidatePath).toHaveBeenCalledWith("/dashboard/configuracion/pos");
    expect(mocks.revalidatePath).toHaveBeenCalledWith("/pos");
  });

  test("rechaza un nombre vacío sin tocar la RPC", async () => {
    await expect(
      crearTerminal({
        nombre: " ",
        almacen_id: ALMACEN,
        cuenta_efectivo_id: ID_CUENTA,
        numeracion_defecto_id: NUMERACION,
        contacto_defecto_id: ID_CONTACTO,
      }),
    ).resolves.toEqual({ ok: false, error: "El nombre de la terminal es obligatorio." });
    expect(mocks.createClient).not.toHaveBeenCalled();
  });

  test("un lector no puede crear terminales", async () => {
    mocks.getRol.mockResolvedValue("lector");

    await expect(crearTerminal({})).resolves.toEqual({
      ok: false,
      error: "No tienes permiso para crear terminales.",
    });
  });

  test("traduce un nombre duplicado de la RPC", async () => {
    conRpc({ error: { message: "ya existe una terminal con ese nombre", code: "22023" } });

    await expect(
      crearTerminal({
        nombre: "Caja 1",
        almacen_id: ALMACEN,
        cuenta_efectivo_id: ID_CUENTA,
        numeracion_defecto_id: NUMERACION,
        contacto_defecto_id: ID_CONTACTO,
      }),
    ).resolves.toEqual({ ok: false, error: "Ya existe una terminal con ese nombre" });
  });
});

describe("actualizarTerminal", () => {
  test("solo envía las claves presentes, incluidos los nulos", async () => {
    const rpc = conRpc({ error: null });

    await expect(
      actualizarTerminal(ID_TERMINAL, { nombre: " Caja 2 ", cuenta_tarjeta_debito_id: null }),
    ).resolves.toEqual({ ok: true, data: { id: ID_TERMINAL } });

    expect(rpc).toHaveBeenCalledWith("pos_actualizar_terminal", {
      p_id: ID_TERMINAL,
      p: { nombre: "Caja 2", cuenta_tarjeta_debito_id: null },
    });
  });

  test("rechaza una edición vacía y un id inválido", async () => {
    await expect(actualizarTerminal(ID_TERMINAL, {})).resolves.toEqual({
      ok: false,
      error: "No hay cambios para guardar.",
    });
    await expect(actualizarTerminal("123", { nombre: "Caja" })).resolves.toEqual({
      ok: false,
      error: "La terminal no es válida.",
    });
    expect(mocks.createClient).not.toHaveBeenCalled();
  });

  test("traduce el candado de turno abierto", async () => {
    conRpc({
      error: {
        message: "cierra el turno antes de cambiar la cuenta de efectivo, el almacén o la numeración",
        code: "22023",
      },
    });

    await expect(actualizarTerminal(ID_TERMINAL, { almacen_id: ALMACEN })).resolves.toEqual({
      ok: false,
      error: "Cierra el turno antes de cambiar la cuenta de efectivo, el almacén o la numeración",
    });
  });
});

describe("abrirTurno", () => {
  test("llama la RPC con la base y las observaciones, y devuelve el resumen", async () => {
    const rpc = conRpc({ data: aperturaJson(), error: null });

    const resultado = await abrirTurno({
      terminal_id: ID_TERMINAL,
      base_inicial: "100.5",
      observaciones: " Turno mañana ",
    });

    expect(rpc).toHaveBeenCalledWith("pos_abrir_turno", {
      p: { terminal_id: ID_TERMINAL, base_inicial: "100.5", observaciones: "Turno mañana" },
    });
    expect(resultado.ok).toBe(true);
    if (!resultado.ok) return;

    expect(resultado.data.turno.numero).toBe(4);
    expect(resultado.data.turno.base_inicial).toBe("0");
    expect(resultado.data.resumen.efectivo.efectivo_esperado).toBe("306");
    expect(mocks.revalidatePath).toHaveBeenCalledWith("/pos/turnos");
  });

  test("rechaza la base negativa sin tocar la RPC", async () => {
    await expect(abrirTurno({ terminal_id: ID_TERMINAL, base_inicial: "-1" })).resolves.toEqual({
      ok: false,
      error: "La base inicial no puede ser negativa.",
    });
    expect(mocks.createClient).not.toHaveBeenCalled();
  });

  test("un lector no puede abrir turnos", async () => {
    mocks.getRol.mockResolvedValue("lector");

    await expect(abrirTurno({ terminal_id: ID_TERMINAL, base_inicial: "0" })).resolves.toEqual({
      ok: false,
      error: "No tienes permiso para abrir turnos.",
    });
  });
});

describe("registrarMovimientoTurno", () => {
  test("el cobro de factura no envía cuenta de contrapartida", async () => {
    const rpc = conRpc({ data: movimientoJson(), error: null });

    const resultado = await registrarMovimientoTurno({
      turno_id: ID_TURNO,
      tipo: "ingreso",
      motivo: "cobro_factura",
      monto: "100",
      factura_id: ID_FACTURA,
    });

    expect(rpc).toHaveBeenCalledWith("pos_registrar_movimiento_turno", {
      p: {
        turno_id: ID_TURNO,
        tipo: "ingreso",
        motivo: "cobro_factura",
        monto: "100",
        factura_id: ID_FACTURA,
      },
    });
    expect(resultado.ok).toBe(true);
    if (resultado.ok) expect(resultado.data.movimiento.cajero).toBe("Waldy Alcántara");
  });

  test("el gasto menor envía subtotal, ITBIS y descripción", async () => {
    const rpc = conRpc({ data: movimientoJson(), error: null });

    await registrarMovimientoTurno({
      turno_id: ID_TURNO,
      tipo: "retiro",
      motivo: "gasto_menor",
      monto: "118",
      cuenta_gasto_id: CUENTA_GASTO,
      descripcion: "Papel",
      subtotal: "100",
      itbis_tasa: "18",
    });

    expect(rpc).toHaveBeenCalledWith("pos_registrar_movimiento_turno", {
      p: {
        turno_id: ID_TURNO,
        tipo: "retiro",
        motivo: "gasto_menor",
        monto: "118",
        cuenta_gasto_id: CUENTA_GASTO,
        descripcion: "Papel",
        subtotal: "100",
        itbis_tasa: "18",
      },
    });
  });

  test("rechaza el motivo que no corresponde al tipo", async () => {
    await expect(
      registrarMovimientoTurno({
        turno_id: ID_TURNO,
        tipo: "retiro",
        motivo: "fondo_caja",
        monto: "100",
        cuenta_contrapartida_id: ID_CUENTA,
      }),
    ).resolves.toEqual({ ok: false, error: "El motivo del movimiento no corresponde al tipo." });
    expect(mocks.createClient).not.toHaveBeenCalled();
  });

  test("traduce el retiro que deja la caja negativa", async () => {
    conRpc({ error: { message: "el retiro deja la caja en negativo", code: "22023" } });

    await expect(
      registrarMovimientoTurno({
        turno_id: ID_TURNO,
        tipo: "retiro",
        motivo: "retiro_caja",
        monto: "100",
        cuenta_contrapartida_id: ID_CUENTA,
      }),
    ).resolves.toEqual({ ok: false, error: "El retiro deja la caja en negativo" });
  });
});

describe("cerrarTurno", () => {
  test("envía el efectivo real y registra la diferencia por defecto", async () => {
    const rpc = conRpc({ data: cierreJson(), error: null });

    const resultado = await cerrarTurno({
      turno_id: ID_TURNO,
      efectivo_real: "300",
      observaciones: "Cierre",
    });

    expect(rpc).toHaveBeenCalledWith("pos_cerrar_turno", {
      p: { turno_id: ID_TURNO, efectivo_real: "300", registrar_diferencia: true, observaciones: "Cierre" },
    });
    expect(resultado.ok).toBe(true);
    if (!resultado.ok) return;

    expect(resultado.data.turno.estado).toBe("cerrado");
    expect(resultado.data.turno.diferencia).toBe("-6");
    expect(resultado.data.asiento_diferencia?.total).toBe("6");
  });

  test("exige el efectivo real", async () => {
    await expect(cerrarTurno({ turno_id: ID_TURNO, efectivo_real: "" })).resolves.toEqual({
      ok: false,
      error: "El efectivo real es obligatorio.",
    });
  });

  test("un lector no puede cerrar turnos", async () => {
    mocks.getRol.mockResolvedValue("lector");

    await expect(cerrarTurno({ turno_id: ID_TURNO, efectivo_real: "0" })).resolves.toEqual({
      ok: false,
      error: "No tienes permiso para cerrar turnos.",
    });
  });
});

describe("completarVenta", () => {
  const ventaEntrada = {
    terminal_id: ID_TERMINAL,
    contacto_id: ID_CONTACTO,
    contacto_defecto_id: ID_CONTACTO,
    numeracion_id: NUMERACION,
    fecha: "2026-11-20",
    lineas: [
      {
        producto_id: PRODUCTO,
        descripcion: "Destornillador",
        cantidad: "2",
        precio: "100",
        itbis_tasa: "18",
      },
    ],
    pagos: [{ metodo: "efectivo", monto: "236", monto_recibido: "250" }],
  };

  test("llama la RPC directo con el payload validado y sin el contexto de la UI", async () => {
    const rpc = conRpc({ data: ventaJson(), error: null });

    const resultado = await completarVenta(ventaEntrada);

    expect(rpc).toHaveBeenCalledWith("pos_completar_venta", {
      p: {
        terminal_id: ID_TERMINAL,
        pagos: [{ metodo: "efectivo", monto: "236", monto_recibido: "250" }],
        lineas: [
          {
            producto_id: PRODUCTO,
            cantidad: "2",
            descuento_pct: "0",
            descripcion: "Destornillador",
            precio: "100",
            itbis_tasa: "18",
          },
        ],
        contacto_id: ID_CONTACTO,
        numeracion_id: NUMERACION,
        fecha: "2026-11-20",
      },
    });
    expect(resultado.ok).toBe(true);
    if (!resultado.ok) return;

    expect(resultado.data.factura.ncf).toBe("B0200000015");
    expect(resultado.data.totales.total).toBe("236");
    expect(mocks.revalidatePath).toHaveBeenCalledWith("/pos/historial");
    expect(mocks.revalidatePath).toHaveBeenCalledWith("/dashboard/facturacion");
  });

  test("rechaza un pago combinado que no suma sin tocar la RPC", async () => {
    await expect(
      completarVenta({
        ...ventaEntrada,
        pagos: [
          { metodo: "efectivo", monto: "100" },
          { metodo: "tarjeta_credito", monto: "200" },
        ],
      }),
    ).resolves.toEqual({ ok: false, error: "La suma de los pagos no puede exceder el total de la venta." });
    expect(mocks.createClient).not.toHaveBeenCalled();
  });

  test("rechaza el cambio en un método que no es efectivo", async () => {
    await expect(
      completarVenta({
        ...ventaEntrada,
        pagos: [{ metodo: "tarjeta_debito", monto: "236", monto_recibido: "250" }],
      }),
    ).resolves.toEqual({ ok: false, error: "Solo el efectivo admite monto recibido y cambio." });
  });

  test("rechaza el crédito al Consumidor Final", async () => {
    await expect(
      completarVenta({
        ...ventaEntrada,
        pagos: [],
      }),
    ).resolves.toEqual({
      ok: false,
      error: "No se puede vender a crédito al Consumidor Final; selecciona un cliente o cobra el total.",
    });
  });

  test("traduce el error de turno cerrado de la RPC", async () => {
    conRpc({ error: { message: "no hay un turno abierto en la terminal Caja 1", code: "22023" } });

    await expect(completarVenta(ventaEntrada)).resolves.toEqual({
      ok: false,
      error: "No hay un turno abierto en la terminal Caja 1",
    });
  });

  test("un lector no puede vender", async () => {
    mocks.getRol.mockResolvedValue("lector");

    await expect(completarVenta(ventaEntrada)).resolves.toEqual({
      ok: false,
      error: "No tienes permiso para vender.",
    });
  });
});

describe("crearCotizacionPOS", () => {
  test("llama la RPC con las líneas y devuelve la cotización", async () => {
    const rpc = conRpc({ data: cotizacionJson(), error: null });

    const resultado = await crearCotizacionPOS({
      terminal_id: ID_TERMINAL,
      contacto_id: ID_CONTACTO,
      fecha: "2026-11-20",
      vencimiento: "2026-12-20",
      lineas: [{ producto_id: PRODUCTO, cantidad: "2", precio: "100", itbis_tasa: "18" }],
    });

    expect(rpc).toHaveBeenCalledWith("pos_crear_cotizacion", {
      p: {
        terminal_id: ID_TERMINAL,
        lineas: [
          {
            producto_id: PRODUCTO,
            cantidad: "2",
            descuento_pct: "0",
            precio: "100",
            itbis_tasa: "18",
          },
        ],
        contacto_id: ID_CONTACTO,
        fecha: "2026-11-20",
        vencimiento: "2026-12-20",
      },
    });
    expect(resultado.ok).toBe(true);
    if (resultado.ok) expect(resultado.data.cotizacion.numero).toBe(12);
  });

  test("un lector no puede cotizar", async () => {
    mocks.getRol.mockResolvedValue("lector");

    await expect(
      crearCotizacionPOS({
        terminal_id: ID_TERMINAL,
        lineas: [{ producto_id: PRODUCTO, cantidad: "1", precio: "100" }],
      }),
    ).resolves.toEqual({ ok: false, error: "No tienes permiso para crear cotizaciones." });
  });
});

describe("crearDevolucionPOS", () => {
  test("llama la RPC con las líneas y el reembolso combinado", async () => {
    const rpc = conRpc({ data: devolucionJson(), error: null });

    const resultado = await crearDevolucionPOS({
      terminal_id: ID_TERMINAL,
      factura_id: ID_FACTURA,
      tipo_reembolso: "combinado",
      monto_reembolso_efectivo: "20",
      cuenta_reembolso_id: ID_CUENTA,
      lineas: [{ factura_linea_id: ID_LINEA, cantidad: "0.5" }],
      notas: "Cliente devolvió una unidad",
    });

    expect(rpc).toHaveBeenCalledWith("pos_crear_devolucion", {
      p: {
        terminal_id: ID_TERMINAL,
        factura_id: ID_FACTURA,
        tipo_reembolso: "combinado",
        lineas: [{ factura_linea_id: ID_LINEA, cantidad: "0.5" }],
        monto_reembolso_efectivo: "20",
        cuenta_reembolso_id: ID_CUENTA,
        notas: "Cliente devolvió una unidad",
      },
    });
    expect(resultado.ok).toBe(true);
    if (resultado.ok) expect(resultado.data.nota.ncf).toBe("B0400000004");
  });

  test("exige efectivo en el reembolso combinado", async () => {
    await expect(
      crearDevolucionPOS({
        terminal_id: ID_TERMINAL,
        factura_id: ID_FACTURA,
        tipo_reembolso: "combinado",
        lineas: [{ factura_linea_id: ID_LINEA, cantidad: "1" }],
      }),
    ).resolves.toEqual({
      ok: false,
      error: "El reembolso combinado requiere efectivo y crédito mayores a cero.",
    });
  });

  test("traduce el error de la RPC", async () => {
    conRpc({ error: { message: "el efectivo devuelto no puede exceder lo pagado en la factura", code: "22023" } });

    await expect(
      crearDevolucionPOS({
        terminal_id: ID_TERMINAL,
        factura_id: ID_FACTURA,
        tipo_reembolso: "efectivo",
        lineas: [{ factura_linea_id: ID_LINEA, cantidad: "1" }],
      }),
    ).resolves.toEqual({ ok: false, error: "El efectivo devuelto no puede exceder lo pagado en la factura" });
  });
});
