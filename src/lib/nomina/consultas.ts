import { mensajeErrorRpc } from "@/lib/facturacion/errores";
import { paginarConsulta } from "@/lib/supabase/paginar";
import { createClient } from "@/lib/supabase/server";

import {
  anioSchema,
  filtroConceptoSchema,
  filtroEmpleadoSchema,
  filtroNovedadSchema,
  filtroPeriodoSchema,
  filtroReciboSchema,
  idSchema,
  reporteTssSchema,
  segmentoSchema,
} from "./esquemas";
import {
  type FilaConcepto,
  type FilaConfig,
  type FilaEmpleado,
  type FilaLinea,
  type FilaMapeo,
  type FilaNovedad,
  type FilaParametros,
  type FilaPeriodo,
  type FilaRecibo,
  type FilaReporteTss,
  type FilaResumen,
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
} from "./mapeo";
import type {
  ConceptoNomina,
  ConfigNomina,
  Empleado,
  FilaTSS,
  MapeoContable,
  NovedadRecurrente,
  ParametrosRD,
  PeriodoNomina,
  ReciboConLineas,
  ReciboNomina,
  ResumenPeriodo,
} from "./tipos";

/**
 * Lecturas de nómina. Todas pasan por `paginarConsulta` para no truncar en el
 * corte de ~1,000 filas de PostgREST y ordenan por una clave determinística
 * antes de pedir cada lote. La RLS filtra por perfil: un `lector` lee todo.
 */

const EMPLEADO_SELECT =
  "id, contacto_id, tipo_identificacion, identificacion, primer_nombre, segundo_nombre, primer_apellido, " +
  "segundo_apellido, correo, telefono, municipio, direccion, cargo, area, segmento_contable, centro_costo_id, " +
  "tipo_contrato, fecha_ingreso, fecha_fin, frecuencia_pago, salario_mensual, metodo_pago, banco_nombre, " +
  "tipo_cuenta_banco, numero_cuenta_banco, clave_tss, estado, creado_en, centro_costo:centros_costo(nombre)";

const RECIBO_SELECT =
  "id, periodo_id, empleado_id, dias_trabajados, salario_base, base_tss, base_sfs, base_afp, base_srl, base_infotep, " +
  "base_isr, total_ingresos, total_deducciones, total_aportes_empleador, total_provisiones, neto_pagar, " +
  "costo_total_empresa, estado, cuenta_salarios_por_pagar_id, asiento_id, pago_asiento_id, cuenta_pago_id, " +
  "fecha_pagado, colilla_enviada_en, colilla_enviada_a, creado_en, periodo:nomina_periodos(codigo), " +
  "empleado:empleados(primer_nombre, segundo_nombre, primer_apellido, segundo_apellido)";

const LINEA_SELECT =
  "id, recibo_id, concepto_id, clase, cantidad, porcentaje, monto, origen, notas, orden, creado_en, " +
  "nomina_conceptos(codigo, nombre)";

const CONFIG_SELECT =
  "id, riesgo_laboral, categoria_empresa, aplica_infotep, frecuencia_defecto, cuenta_pago_defecto_id, " +
  "cuenta_salarios_por_pagar_id, registrar_provisiones, contacto_tss_id, contacto_infotep_id, contacto_dgii_id, " +
  "actualizado_en, cuenta_pago:cuentas!nomina_config_empresa_cuenta_pago_defecto_id_fkey(codigo, nombre), " +
  "cuenta_salarios:cuentas!nomina_config_empresa_cuenta_salarios_por_pagar_id_fkey(codigo, nombre), " +
  "contacto_tss:contactos!nomina_config_empresa_contacto_tss_id_fkey(nombre), " +
  "contacto_infotep:contactos!nomina_config_empresa_contacto_infotep_id_fkey(nombre), " +
  "contacto_dgii:contactos!nomina_config_empresa_contacto_dgii_id_fkey(nombre)";

const MAPEO_SELECT =
  "id, segmento, concepto_id, cuenta_gasto_id, cuenta_pasivo_id, " +
  "nomina_conceptos(codigo, nombre, clase, orden), " +
  "cuenta_gasto:cuentas!nomina_mapeo_contable_cuenta_gasto_id_fkey(codigo, nombre), " +
  "cuenta_pasivo:cuentas!nomina_mapeo_contable_cuenta_pasivo_id_fkey(codigo, nombre)";

function esId(valor: string): boolean {
  return idSchema.safeParse(valor).success;
}

/** Limpia los caracteres que rompen la sintaxis de `.or()` de PostgREST. */
function patronBusqueda(valor: string): string {
  return valor
    .replace(/[%,()\\]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 80);
}

function ordenClase(clase: string): number {
  if (clase === "ingreso") return 0;
  if (clase === "deduccion") return 1;
  if (clase === "aporte_empleador") return 2;
  return 3;
}

/** Empleados con los filtros de la lista (estado, frecuencia, segmento, búsqueda). */
export async function getEmpleados(filtros: unknown = {}): Promise<Empleado[]> {
  const resultado = filtroEmpleadoSchema.safeParse(filtros ?? {});
  if (!resultado.success) return [];

  const datos = resultado.data;
  const supabase = await createClient();

  let consulta = supabase.from("empleados").select(EMPLEADO_SELECT);

  if (datos.estado) consulta = consulta.eq("estado", datos.estado);
  if (datos.frecuencia) consulta = consulta.eq("frecuencia_pago", datos.frecuencia);
  if (datos.segmento) consulta = consulta.eq("segmento_contable", datos.segmento);

  const termino = datos.busqueda ? patronBusqueda(datos.busqueda) : "";
  if (termino) {
    consulta = consulta.or(
      [
        `primer_nombre.ilike.%${termino}%`,
        `segundo_nombre.ilike.%${termino}%`,
        `primer_apellido.ilike.%${termino}%`,
        `segundo_apellido.ilike.%${termino}%`,
        `identificacion.ilike.%${termino}%`,
      ].join(","),
    );
  }

  const { data, error } = await paginarConsulta((inicio, fin) =>
    consulta.order("primer_apellido").order("primer_nombre").order("id").range(inicio, fin).returns<FilaEmpleado[]>(),
  );

  if (error) throw new Error(mensajeErrorRpc(error));

  return (data ?? []).map((fila) => mapearEmpleado(fila));
}

/** Ficha de un empleado, o `null` si el id no existe. */
export async function getEmpleado(id: string): Promise<Empleado | null> {
  if (!esId(id)) return null;

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("empleados")
    .select(EMPLEADO_SELECT)
    .eq("id", id)
    .maybeSingle<FilaEmpleado>();

  if (error) throw new Error(mensajeErrorRpc(error));
  return data ? mapearEmpleado(data) : null;
}

/** Periodos de nómina, del más reciente al más antiguo. */
export async function getPeriodos(filtros: unknown = {}): Promise<PeriodoNomina[]> {
  const resultado = filtroPeriodoSchema.safeParse(filtros ?? {});
  if (!resultado.success) return [];

  const datos = resultado.data;
  const supabase = await createClient();

  let consulta = supabase
    .from("nomina_periodos")
    .select(
      "id, codigo, frecuencia, fecha_inicio, fecha_fin, fecha_pago, anio_fiscal, estado, total_salario, " +
        "total_ingresos, total_deducciones, total_aportes_empleador, total_provisiones, total_neto, " +
        "total_costo_empresa, observaciones, creado_en",
    );

  if (datos.anio !== undefined) consulta = consulta.eq("anio_fiscal", datos.anio);
  if (datos.frecuencia) consulta = consulta.eq("frecuencia", datos.frecuencia);
  if (datos.estado) consulta = consulta.eq("estado", datos.estado);

  const { data, error } = await paginarConsulta((inicio, fin) =>
    consulta
      .order("fecha_inicio", { ascending: false })
      .order("frecuencia")
      .order("id")
      .range(inicio, fin)
      .returns<FilaPeriodo[]>(),
  );

  if (error) throw new Error(mensajeErrorRpc(error));

  return (data ?? []).map((fila) => mapearPeriodo(fila));
}

/** Cabecera de un periodo, o `null` si el id no existe. */
export async function getPeriodo(id: string): Promise<PeriodoNomina | null> {
  if (!esId(id)) return null;

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("nomina_periodos")
    .select(
      "id, codigo, frecuencia, fecha_inicio, fecha_fin, fecha_pago, anio_fiscal, estado, total_salario, " +
        "total_ingresos, total_deducciones, total_aportes_empleador, total_provisiones, total_neto, " +
        "total_costo_empresa, observaciones, creado_en",
    )
    .eq("id", id)
    .maybeSingle<FilaPeriodo>();

  if (error) throw new Error(mensajeErrorRpc(error));
  return data ? mapearPeriodo(data) : null;
}

/** Recibos por periodo y/o empleado, ordenados por nombre del empleado. */
export async function getRecibos(filtros: unknown = {}): Promise<ReciboNomina[]> {
  const resultado = filtroReciboSchema.safeParse(filtros ?? {});
  if (!resultado.success) return [];

  const datos = resultado.data;
  const supabase = await createClient();

  let consulta = supabase.from("nomina_recibos").select(RECIBO_SELECT);

  if (datos.periodo_id) consulta = consulta.eq("periodo_id", datos.periodo_id);
  if (datos.empleado_id) consulta = consulta.eq("empleado_id", datos.empleado_id);
  if (datos.estado) consulta = consulta.eq("estado", datos.estado);

  const { data, error } = await paginarConsulta((inicio, fin) =>
    consulta.order("creado_en").order("id").range(inicio, fin).returns<FilaRecibo[]>(),
  );

  if (error) throw new Error(mensajeErrorRpc(error));

  return (data ?? [])
    .map((fila) => mapearRecibo(fila))
    .sort((a, b) => a.empleado_nombre.localeCompare(b.empleado_nombre, "es"));
}

/** Recibo con sus líneas de detalle, o `null` si el id no existe. */
export async function getRecibo(id: string): Promise<ReciboConLineas | null> {
  if (!esId(id)) return null;

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("nomina_recibos")
    .select(RECIBO_SELECT)
    .eq("id", id)
    .maybeSingle<FilaRecibo>();

  if (error) throw new Error(mensajeErrorRpc(error));
  if (!data) return null;

  const { data: filas, error: errorLineas } = await paginarConsulta((inicio, fin) =>
    supabase
      .from("nomina_recibo_lineas")
      .select(LINEA_SELECT)
      .eq("recibo_id", id)
      .order("orden")
      .order("concepto_id")
      .order("id")
      .range(inicio, fin)
      .returns<FilaLinea[]>(),
  );

  if (errorLineas) throw new Error(mensajeErrorRpc(errorLineas));

  const lineas = (filas ?? [])
    .map((fila) => mapearLinea(fila))
    .sort((a, b) => a.orden - b.orden || a.concepto_nombre.localeCompare(b.concepto_nombre, "es"));

  return { ...mapearRecibo(data), lineas };
}

/** Novedades recurrentes del empleado (activas e históricas). */
export async function getNovedadesRecurrentes(empleadoId: string, filtros: unknown = {}): Promise<NovedadRecurrente[]> {
  if (!esId(empleadoId)) return [];

  const resultado = filtroNovedadSchema.safeParse(filtros ?? {});
  if (!resultado.success) return [];

  const supabase = await createClient();

  let consulta = supabase
    .from("empleado_novedades_recurrentes")
    .select(
      "id, empleado_id, concepto_id, monto, porcentaje, fecha_inicio, fecha_fin, activa, notas, creado_en, " +
        "nomina_conceptos(codigo, nombre, clase)",
    )
    .eq("empleado_id", empleadoId);

  if (resultado.data.solo_activas) consulta = consulta.eq("activa", true);

  const { data, error } = await paginarConsulta((inicio, fin) =>
    consulta.order("fecha_inicio").order("id").range(inicio, fin).returns<FilaNovedad[]>(),
  );

  if (error) throw new Error(mensajeErrorRpc(error));

  return (data ?? []).map((fila) => mapearNovedad(fila));
}

/** Catálogo de conceptos. Los del sistema siguen apareciendo aunque estén inactivos. */
export async function getConceptos(filtros: unknown = {}): Promise<ConceptoNomina[]> {
  const resultado = filtroConceptoSchema.safeParse(filtros ?? {});
  if (!resultado.success) return [];

  const datos = resultado.data;
  const supabase = await createClient();

  let consulta = supabase
    .from("nomina_conceptos")
    .select("id, codigo, nombre, clase, grava_tss, grava_isr, grava_infotep, es_sistema, activo, orden, creado_en");

  if (datos.clase) consulta = consulta.eq("clase", datos.clase);
  if (datos.activo !== undefined) consulta = consulta.eq("activo", datos.activo);

  const termino = datos.busqueda ? patronBusqueda(datos.busqueda) : "";
  if (termino) consulta = consulta.or(`codigo.ilike.%${termino}%,nombre.ilike.%${termino}%`);

  const { data, error } = await paginarConsulta((inicio, fin) =>
    consulta.order("clase").order("orden").order("codigo").order("id").range(inicio, fin).returns<FilaConcepto[]>(),
  );

  if (error) throw new Error(mensajeErrorRpc(error));

  return (data ?? []).map((fila) => mapearConcepto(fila));
}

/** Parámetros legales de un año, o `null` si el año no está sembrado. */
export async function getParametrosNomina(anio: number): Promise<ParametrosRD | null> {
  const validado = anioSchema.safeParse(anio);
  if (!validado.success) return null;

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("nomina_parametros_rd")
    .select(
      "anio, salario_minimo, tasa_sfs_empleado, tasa_sfs_empleador, tope_sfs_mensual, tasa_afp_empleado, " +
        "tasa_afp_empleador, tope_afp_mensual, tope_srl_mensual, tasa_srl_tipo_1, tasa_srl_tipo_2, " +
        "tasa_srl_tipo_3, tasa_srl_tipo_4, tasa_infotep, dias_mes_laboral, horas_dia_laboral, escala_isr_anual, " +
        "actualizado_en",
    )
    .eq("anio", validado.data)
    .maybeSingle<FilaParametros>();

  if (error) throw new Error(mensajeErrorRpc(error));
  return data ? mapearParametros(data) : null;
}

/** Configuración de la empresa para nómina (fila 1), o `null` si no existe. */
export async function getConfigNomina(): Promise<ConfigNomina | null> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("nomina_config_empresa")
    .select(CONFIG_SELECT)
    .eq("id", 1)
    .maybeSingle<FilaConfig>();

  if (error) throw new Error(mensajeErrorRpc(error));
  return data ? mapearConfig(data) : null;
}

/**
 * Mapeo contable de los 40 conceptos, opcionalmente de un solo segmento.
 * Se ordena en memoria por clase y orden del concepto para agrupar la pantalla.
 */
export async function getMapeoContable(segmento?: string | null): Promise<MapeoContable[]> {
  let segmentoValido: string | undefined;

  if (segmento !== undefined && segmento !== null && segmento !== "") {
    const validado = segmentoSchema.safeParse(segmento);
    if (!validado.success) return [];
    segmentoValido = validado.data;
  }

  const supabase = await createClient();
  let consulta = supabase.from("nomina_mapeo_contable").select(MAPEO_SELECT);

  if (segmentoValido) consulta = consulta.eq("segmento", segmentoValido);

  const { data, error } = await paginarConsulta((inicio, fin) =>
    consulta.order("segmento").order("concepto_id").order("id").range(inicio, fin).returns<FilaMapeo[]>(),
  );

  if (error) throw new Error(mensajeErrorRpc(error));

  return (data ?? [])
    .map((fila) => mapearMapeo(fila))
    .sort(
      (a, b) =>
        a.segmento.localeCompare(b.segmento, "es") ||
        ordenClase(a.clase) - ordenClase(b.clase) ||
        a.concepto_codigo.localeCompare(b.concepto_codigo, "es"),
    );
}

/** Filas por recibo de un periodo (incluye anulados), en orden de nombre. */
export async function getResumenPeriodo(periodoId: string): Promise<ResumenPeriodo[]> {
  if (!esId(periodoId)) return [];

  const supabase = await createClient();
  const { data, error } = await paginarConsulta((inicio, fin) =>
    supabase
      .rpc("nomina_resumen_periodo", { p_periodo_id: periodoId })
      .order("empleado_nombre")
      .order("recibo_id")
      .range(inicio, fin)
      .returns<FilaResumen[]>(),
  );

  if (error) throw new Error(mensajeErrorRpc(error));

  return (data ?? []).map((fila) => mapearResumen(fila));
}

/** Reporte mensual SUIRPlus/IR-3 agrupado por empleado. */
export async function getReporteTSS(entrada: unknown): Promise<FilaTSS[]> {
  const resultado = reporteTssSchema.safeParse(entrada);
  if (!resultado.success) return [];

  const datos = resultado.data;
  const supabase = await createClient();
  const { data, error } = await paginarConsulta((inicio, fin) =>
    supabase
      .rpc("nomina_reporte_tss", { p_anio: datos.anio, p_mes: datos.mes })
      .order("empleado_nombre")
      .order("empleado_id")
      .range(inicio, fin)
      .returns<FilaReporteTss[]>(),
  );

  if (error) throw new Error(mensajeErrorRpc(error));

  return (data ?? []).map((fila) => mapearFilaTss(fila));
}
