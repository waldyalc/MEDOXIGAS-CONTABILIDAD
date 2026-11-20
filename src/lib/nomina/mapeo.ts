import { z } from "zod";

import type { Json } from "@/lib/supabase/types";

import type {
  ClaseConcepto,
  ConceptoNomina,
  ConfigNomina,
  Decimal,
  Empleado,
  EscalaIsrTramo,
  EstadoEmpleado,
  EstadoNomina,
  FilaTSS,
  FrecuenciaPago,
  LineaRecibo,
  MapeoContable,
  MetodoPago,
  NovedadRecurrente,
  OrigenLinea,
  ParametrosRD,
  PeriodoNomina,
  ReciboNomina,
  ResumenPeriodo,
  SegmentoContable,
  TipoContrato,
  TipoCuentaBanco,
  TipoIdentificacion,
} from "./tipos";

/**
 * Mapeo de filas de PostgREST/RPC a los tipos de dominio.
 *
 * Las columnas `numeric` llegan como `number`; aquí se convierten a texto
 * decimal (`Decimal`) una sola vez para que ninguna pantalla opere con floats.
 * Los enums se normalizan con valores por defecto documentados: las tablas ya
 * tienen CHECK, el defecto solo evita romper la lectura si la base cambia.
 */

export function decimal(valor: number | string): Decimal {
  return String(valor);
}

export function decimalNulo(valor: number | string | null | undefined): Decimal | null {
  return valor === null || valor === undefined ? null : String(valor);
}

export function nombreCompleto(persona: {
  primer_nombre: string;
  segundo_nombre?: string | null;
  primer_apellido: string;
  segundo_apellido?: string | null;
}): string {
  return [persona.primer_nombre, persona.segundo_nombre, persona.primer_apellido, persona.segundo_apellido]
    .map((parte) => parte?.trim() ?? "")
    .filter(Boolean)
    .join(" ");
}

export function nombreCuenta(cuenta: { codigo: string; nombre: string } | null | undefined): string | null {
  if (!cuenta) return null;
  return `${cuenta.codigo} — ${cuenta.nombre}`;
}

function comoFrecuencia(valor: string): FrecuenciaPago {
  return valor === "mensual" ? "mensual" : "quincenal";
}

function comoSegmento(valor: string): SegmentoContable {
  if (valor === "operativa") return "operativa";
  if (valor === "ventas") return "ventas";
  return "administrativa";
}

function comoEstadoNomina(valor: string): EstadoNomina {
  if (valor === "calculado") return "calculado";
  if (valor === "contabilizado") return "contabilizado";
  if (valor === "pagado") return "pagado";
  if (valor === "anulado") return "anulado";
  return "borrador";
}

function comoEstadoEmpleado(valor: string): EstadoEmpleado {
  if (valor === "suspendido") return "suspendido";
  if (valor === "inactivo") return "inactivo";
  return "activo";
}

function comoClase(valor: string): ClaseConcepto {
  if (valor === "deduccion") return "deduccion";
  if (valor === "aporte_empleador") return "aporte_empleador";
  if (valor === "provision") return "provision";
  return "ingreso";
}

function comoOrigen(valor: string): OrigenLinea {
  if (valor === "recurrente") return "recurrente";
  if (valor === "manual") return "manual";
  return "sistema";
}

function comoTipoIdentificacion(valor: string): TipoIdentificacion {
  if (valor === "pasaporte") return "pasaporte";
  if (valor === "residencia") return "residencia";
  return "cedula";
}

function comoMetodoPago(valor: string): MetodoPago {
  if (valor === "efectivo") return "efectivo";
  if (valor === "cheque") return "cheque";
  return "transferencia";
}

function comoTipoContrato(valor: string): TipoContrato {
  return valor === "definido" ? "definido" : "indefinido";
}

function comoTipoCuentaBanco(valor: string | null): TipoCuentaBanco | null {
  if (valor === "ahorros") return "ahorros";
  if (valor === "corriente") return "corriente";
  return null;
}

// ---------------------------------------------------------------------------
// Filas crudas
// ---------------------------------------------------------------------------

export interface FilaEmpleado {
  id: string;
  contacto_id: string;
  tipo_identificacion: string;
  identificacion: string;
  primer_nombre: string;
  segundo_nombre: string | null;
  primer_apellido: string;
  segundo_apellido: string | null;
  correo: string | null;
  telefono: string | null;
  municipio: string | null;
  direccion: string | null;
  cargo: string | null;
  area: string | null;
  segmento_contable: string;
  centro_costo_id: string | null;
  centro_costo: { nombre: string } | null;
  tipo_contrato: string;
  fecha_ingreso: string;
  fecha_fin: string | null;
  frecuencia_pago: string;
  salario_mensual: number;
  metodo_pago: string;
  banco_nombre: string | null;
  tipo_cuenta_banco: string | null;
  numero_cuenta_banco: string | null;
  clave_tss: string | null;
  estado: string;
  creado_en: string;
}

export function mapearEmpleado(fila: FilaEmpleado): Empleado {
  return {
    id: fila.id,
    contacto_id: fila.contacto_id,
    tipo_identificacion: comoTipoIdentificacion(fila.tipo_identificacion),
    identificacion: fila.identificacion,
    primer_nombre: fila.primer_nombre,
    segundo_nombre: fila.segundo_nombre,
    primer_apellido: fila.primer_apellido,
    segundo_apellido: fila.segundo_apellido,
    nombre_completo: nombreCompleto(fila),
    correo: fila.correo,
    telefono: fila.telefono,
    municipio: fila.municipio,
    direccion: fila.direccion,
    cargo: fila.cargo,
    area: fila.area,
    segmento_contable: comoSegmento(fila.segmento_contable),
    centro_costo_id: fila.centro_costo_id,
    centro_costo_nombre: fila.centro_costo?.nombre ?? null,
    tipo_contrato: comoTipoContrato(fila.tipo_contrato),
    fecha_ingreso: fila.fecha_ingreso,
    fecha_fin: fila.fecha_fin,
    frecuencia_pago: comoFrecuencia(fila.frecuencia_pago),
    salario_mensual: decimal(fila.salario_mensual),
    metodo_pago: comoMetodoPago(fila.metodo_pago),
    banco_nombre: fila.banco_nombre,
    tipo_cuenta_banco: comoTipoCuentaBanco(fila.tipo_cuenta_banco),
    numero_cuenta_banco: fila.numero_cuenta_banco,
    clave_tss: fila.clave_tss,
    estado: comoEstadoEmpleado(fila.estado),
    creado_en: fila.creado_en,
  };
}

export interface FilaNovedad {
  id: string;
  empleado_id: string;
  concepto_id: string;
  monto: number | null;
  porcentaje: number | null;
  fecha_inicio: string;
  fecha_fin: string | null;
  activa: boolean;
  notas: string | null;
  creado_en: string;
  nomina_conceptos: { codigo: string; nombre: string; clase: string } | null;
}

export function mapearNovedad(fila: FilaNovedad): NovedadRecurrente {
  return {
    id: fila.id,
    empleado_id: fila.empleado_id,
    concepto_id: fila.concepto_id,
    concepto_codigo: fila.nomina_conceptos?.codigo ?? "",
    concepto_nombre: fila.nomina_conceptos?.nombre ?? "",
    clase: comoClase(fila.nomina_conceptos?.clase ?? "ingreso"),
    monto: decimalNulo(fila.monto),
    porcentaje: decimalNulo(fila.porcentaje),
    fecha_inicio: fila.fecha_inicio,
    fecha_fin: fila.fecha_fin,
    activa: fila.activa,
    notas: fila.notas,
    creado_en: fila.creado_en,
  };
}

export interface FilaPeriodo {
  id: string;
  codigo: string;
  frecuencia: string;
  fecha_inicio: string;
  fecha_fin: string;
  fecha_pago: string | null;
  anio_fiscal: number;
  estado: string;
  total_salario: number;
  total_ingresos: number;
  total_deducciones: number;
  total_aportes_empleador: number;
  total_provisiones: number;
  total_neto: number;
  total_costo_empresa: number;
  observaciones: string | null;
  creado_en: string;
}

export function mapearPeriodo(fila: FilaPeriodo): PeriodoNomina {
  return {
    id: fila.id,
    codigo: fila.codigo,
    frecuencia: comoFrecuencia(fila.frecuencia),
    fecha_inicio: fila.fecha_inicio,
    fecha_fin: fila.fecha_fin,
    fecha_pago: fila.fecha_pago,
    anio_fiscal: fila.anio_fiscal,
    estado: comoEstadoNomina(fila.estado),
    total_salario: decimal(fila.total_salario),
    total_ingresos: decimal(fila.total_ingresos),
    total_deducciones: decimal(fila.total_deducciones),
    total_aportes_empleador: decimal(fila.total_aportes_empleador),
    total_provisiones: decimal(fila.total_provisiones),
    total_neto: decimal(fila.total_neto),
    total_costo_empresa: decimal(fila.total_costo_empresa),
    observaciones: fila.observaciones,
    creado_en: fila.creado_en,
  };
}

export interface FilaRecibo {
  id: string;
  periodo_id: string;
  empleado_id: string;
  dias_trabajados: number;
  salario_base: number;
  base_tss: number;
  base_sfs: number;
  base_afp: number;
  base_srl: number;
  base_infotep: number;
  base_isr: number;
  total_ingresos: number;
  total_deducciones: number;
  total_aportes_empleador: number;
  total_provisiones: number;
  neto_pagar: number;
  costo_total_empresa: number;
  estado: string;
  cuenta_salarios_por_pagar_id: string | null;
  asiento_id: string | null;
  pago_asiento_id: string | null;
  cuenta_pago_id: string | null;
  fecha_pagado: string | null;
  colilla_enviada_en: string | null;
  colilla_enviada_a: string | null;
  creado_en: string;
  periodo: { codigo: string } | null;
  empleado: {
    primer_nombre: string;
    segundo_nombre: string | null;
    primer_apellido: string;
    segundo_apellido: string | null;
  } | null;
}

export function mapearRecibo(fila: FilaRecibo): ReciboNomina {
  return {
    id: fila.id,
    periodo_id: fila.periodo_id,
    periodo_codigo: fila.periodo?.codigo ?? "",
    empleado_id: fila.empleado_id,
    empleado_nombre: fila.empleado ? nombreCompleto(fila.empleado) : "",
    dias_trabajados: decimal(fila.dias_trabajados),
    salario_base: decimal(fila.salario_base),
    base_tss: decimal(fila.base_tss),
    base_sfs: decimal(fila.base_sfs),
    base_afp: decimal(fila.base_afp),
    base_srl: decimal(fila.base_srl),
    base_infotep: decimal(fila.base_infotep),
    base_isr: decimal(fila.base_isr),
    total_ingresos: decimal(fila.total_ingresos),
    total_deducciones: decimal(fila.total_deducciones),
    total_aportes_empleador: decimal(fila.total_aportes_empleador),
    total_provisiones: decimal(fila.total_provisiones),
    neto_pagar: decimal(fila.neto_pagar),
    costo_total_empresa: decimal(fila.costo_total_empresa),
    estado: comoEstadoNomina(fila.estado),
    cuenta_salarios_por_pagar_id: fila.cuenta_salarios_por_pagar_id,
    asiento_id: fila.asiento_id,
    pago_asiento_id: fila.pago_asiento_id,
    cuenta_pago_id: fila.cuenta_pago_id,
    fecha_pagado: fila.fecha_pagado,
    colilla_enviada_en: fila.colilla_enviada_en,
    colilla_enviada_a: fila.colilla_enviada_a,
    creado_en: fila.creado_en,
  };
}

export interface FilaLinea {
  id: string;
  recibo_id: string;
  concepto_id: string;
  clase: string;
  cantidad: number | null;
  porcentaje: number | null;
  monto: number;
  origen: string;
  notas: string | null;
  orden: number;
  creado_en: string;
  nomina_conceptos: { codigo: string; nombre: string } | null;
}

export function mapearLinea(fila: FilaLinea): LineaRecibo {
  return {
    id: fila.id,
    recibo_id: fila.recibo_id,
    concepto_id: fila.concepto_id,
    concepto_codigo: fila.nomina_conceptos?.codigo ?? "",
    concepto_nombre: fila.nomina_conceptos?.nombre ?? "",
    clase: comoClase(fila.clase),
    cantidad: decimalNulo(fila.cantidad),
    porcentaje: decimalNulo(fila.porcentaje),
    monto: decimal(fila.monto),
    origen: comoOrigen(fila.origen),
    notas: fila.notas,
    orden: fila.orden,
    creado_en: fila.creado_en,
  };
}

export interface FilaConcepto {
  id: string;
  codigo: string;
  nombre: string;
  clase: string;
  grava_tss: boolean;
  grava_isr: boolean;
  grava_infotep: boolean;
  es_sistema: boolean;
  activo: boolean;
  orden: number;
  creado_en: string;
}

export function mapearConcepto(fila: FilaConcepto): ConceptoNomina {
  return {
    id: fila.id,
    codigo: fila.codigo,
    nombre: fila.nombre,
    clase: comoClase(fila.clase),
    grava_tss: fila.grava_tss,
    grava_isr: fila.grava_isr,
    grava_infotep: fila.grava_infotep,
    es_sistema: fila.es_sistema,
    activo: fila.activo,
    orden: fila.orden,
    creado_en: fila.creado_en,
  };
}

const tramoLeidoSchema = z.object({
  desde: z.union([z.number(), z.string()]),
  hasta: z.union([z.number(), z.string()]).nullable(),
  tasa: z.union([z.number(), z.string()]),
  monto_fijo: z.union([z.number(), z.string()]),
});

/**
 * Lee la escala de ISR guardada como jsonb. Si el JSON no tiene la forma
 * esperada devuelve `[]`: la pantalla muestra el error de parámetros y el
 * motor es quien decide si puede calcular.
 */
export function leerEscalaIsr(valor: Json): EscalaIsrTramo[] {
  const resultado = z.array(tramoLeidoSchema).safeParse(valor);
  if (!resultado.success) return [];

  return resultado.data.map((tramo) => ({
    desde: String(tramo.desde),
    hasta: tramo.hasta === null ? null : String(tramo.hasta),
    tasa: String(tramo.tasa),
    monto_fijo: String(tramo.monto_fijo),
  }));
}

export interface FilaParametros {
  anio: number;
  salario_minimo: number;
  tasa_sfs_empleado: number;
  tasa_sfs_empleador: number;
  tope_sfs_mensual: number;
  tasa_afp_empleado: number;
  tasa_afp_empleador: number;
  tope_afp_mensual: number;
  tope_srl_mensual: number;
  tasa_srl_tipo_1: number;
  tasa_srl_tipo_2: number;
  tasa_srl_tipo_3: number;
  tasa_srl_tipo_4: number;
  tasa_infotep: number;
  dias_mes_laboral: number;
  horas_dia_laboral: number;
  escala_isr_anual: Json;
  actualizado_en: string;
}

export function mapearParametros(fila: FilaParametros): ParametrosRD {
  return {
    anio: fila.anio,
    salario_minimo: decimal(fila.salario_minimo),
    tasa_sfs_empleado: decimal(fila.tasa_sfs_empleado),
    tasa_sfs_empleador: decimal(fila.tasa_sfs_empleador),
    tope_sfs_mensual: decimal(fila.tope_sfs_mensual),
    tasa_afp_empleado: decimal(fila.tasa_afp_empleado),
    tasa_afp_empleador: decimal(fila.tasa_afp_empleador),
    tope_afp_mensual: decimal(fila.tope_afp_mensual),
    tope_srl_mensual: decimal(fila.tope_srl_mensual),
    tasa_srl_tipo_1: decimal(fila.tasa_srl_tipo_1),
    tasa_srl_tipo_2: decimal(fila.tasa_srl_tipo_2),
    tasa_srl_tipo_3: decimal(fila.tasa_srl_tipo_3),
    tasa_srl_tipo_4: decimal(fila.tasa_srl_tipo_4),
    tasa_infotep: decimal(fila.tasa_infotep),
    dias_mes_laboral: decimal(fila.dias_mes_laboral),
    horas_dia_laboral: decimal(fila.horas_dia_laboral),
    escala_isr_anual: leerEscalaIsr(fila.escala_isr_anual),
    actualizado_en: fila.actualizado_en,
  };
}

export interface FilaConfig {
  id: number;
  riesgo_laboral: string;
  categoria_empresa: string;
  aplica_infotep: boolean;
  frecuencia_defecto: string;
  cuenta_pago_defecto_id: string | null;
  cuenta_salarios_por_pagar_id: string | null;
  registrar_provisiones: boolean;
  contacto_tss_id: string | null;
  contacto_infotep_id: string | null;
  contacto_dgii_id: string | null;
  actualizado_en: string;
  cuenta_pago: { codigo: string; nombre: string } | null;
  cuenta_salarios: { codigo: string; nombre: string } | null;
  contacto_tss: { nombre: string } | null;
  contacto_infotep: { nombre: string } | null;
  contacto_dgii: { nombre: string } | null;
}

export function mapearConfig(fila: FilaConfig): ConfigNomina {
  return {
    id: fila.id,
    riesgo_laboral:
      fila.riesgo_laboral === "tipo_2" || fila.riesgo_laboral === "tipo_3" || fila.riesgo_laboral === "tipo_4"
        ? fila.riesgo_laboral
        : "tipo_1",
    categoria_empresa:
      fila.categoria_empresa === "micro" || fila.categoria_empresa === "mediana" || fila.categoria_empresa === "grande"
        ? fila.categoria_empresa
        : "pequena",
    aplica_infotep: fila.aplica_infotep,
    frecuencia_defecto: comoFrecuencia(fila.frecuencia_defecto),
    cuenta_pago_defecto_id: fila.cuenta_pago_defecto_id,
    cuenta_pago_defecto_nombre: nombreCuenta(fila.cuenta_pago),
    cuenta_salarios_por_pagar_id: fila.cuenta_salarios_por_pagar_id,
    cuenta_salarios_por_pagar_nombre: nombreCuenta(fila.cuenta_salarios),
    registrar_provisiones: fila.registrar_provisiones,
    contacto_tss_id: fila.contacto_tss_id,
    contacto_tss_nombre: fila.contacto_tss?.nombre ?? null,
    contacto_infotep_id: fila.contacto_infotep_id,
    contacto_infotep_nombre: fila.contacto_infotep?.nombre ?? null,
    contacto_dgii_id: fila.contacto_dgii_id,
    contacto_dgii_nombre: fila.contacto_dgii?.nombre ?? null,
    actualizado_en: fila.actualizado_en,
  };
}

export interface FilaMapeo {
  id: string;
  segmento: string;
  concepto_id: string;
  cuenta_gasto_id: string | null;
  cuenta_pasivo_id: string | null;
  nomina_conceptos: { codigo: string; nombre: string; clase: string; orden: number } | null;
  cuenta_gasto: { codigo: string; nombre: string } | null;
  cuenta_pasivo: { codigo: string; nombre: string } | null;
}

export function mapearMapeo(fila: FilaMapeo): MapeoContable {
  return {
    id: fila.id,
    segmento: comoSegmento(fila.segmento),
    concepto_id: fila.concepto_id,
    concepto_codigo: fila.nomina_conceptos?.codigo ?? "",
    concepto_nombre: fila.nomina_conceptos?.nombre ?? "",
    clase: comoClase(fila.nomina_conceptos?.clase ?? "ingreso"),
    cuenta_gasto_id: fila.cuenta_gasto_id,
    cuenta_gasto_codigo: fila.cuenta_gasto?.codigo ?? null,
    cuenta_gasto_nombre: fila.cuenta_gasto?.nombre ?? null,
    cuenta_pasivo_id: fila.cuenta_pasivo_id,
    cuenta_pasivo_codigo: fila.cuenta_pasivo?.codigo ?? null,
    cuenta_pasivo_nombre: fila.cuenta_pasivo?.nombre ?? null,
  };
}

export interface FilaResumen {
  recibo_id: string;
  empleado_id: string;
  empleado_nombre: string;
  identificacion: string;
  cargo: string | null;
  segmento_contable: string;
  dias_trabajados: number;
  salario_base: number;
  total_ingresos: number;
  total_deducciones: number;
  total_aportes_empleador: number;
  total_provisiones: number;
  neto_pagar: number;
  costo_total_empresa: number;
  estado: string;
  asiento_codigo: string | null;
  fecha_pagado: string | null;
  colilla_enviada_en: string | null;
}

export function mapearResumen(fila: FilaResumen): ResumenPeriodo {
  return {
    recibo_id: fila.recibo_id,
    empleado_id: fila.empleado_id,
    empleado_nombre: fila.empleado_nombre,
    identificacion: fila.identificacion,
    cargo: fila.cargo,
    segmento_contable: comoSegmento(fila.segmento_contable),
    dias_trabajados: decimal(fila.dias_trabajados),
    salario_base: decimal(fila.salario_base),
    total_ingresos: decimal(fila.total_ingresos),
    total_deducciones: decimal(fila.total_deducciones),
    total_aportes_empleador: decimal(fila.total_aportes_empleador),
    total_provisiones: decimal(fila.total_provisiones),
    neto_pagar: decimal(fila.neto_pagar),
    costo_total_empresa: decimal(fila.costo_total_empresa),
    estado: comoEstadoNomina(fila.estado),
    asiento_codigo: fila.asiento_codigo,
    fecha_pagado: fila.fecha_pagado,
    colilla_enviada_en: fila.colilla_enviada_en,
  };
}

export interface FilaReporteTss {
  anio: number;
  mes: number;
  empleado_id: string;
  empleado_nombre: string;
  identificacion: string;
  clave_tss: string | null;
  periodos: number;
  dias_trabajados: number;
  salario_base: number;
  base_sfs: number;
  base_afp: number;
  base_srl: number;
  base_infotep: number;
  base_isr: number;
  sfs_empleado: number;
  afp_empleado: number;
  isr: number;
  sfs_empleador: number;
  afp_empleador: number;
  srl: number;
  infotep: number;
  total_deducciones: number;
  neto_pagar: number;
}

export function mapearFilaTss(fila: FilaReporteTss): FilaTSS {
  return {
    anio: fila.anio,
    mes: fila.mes,
    empleado_id: fila.empleado_id,
    empleado_nombre: fila.empleado_nombre,
    identificacion: fila.identificacion,
    clave_tss: fila.clave_tss,
    periodos: fila.periodos,
    dias_trabajados: decimal(fila.dias_trabajados),
    salario_base: decimal(fila.salario_base),
    base_sfs: decimal(fila.base_sfs),
    base_afp: decimal(fila.base_afp),
    base_srl: decimal(fila.base_srl),
    base_infotep: decimal(fila.base_infotep),
    base_isr: decimal(fila.base_isr),
    sfs_empleado: decimal(fila.sfs_empleado),
    afp_empleado: decimal(fila.afp_empleado),
    isr: decimal(fila.isr),
    sfs_empleador: decimal(fila.sfs_empleador),
    afp_empleador: decimal(fila.afp_empleador),
    srl: decimal(fila.srl),
    infotep: decimal(fila.infotep),
    total_deducciones: decimal(fila.total_deducciones),
    neto_pagar: decimal(fila.neto_pagar),
  };
}

// ---------------------------------------------------------------------------
// Respuestas jsonb de las RPC (totales como texto decimal)
// ---------------------------------------------------------------------------

const montoJsonSchema = z.union([z.number(), z.string()]);

export const respuestaCalculoPeriodoSchema = z.object({
  recibos: z.number().int(),
  total_neto: montoJsonSchema,
  total_costo_empresa: montoJsonSchema,
});

export type RespuestaCalculoPeriodo = z.infer<typeof respuestaCalculoPeriodoSchema>;

export function leerRespuestaCalculoPeriodo(valor: unknown): {
  recibos: number;
  totalNeto: Decimal;
  totalCostoEmpresa: Decimal;
} | null {
  const resultado = respuestaCalculoPeriodoSchema.safeParse(valor);
  if (!resultado.success) return null;

  return {
    recibos: resultado.data.recibos,
    totalNeto: String(resultado.data.total_neto),
    totalCostoEmpresa: String(resultado.data.total_costo_empresa),
  };
}

export const respuestaContabilizarPeriodoSchema = z.object({
  asientos: z.number().int(),
  total: montoJsonSchema,
});

export function leerRespuestaContabilizarPeriodo(valor: unknown): { asientos: number; total: Decimal } | null {
  const resultado = respuestaContabilizarPeriodoSchema.safeParse(valor);
  if (!resultado.success) return null;

  return { asientos: resultado.data.asientos, total: String(resultado.data.total) };
}

export const respuestaPagarPeriodoSchema = z.object({
  recibos: z.number().int(),
  asientos: z.number().int(),
  total_pagado: montoJsonSchema,
});

export function leerRespuestaPagarPeriodo(valor: unknown): {
  recibos: number;
  asientos: number;
  totalPagado: Decimal;
} | null {
  const resultado = respuestaPagarPeriodoSchema.safeParse(valor);
  if (!resultado.success) return null;

  return {
    recibos: resultado.data.recibos,
    asientos: resultado.data.asientos,
    totalPagado: String(resultado.data.total_pagado),
  };
}

export const respuestaNovedadReciboSchema = z.object({
  linea_id: z.uuid(),
  monto: montoJsonSchema,
});

export function leerRespuestaNovedadRecibo(valor: unknown): { lineaId: string; monto: Decimal } | null {
  const resultado = respuestaNovedadReciboSchema.safeParse(valor);
  if (!resultado.success) return null;

  return { lineaId: resultado.data.linea_id, monto: String(resultado.data.monto) };
}
