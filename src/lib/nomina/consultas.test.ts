import { beforeEach, describe, expect, test, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  createClient: vi.fn(),
}));

vi.mock("@/lib/supabase/server", () => ({ createClient: mocks.createClient }));

const {
  getConceptos,
  getConfigNomina,
  getEmpleado,
  getEmpleados,
  getMapeoContable,
  getNovedadesRecurrentes,
  getParametrosNomina,
  getPeriodo,
  getPeriodos,
  getRecibo,
  getRecibos,
  getReporteTSS,
  getResumenPeriodo,
} = await import("./consultas");

const UUID = "11111111-1111-4111-8111-111111111111";
const OTRO_UUID = "22222222-2222-4222-8222-222222222222";

interface ErrorRpc {
  message: string;
  code?: string;
}

interface ConsultaFalsa {
  tabla: string;
  llamadas: string[];
}

function crearConsulta(filas: unknown[], error: ErrorRpc | null) {
  return crearConstructor({ data: filas, error });
}

function crearConstructor(resultado: { data: unknown; error: ErrorRpc | null }) {
  const llamadas: string[] = [];
  const registrar = (metodo: string, args: unknown[]) => {
    const texto = args
      .map((arg) => (typeof arg === "object" && arg !== null ? JSON.stringify(arg) : String(arg)))
      .join("|");
    llamadas.push(`${metodo}(${texto})`);
  };

  const consulta: Record<string, unknown> = {};
  for (const metodo of ["select", "eq", "order", "or", "range", "returns"]) {
    consulta[metodo] = (...args: unknown[]) => {
      registrar(metodo, args);
      return consulta;
    };
  }
  consulta.maybeSingle = () => {
    registrar("maybeSingle", []);
    const data = Array.isArray(resultado.data) ? (resultado.data[0] ?? null) : resultado.data;
    return Promise.resolve({ data, error: resultado.error });
  };
  // biome-ignore lint/suspicious/noThenProperty: el mock imita el builder de Supabase, que se espera con await.
  consulta.then = (resolver: (valor: { data: unknown; error: ErrorRpc | null }) => unknown) =>
    Promise.resolve(resultado).then(resolver);

  return { consulta, llamadas };
}

function crearRpc(data: unknown, error: ErrorRpc | null) {
  return crearConstructor({ data, error }).consulta;
}

function mockCliente(opciones: {
  filas?: Record<string, unknown[]>;
  error?: ErrorRpc | null;
  rpcData?: unknown;
  rpcError?: ErrorRpc | null;
}): { from: ReturnType<typeof vi.fn>; rpc: ReturnType<typeof vi.fn>; consultas: ConsultaFalsa[] } {
  const consultas: ConsultaFalsa[] = [];
  const error = opciones.error ?? null;

  const from = vi.fn((tabla: string) => {
    const { consulta, llamadas } = crearConsulta(opciones.filas?.[tabla] ?? [], error);
    consultas.push({ tabla, llamadas });
    return consulta;
  });

  const rpc = vi.fn(() => crearRpc(opciones.rpcData ?? [], opciones.rpcError ?? null));
  mocks.createClient.mockResolvedValue({ from, rpc });

  return { from, rpc, consultas };
}

const filaEmpleado = {
  id: UUID,
  contacto_id: OTRO_UUID,
  tipo_identificacion: "cedula",
  identificacion: "00112345678",
  primer_nombre: "María",
  segundo_nombre: null,
  primer_apellido: "Fernández",
  segundo_apellido: null,
  correo: null,
  telefono: null,
  municipio: null,
  direccion: null,
  cargo: "Contadora",
  area: null,
  segmento_contable: "administrativa",
  centro_costo_id: null,
  centro_costo: null,
  tipo_contrato: "indefinido",
  fecha_ingreso: "2024-03-01",
  fecha_fin: null,
  frecuencia_pago: "quincenal",
  salario_mensual: 60000,
  metodo_pago: "transferencia",
  banco_nombre: "Banco Popular",
  tipo_cuenta_banco: "corriente",
  numero_cuenta_banco: "123",
  clave_tss: "001",
  estado: "activo",
  creado_en: "2026-11-20T00:00:00Z",
};

const filaPeriodo = {
  id: UUID,
  codigo: "2026-11-Q2",
  frecuencia: "quincenal",
  fecha_inicio: "2026-11-16",
  fecha_fin: "2026-11-30",
  fecha_pago: null,
  anio_fiscal: 2026,
  estado: "borrador",
  total_salario: 0,
  total_ingresos: 0,
  total_deducciones: 0,
  total_aportes_empleador: 0,
  total_provisiones: 0,
  total_neto: 0,
  total_costo_empresa: 0,
  observaciones: null,
  creado_en: "2026-11-20T00:00:00Z",
};

const filaRecibo = {
  id: UUID,
  periodo_id: OTRO_UUID,
  empleado_id: UUID,
  dias_trabajados: 11.915,
  salario_base: 30000,
  base_tss: 30000,
  base_sfs: 30000,
  base_afp: 30000,
  base_srl: 30000,
  base_infotep: 30000,
  base_isr: 30000,
  total_ingresos: 30000,
  total_deducciones: 1773,
  total_aportes_empleador: 4887,
  total_provisiones: 0,
  neto_pagar: 28227,
  costo_total_empresa: 34887,
  estado: "calculado",
  cuenta_salarios_por_pagar_id: null,
  asiento_id: null,
  pago_asiento_id: null,
  cuenta_pago_id: null,
  fecha_pagado: null,
  colilla_enviada_en: null,
  colilla_enviada_a: null,
  creado_en: "2026-11-20T00:00:00Z",
  periodo: { codigo: "2026-11-Q2" },
  empleado: { primer_nombre: "María", segundo_nombre: null, primer_apellido: "Fernández", segundo_apellido: null },
};

const filaLinea = {
  id: UUID,
  recibo_id: OTRO_UUID,
  concepto_id: UUID,
  clase: "ingreso",
  cantidad: null,
  porcentaje: null,
  monto: 30000,
  origen: "sistema",
  notas: null,
  orden: 10,
  creado_en: "2026-11-20T00:00:00Z",
  nomina_conceptos: { codigo: "SALARIO", nombre: "Salario" },
};

const filaNovedad = {
  id: UUID,
  empleado_id: OTRO_UUID,
  concepto_id: UUID,
  monto: 1500,
  porcentaje: null,
  fecha_inicio: "2026-11-01",
  fecha_fin: null,
  activa: true,
  notas: null,
  creado_en: "2026-11-20T00:00:00Z",
  nomina_conceptos: { codigo: "PRESTAMO", nombre: "Préstamos", clase: "deduccion" },
};

const filaConcepto = {
  id: UUID,
  codigo: "SALARIO",
  nombre: "Salario",
  clase: "ingreso",
  grava_tss: true,
  grava_isr: true,
  grava_infotep: true,
  es_sistema: true,
  activo: true,
  orden: 10,
  creado_en: "2026-11-20T00:00:00Z",
};

const filaParametros = {
  anio: 2026,
  salario_minimo: 23223,
  tasa_sfs_empleado: 3.04,
  tasa_sfs_empleador: 7.09,
  tope_sfs_mensual: 232230,
  tasa_afp_empleado: 2.87,
  tasa_afp_empleador: 7.1,
  tope_afp_mensual: 464460,
  tope_srl_mensual: 92892,
  tasa_srl_tipo_1: 1.1,
  tasa_srl_tipo_2: 1.15,
  tasa_srl_tipo_3: 1.25,
  tasa_srl_tipo_4: 1.3,
  tasa_infotep: 1,
  dias_mes_laboral: 23.83,
  horas_dia_laboral: 8,
  escala_isr_anual: [{ desde: 0, hasta: null, tasa: 0, monto_fijo: 0 }],
  actualizado_en: "2026-11-20T00:00:00Z",
};

const filaConfig = {
  id: 1,
  riesgo_laboral: "tipo_1",
  categoria_empresa: "pequena",
  aplica_infotep: true,
  frecuencia_defecto: "quincenal",
  cuenta_pago_defecto_id: UUID,
  cuenta_salarios_por_pagar_id: UUID,
  registrar_provisiones: false,
  contacto_tss_id: null,
  contacto_infotep_id: null,
  contacto_dgii_id: null,
  actualizado_en: "2026-11-20T00:00:00Z",
  cuenta_pago: { codigo: "1102", nombre: "Banco principal" },
  cuenta_salarios: { codigo: "2107", nombre: "Salarios por pagar" },
  contacto_tss: null,
  contacto_infotep: null,
  contacto_dgii: null,
};

const filaMapeo = {
  id: UUID,
  segmento: "administrativa",
  concepto_id: OTRO_UUID,
  cuenta_gasto_id: UUID,
  cuenta_pasivo_id: null,
  nomina_conceptos: { codigo: "SALARIO", nombre: "Salario", clase: "ingreso", orden: 10 },
  cuenta_gasto: { codigo: "6110", nombre: "Sueldos y salarios" },
  cuenta_pasivo: null,
};

const filaResumen = {
  recibo_id: UUID,
  empleado_id: OTRO_UUID,
  empleado_nombre: "María Fernández",
  identificacion: "00112345678",
  cargo: "Contadora",
  segmento_contable: "administrativa",
  dias_trabajados: 23.83,
  salario_base: 30000,
  total_ingresos: 30000,
  total_deducciones: 1773,
  total_aportes_empleador: 4887,
  total_provisiones: 0,
  neto_pagar: 28227,
  costo_total_empresa: 34887,
  estado: "calculado",
  asiento_codigo: null,
  fecha_pagado: null,
  colilla_enviada_en: null,
};

const filaTss = {
  anio: 2026,
  mes: 11,
  empleado_id: UUID,
  empleado_nombre: "María Fernández",
  identificacion: "00112345678",
  clave_tss: "001",
  periodos: 1,
  dias_trabajados: 23.83,
  salario_base: 30000,
  base_sfs: 30000,
  base_afp: 30000,
  base_srl: 30000,
  base_infotep: 30000,
  base_isr: 30000,
  sfs_empleado: 912,
  afp_empleado: 861,
  isr: 0,
  sfs_empleador: 2127,
  afp_empleador: 2130,
  srl: 330,
  infotep: 300,
  total_deducciones: 1773,
  neto_pagar: 28227,
};

beforeEach(() => {
  vi.clearAllMocks();
});

describe("getEmpleados", () => {
  test("lee la tabla con el centro de costo y pagina por lotes", async () => {
    const { from, consultas } = mockCliente({ filas: { empleados: [filaEmpleado] } });

    const empleados = await getEmpleados();

    expect(from).toHaveBeenCalledWith("empleados");
    expect(empleados).toHaveLength(1);
    expect(empleados[0]?.nombre_completo).toBe("María Fernández");
    expect(consultas[0]?.llamadas.some((llamada) => llamada.includes("centro_costo:centros_costo(nombre)"))).toBe(true);
    expect(consultas[0]?.llamadas).toContain("order(primer_apellido)");
    expect(consultas[0]?.llamadas).toContain("order(id)");
    expect(consultas[0]?.llamadas.some((llamada) => llamada.startsWith("range(0|999)"))).toBe(true);
  });

  test("aplica estado, frecuencia, segmento y búsqueda", async () => {
    const { consultas } = mockCliente({ filas: { empleados: [] } });

    await getEmpleados({
      estado: "activo",
      frecuencia: "mensual",
      segmento: "ventas",
      busqueda: "maría",
    });

    const llamadas = consultas[0]?.llamadas ?? [];
    expect(llamadas).toContain("eq(estado|activo)");
    expect(llamadas).toContain("eq(frecuencia_pago|mensual)");
    expect(llamadas).toContain("eq(segmento_contable|ventas)");
    expect(
      llamadas.some((llamada) => llamada.startsWith("or(") && llamada.includes("primer_nombre.ilike.%maría%")),
    ).toBe(true);
  });

  test("limpia los caracteres que rompen el or de PostgREST", async () => {
    const { consultas } = mockCliente({ filas: { empleados: [] } });

    await getEmpleados({ busqueda: "a%,(b)" });

    const or = consultas[0]?.llamadas.find((llamada) => llamada.startsWith("or("));
    expect(or).toContain("a b");
  });

  test("un filtro inválido devuelve lista vacía sin tocar la base", async () => {
    await expect(getEmpleados({ estado: "despedido" })).resolves.toEqual([]);
    expect(mocks.createClient).not.toHaveBeenCalled();
  });
});

describe("getEmpleado", () => {
  test("un id inválido devuelve null sin consultar", async () => {
    await expect(getEmpleado("no-es-uuid")).resolves.toBeNull();
    expect(mocks.createClient).not.toHaveBeenCalled();
  });

  test("lee la ficha por id", async () => {
    const { consultas } = mockCliente({ filas: { empleados: [filaEmpleado] } });

    const empleado = await getEmpleado(UUID);

    expect(empleado?.identificacion).toBe("00112345678");
    expect(consultas[0]?.llamadas).toContain(`eq(id|${UUID})`);
    expect(consultas[0]?.llamadas).toContain("maybeSingle()");
  });

  test("sin fila devuelve null", async () => {
    mockCliente({ filas: { empleados: [] } });
    await expect(getEmpleado(UUID)).resolves.toBeNull();
  });
});

describe("getPeriodos y getPeriodo", () => {
  test("ordena del más reciente al más antiguo", async () => {
    const { from, consultas } = mockCliente({ filas: { nomina_periodos: [filaPeriodo] } });

    const periodos = await getPeriodos();

    expect(from).toHaveBeenCalledWith("nomina_periodos");
    expect(periodos[0]?.codigo).toBe("2026-11-Q2");
    expect(consultas[0]?.llamadas).toContain('order(fecha_inicio|{"ascending":false})');
  });

  test("filtra por año, frecuencia y estado", async () => {
    const { consultas } = mockCliente({ filas: { nomina_periodos: [] } });

    await getPeriodos({ anio: 2026, frecuencia: "mensual", estado: "pagado" });

    const llamadas = consultas[0]?.llamadas ?? [];
    expect(llamadas).toContain("eq(anio_fiscal|2026)");
    expect(llamadas).toContain("eq(frecuencia|mensual)");
    expect(llamadas).toContain("eq(estado|pagado)");
  });

  test("un periodo con id inválido devuelve null", async () => {
    await expect(getPeriodo("2026-11-Q2")).resolves.toBeNull();
    expect(mocks.createClient).not.toHaveBeenCalled();
  });

  test("lee un periodo por id", async () => {
    mockCliente({ filas: { nomina_periodos: [filaPeriodo] } });
    await expect(getPeriodo(UUID)).resolves.toMatchObject({ id: UUID, anio_fiscal: 2026 });
  });
});

describe("getRecibos y getRecibo", () => {
  test("filtra por periodo y ordena por nombre del empleado", async () => {
    const { consultas } = mockCliente({ filas: { nomina_recibos: [filaRecibo] } });

    const recibos = await getRecibos({ periodo_id: OTRO_UUID });

    expect(recibos[0]?.empleado_nombre).toBe("María Fernández");
    expect(recibos[0]?.periodo_codigo).toBe("2026-11-Q2");
    expect(consultas[0]?.llamadas).toContain(`eq(periodo_id|${OTRO_UUID})`);
  });

  test("un filtro inválido devuelve lista vacía", async () => {
    await expect(getRecibos({ estado: "perdido" })).resolves.toEqual([]);
    expect(mocks.createClient).not.toHaveBeenCalled();
  });

  test("el detalle trae las líneas ordenadas por orden", async () => {
    const linea400 = { ...filaLinea, id: OTRO_UUID, orden: 400, nomina_conceptos: { codigo: "SFS", nombre: "SFS" } };
    mockCliente({
      filas: { nomina_recibos: [filaRecibo], nomina_recibo_lineas: [linea400, filaLinea] },
    });

    const recibo = await getRecibo(UUID);

    expect(recibo?.lineas).toHaveLength(2);
    expect(recibo?.lineas[0]?.orden).toBe(10);
    expect(recibo?.lineas[1]?.concepto_codigo).toBe("SFS");
  });

  test("un recibo inexistente devuelve null sin leer líneas", async () => {
    const { from } = mockCliente({ filas: { nomina_recibos: [], nomina_recibo_lineas: [filaLinea] } });

    await expect(getRecibo(UUID)).resolves.toBeNull();
    expect(from).toHaveBeenCalledTimes(1);
  });

  test("un id inválido devuelve null", async () => {
    await expect(getRecibo("recibo-1")).resolves.toBeNull();
  });
});

describe("getNovedadesRecurrentes", () => {
  test("un empleado inválido devuelve lista vacía", async () => {
    await expect(getNovedadesRecurrentes("x")).resolves.toEqual([]);
    expect(mocks.createClient).not.toHaveBeenCalled();
  });

  test("devuelve todas por defecto", async () => {
    const { consultas } = mockCliente({ filas: { empleado_novedades_recurrentes: [filaNovedad] } });

    const novedades = await getNovedadesRecurrentes(UUID);

    expect(novedades[0]?.concepto_codigo).toBe("PRESTAMO");
    expect(consultas[0]?.llamadas).not.toContain("eq(activa|true)");
  });

  test("solo_activas agrega el filtro", async () => {
    const { consultas } = mockCliente({ filas: { empleado_novedades_recurrentes: [] } });

    await getNovedadesRecurrentes(UUID, { solo_activas: true });

    expect(consultas[0]?.llamadas).toContain("eq(activa|true)");
  });
});

describe("getConceptos", () => {
  test("filtra por clase y estado", async () => {
    const { consultas } = mockCliente({ filas: { nomina_conceptos: [filaConcepto] } });

    const conceptos = await getConceptos({ clase: "ingreso", activo: true });

    expect(conceptos[0]?.codigo).toBe("SALARIO");
    const llamadas = consultas[0]?.llamadas ?? [];
    expect(llamadas).toContain("eq(clase|ingreso)");
    expect(llamadas).toContain("eq(activo|true)");
  });

  test("busca por código o nombre", async () => {
    const { consultas } = mockCliente({ filas: { nomina_conceptos: [] } });

    await getConceptos({ busqueda: "sal" });

    const or = consultas[0]?.llamadas.find((llamada) => llamada.startsWith("or("));
    expect(or).toContain("codigo.ilike.%sal%");
    expect(or).toContain("nombre.ilike.%sal%");
  });
});

describe("getParametrosNomina y getConfigNomina", () => {
  test("un año inválido devuelve null", async () => {
    await expect(getParametrosNomina(1999)).resolves.toBeNull();
    expect(mocks.createClient).not.toHaveBeenCalled();
  });

  test("lee los parámetros del año", async () => {
    mockCliente({ filas: { nomina_parametros_rd: [filaParametros] } });

    const parametros = await getParametrosNomina(2026);

    expect(parametros?.tope_sfs_mensual).toBe("232230");
    expect(parametros?.escala_isr_anual).toHaveLength(1);
  });

  test("un año sin fila devuelve null", async () => {
    mockCliente({ filas: { nomina_parametros_rd: [] } });
    await expect(getParametrosNomina(2027)).resolves.toBeNull();
  });

  test("la configuración trae los nombres de cuentas", async () => {
    const { consultas } = mockCliente({ filas: { nomina_config_empresa: [filaConfig] } });

    const config = await getConfigNomina();

    expect(config?.cuenta_pago_defecto_nombre).toBe("1102 — Banco principal");
    expect(consultas[0]?.llamadas).toContain("eq(id|1)");
  });

  test("sin configuración devuelve null", async () => {
    mockCliente({ filas: { nomina_config_empresa: [] } });
    await expect(getConfigNomina()).resolves.toBeNull();
  });
});

describe("getMapeoContable", () => {
  test("un segmento inválido devuelve lista vacía", async () => {
    await expect(getMapeoContable("otro")).resolves.toEqual([]);
    expect(mocks.createClient).not.toHaveBeenCalled();
  });

  test("filtra por segmento y ordena por clase", async () => {
    const { consultas } = mockCliente({ filas: { nomina_mapeo_contable: [filaMapeo] } });

    const mapeos = await getMapeoContable("administrativa");

    expect(mapeos[0]?.cuenta_gasto_codigo).toBe("6110");
    expect(consultas[0]?.llamadas).toContain("eq(segmento|administrativa)");
  });
});

describe("reportes", () => {
  test("getResumenPeriodo llama la RPC con el periodo", async () => {
    const { rpc } = mockCliente({ rpcData: [filaResumen] });

    const filas = await getResumenPeriodo(UUID);

    expect(filas[0]?.neto_pagar).toBe("28227");
    expect(rpc).toHaveBeenCalledWith("nomina_resumen_periodo", { p_periodo_id: UUID });
  });

  test("un periodo inválido no llama la RPC", async () => {
    await expect(getResumenPeriodo("x")).resolves.toEqual([]);
    expect(mocks.createClient).not.toHaveBeenCalled();
  });

  test("getReporteTSS valida el mes", async () => {
    await expect(getReporteTSS({ anio: 2026, mes: 13 })).resolves.toEqual([]);
    expect(mocks.createClient).not.toHaveBeenCalled();
  });

  test("getReporteTSS llama la RPC con año y mes", async () => {
    const { rpc } = mockCliente({ rpcData: [filaTss] });

    const filas = await getReporteTSS({ anio: 2026, mes: 11 });

    expect(filas[0]?.empleado_nombre).toBe("María Fernández");
    expect(filas[0]?.sfs_empleado).toBe("912");
    expect(rpc).toHaveBeenCalledWith("nomina_reporte_tss", { p_anio: 2026, p_mes: 11 });
  });

  test("un error de la RPC se traduce al español", async () => {
    mockCliente({ rpcError: { message: "duplicate key value violates unique constraint", code: "23505" } });

    await expect(getReporteTSS({ anio: 2026, mes: 11 })).rejects.toThrow("Ese registro ya existe.");
  });
});
