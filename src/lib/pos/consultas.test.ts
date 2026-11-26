import { beforeEach, describe, expect, test, vi } from "vitest";

const mocks = vi.hoisted(() => ({ createClient: vi.fn() }));

vi.mock("@/lib/supabase/server", () => ({ createClient: mocks.createClient }));

const {
  ErrorPOS,
  buscarProductoPorCodigo,
  getCotizacionesAbiertas,
  getHistorialPOS,
  getPagosPOS,
  getProductosPOS,
  getResumenTurno,
  getTerminal,
  getTerminales,
  getTurnoAbierto,
} = await import("./consultas");

import { aperturaJson, ID_CONTACTO, ID_CUENTA, ID_FACTURA, ID_TERMINAL, ID_TURNO } from "./pruebas/ejemplos";

const ALMACEN = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const LISTA = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";

interface RespuestaMock {
  data: unknown;
  error: unknown;
  count?: number;
}

/** Cadena mínima de PostgREST: todos los filtros devuelven el mismo builder. */
function cadena(respuesta: RespuestaMock) {
  const builder: Record<string, unknown> = {};

  for (const metodo of ["select", "order", "range", "eq", "gte", "lte", "in", "or"]) {
    builder[metodo] = vi.fn(() => builder);
  }

  builder.returns = vi.fn().mockResolvedValue(respuesta);
  builder.maybeSingle = vi.fn().mockResolvedValue(respuesta);

  return builder;
}

/** Variante para las consultas que terminan en `.eq()` sin `.returns()`. */
function cadenaPagos(respuesta: RespuestaMock) {
  const builder = cadena(respuesta);
  builder.eq = vi.fn().mockResolvedValue(respuesta);
  return builder;
}

const filaTerminal = {
  id: ID_TERMINAL,
  nombre: "Caja 1",
  almacen_id: ALMACEN,
  cuenta_efectivo_id: ID_CUENTA,
  cuenta_tarjeta_debito_id: null,
  cuenta_tarjeta_credito_id: null,
  cuenta_transferencia_id: null,
  numeracion_defecto_id: "cccccccc-cccc-4ccc-8ccc-cccccccccccc",
  lista_precio_defecto_id: LISTA,
  contacto_defecto_id: ID_CONTACTO,
  centro_costo_id: null,
  plantilla_ticket: { ancho_mm: 80 },
  activa: true,
  creado_en: "2026-11-20T10:00:00-04:00",
  actualizado_en: "2026-11-20T10:00:00-04:00",
};

const filaTurno = {
  id: ID_TURNO,
  numero: 4,
  terminal_id: ID_TERMINAL,
  abierto_por: "12121212-1212-4212-8212-121212121212",
  cerrado_por: null,
  abierto_en: "2026-11-20T14:05:00-04:00",
  cerrado_en: null,
  estado: "abierto",
  base_inicial: 0,
  efectivo_esperado: null,
  efectivo_real: null,
  diferencia: null,
  asiento_diferencia_id: null,
  observaciones: null,
};

beforeEach(() => {
  vi.clearAllMocks();
});

describe("getTerminales", () => {
  test("lee todas las terminales y normaliza la plantilla", async () => {
    const from = vi.fn(() => cadena({ data: [filaTerminal], error: null }));
    mocks.createClient.mockResolvedValue({ from });

    const terminales = await getTerminales();

    expect(terminales).toHaveLength(1);
    expect(terminales[0]?.nombre).toBe("Caja 1");
    expect(terminales[0]?.plantilla_ticket.ancho_mm).toBe(80);
  });
});

describe("getTerminal", () => {
  test("un id inválido no llega a la base", async () => {
    await expect(getTerminal("no-es-uuid")).resolves.toBeNull();
    expect(mocks.createClient).not.toHaveBeenCalled();
  });

  test("devuelve la terminal o null", async () => {
    const from = vi
      .fn()
      .mockReturnValueOnce(cadena({ data: filaTerminal, error: null }))
      .mockReturnValueOnce(cadena({ data: null, error: null }));
    mocks.createClient.mockResolvedValue({ from });

    const terminal = await getTerminal(ID_TERMINAL);
    expect(terminal?.lista_precio_defecto_id).toBe(LISTA);

    await expect(getTerminal(ID_TERMINAL)).resolves.toBeNull();
  });
});

describe("getTurnoAbierto", () => {
  test("devuelve el turno abierto con sus montos como texto", async () => {
    const from = vi.fn(() => cadena({ data: filaTurno, error: null }));
    mocks.createClient.mockResolvedValue({ from });

    const turno = await getTurnoAbierto(ID_TERMINAL);

    expect(turno?.numero).toBe(4);
    expect(turno?.base_inicial).toBe("0");
    expect(turno?.estado).toBe("abierto");
  });

  test("sin turno abierto devuelve null y un id inválido no consulta", async () => {
    const from = vi.fn(() => cadena({ data: null, error: null }));
    mocks.createClient.mockResolvedValue({ from });

    await expect(getTurnoAbierto(ID_TERMINAL)).resolves.toBeNull();
    await expect(getTurnoAbierto("x")).resolves.toBeNull();
    expect(from).toHaveBeenCalledTimes(1);
  });
});

describe("getResumenTurno", () => {
  test("llama pos_resumen_turno y mapea el bloque resumen", async () => {
    const rpc = vi.fn().mockResolvedValue({ data: aperturaJson(), error: null });
    mocks.createClient.mockResolvedValue({ rpc });

    const vista = await getResumenTurno(ID_TURNO);

    expect(rpc).toHaveBeenCalledWith("pos_resumen_turno", { p_turno_id: ID_TURNO });
    expect(vista?.turno.numero).toBe(4);
    expect(vista?.terminal.nombre).toBe("Caja 1");
    expect(vista?.resumen.efectivo.efectivo_esperado).toBe("306");
    expect(vista?.resumen.movimientos[0]?.vigente).toBe(true);
  });

  test("conserva el SQLSTATE para detectar POS no instalado", async () => {
    const rpc = vi.fn().mockResolvedValue({
      data: null,
      error: { message: "relation public.pos_turnos does not exist", code: "42P01" },
    });
    mocks.createClient.mockResolvedValue({ rpc });

    await expect(getResumenTurno(ID_TURNO)).rejects.toBeInstanceOf(ErrorPOS);
    await expect(getResumenTurno(ID_TURNO)).rejects.toMatchObject({ codigo: "42P01" });
  });
});

describe("getHistorialPOS", () => {
  test("un filtro inválido devuelve una página vacía sin consultar", async () => {
    await expect(getHistorialPOS({ tamano: 7 })).resolves.toMatchObject({
      filas: [],
      resumen: { total: 0, pagina: 1 },
    });
    expect(mocks.createClient).not.toHaveBeenCalled();
  });

  test("pagina las facturas y lee los métodos en un segundo lote", async () => {
    const facturas = cadena({
      data: [
        {
          id: ID_FACTURA,
          numero: 15,
          ncf: "B0200000015",
          tipo_comprobante: "02",
          fecha: "2026-11-20",
          creado_en: null,
          contacto_id: ID_CONTACTO,
          turno_id: ID_TURNO,
          estado: "pagada",
          total: 236,
          pagado: 236,
          retenido: 0,
          credito: 0,
          contactos: { nombre: "Consumidor Final" },
          pos_turnos: { numero: 4, pos_terminales: { id: ID_TERMINAL, nombre: "Caja 1" } },
        },
      ],
      error: null,
      count: 1,
    });
    const pagos = cadenaPagos({
      data: [{ factura_id: ID_FACTURA, metodo: "efectivo", estado: "activo" }],
      error: null,
    });
    const from = vi.fn().mockReturnValueOnce(facturas).mockReturnValueOnce(pagos);
    mocks.createClient.mockResolvedValue({ from });

    const pagina = await getHistorialPOS({ pagina: 1, tamano: 25 });

    expect(pagina.resumen).toMatchObject({ total: 1, pagina: 1, totalPaginas: 1 });
    expect(pagina.filas[0]?.cliente_nombre).toBe("Consumidor Final");
    expect(pagina.filas[0]?.metodos).toEqual(["efectivo"]);
    expect(pagina.filas[0]?.saldo).toBe("0.00");
  });
});

describe("getPagosPOS", () => {
  const filaPago = {
    id: "99999999-9999-4999-8999-999999999999",
    numero: 15,
    turno_id: ID_TURNO,
    tipo: "ingreso",
    motivo: "cobro_factura",
    monto: 236.5,
    cuenta_contrapartida_id: ID_CUENTA,
    contacto_id: ID_CONTACTO,
    factura_id: ID_FACTURA,
    gasto_menor_id: null,
    pago_recibido_id: "88888888-8888-4888-8888-888888888888",
    asiento_id: "77777777-7777-4777-8777-777777777777",
    notas: "  Cobro mostrador  ",
    creado_en: "2026-11-20T15:30:00-04:00",
    creado_por: "12121212-1212-4212-8212-121212121212",
    pos_turnos: { numero: 4 },
    cuentas: { nombre: "Cuentas por cobrar" },
    contactos: { nombre: "Consumidor Final" },
    facturas: { numero: 15, ncf: "B0200000015" },
    pagos_recibidos: { estado: "activo" },
    gastos_menores: null,
  };

  test("una terminal inválida o una búsqueda sin dígitos no llegan a la base", async () => {
    await expect(getPagosPOS({ terminalId: "no-uuid", tipo: "ingreso" })).resolves.toMatchObject({ filas: [] });
    await expect(getPagosPOS({ terminalId: ID_TERMINAL, tipo: "ingreso", q: "abc" })).resolves.toMatchObject({
      filas: [],
      resumen: { total: 0 },
    });
    expect(mocks.createClient).not.toHaveBeenCalled();
  });

  test("filtra por terminal, tipo y número de recibo, y marca la vigencia", async () => {
    const consulta = cadena({ data: [filaPago], error: null, count: 1 });
    const from = vi.fn(() => consulta);
    mocks.createClient.mockResolvedValue({ from });

    const pagina = await getPagosPOS({ terminalId: ID_TERMINAL, tipo: "ingreso", q: "15", pagina: 1, tamano: 25 });

    expect(consulta.eq).toHaveBeenCalledWith("pos_turnos.terminal_id", ID_TERMINAL);
    expect(consulta.eq).toHaveBeenCalledWith("tipo", "ingreso");
    expect(consulta.eq).toHaveBeenCalledWith("numero", 15);
    expect(pagina.resumen).toMatchObject({ total: 1, pagina: 1, totalPaginas: 1 });
    expect(pagina.filas[0]).toMatchObject({
      numero: 15,
      turno_numero: 4,
      tipo: "ingreso",
      motivo: "cobro_factura",
      monto: "236.5",
      cuenta_nombre: "Cuentas por cobrar",
      contacto_nombre: "Consumidor Final",
      factura_numero: 15,
      factura_ncf: "B0200000015",
      notas: "Cobro mostrador",
      vigente: true,
    });
  });

  test("un recibo con el pago anulado queda no vigente", async () => {
    const consulta = cadena({
      data: [{ ...filaPago, pagos_recibidos: { estado: "anulado" } }],
      error: null,
      count: 1,
    });
    mocks.createClient.mockResolvedValue({ from: vi.fn(() => consulta) });

    const pagina = await getPagosPOS({ terminalId: ID_TERMINAL, tipo: "ingreso" });

    expect(pagina.filas[0]?.vigente).toBe(false);
  });

  test("los egresos consultan tipo retiro", async () => {
    const consulta = cadena({ data: [], error: null, count: 0 });
    mocks.createClient.mockResolvedValue({ from: vi.fn(() => consulta) });

    await getPagosPOS({ terminalId: ID_TERMINAL, tipo: "retiro" });

    expect(consulta.eq).toHaveBeenCalledWith("tipo", "retiro");
  });
});

describe("getCotizacionesAbiertas", () => {
  test("lee las cotizaciones abiertas por lotes", async () => {
    const from = vi.fn(() =>
      cadena({
        data: [
          {
            id: "dddddddd-dddd-4ddd-8ddd-dddddddddddd",
            numero: 12,
            contacto_id: ID_CONTACTO,
            fecha: "2026-11-20",
            vencimiento: "2026-12-20",
            total: 236,
            estado: "abierta",
            vendedor_id: null,
            contactos: { nombre: "Consumidor Final" },
          },
        ],
        error: null,
      }),
    );
    mocks.createClient.mockResolvedValue({ from });

    const cotizaciones = await getCotizacionesAbiertas();

    expect(cotizaciones[0]?.numero).toBe(12);
    expect(cotizaciones[0]?.cliente_nombre).toBe("Consumidor Final");
    expect(cotizaciones[0]?.total).toBe("236");
  });
});

describe("getProductosPOS", () => {
  test("resuelve el almacén y la lista de la terminal", async () => {
    const from = vi.fn(() => cadena({ data: filaTerminal, error: null }));
    const rpc = vi.fn().mockResolvedValue({
      data: [
        {
          producto_id: "eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee",
          nombre: "Alambre",
          referencia: null,
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
          unidades: [],
        },
      ],
      error: null,
    });
    mocks.createClient.mockResolvedValue({ from, rpc });

    const productos = await getProductosPOS({ terminal_id: ID_TERMINAL, busqueda: "alambre" });

    expect(rpc).toHaveBeenCalledWith("pos_catalogo_productos", {
      p_solo_favoritos: false,
      p_limit: 50,
      p_offset: 0,
      p_almacen_id: ALMACEN,
      p_lista_precio_id: LISTA,
      p_busqueda: "alambre",
    });
    expect(productos[0]?.precio).toBe("100");
  });

  test("un filtro inválido no llega a la base", async () => {
    await expect(getProductosPOS({ limit: 0 })).resolves.toEqual([]);
    expect(mocks.createClient).not.toHaveBeenCalled();
  });
});

describe("buscarProductoPorCodigo", () => {
  test("un código vacío no llega a la base", async () => {
    await expect(buscarProductoPorCodigo({ codigo: "  " })).resolves.toBeNull();
    expect(mocks.createClient).not.toHaveBeenCalled();
  });

  test("devuelve el producto del código con el stock como texto", async () => {
    const rpc = vi.fn().mockResolvedValue({
      data: [
        {
          producto_id: "eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee",
          nombre: "Cemento gris",
          referencia: null,
          marca: null,
          tipo: "producto",
          unidad_id: null,
          unidad_nombre: null,
          factor_base: 1,
          precio: 450,
          itbis_tasa: 18,
          stock: 10,
          disponible: 10,
          imagen_path: null,
          favorito_pos: false,
          codigo: "7501234567890",
        },
      ],
      error: null,
    });
    mocks.createClient.mockResolvedValue({ rpc });

    const producto = await buscarProductoPorCodigo({ codigo: " 7501234567890 ", almacen_id: ALMACEN });

    expect(rpc).toHaveBeenCalledWith("pos_buscar_por_codigo_barra", {
      p_codigo: "7501234567890",
      p_almacen_id: ALMACEN,
    });
    expect(producto?.stock).toBe("10");
  });
});
