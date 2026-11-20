import { describe, expect, test } from "vitest";

import {
  decimal,
  decimalNulo,
  leerEscalaIsr,
  leerRespuestaCalculoPeriodo,
  leerRespuestaContabilizarPeriodo,
  leerRespuestaNovedadRecibo,
  leerRespuestaPagarPeriodo,
  mapearConcepto,
  mapearConfig,
  mapearEmpleado,
  mapearFilaTss,
  mapearLinea,
  mapearMapeo,
  mapearNovedad,
  mapearParametros,
  mapearPeriodo,
  mapearRecibo,
  mapearResumen,
  nombreCompleto,
  nombreCuenta,
} from "./mapeo";

const UUID = "11111111-1111-4111-8111-111111111111";

describe("helpers decimales y nombres", () => {
  test("convierte un número a texto sin perder el valor", () => {
    expect(decimal(30000)).toBe("30000");
    expect(decimal(30000.5)).toBe("30000.5");
    expect(decimal("3.040")).toBe("3.040");
  });

  test("respeta el nulo en los decimales opcionales", () => {
    expect(decimalNulo(null)).toBeNull();
    expect(decimalNulo(undefined)).toBeNull();
    expect(decimalNulo(0)).toBe("0");
  });

  test("arma el nombre completo sin dobles espacios", () => {
    expect(
      nombreCompleto({
        primer_nombre: "María",
        segundo_nombre: " José ",
        primer_apellido: "Fernández",
        segundo_apellido: null,
      }),
    ).toBe("María José Fernández");
  });

  test("un nombre con partes vacías no deja huecos", () => {
    expect(nombreCompleto({ primer_nombre: "Ana", primer_apellido: "Pérez" })).toBe("Ana Pérez");
  });

  test("la cuenta se muestra como código — nombre", () => {
    expect(nombreCuenta({ codigo: "2107", nombre: "Salarios por pagar" })).toBe("2107 — Salarios por pagar");
    expect(nombreCuenta(null)).toBeNull();
  });
});

describe("mapearEmpleado", () => {
  test("normaliza enums y montos y toma el nombre del contacto", () => {
    const empleado = mapearEmpleado({
      id: UUID,
      contacto_id: UUID,
      tipo_identificacion: "cedula",
      identificacion: "00112345678",
      primer_nombre: "María",
      segundo_nombre: null,
      primer_apellido: "Fernández",
      segundo_apellido: "López",
      correo: null,
      telefono: null,
      municipio: null,
      direccion: null,
      cargo: "Contadora",
      area: null,
      segmento_contable: "ventas",
      centro_costo_id: UUID,
      centro_costo: { nombre: "Santo Domingo" },
      tipo_contrato: "definido",
      fecha_ingreso: "2024-03-01",
      fecha_fin: "2027-03-01",
      frecuencia_pago: "mensual",
      salario_mensual: 60000.5,
      metodo_pago: "transferencia",
      banco_nombre: "Banco Popular",
      tipo_cuenta_banco: "corriente",
      numero_cuenta_banco: "123",
      clave_tss: "001",
      estado: "activo",
      creado_en: "2026-11-20T00:00:00Z",
    });

    expect(empleado.nombre_completo).toBe("María Fernández López");
    expect(empleado.salario_mensual).toBe("60000.5");
    expect(empleado.segmento_contable).toBe("ventas");
    expect(empleado.frecuencia_pago).toBe("mensual");
    expect(empleado.centro_costo_nombre).toBe("Santo Domingo");
    expect(empleado.tipo_cuenta_banco).toBe("corriente");
  });

  test("un dato fuera de la lista cae al valor por defecto documentado", () => {
    const empleado = mapearEmpleado({
      id: UUID,
      contacto_id: UUID,
      tipo_identificacion: "otro",
      identificacion: "X",
      primer_nombre: "Ana",
      segundo_nombre: null,
      primer_apellido: "Pérez",
      segundo_apellido: null,
      correo: null,
      telefono: null,
      municipio: null,
      direccion: null,
      cargo: null,
      area: null,
      segmento_contable: "otro",
      centro_costo_id: null,
      centro_costo: null,
      tipo_contrato: "otro",
      fecha_ingreso: "2026-01-01",
      fecha_fin: null,
      frecuencia_pago: "semanal",
      salario_mensual: 100,
      metodo_pago: "otro",
      banco_nombre: null,
      tipo_cuenta_banco: null,
      numero_cuenta_banco: null,
      clave_tss: null,
      estado: "otro",
      creado_en: "2026-11-20T00:00:00Z",
    });

    expect(empleado.tipo_identificacion).toBe("cedula");
    expect(empleado.segmento_contable).toBe("administrativa");
    expect(empleado.frecuencia_pago).toBe("quincenal");
    expect(empleado.metodo_pago).toBe("transferencia");
    expect(empleado.estado).toBe("activo");
  });
});

describe("mapearNovedad, periodo y recibo", () => {
  test("la novedad trae el concepto del join", () => {
    const novedad = mapearNovedad({
      id: UUID,
      empleado_id: UUID,
      concepto_id: UUID,
      monto: 1500,
      porcentaje: null,
      fecha_inicio: "2026-11-01",
      fecha_fin: null,
      activa: true,
      notas: "Préstamo",
      creado_en: "2026-11-20T00:00:00Z",
      nomina_conceptos: { codigo: "PRESTAMO", nombre: "Préstamos", clase: "deduccion" },
    });

    expect(novedad.concepto_codigo).toBe("PRESTAMO");
    expect(novedad.clase).toBe("deduccion");
    expect(novedad.monto).toBe("1500");
    expect(novedad.porcentaje).toBeNull();
  });

  test("la novedad sin join queda con campos vacíos", () => {
    const novedad = mapearNovedad({
      id: UUID,
      empleado_id: UUID,
      concepto_id: UUID,
      monto: null,
      porcentaje: 5,
      fecha_inicio: "2026-11-01",
      fecha_fin: null,
      activa: true,
      notas: null,
      creado_en: "2026-11-20T00:00:00Z",
      nomina_conceptos: null,
    });

    expect(novedad.concepto_codigo).toBe("");
    expect(novedad.clase).toBe("ingreso");
  });

  test("el periodo conserva sus totales como texto", () => {
    const periodo = mapearPeriodo({
      id: UUID,
      codigo: "2026-11-Q2",
      frecuencia: "quincenal",
      fecha_inicio: "2026-11-16",
      fecha_fin: "2026-11-30",
      fecha_pago: null,
      anio_fiscal: 2026,
      estado: "calculado",
      total_salario: 30000,
      total_ingresos: 30000,
      total_deducciones: 1773,
      total_aportes_empleador: 4887,
      total_provisiones: 0,
      total_neto: 28227,
      total_costo_empresa: 34887,
      observaciones: null,
      creado_en: "2026-11-20T00:00:00Z",
    });

    expect(periodo.codigo).toBe("2026-11-Q2");
    expect(periodo.estado).toBe("calculado");
    expect(periodo.total_neto).toBe("28227");
    expect(periodo.total_costo_empresa).toBe("34887");
  });

  test("el recibo toma el nombre del empleado y el código del periodo", () => {
    const recibo = mapearRecibo({
      id: UUID,
      periodo_id: UUID,
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
      estado: "pagado",
      cuenta_salarios_por_pagar_id: UUID,
      asiento_id: UUID,
      pago_asiento_id: UUID,
      cuenta_pago_id: UUID,
      fecha_pagado: "2026-11-30",
      colilla_enviada_en: null,
      colilla_enviada_a: null,
      creado_en: "2026-11-20T00:00:00Z",
      periodo: { codigo: "2026-11-Q2" },
      empleado: { primer_nombre: "María", segundo_nombre: null, primer_apellido: "Fernández", segundo_apellido: null },
    });

    expect(recibo.empleado_nombre).toBe("María Fernández");
    expect(recibo.periodo_codigo).toBe("2026-11-Q2");
    expect(recibo.dias_trabajados).toBe("11.915");
    expect(recibo.estado).toBe("pagado");
  });

  test("la línea de recibo conserva cantidad y porcentaje", () => {
    const linea = mapearLinea({
      id: UUID,
      recibo_id: UUID,
      concepto_id: UUID,
      clase: "ingreso",
      cantidad: 5,
      porcentaje: 135,
      monto: 2124.42,
      origen: "manual",
      notas: null,
      orden: 50,
      creado_en: "2026-11-20T00:00:00Z",
      nomina_conceptos: { codigo: "HORAS_EXTRA_35", nombre: "Horas Extra 35%" },
    });

    expect(linea.cantidad).toBe("5");
    expect(linea.porcentaje).toBe("135");
    expect(linea.monto).toBe("2124.42");
    expect(linea.origen).toBe("manual");
  });
});

describe("catálogo, parámetros y configuración", () => {
  test("el concepto respeta los flags", () => {
    const concepto = mapearConcepto({
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
    });

    expect(concepto.clase).toBe("ingreso");
    expect(concepto.grava_tss).toBe(true);
    expect(concepto.es_sistema).toBe(true);
  });

  test("la escala de ISR se lee como texto decimal", () => {
    const escala = leerEscalaIsr([
      { desde: 0, hasta: 416220, tasa: 0, monto_fijo: 0 },
      { desde: 416220, hasta: null, tasa: 25, monto_fijo: 31216.35 },
    ]);

    expect(escala).toHaveLength(2);
    expect(escala[0]?.desde).toBe("0");
    expect(escala[1]?.hasta).toBeNull();
    expect(escala[1]?.monto_fijo).toBe("31216.35");
  });

  test("una escala con forma inválida queda vacía", () => {
    expect(leerEscalaIsr("no-es-una-escala")).toEqual([]);
    expect(leerEscalaIsr({ desde: 0 })).toEqual([]);
  });

  test("los parámetros traen topes y escala", () => {
    const parametros = mapearParametros({
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
    });

    expect(parametros.salario_minimo).toBe("23223");
    expect(parametros.tope_sfs_mensual).toBe("232230");
    expect(parametros.escala_isr_anual).toHaveLength(1);
  });

  test("la configuración trae los nombres de cuentas y contactos", () => {
    const config = mapearConfig({
      id: 1,
      riesgo_laboral: "tipo_2",
      categoria_empresa: "mediana",
      aplica_infotep: true,
      frecuencia_defecto: "mensual",
      cuenta_pago_defecto_id: UUID,
      cuenta_salarios_por_pagar_id: UUID,
      registrar_provisiones: false,
      contacto_tss_id: UUID,
      contacto_infotep_id: null,
      contacto_dgii_id: null,
      actualizado_en: "2026-11-20T00:00:00Z",
      cuenta_pago: { codigo: "1102", nombre: "Banco principal" },
      cuenta_salarios: { codigo: "2107", nombre: "Salarios por pagar" },
      contacto_tss: { nombre: "TSS" },
      contacto_infotep: null,
      contacto_dgii: null,
    });

    expect(config.riesgo_laboral).toBe("tipo_2");
    expect(config.categoria_empresa).toBe("mediana");
    expect(config.cuenta_pago_defecto_nombre).toBe("1102 — Banco principal");
    expect(config.contacto_tss_nombre).toBe("TSS");
    expect(config.contacto_infotep_nombre).toBeNull();
  });

  test("el mapeo conserva las cuentas y la clase del concepto", () => {
    const mapeo = mapearMapeo({
      id: UUID,
      segmento: "operativa",
      concepto_id: UUID,
      cuenta_gasto_id: UUID,
      cuenta_pasivo_id: null,
      nomina_conceptos: { codigo: "SALARIO", nombre: "Salario", clase: "ingreso", orden: 10 },
      cuenta_gasto: { codigo: "6110", nombre: "Sueldos y salarios" },
      cuenta_pasivo: null,
    });

    expect(mapeo.segmento).toBe("operativa");
    expect(mapeo.clase).toBe("ingreso");
    expect(mapeo.cuenta_gasto_codigo).toBe("6110");
    expect(mapeo.cuenta_pasivo_codigo).toBeNull();
  });
});

describe("resumen del periodo y reporte TSS", () => {
  test("el resumen conserva montos y estado", () => {
    const resumen = mapearResumen({
      recibo_id: UUID,
      empleado_id: UUID,
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
    });

    expect(resumen.dias_trabajados).toBe("23.83");
    expect(resumen.neto_pagar).toBe("28227");
    expect(resumen.estado).toBe("calculado");
  });

  test("la fila TSS trae bases y aportes como texto", () => {
    const fila = mapearFilaTss({
      anio: 2026,
      mes: 11,
      empleado_id: UUID,
      empleado_nombre: "María Fernández",
      identificacion: "00112345678",
      clave_tss: "001",
      periodos: 2,
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
    });

    expect(fila.periodos).toBe(2);
    expect(fila.base_sfs).toBe("30000");
    expect(fila.isr).toBe("0");
    expect(fila.clave_tss).toBe("001");
  });
});

describe("respuestas jsonb de las RPC", () => {
  test("calcula el periodo devuelve los totales como texto", () => {
    expect(leerRespuestaCalculoPeriodo({ recibos: 2, total_neto: 28227, total_costo_empresa: 34887 })).toEqual({
      recibos: 2,
      totalNeto: "28227",
      totalCostoEmpresa: "34887",
    });
  });

  test("una respuesta de cálculo incompleta no se acepta", () => {
    expect(leerRespuestaCalculoPeriodo({ recibos: 2 })).toBeNull();
    expect(leerRespuestaCalculoPeriodo(null)).toBeNull();
  });

  test("contabilizar el periodo devuelve asientos y total", () => {
    expect(leerRespuestaContabilizarPeriodo({ asientos: 2, total: 69774 })).toEqual({ asientos: 2, total: "69774" });
  });

  test("pagar el periodo devuelve recibos, asientos y total", () => {
    expect(leerRespuestaPagarPeriodo({ recibos: 2, asientos: 2, total_pagado: 56454 })).toEqual({
      recibos: 2,
      asientos: 2,
      totalPagado: "56454",
    });
  });

  test("la novedad del recibo devuelve la línea y el monto calculado", () => {
    expect(leerRespuestaNovedadRecibo({ linea_id: UUID, monto: 2124.42 })).toEqual({
      lineaId: UUID,
      monto: "2124.42",
    });
  });

  test("una novedad con id inválido no se acepta", () => {
    expect(leerRespuestaNovedadRecibo({ linea_id: "x", monto: 1 })).toBeNull();
  });
});
