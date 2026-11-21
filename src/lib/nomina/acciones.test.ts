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
  actualizarEmpleado,
  agregarEmpleadosPeriodo,
  anularPagoRecibo,
  anularRecibo,
  calcularPeriodo,
  calcularRecibo,
  cambiarEstadoEmpleado,
  contabilizarPeriodo,
  contabilizarRecibo,
  crearEmpleado,
  crearPeriodo,
  eliminarNovedadRecibo,
  eliminarNovedadRecurrente,
  guardarConfigNomina,
  guardarMapeoContable,
  guardarNovedadRecibo,
  guardarNovedadRecurrente,
  guardarParametrosNomina,
  pagarPeriodo,
  pagarRecibo,
  registrarEnvioColillas,
} = await import("./acciones");

const EMPLEADO = "11111111-1111-4111-8111-111111111111";
const CONCEPTO = "22222222-2222-4222-8222-222222222222";
const PERIODO = "33333333-3333-4333-8333-333333333333";
const RECIBO = "44444444-4444-4444-8444-444444444444";
const CUENTA = "55555555-5555-4555-8555-555555555555";
const ASIENTO = "66666666-6666-4666-8666-666666666666";
const LINEA = "77777777-7777-4777-8777-777777777777";

function rpcMock(respuesta: { data?: unknown; error?: unknown } = {}) {
  const rpc = vi.fn().mockResolvedValue({ data: null, error: null, ...respuesta });
  mocks.createClient.mockResolvedValue({ rpc });
  return rpc;
}

const empleadoEntrada = {
  tipo_identificacion: "cedula",
  identificacion: "001-1234567-8",
  primer_nombre: "María",
  primer_apellido: "Fernández",
  segmento_contable: "administrativa",
  fecha_ingreso: "2024-03-01",
  frecuencia_pago: "quincenal",
  salario_mensual: "60000",
  metodo_pago: "efectivo",
};

const novedadRecurrente = {
  empleado_id: EMPLEADO,
  concepto_id: CONCEPTO,
  monto: "1500",
  fecha_inicio: "2026-11-01",
};

const periodoEntrada = {
  frecuencia: "quincenal",
  fecha_inicio: "2026-11-16",
  fecha_fin: "2026-11-30",
  fecha_pago: "2026-11-30",
};

const parametersEntrada = {
  anio: 2026,
  salario_minimo: "23223",
  tasa_sfs_empleado: "3.04",
  tasa_sfs_empleador: "7.09",
  tope_sfs_mensual: "232230",
  tasa_afp_empleado: "2.87",
  tasa_afp_empleador: "7.10",
  tope_afp_mensual: "464460",
  tope_srl_mensual: "92892",
  tasa_srl_tipo_1: "1.10",
  tasa_srl_tipo_2: "1.15",
  tasa_srl_tipo_3: "1.25",
  tasa_srl_tipo_4: "1.30",
  tasa_infotep: "1.00",
  dias_mes_laboral: "23.83",
  horas_dia_laboral: "8",
  escala_isr_anual: [
    { desde: "0", hasta: "416220", tasa: "0", monto_fijo: "0" },
    { desde: "416220", hasta: "", tasa: "25", monto_fijo: "0" },
  ],
};

beforeEach(() => {
  vi.clearAllMocks();
  mocks.getRol.mockResolvedValue("admin");
});

describe("empleados", () => {
  test("crearEmpleado llama la RPC con la cédula normalizada y devuelve el id", async () => {
    const rpc = rpcMock({ data: EMPLEADO });

    await expect(crearEmpleado(empleadoEntrada)).resolves.toEqual({ ok: true, id: EMPLEADO });
    expect(rpc).toHaveBeenCalledWith("nomina_crear_empleado", {
      p: expect.objectContaining({
        identificacion: "00112345678",
        salario_mensual: "60000",
        metodo_pago: "efectivo",
        tipo_contrato: "indefinido",
      }),
    });
  });

  test("crearEmpleado rechaza una cédula inválida sin llamar la RPC", async () => {
    await expect(crearEmpleado({ ...empleadoEntrada, identificacion: "123" })).resolves.toEqual({
      ok: false,
      error: "La cédula debe tener 11 dígitos.",
    });
    expect(mocks.createClient).not.toHaveBeenCalled();
  });

  test("crearEmpleado devuelve el error de la RPC", async () => {
    rpcMock({ error: { message: "duplicate key value violates unique constraint", code: "23505" } });

    await expect(crearEmpleado(empleadoEntrada)).resolves.toEqual({
      ok: false,
      error: "Ese registro ya existe.",
    });
  });

  test("un lector no crea empleados", async () => {
    mocks.getRol.mockResolvedValue("lector");

    await expect(crearEmpleado(empleadoEntrada)).resolves.toEqual({
      ok: false,
      error: "No tienes permiso para crear empleados.",
    });
    expect(mocks.createClient).not.toHaveBeenCalled();
  });

  test("actualizarEmpleado envía el id y el payload completo", async () => {
    const rpc = rpcMock({ data: EMPLEADO });

    await expect(actualizarEmpleado(EMPLEADO, empleadoEntrada)).resolves.toEqual({ ok: true, id: EMPLEADO });
    expect(rpc).toHaveBeenCalledWith("nomina_actualizar_empleado", {
      p_id: EMPLEADO,
      p: expect.objectContaining({ primer_nombre: "María" }),
    });
  });

  test("actualizarEmpleado rechaza un id inválido", async () => {
    await expect(actualizarEmpleado("no-es-uuid", empleadoEntrada)).resolves.toEqual({
      ok: false,
      error: "El empleado no es válido.",
    });
  });

  test("cambiarEstadoEmpleado envía el estado y la fecha de fin", async () => {
    const rpc = rpcMock({ data: EMPLEADO });

    await expect(cambiarEstadoEmpleado(EMPLEADO, { estado: "inactivo", fecha_fin: "2026-12-31" })).resolves.toEqual({
      ok: true,
      id: EMPLEADO,
    });
    expect(rpc).toHaveBeenCalledWith("nomina_cambiar_estado_empleado", {
      p_id: EMPLEADO,
      p_estado: "inactivo",
      p_fecha_fin: "2026-12-31",
    });
  });

  test("cambiarEstadoEmpleado no envía fecha si no viene", async () => {
    const rpc = rpcMock({ data: EMPLEADO });

    await cambiarEstadoEmpleado(EMPLEADO, { estado: "activo" });
    expect(rpc).toHaveBeenCalledWith("nomina_cambiar_estado_empleado", { p_id: EMPLEADO, p_estado: "activo" });
  });

  test("guardarNovedadRecurrente envía el monto", async () => {
    const rpc = rpcMock({ data: LINEA });

    await expect(guardarNovedadRecurrente(novedadRecurrente)).resolves.toEqual({ ok: true, id: LINEA });
    expect(rpc).toHaveBeenCalledWith("nomina_guardar_novedad_recurrente", {
      p: expect.objectContaining({ monto: "1500", activa: true, notas: null }),
    });
  });

  test("guardarNovedadRecurrente envía el porcentaje cuando no hay monto", async () => {
    const rpc = rpcMock({ data: LINEA });

    await guardarNovedadRecurrente({ ...novedadRecurrente, monto: undefined, porcentaje: "5" });
    expect(rpc).toHaveBeenCalledWith("nomina_guardar_novedad_recurrente", {
      p: expect.objectContaining({ porcentaje: "5" }),
    });
  });

  test("guardarNovedadRecurrente rechaza monto y porcentaje juntos", async () => {
    await expect(guardarNovedadRecurrente({ ...novedadRecurrente, porcentaje: "5" })).resolves.toEqual({
      ok: false,
      error: "Indica un monto o un porcentaje, no ambos.",
    });
  });

  test("eliminarNovedadRecurrente apaga la novedad", async () => {
    const rpc = rpcMock();

    await expect(eliminarNovedadRecurrente(LINEA)).resolves.toEqual({ ok: true });
    expect(rpc).toHaveBeenCalledWith("nomina_eliminar_novedad_recurrente", { p_id: LINEA });
  });
});

describe("configuración", () => {
  test("guardarConfigNomina envía solo las claves presentes", async () => {
    const rpc = rpcMock();

    await expect(guardarConfigNomina({ aplica_infotep: false, riesgo_laboral: "tipo_2" })).resolves.toEqual({
      ok: true,
    });
    expect(rpc).toHaveBeenCalledWith("nomina_guardar_config_empresa", {
      p: { aplica_infotep: false, riesgo_laboral: "tipo_2" },
    });
  });

  test("guardarConfigNomina envía null para borrar una cuenta", async () => {
    const rpc = rpcMock();

    await guardarConfigNomina({ cuenta_salarios_por_pagar_id: "" });
    expect(rpc).toHaveBeenCalledWith("nomina_guardar_config_empresa", {
      p: { cuenta_salarios_por_pagar_id: null },
    });
  });

  test("guardarConfigNomina rechaza un enum inválido", async () => {
    await expect(guardarConfigNomina({ riesgo_laboral: "tipo_9" })).resolves.toEqual({
      ok: false,
      error: "El riesgo laboral no es válido.",
    });
  });

  test("guardarMapeoContable envía los mapeos sin el contexto de clase", async () => {
    const rpc = rpcMock({ data: 2 });

    await expect(
      guardarMapeoContable({
        mapeos: [
          { segmento: "ventas", concepto_id: CONCEPTO, clase: "ingreso", cuenta_gasto_id: CUENTA },
          { segmento: "ventas", concepto_id: EMPLEADO, clase: "ingreso", cuenta_gasto_id: LINEA },
        ],
      }),
    ).resolves.toEqual({ ok: true, guardados: 2 });

    expect(rpc).toHaveBeenCalledWith("nomina_guardar_mapeo_contable", {
      p: {
        mapeos: [
          { segmento: "ventas", concepto_id: CONCEPTO, cuenta_gasto_id: CUENTA },
          { segmento: "ventas", concepto_id: EMPLEADO, cuenta_gasto_id: LINEA },
        ],
      },
    });
  });

  test("guardarMapeoContable valida la obligación por clase", async () => {
    await expect(
      guardarMapeoContable({ mapeos: [{ segmento: "ventas", concepto_id: CONCEPTO, clase: "ingreso" }] }),
    ).resolves.toEqual({ ok: false, error: "El ingreso necesita cuenta de gasto." });
  });

  test("guardarParametrosNomina envía la escala completa", async () => {
    const rpc = rpcMock();

    await expect(guardarParametrosNomina(parametersEntrada)).resolves.toEqual({ ok: true });
    expect(rpc).toHaveBeenCalledWith("nomina_guardar_parametros_rd", {
      p: expect.objectContaining({
        anio: 2026,
        tope_sfs_mensual: "232230",
        escala_isr_anual: [
          { desde: "0", hasta: "416220", tasa: "0", monto_fijo: "0" },
          { desde: "416220", hasta: null, tasa: "25", monto_fijo: "0" },
        ],
      }),
    });
  });

  test("un contador puede guardar la configuración", async () => {
    mocks.getRol.mockResolvedValue("contador");
    rpcMock();

    await expect(guardarConfigNomina({ aplica_infotep: true })).resolves.toEqual({ ok: true });
  });

  test("un lector no guarda los parámetros", async () => {
    mocks.getRol.mockResolvedValue("lector");

    await expect(guardarParametrosNomina(parametersEntrada)).resolves.toEqual({
      ok: false,
      error: "No tienes permiso para guardar los parámetros de nómina.",
    });
  });
});

describe("periodos y cálculo", () => {
  test("crearPeriodo envía el rango y la fecha de pago", async () => {
    const rpc = rpcMock({ data: PERIODO });

    await expect(crearPeriodo(periodoEntrada)).resolves.toEqual({ ok: true, id: PERIODO });
    expect(rpc).toHaveBeenCalledWith("nomina_crear_periodo", {
      p: {
        frecuencia: "quincenal",
        fecha_inicio: "2026-11-16",
        fecha_fin: "2026-11-30",
        fecha_pago: "2026-11-30",
      },
    });
    expect(mocks.revalidatePath).toHaveBeenCalledWith("/dashboard/contabilidad/nomina/periodos");
  });

  test("crearPeriodo rechaza un rango no estándar", async () => {
    await expect(
      crearPeriodo({ ...periodoEntrada, fecha_inicio: "2026-11-05", fecha_fin: "2026-11-20" }),
    ).resolves.toEqual({
      ok: false,
      error: "La quincena debe empezar el día 1 o el día 16.",
    });
  });

  test("agregarEmpleadosPeriodo llama la RPC con el periodo y los empleados", async () => {
    const rpc = rpcMock({ data: 2 });

    await expect(agregarEmpleadosPeriodo({ periodo_id: PERIODO, empleado_ids: [EMPLEADO, CONCEPTO] })).resolves.toEqual(
      { ok: true, agregados: 2 },
    );
    expect(rpc).toHaveBeenCalledWith("nomina_agregar_empleados", {
      p_periodo_id: PERIODO,
      p_empleado_ids: [EMPLEADO, CONCEPTO],
    });
    expect(mocks.revalidatePath).toHaveBeenCalledWith(`/dashboard/contabilidad/nomina/periodos/${PERIODO}`);
  });

  test("agregarEmpleadosPeriodo exige al menos un empleado", async () => {
    await expect(agregarEmpleadosPeriodo({ periodo_id: PERIODO, empleado_ids: [] })).resolves.toEqual({
      ok: false,
      error: "Indica al menos un empleado para agregar.",
    });
    expect(mocks.createClient).not.toHaveBeenCalled();
  });

  test("agregarEmpleadosPeriodo devuelve el error de estado de la RPC en español", async () => {
    rpcMock({
      error: {
        message: "El periodo está contabilizado; solo se agregan empleados a un periodo en borrador o calculado.",
        code: "23514",
      },
    });

    await expect(agregarEmpleadosPeriodo({ periodo_id: PERIODO, empleado_ids: [EMPLEADO] })).resolves.toEqual({
      ok: false,
      error: "El periodo está contabilizado; solo se agregan empleados a un periodo en borrador o calculado.",
    });
  });

  test("un lector no agrega empleados al periodo", async () => {
    mocks.getRol.mockResolvedValue("lector");

    await expect(agregarEmpleadosPeriodo({ periodo_id: PERIODO, empleado_ids: [EMPLEADO] })).resolves.toEqual({
      ok: false,
      error: "No tienes permiso para agregar empleados al periodo.",
    });
    expect(mocks.createClient).not.toHaveBeenCalled();
  });

  test("calcularPeriodo devuelve los totales del periodo", async () => {
    rpcMock({ data: { recibos: 2, total_neto: 28227, total_costo_empresa: 34887 } });

    await expect(calcularPeriodo(PERIODO)).resolves.toEqual({
      ok: true,
      recibos: 2,
      totalNeto: "28227",
      totalCostoEmpresa: "34887",
    });
  });

  test("calcularPeriodo detecta una respuesta inesperada", async () => {
    rpcMock({ data: { recibos: 2 } });

    await expect(calcularPeriodo(PERIODO)).resolves.toEqual({
      ok: false,
      error: "Respuesta inesperada del servidor. Recarga la pantalla e intenta de nuevo.",
    });
  });

  test("calcularRecibo llama la RPC del recibo", async () => {
    const rpc = rpcMock({ data: RECIBO });

    await expect(calcularRecibo(RECIBO)).resolves.toEqual({ ok: true, id: RECIBO });
    expect(rpc).toHaveBeenCalledWith("nomina_calcular_recibo", { p_recibo_id: RECIBO });
  });

  test("calcularRecibo rechaza un id inválido", async () => {
    await expect(calcularRecibo("recibo-1")).resolves.toEqual({ ok: false, error: "El recibo no es válido." });
  });
});

describe("novedades del recibo", () => {
  test("guardarNovedadRecibo devuelve la línea y el monto calculado", async () => {
    const rpc = rpcMock({ data: { linea_id: LINEA, monto: 2124.42 } });

    await expect(guardarNovedadRecibo({ recibo_id: RECIBO, concepto_id: CONCEPTO, cantidad: "5" })).resolves.toEqual({
      ok: true,
      id: LINEA,
      monto: "2124.42",
    });
    expect(rpc).toHaveBeenCalledWith("nomina_guardar_novedad_recibo", {
      p: expect.objectContaining({ recibo_id: RECIBO, concepto_id: CONCEPTO, cantidad: "5", notas: null }),
    });
  });

  test("guardarNovedadRecibo envía el monto manual", async () => {
    const rpc = rpcMock({ data: { linea_id: LINEA, monto: 1500 } });

    await guardarNovedadRecibo({ recibo_id: RECIBO, concepto_id: CONCEPTO, monto: "1500" });
    expect(rpc).toHaveBeenCalledWith("nomina_guardar_novedad_recibo", {
      p: expect.objectContaining({ monto: "1500" }),
    });
  });

  test("guardarNovedadRecibo rechaza dos formas a la vez", async () => {
    await expect(
      guardarNovedadRecibo({ recibo_id: RECIBO, concepto_id: CONCEPTO, monto: "1500", porcentaje: "5" }),
    ).resolves.toEqual({
      ok: false,
      error: "Indica una cantidad de horas, un monto o un porcentaje (solo uno).",
    });
  });

  test("guardarNovedadRecibo detecta una respuesta inesperada", async () => {
    rpcMock({ data: { linea_id: LINEA } });

    await expect(guardarNovedadRecibo({ recibo_id: RECIBO, concepto_id: CONCEPTO, monto: "1500" })).resolves.toEqual({
      ok: false,
      error: "Respuesta inesperada del servidor. Recarga la pantalla e intenta de nuevo.",
    });
  });

  test("eliminarNovedadRecibo borra la línea manual", async () => {
    const rpc = rpcMock();

    await expect(eliminarNovedadRecibo(LINEA)).resolves.toEqual({ ok: true });
    expect(rpc).toHaveBeenCalledWith("nomina_eliminar_novedad_recibo", { p_id: LINEA });
  });
});

describe("contabilización", () => {
  test("contabilizarRecibo devuelve el asiento", async () => {
    const rpc = rpcMock({ data: ASIENTO });

    await expect(contabilizarRecibo(RECIBO)).resolves.toEqual({ ok: true, id: ASIENTO });
    expect(rpc).toHaveBeenCalledWith("nomina_contabilizar_recibo", { p_recibo_id: RECIBO });
  });

  test("contabilizarPeriodo devuelve asientos y total", async () => {
    rpcMock({ data: { asientos: 2, total: 69774 } });

    await expect(contabilizarPeriodo(PERIODO)).resolves.toEqual({ ok: true, asientos: 2, total: "69774" });
  });

  test("contabilizarPeriodo devuelve el error de estado en español", async () => {
    rpcMock({ error: { message: "Calcula la nómina del periodo antes de contabilizar.", code: "23514" } });

    await expect(contabilizarPeriodo(PERIODO)).resolves.toEqual({
      ok: false,
      error: "Calcula la nómina del periodo antes de contabilizar.",
    });
  });
});

describe("pago y colillas", () => {
  test("pagarRecibo devuelve el asiento de pago", async () => {
    const rpc = rpcMock({ data: ASIENTO });

    await expect(pagarRecibo({ recibo_id: RECIBO, cuenta_pago_id: CUENTA, fecha: "2026-11-30" })).resolves.toEqual({
      ok: true,
      id: RECIBO,
      asientoId: ASIENTO,
    });
    expect(rpc).toHaveBeenCalledWith("nomina_pagar_recibo", {
      p: { recibo_id: RECIBO, fecha: "2026-11-30", cuenta_pago_id: CUENTA },
    });
  });

  test("pagarRecibo acepta un neto cero sin asiento", async () => {
    rpcMock({ data: null });

    await expect(pagarRecibo({ recibo_id: RECIBO, cuenta_pago_id: CUENTA })).resolves.toEqual({
      ok: true,
      id: RECIBO,
      asientoId: null,
    });
  });

  test("pagarRecibo exige la cuenta de pago", async () => {
    await expect(pagarRecibo({ recibo_id: RECIBO })).resolves.toEqual({
      ok: false,
      error: "Selecciona la cuenta con la que se paga la nómina.",
    });
  });

  test("pagarPeriodo devuelve recibos, asientos y total", async () => {
    rpcMock({ data: { recibos: 2, asientos: 2, total_pagado: 56454 } });

    await expect(pagarPeriodo({ periodo_id: PERIODO, cuenta_pago_id: CUENTA })).resolves.toEqual({
      ok: true,
      recibos: 2,
      asientos: 2,
      totalPagado: "56454",
    });
  });

  test("registrarEnvioColillas sella los recibos indicados", async () => {
    const rpc = rpcMock({ data: 2 });

    await expect(
      registrarEnvioColillas({
        periodo_id: PERIODO,
        recibo_ids: [RECIBO, EMPLEADO],
        enviado_a: "maria@medoxigas.com",
      }),
    ).resolves.toEqual({ ok: true, enviados: 2 });
    expect(rpc).toHaveBeenCalledWith("nomina_registrar_envio_colillas", {
      p: { periodo_id: PERIODO, recibo_ids: [RECIBO, EMPLEADO], enviado_a: "maria@medoxigas.com" },
    });
  });

  test("registrarEnvioColillas exige al menos un recibo", async () => {
    await expect(registrarEnvioColillas({ periodo_id: PERIODO, recibo_ids: [] })).resolves.toEqual({
      ok: false,
      error: "Indica al menos un recibo para registrar el envío.",
    });
  });
});

describe("anulaciones", () => {
  test("anularPagoRecibo devuelve el asiento de reversa", async () => {
    const rpc = rpcMock({ data: ASIENTO });

    await expect(anularPagoRecibo(RECIBO)).resolves.toEqual({ ok: true, id: RECIBO, asientoId: ASIENTO });
    expect(rpc).toHaveBeenCalledWith("nomina_anular_pago_recibo", { p_recibo_id: RECIBO });
  });

  test("anularPagoRecibo acepta un pago sin asiento", async () => {
    rpcMock({ data: null });

    await expect(anularPagoRecibo(RECIBO)).resolves.toEqual({ ok: true, id: RECIBO, asientoId: null });
  });

  test("anularRecibo devuelve la reversa del NO", async () => {
    const rpc = rpcMock({ data: ASIENTO });

    await expect(anularRecibo(RECIBO)).resolves.toEqual({ ok: true, id: RECIBO, asientoId: ASIENTO });
    expect(rpc).toHaveBeenCalledWith("nomina_anular_recibo", { p_recibo_id: RECIBO });
  });

  test("anularRecibo rechaza un recibo pagado con el mensaje de la RPC", async () => {
    rpcMock({
      error: { message: "El recibo está pagado; anula el pago antes de anular el recibo.", code: "23514" },
    });

    await expect(anularRecibo(RECIBO)).resolves.toEqual({
      ok: false,
      error: "El recibo está pagado; anula el pago antes de anular el recibo.",
    });
  });

  test("un lector no anula recibos", async () => {
    mocks.getRol.mockResolvedValue("lector");

    await expect(anularRecibo(RECIBO)).resolves.toEqual({
      ok: false,
      error: "No tienes permiso para anular el recibo.",
    });
    expect(mocks.createClient).not.toHaveBeenCalled();
  });
});
