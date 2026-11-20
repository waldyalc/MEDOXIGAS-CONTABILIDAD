/**
 * Tipos de la capa TypeScript de Nómina RD (fase 3C).
 *
 * Regla del dinero: todo `numeric` de Postgres se expone como texto decimal
 * (`Decimal`), nunca como `number` flotante. El cálculo vive en las RPC de la
 * base; aquí solo se transporta y se muestra lo que devuelven.
 *
 * Contrato funcional: `docs/dominio-nomina.md` §2, §3 y §6.
 */

/** `numeric` de Postgres como texto decimal; nunca se guarda como float. */
export type Decimal = string;

export const FRECUENCIAS_PAGO = ["quincenal", "mensual"] as const;

export type FrecuenciaPago = (typeof FRECUENCIAS_PAGO)[number];

export const ESTADOS_NOMINA = ["borrador", "calculado", "contabilizado", "pagado", "anulado"] as const;

export type EstadoNomina = (typeof ESTADOS_NOMINA)[number];

export const ESTADOS_EMPLEADO = ["activo", "suspendido", "inactivo"] as const;

export type EstadoEmpleado = (typeof ESTADOS_EMPLEADO)[number];

export const SEGMENTOS_CONTABLES = ["administrativa", "operativa", "ventas"] as const;

export type SegmentoContable = (typeof SEGMENTOS_CONTABLES)[number];

export const CLASES_CONCEPTO = ["ingreso", "deduccion", "aporte_empleador", "provision"] as const;

export type ClaseConcepto = (typeof CLASES_CONCEPTO)[number];

export const TIPOS_IDENTIFICACION = ["cedula", "pasaporte", "residencia"] as const;

export type TipoIdentificacion = (typeof TIPOS_IDENTIFICACION)[number];

export const METODOS_PAGO = ["efectivo", "transferencia", "cheque"] as const;

export type MetodoPago = (typeof METODOS_PAGO)[number];

export const TIPOS_CONTRATO = ["indefinido", "definido"] as const;

export type TipoContrato = (typeof TIPOS_CONTRATO)[number];

export const TIPOS_CUENTA_BANCO = ["ahorros", "corriente"] as const;

export type TipoCuentaBanco = (typeof TIPOS_CUENTA_BANCO)[number];

export const RIESGOS_LABORALES = ["tipo_1", "tipo_2", "tipo_3", "tipo_4"] as const;

export type RiesgoLaboral = (typeof RIESGOS_LABORALES)[number];

export const CATEGORIAS_EMPRESA = ["micro", "pequena", "mediana", "grande"] as const;

export type CategoriaEmpresa = (typeof CATEGORIAS_EMPRESA)[number];

export const ORIGENES_LINEA = ["sistema", "recurrente", "manual"] as const;

export type OrigenLinea = (typeof ORIGENES_LINEA)[number];

/** Ficha del empleado con los datos del contacto ya normalizados. */
export interface Empleado {
  id: string;
  contacto_id: string;
  tipo_identificacion: TipoIdentificacion;
  identificacion: string;
  primer_nombre: string;
  segundo_nombre: string | null;
  primer_apellido: string;
  segundo_apellido: string | null;
  /** Nombre para pantallas y documentos: nombres + apellidos, sin dobles espacios. */
  nombre_completo: string;
  correo: string | null;
  telefono: string | null;
  municipio: string | null;
  direccion: string | null;
  cargo: string | null;
  area: string | null;
  segmento_contable: SegmentoContable;
  centro_costo_id: string | null;
  centro_costo_nombre: string | null;
  tipo_contrato: TipoContrato;
  fecha_ingreso: string;
  fecha_fin: string | null;
  frecuencia_pago: FrecuenciaPago;
  salario_mensual: Decimal;
  metodo_pago: MetodoPago;
  banco_nombre: string | null;
  tipo_cuenta_banco: TipoCuentaBanco | null;
  numero_cuenta_banco: string | null;
  clave_tss: string | null;
  estado: EstadoEmpleado;
  creado_en: string;
}

/** Ingreso o deducción fija que se aplica sola en cada periodo. */
export interface NovedadRecurrente {
  id: string;
  empleado_id: string;
  concepto_id: string;
  concepto_codigo: string;
  concepto_nombre: string;
  clase: ClaseConcepto;
  monto: Decimal | null;
  porcentaje: Decimal | null;
  fecha_inicio: string;
  fecha_fin: string | null;
  activa: boolean;
  notas: string | null;
  creado_en: string;
}

/** Cabecera de un periodo de nómina con sus totales ya calculados. */
export interface PeriodoNomina {
  id: string;
  codigo: string;
  frecuencia: FrecuenciaPago;
  fecha_inicio: string;
  fecha_fin: string;
  fecha_pago: string | null;
  anio_fiscal: number;
  estado: EstadoNomina;
  total_salario: Decimal;
  total_ingresos: Decimal;
  total_deducciones: Decimal;
  total_aportes_empleador: Decimal;
  total_provisiones: Decimal;
  total_neto: Decimal;
  total_costo_empresa: Decimal;
  observaciones: string | null;
  creado_en: string;
}

/** Un recibo por empleado y periodo. */
export interface ReciboNomina {
  id: string;
  periodo_id: string;
  periodo_codigo: string;
  empleado_id: string;
  empleado_nombre: string;
  dias_trabajados: Decimal;
  salario_base: Decimal;
  base_tss: Decimal;
  base_sfs: Decimal;
  base_afp: Decimal;
  base_srl: Decimal;
  base_infotep: Decimal;
  base_isr: Decimal;
  total_ingresos: Decimal;
  total_deducciones: Decimal;
  total_aportes_empleador: Decimal;
  total_provisiones: Decimal;
  neto_pagar: Decimal;
  costo_total_empresa: Decimal;
  estado: EstadoNomina;
  cuenta_salarios_por_pagar_id: string | null;
  asiento_id: string | null;
  pago_asiento_id: string | null;
  cuenta_pago_id: string | null;
  fecha_pagado: string | null;
  colilla_enviada_en: string | null;
  colilla_enviada_a: string | null;
  creado_en: string;
}

/** Línea del detalle de un recibo (sistema, recurrente o manual). */
export interface LineaRecibo {
  id: string;
  recibo_id: string;
  concepto_id: string;
  concepto_codigo: string;
  concepto_nombre: string;
  clase: ClaseConcepto;
  cantidad: Decimal | null;
  porcentaje: Decimal | null;
  monto: Decimal;
  origen: OrigenLinea;
  notas: string | null;
  orden: number;
  creado_en: string;
}

/** Recibo con su detalle completo. */
export interface ReciboConLineas extends ReciboNomina {
  lineas: LineaRecibo[];
}

/** Concepto del catálogo (ingreso, deducción, aporte patronal o provisión). */
export interface ConceptoNomina {
  id: string;
  codigo: string;
  nombre: string;
  clase: ClaseConcepto;
  grava_tss: boolean;
  grava_isr: boolean;
  grava_infotep: boolean;
  es_sistema: boolean;
  activo: boolean;
  orden: number;
  creado_en: string;
}

/** Tramo de la escala anual de ISR (DGII). */
export interface EscalaIsrTramo {
  desde: Decimal;
  hasta: Decimal | null;
  tasa: Decimal;
  monto_fijo: Decimal;
}

/** Parámetros legales de RD para un año fiscal. */
export interface ParametrosRD {
  anio: number;
  salario_minimo: Decimal;
  tasa_sfs_empleado: Decimal;
  tasa_sfs_empleador: Decimal;
  tope_sfs_mensual: Decimal;
  tasa_afp_empleado: Decimal;
  tasa_afp_empleador: Decimal;
  tope_afp_mensual: Decimal;
  tope_srl_mensual: Decimal;
  tasa_srl_tipo_1: Decimal;
  tasa_srl_tipo_2: Decimal;
  tasa_srl_tipo_3: Decimal;
  tasa_srl_tipo_4: Decimal;
  tasa_infotep: Decimal;
  dias_mes_laboral: Decimal;
  horas_dia_laboral: Decimal;
  escala_isr_anual: EscalaIsrTramo[];
  actualizado_en: string;
}

/** Configuración de la empresa para nómina (fila única, `id = 1`). */
export interface ConfigNomina {
  id: number;
  riesgo_laboral: RiesgoLaboral;
  categoria_empresa: CategoriaEmpresa;
  aplica_infotep: boolean;
  frecuencia_defecto: FrecuenciaPago;
  cuenta_pago_defecto_id: string | null;
  cuenta_pago_defecto_nombre: string | null;
  cuenta_salarios_por_pagar_id: string | null;
  cuenta_salarios_por_pagar_nombre: string | null;
  registrar_provisiones: boolean;
  contacto_tss_id: string | null;
  contacto_tss_nombre: string | null;
  contacto_infotep_id: string | null;
  contacto_infotep_nombre: string | null;
  contacto_dgii_id: string | null;
  contacto_dgii_nombre: string | null;
  actualizado_en: string;
}

/** Cuentas del asiento para un concepto y un segmento contable. */
export interface MapeoContable {
  id: string;
  segmento: SegmentoContable;
  concepto_id: string;
  concepto_codigo: string;
  concepto_nombre: string;
  clase: ClaseConcepto;
  cuenta_gasto_id: string | null;
  cuenta_gasto_codigo: string | null;
  cuenta_gasto_nombre: string | null;
  cuenta_pasivo_id: string | null;
  cuenta_pasivo_codigo: string | null;
  cuenta_pasivo_nombre: string | null;
}

/** Fila de `nomina_resumen_periodo`: una por recibo, incluidos los anulados. */
export interface ResumenPeriodo {
  recibo_id: string;
  empleado_id: string;
  empleado_nombre: string;
  identificacion: string;
  cargo: string | null;
  segmento_contable: SegmentoContable;
  dias_trabajados: Decimal;
  salario_base: Decimal;
  total_ingresos: Decimal;
  total_deducciones: Decimal;
  total_aportes_empleador: Decimal;
  total_provisiones: Decimal;
  neto_pagar: Decimal;
  costo_total_empresa: Decimal;
  estado: EstadoNomina;
  asiento_codigo: string | null;
  fecha_pagado: string | null;
  colilla_enviada_en: string | null;
}

/** Fila de `nomina_reporte_tss`: resumen mensual por empleado para SUIRPlus/IR-3. */
export interface FilaTSS {
  anio: number;
  mes: number;
  empleado_id: string;
  empleado_nombre: string;
  identificacion: string;
  clave_tss: string | null;
  periodos: number;
  dias_trabajados: Decimal;
  salario_base: Decimal;
  base_sfs: Decimal;
  base_afp: Decimal;
  base_srl: Decimal;
  base_infotep: Decimal;
  base_isr: Decimal;
  sfs_empleado: Decimal;
  afp_empleado: Decimal;
  isr: Decimal;
  sfs_empleador: Decimal;
  afp_empleador: Decimal;
  srl: Decimal;
  infotep: Decimal;
  total_deducciones: Decimal;
  neto_pagar: Decimal;
}
