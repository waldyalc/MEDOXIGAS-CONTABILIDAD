import { describe, expect, test } from "vitest";
import type { z } from "zod";

import {
  anioSchema,
  cambioEstadoEmpleadoSchema,
  configNominaSchema,
  empleadoSchema,
  envioColillasSchema,
  filtroEmpleadoSchema,
  mapeoContableSchema,
  novedadReciboSchema,
  novedadRecurrenteSchema,
  pagoPeriodoSchema,
  pagoReciboSchema,
  parametrosNominaSchema,
  periodoSchema,
  reporteTssSchema,
} from "./esquemas";

const UUID = "11111111-1111-4111-8111-111111111111";
const OTRO_UUID = "22222222-2222-4222-8222-222222222222";
const CUENTA = "33333333-3333-4333-8333-333333333333";

function errorDe(esquema: z.ZodType, valor: unknown): string {
  const resultado = esquema.safeParse(valor);
  return resultado.success ? "" : (resultado.error.issues[0]?.message ?? "");
}

const empleadoBase = {
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

describe("empleadoSchema", () => {
  test("normaliza la cédula a dígitos y aplica los defaults", () => {
    const resultado = empleadoSchema.safeParse(empleadoBase);
    expect(resultado.success).toBe(true);
    if (!resultado.success) return;

    expect(resultado.data.identificacion).toBe("00112345678");
    expect(resultado.data.tipo_contrato).toBe("indefinido");
  });

  test("acepta el salario con separador de miles y coma decimal", () => {
    const resultado = empleadoSchema.safeParse({ ...empleadoBase, salario_mensual: "1,500.50" });
    expect(resultado.success).toBe(true);
    if (resultado.success) expect(Number(resultado.data.salario_mensual)).toBe(1500.5);
  });

  test("rechaza una cédula de 10 dígitos", () => {
    expect(errorDe(empleadoSchema, { ...empleadoBase, identificacion: "001-123456-7" })).toBe(
      "La cédula debe tener 11 dígitos.",
    );
  });

  test("rechaza una cédula con letras que no deja 11 dígitos", () => {
    expect(errorDe(empleadoSchema, { ...empleadoBase, identificacion: "abc" })).toBe(
      "La cédula debe tener 11 dígitos.",
    );
  });

  test("un pasaporte en blanco es obligatorio", () => {
    expect(errorDe(empleadoSchema, { ...empleadoBase, tipo_identificacion: "pasaporte", identificacion: "   " })).toBe(
      "La identificación es obligatoria.",
    );
  });

  test("el salario debe ser mayor que cero", () => {
    expect(errorDe(empleadoSchema, { ...empleadoBase, salario_mensual: "0" })).toBe(
      "El salario mensual debe ser mayor que cero.",
    );
  });

  test("rechaza un salario con más de dos decimales", () => {
    expect(errorDe(empleadoSchema, { ...empleadoBase, salario_mensual: "100.123" })).toBe(
      "El salario mensual debe ser un número de hasta 2 decimales.",
    );
  });

  test("el contrato definido exige fecha de fin", () => {
    expect(errorDe(empleadoSchema, { ...empleadoBase, tipo_contrato: "definido" })).toBe(
      "El contrato definido necesita una fecha de fin.",
    );
  });

  test("la fecha de fin no puede ser anterior al ingreso", () => {
    expect(
      errorDe(empleadoSchema, {
        ...empleadoBase,
        tipo_contrato: "definido",
        fecha_fin: "2024-02-01",
      }),
    ).toBe("La fecha de fin no puede ser anterior a la fecha de ingreso.");
  });

  test("la transferencia exige banco, tipo y número de cuenta", () => {
    const mensaje = errorDe(empleadoSchema, { ...empleadoBase, metodo_pago: "transferencia" });
    expect(mensaje).toBe("Si el pago es por transferencia, indica el banco, el tipo y el número de cuenta.");
  });

  test("acepta transferencia completa", () => {
    const resultado = empleadoSchema.safeParse({
      ...empleadoBase,
      metodo_pago: "transferencia",
      banco_nombre: "Banco Popular",
      tipo_cuenta_banco: "corriente",
      numero_cuenta_banco: "123456789",
    });
    expect(resultado.success).toBe(true);
  });

  test("la clave TSS debe tener 3 dígitos", () => {
    expect(errorDe(empleadoSchema, { ...empleadoBase, clave_tss: "12" })).toBe("La clave TSS debe tener 3 dígitos.");
  });

  test("valida el formato del correo", () => {
    expect(errorDe(empleadoSchema, { ...empleadoBase, correo: "maria@medoxigas" })).toBe(
      "El correo no tiene un formato válido.",
    );
  });

  test("convierte los textos opcionales vacíos en undefined", () => {
    const resultado = empleadoSchema.safeParse({ ...empleadoBase, segundo_nombre: "  ", correo: "" });
    expect(resultado.success).toBe(true);
    if (resultado.success) {
      expect(resultado.data.segundo_nombre).toBeUndefined();
      expect(resultado.data.correo).toBeUndefined();
    }
  });
});

describe("novedadRecurrenteSchema", () => {
  const base = {
    empleado_id: UUID,
    concepto_id: OTRO_UUID,
    fecha_inicio: "2026-11-01",
  };

  test("acepta un monto fijo", () => {
    const resultado = novedadRecurrenteSchema.safeParse({ ...base, monto: "1500" });
    expect(resultado.success).toBe(true);
    if (resultado.success) expect(resultado.data.activa).toBe(true);
  });

  test("acepta un porcentaje", () => {
    expect(novedadRecurrenteSchema.safeParse({ ...base, porcentaje: "5.5" }).success).toBe(true);
  });

  test("rechaza monto y porcentaje a la vez", () => {
    expect(errorDe(novedadRecurrenteSchema, { ...base, monto: "10", porcentaje: "5" })).toBe(
      "Indica un monto o un porcentaje, no ambos.",
    );
  });

  test("exige una de las dos formas", () => {
    expect(errorDe(novedadRecurrenteSchema, base)).toBe("Indica un monto o un porcentaje mayor que cero.");
  });

  test("el monto debe ser mayor que cero", () => {
    expect(errorDe(novedadRecurrenteSchema, { ...base, monto: "0" })).toBe("El monto debe ser mayor que cero.");
  });

  test("el porcentaje no pasa de 100", () => {
    expect(errorDe(novedadRecurrenteSchema, { ...base, porcentaje: "101" })).toBe(
      "El porcentaje debe ser mayor que cero y máximo 100.",
    );
  });

  test("la fecha de fin no puede ser anterior al inicio", () => {
    expect(errorDe(novedadRecurrenteSchema, { ...base, monto: "10", fecha_fin: "2026-10-01" })).toBe(
      "La fecha de fin no puede ser anterior a la fecha de inicio.",
    );
  });
});

describe("periodoSchema", () => {
  test("acepta un mes completo", () => {
    expect(
      periodoSchema.safeParse({ frecuencia: "mensual", fecha_inicio: "2026-11-01", fecha_fin: "2026-11-30" }).success,
    ).toBe(true);
  });

  test("acepta la primera quincena", () => {
    expect(
      periodoSchema.safeParse({ frecuencia: "quincenal", fecha_inicio: "2026-11-01", fecha_fin: "2026-11-15" }).success,
    ).toBe(true);
  });

  test("acepta la segunda quincena hasta el último día", () => {
    expect(
      periodoSchema.safeParse({ frecuencia: "quincenal", fecha_inicio: "2026-11-16", fecha_fin: "2026-11-30" }).success,
    ).toBe(true);
  });

  test("rechaza un mes incompleto", () => {
    expect(errorDe(periodoSchema, { frecuencia: "mensual", fecha_inicio: "2026-11-01", fecha_fin: "2026-11-29" })).toBe(
      "El periodo mensual debe ir del primer al último día del mes.",
    );
  });

  test("rechaza un rango libre de quincena", () => {
    expect(
      errorDe(periodoSchema, { frecuencia: "quincenal", fecha_inicio: "2026-11-05", fecha_fin: "2026-11-20" }),
    ).toBe("La quincena debe empezar el día 1 o el día 16.");
  });

  test("rechaza una primera quincena que no termina el 15", () => {
    expect(
      errorDe(periodoSchema, { frecuencia: "quincenal", fecha_inicio: "2026-11-01", fecha_fin: "2026-11-14" }),
    ).toBe("La primera quincena debe ir del día 1 al 15.");
  });

  test("rechaza un periodo que cruza de año", () => {
    expect(errorDe(periodoSchema, { frecuencia: "mensual", fecha_inicio: "2026-12-01", fecha_fin: "2027-01-31" })).toBe(
      "El periodo no puede cruzar de año.",
    );
  });

  test("rechaza una fecha de fin anterior al inicio", () => {
    expect(errorDe(periodoSchema, { frecuencia: "mensual", fecha_inicio: "2026-11-30", fecha_fin: "2026-11-01" })).toBe(
      "La fecha fin no puede ser anterior a la fecha inicio.",
    );
  });

  test("no exige fecha de pago", () => {
    expect(
      periodoSchema.safeParse({ frecuencia: "mensual", fecha_inicio: "2026-02-01", fecha_fin: "2026-02-28" }).success,
    ).toBe(true);
  });
});

describe("novedadReciboSchema", () => {
  const base = { recibo_id: UUID, concepto_id: OTRO_UUID };

  test("acepta horas extra con cantidad positiva", () => {
    expect(novedadReciboSchema.safeParse({ ...base, cantidad: "5" }).success).toBe(true);
  });

  test("las horas extra exigen cantidad mayor que cero", () => {
    expect(errorDe(novedadReciboSchema, { ...base, cantidad: "0" })).toBe(
      "Las horas extra requieren una cantidad mayor que cero.",
    );
  });

  test("rechaza monto y porcentaje juntos", () => {
    expect(errorDe(novedadReciboSchema, { ...base, monto: "10", porcentaje: "5" })).toBe(
      "Indica una cantidad de horas, un monto o un porcentaje (solo uno).",
    );
  });

  test("rechaza cantidad y monto juntos", () => {
    expect(errorDe(novedadReciboSchema, { ...base, cantidad: "5", monto: "10" })).toBe(
      "Indica una cantidad de horas, un monto o un porcentaje (solo uno).",
    );
  });

  test("exige una de las tres formas", () => {
    expect(errorDe(novedadReciboSchema, base)).toBe(
      "Indica una cantidad de horas, un monto o un porcentaje (solo uno).",
    );
  });

  test("el porcentaje no pasa de 100", () => {
    expect(errorDe(novedadReciboSchema, { ...base, porcentaje: "150" })).toBe(
      "El porcentaje debe ser mayor que cero y máximo 100.",
    );
  });
});

describe("pagos y envíos", () => {
  test("el pago de recibo exige la cuenta", () => {
    expect(errorDe(pagoReciboSchema, { recibo_id: UUID })).toBe("Selecciona la cuenta con la que se paga la nómina.");
  });

  test("acepta un pago con fecha", () => {
    const resultado = pagoReciboSchema.safeParse({ recibo_id: UUID, cuenta_pago_id: CUENTA, fecha: "2026-11-30" });
    expect(resultado.success).toBe(true);
  });

  test("rechaza un recibo que no es uuid", () => {
    expect(errorDe(pagoReciboSchema, { recibo_id: "recibo-1", cuenta_pago_id: CUENTA })).toBe(
      "Selecciona un recibo válido.",
    );
  });

  test("el pago de periodo exige periodo y cuenta", () => {
    expect(errorDe(pagoPeriodoSchema, { cuenta_pago_id: CUENTA })).toBe("Selecciona un periodo válido.");
    expect(errorDe(pagoPeriodoSchema, { periodo_id: UUID })).toBe("Selecciona la cuenta con la que se paga la nómina.");
  });

  test("el envío exige al menos un recibo", () => {
    expect(errorDe(envioColillasSchema, { periodo_id: UUID, recibo_ids: [] })).toBe(
      "Indica al menos un recibo para registrar el envío.",
    );
  });

  test("el envío acepta vario recibos y destinatario", () => {
    const resultado = envioColillasSchema.safeParse({
      periodo_id: UUID,
      recibo_ids: [UUID, OTRO_UUID],
      enviado_a: "maria@medoxigas.com",
    });
    expect(resultado.success).toBe(true);
  });

  test("el cambio de estado solo acepta los estados del contrato", () => {
    expect(cambioEstadoEmpleadoSchema.safeParse({ estado: "suspendido" }).success).toBe(true);
    expect(errorDe(cambioEstadoEmpleadoSchema, { estado: "despedido" })).toBe("El estado del empleado no es válido.");
  });
});

describe("configNominaSchema", () => {
  test("acepta una actualización parcial vacía", () => {
    expect(configNominaSchema.safeParse({}).success).toBe(true);
  });

  test("rechaza un riesgo laboral fuera de la lista", () => {
    expect(errorDe(configNominaSchema, { riesgo_laboral: "tipo_9" })).toBe("El riesgo laboral no es válido.");
  });

  test("convierte el vacío en null para borrar una cuenta", () => {
    const resultado = configNominaSchema.safeParse({ cuenta_pago_defecto_id: "" });
    expect(resultado.success).toBe(true);
    if (resultado.success) expect(resultado.data.cuenta_pago_defecto_id).toBeNull();
  });

  test("no inventa las claves que no vienen", () => {
    const resultado = configNominaSchema.safeParse({ aplica_infotep: false });
    expect(resultado.success).toBe(true);
    if (resultado.success) expect(resultado.data.cuenta_pago_defecto_id).toBeUndefined();
  });
});

describe("mapeoContableSchema", () => {
  const base = { segmento: "administrativa", concepto_id: UUID };

  test("acepta un ingreso con cuenta de gasto", () => {
    const resultado = mapeoContableSchema.safeParse({
      mapeos: [{ ...base, clase: "ingreso", cuenta_gasto_id: CUENTA }],
    });
    expect(resultado.success).toBe(true);
  });

  test("el ingreso exige cuenta de gasto", () => {
    expect(errorDe(mapeoContableSchema, { mapeos: [{ ...base, clase: "ingreso" }] })).toBe(
      "El ingreso necesita cuenta de gasto.",
    );
  });

  test("el ingreso no lleva cuenta de pasivo", () => {
    expect(
      errorDe(mapeoContableSchema, {
        mapeos: [{ ...base, clase: "ingreso", cuenta_gasto_id: CUENTA, cuenta_pasivo_id: OTRO_UUID }],
      }),
    ).toBe("El ingreso no lleva cuenta de pasivo.");
  });

  test("la deducción exige cuenta de pasivo", () => {
    expect(errorDe(mapeoContableSchema, { mapeos: [{ ...base, clase: "deduccion" }] })).toBe(
      "La deducción necesita cuenta de pasivo.",
    );
  });

  test("la deducción no lleva cuenta de gasto", () => {
    expect(
      errorDe(mapeoContableSchema, {
        mapeos: [{ ...base, clase: "deduccion", cuenta_gasto_id: CUENTA, cuenta_pasivo_id: OTRO_UUID }],
      }),
    ).toBe("La deducción no lleva cuenta de gasto.");
  });

  test("el aporte patronal exige las dos cuentas", () => {
    expect(errorDe(mapeoContableSchema, { mapeos: [{ ...base, clase: "aporte_empleador" }] })).toBe(
      "El aporte o la provisión necesitan cuenta de gasto y de pasivo.",
    );
  });

  test("sin clase exige al menos una cuenta", () => {
    expect(errorDe(mapeoContableSchema, { mapeos: [base] })).toBe("Indica al menos una cuenta para el concepto.");
  });

  test("exige al menos un mapeo", () => {
    expect(errorDe(mapeoContableSchema, { mapeos: [] })).toBe("Indica al menos un mapeo.");
  });
});

const parametrosBase = {
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
    { desde: "416220", hasta: "624329", tasa: "15", monto_fijo: "0" },
    { desde: "624329", hasta: "867123", tasa: "20", monto_fijo: "31216.35" },
    { desde: "867123", hasta: "", tasa: "25", monto_fijo: "79775.15" },
  ],
};

describe("parametrosNominaSchema", () => {
  test("acepta los parámetros 2026 completos", () => {
    expect(parametrosNominaSchema.safeParse(parametrosBase).success).toBe(true);
  });

  test("rechaza un año fuera de rango", () => {
    expect(errorDe(parametrosNominaSchema, { ...parametrosBase, anio: 1999 })).toBe(
      "El año debe estar entre 2000 y 2100.",
    );
  });

  test("la escala debe empezar en 0", () => {
    const escala = parametrosBase.escala_isr_anual.map((tramo, indice) =>
      indice === 0 ? { ...tramo, desde: "1" } : tramo,
    );
    expect(errorDe(parametrosNominaSchema, { ...parametrosBase, escala_isr_anual: escala })).toContain("empezar en 0");
  });

  test("cada tramo debe empezar donde termina el anterior", () => {
    const escala = parametrosBase.escala_isr_anual.map((tramo, indice) =>
      indice === 1 ? { ...tramo, desde: "416221" } : tramo,
    );
    expect(errorDe(parametrosNominaSchema, { ...parametrosBase, escala_isr_anual: escala })).toContain(
      "donde termina el anterior",
    );
  });

  test("solo el último tramo queda abierto", () => {
    const escala = parametrosBase.escala_isr_anual.map((tramo, indice) =>
      indice === 1 ? { ...tramo, hasta: "" } : tramo,
    );
    expect(errorDe(parametrosNominaSchema, { ...parametrosBase, escala_isr_anual: escala })).toContain(
      "Solo el último tramo",
    );
  });

  test("el último tramo no puede cerrar", () => {
    const escala = parametrosBase.escala_isr_anual.map((tramo, indice) =>
      indice === 3 ? { ...tramo, hasta: "1000000" } : tramo,
    );
    expect(errorDe(parametrosNominaSchema, { ...parametrosBase, escala_isr_anual: escala })).toContain(
      "debe quedar abierto",
    );
  });

  test("el monto fijo debe ser el impuesto acumulado", () => {
    const escala = parametrosBase.escala_isr_anual.map((tramo, indice) =>
      indice === 2 ? { ...tramo, monto_fijo: "1000" } : tramo,
    );
    expect(errorDe(parametrosNominaSchema, { ...parametrosBase, escala_isr_anual: escala })).toContain(
      "monto fijo del tramo no coincide",
    );
  });

  test("rechaza una tasa mayor a 100", () => {
    expect(errorDe(parametrosNominaSchema, { ...parametrosBase, tasa_infotep: "101" })).toBe(
      "Las tasas deben estar entre 0 y 100.",
    );
  });

  test("los días del mes laboral deben ser mayores que cero", () => {
    expect(errorDe(parametrosNominaSchema, { ...parametrosBase, dias_mes_laboral: "0" })).toBe(
      "Los días del mes laboral deben ser mayores que cero y máximo 31.",
    );
  });

  test("las horas del día no pasan de 24", () => {
    expect(errorDe(parametrosNominaSchema, { ...parametrosBase, horas_dia_laboral: "25" })).toBe(
      "Las horas del día laboral deben ser mayores que cero y máximo 24.",
    );
  });

  test("acepta una escala de dos tramos", () => {
    const dosTramos = parametrosBase.escala_isr_anual.slice(0, 1).concat({
      desde: "416220",
      hasta: "",
      tasa: "10",
      monto_fijo: "0",
    });
    expect(parametrosNominaSchema.safeParse({ ...parametrosBase, escala_isr_anual: dosTramos }).success).toBe(true);
  });
});

describe("filtros de lectura", () => {
  test("rechaza un mes de reporte fuera de 1–12", () => {
    expect(errorDe(reporteTssSchema, { anio: 2026, mes: 13 })).toBe("El mes debe estar entre 1 y 12.");
  });

  test("acepta el reporte de diciembre", () => {
    expect(reporteTssSchema.safeParse({ anio: 2026, mes: 12 }).success).toBe(true);
  });

  test("rechaza una búsqueda demasiado larga", () => {
    expect(errorDe(filtroEmpleadoSchema, { busqueda: "x".repeat(81) })).toBe("La búsqueda es demasiado larga.");
  });

  test("el año de la consulta debe estar entre 2000 y 2100", () => {
    expect(errorDe(anioSchema, 2101)).toBe("El año debe estar entre 2000 y 2100.");
  });
});
