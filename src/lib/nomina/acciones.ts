"use server";

import { revalidatePath } from "next/cache";

import { getRol } from "@/lib/auth/rol";
import { mensajeErrorRpc } from "@/lib/facturacion/errores";
import { createClient } from "@/lib/supabase/server";
import type { Json } from "@/lib/supabase/types";

import {
  cambioEstadoEmpleadoSchema,
  configNominaSchema,
  type EmpleadoEntrada,
  empleadoSchema,
  envioColillasSchema,
  idSchema,
  mapeoContableSchema,
  mensajeValidacion,
  novedadReciboSchema,
  novedadRecurrenteSchema,
  pagoPeriodoSchema,
  pagoReciboSchema,
  parametrosNominaSchema,
  periodoSchema,
} from "./esquemas";
import {
  leerRespuestaCalculoPeriodo,
  leerRespuestaContabilizarPeriodo,
  leerRespuestaNovedadRecibo,
  leerRespuestaPagarPeriodo,
} from "./mapeo";
import { clienteNominaPendiente } from "./rpc";
import type { Decimal } from "./tipos";

/**
 * Acciones de servidor de Nómina RD (fase 3C).
 *
 * Reglas: el rol se valida aquí (admin/contador), el payload se valida con Zod
 * y la RPC se llama directo (`supabase.rpc("nombre", args)`), nunca extraída.
 * La base sigue siendo la autoridad: sus mensajes en español se devuelven tal
 * cual a la pantalla.
 */

export type ResultadoNomina = { ok: true; id: string } | { ok: false; error: string };

export type ResultadoNominaSimple = { ok: true } | { ok: false; error: string };

export type ResultadoNovedad = { ok: true; id: string; monto: Decimal } | { ok: false; error: string };

export type ResultadoPagoRecibo = { ok: true; id: string; asientoId: string | null } | { ok: false; error: string };

export type ResultadoEnvioColillas = { ok: true; enviados: number } | { ok: false; error: string };

export type ResultadoGuardarMapeo = { ok: true; guardados: number } | { ok: false; error: string };

export type ResultadoCalculoPeriodo =
  | { ok: true; recibos: number; totalNeto: Decimal; totalCostoEmpresa: Decimal }
  | { ok: false; error: string };

export type ResultadoContabilizarPeriodo =
  | { ok: true; asientos: number; total: Decimal }
  | { ok: false; error: string };

export type ResultadoPagarPeriodo =
  | { ok: true; recibos: number; asientos: number; totalPagado: Decimal }
  | { ok: false; error: string };

const RESPUESTA_INESPERADA = "Respuesta inesperada del servidor. Recarga la pantalla e intenta de nuevo.";

async function puedeEscribir(): Promise<boolean> {
  const rol = await getRol();
  return rol === "admin" || rol === "contador";
}

function revalidar(...rutas: string[]) {
  for (const ruta of rutas) revalidatePath(ruta);
}

function revalidarPeriodo(periodoId?: string) {
  revalidar("/dashboard/contabilidad/nomina", "/dashboard/contabilidad/nomina/periodos");
  if (periodoId) revalidar(`/dashboard/contabilidad/nomina/periodos/${periodoId}`);
}

function revalidarRecibo(reciboId: string) {
  revalidar(
    "/dashboard/contabilidad/nomina/periodos",
    `/dashboard/contabilidad/nomina/recibos/${reciboId}`,
    "/dashboard/contabilidad/nomina/pagos",
  );
}

function payloadEmpleado(datos: EmpleadoEntrada): Json {
  return {
    tipo_identificacion: datos.tipo_identificacion,
    identificacion: datos.identificacion,
    primer_nombre: datos.primer_nombre,
    segundo_nombre: datos.segundo_nombre ?? null,
    primer_apellido: datos.primer_apellido,
    segundo_apellido: datos.segundo_apellido ?? null,
    correo: datos.correo ?? null,
    telefono: datos.telefono ?? null,
    municipio: datos.municipio ?? null,
    direccion: datos.direccion ?? null,
    cargo: datos.cargo ?? null,
    area: datos.area ?? null,
    segmento_contable: datos.segmento_contable,
    centro_costo_id: datos.centro_costo_id ?? null,
    tipo_contrato: datos.tipo_contrato,
    fecha_ingreso: datos.fecha_ingreso,
    fecha_fin: datos.fecha_fin ?? null,
    frecuencia_pago: datos.frecuencia_pago,
    salario_mensual: datos.salario_mensual,
    metodo_pago: datos.metodo_pago,
    banco_nombre: datos.banco_nombre ?? null,
    tipo_cuenta_banco: datos.tipo_cuenta_banco ?? null,
    numero_cuenta_banco: datos.numero_cuenta_banco ?? null,
    clave_tss: datos.clave_tss ?? null,
  };
}

// ---------------------------------------------------------------------------
// Empleados
// ---------------------------------------------------------------------------

export async function crearEmpleado(entrada: unknown): Promise<ResultadoNomina> {
  if (!(await puedeEscribir())) return { ok: false, error: "No tienes permiso para crear empleados." };

  const resultado = empleadoSchema.safeParse(entrada);
  if (!resultado.success) return { ok: false, error: mensajeValidacion(resultado.error) };

  const supabase = await createClient();
  const cliente = clienteNominaPendiente(supabase);
  const { data, error } = await cliente.rpc("nomina_crear_empleado", { p: payloadEmpleado(resultado.data) });

  if (error) return { ok: false, error: mensajeErrorRpc(error) };
  if (typeof data !== "string") return { ok: false, error: "No se pudo crear el empleado." };

  revalidar("/dashboard/contabilidad/nomina/empleados", `/dashboard/contabilidad/nomina/empleados/${data}`);
  return { ok: true, id: data };
}

export async function actualizarEmpleado(id: string, entrada: unknown): Promise<ResultadoNomina> {
  if (!(await puedeEscribir())) return { ok: false, error: "No tienes permiso para editar empleados." };
  if (!idSchema.safeParse(id).success) return { ok: false, error: "El empleado no es válido." };

  const resultado = empleadoSchema.safeParse(entrada);
  if (!resultado.success) return { ok: false, error: mensajeValidacion(resultado.error) };

  const supabase = await createClient();
  const cliente = clienteNominaPendiente(supabase);
  const { data, error } = await cliente.rpc("nomina_actualizar_empleado", {
    p_id: id,
    p: payloadEmpleado(resultado.data),
  });

  if (error) return { ok: false, error: mensajeErrorRpc(error) };
  if (typeof data !== "string") return { ok: false, error: "No se pudo actualizar el empleado." };

  revalidar("/dashboard/contabilidad/nomina/empleados", `/dashboard/contabilidad/nomina/empleados/${data}`);
  return { ok: true, id: data };
}

export async function cambiarEstadoEmpleado(id: string, entrada: unknown): Promise<ResultadoNomina> {
  if (!(await puedeEscribir())) return { ok: false, error: "No tienes permiso para cambiar el estado del empleado." };
  if (!idSchema.safeParse(id).success) return { ok: false, error: "El empleado no es válido." };

  const resultado = cambioEstadoEmpleadoSchema.safeParse(entrada);
  if (!resultado.success) return { ok: false, error: mensajeValidacion(resultado.error) };

  const datos = resultado.data;
  const supabase = await createClient();
  const cliente = clienteNominaPendiente(supabase);
  const { data, error } = await cliente.rpc("nomina_cambiar_estado_empleado", {
    p_id: id,
    p_estado: datos.estado,
    ...(datos.fecha_fin ? { p_fecha_fin: datos.fecha_fin } : {}),
  });

  if (error) return { ok: false, error: mensajeErrorRpc(error) };
  if (typeof data !== "string") return { ok: false, error: "No se pudo cambiar el estado del empleado." };

  revalidar("/dashboard/contabilidad/nomina/empleados", `/dashboard/contabilidad/nomina/empleados/${data}`);
  return { ok: true, id: data };
}

export async function guardarNovedadRecurrente(entrada: unknown): Promise<ResultadoNomina> {
  if (!(await puedeEscribir())) return { ok: false, error: "No tienes permiso para guardar novedades recurrentes." };

  const resultado = novedadRecurrenteSchema.safeParse(entrada);
  if (!resultado.success) return { ok: false, error: mensajeValidacion(resultado.error) };

  const datos = resultado.data;
  const supabase = await createClient();
  const cliente = clienteNominaPendiente(supabase);
  const { data, error } = await cliente.rpc("nomina_guardar_novedad_recurrente", {
    p: {
      ...(datos.id ? { id: datos.id } : {}),
      empleado_id: datos.empleado_id,
      concepto_id: datos.concepto_id,
      ...(datos.monto !== undefined ? { monto: datos.monto } : { porcentaje: datos.porcentaje }),
      fecha_inicio: datos.fecha_inicio,
      fecha_fin: datos.fecha_fin ?? null,
      activa: datos.activa,
      notas: datos.notas ?? null,
    },
  });

  if (error) return { ok: false, error: mensajeErrorRpc(error) };
  if (typeof data !== "string") return { ok: false, error: "No se pudo guardar la novedad recurrente." };

  revalidar(
    "/dashboard/contabilidad/nomina/empleados",
    `/dashboard/contabilidad/nomina/empleados/${datos.empleado_id}`,
  );
  return { ok: true, id: data };
}

export async function eliminarNovedadRecurrente(id: string): Promise<ResultadoNominaSimple> {
  if (!(await puedeEscribir())) return { ok: false, error: "No tienes permiso para apagar novedades recurrentes." };
  if (!idSchema.safeParse(id).success) return { ok: false, error: "La novedad recurrente no es válida." };

  const supabase = await createClient();
  const cliente = clienteNominaPendiente(supabase);
  const { error } = await cliente.rpc("nomina_eliminar_novedad_recurrente", { p_id: id });

  if (error) return { ok: false, error: mensajeErrorRpc(error) };

  revalidar("/dashboard/contabilidad/nomina/empleados");
  return { ok: true };
}

// ---------------------------------------------------------------------------
// Configuración
// ---------------------------------------------------------------------------

export async function guardarConfigNomina(entrada: unknown): Promise<ResultadoNominaSimple> {
  if (!(await puedeEscribir()))
    return { ok: false, error: "No tienes permiso para guardar la configuración de nómina." };

  const resultado = configNominaSchema.safeParse(entrada);
  if (!resultado.success) return { ok: false, error: mensajeValidacion(resultado.error) };

  const datos = resultado.data;
  const supabase = await createClient();
  const cliente = clienteNominaPendiente(supabase);
  const { error } = await cliente.rpc("nomina_guardar_config_empresa", {
    p: {
      ...(datos.riesgo_laboral !== undefined ? { riesgo_laboral: datos.riesgo_laboral } : {}),
      ...(datos.categoria_empresa !== undefined ? { categoria_empresa: datos.categoria_empresa } : {}),
      ...(datos.aplica_infotep !== undefined ? { aplica_infotep: datos.aplica_infotep } : {}),
      ...(datos.frecuencia_defecto !== undefined ? { frecuencia_defecto: datos.frecuencia_defecto } : {}),
      ...(datos.cuenta_pago_defecto_id !== undefined ? { cuenta_pago_defecto_id: datos.cuenta_pago_defecto_id } : {}),
      ...(datos.cuenta_salarios_por_pagar_id !== undefined
        ? { cuenta_salarios_por_pagar_id: datos.cuenta_salarios_por_pagar_id }
        : {}),
      ...(datos.registrar_provisiones !== undefined ? { registrar_provisiones: datos.registrar_provisiones } : {}),
      ...(datos.contacto_tss_id !== undefined ? { contacto_tss_id: datos.contacto_tss_id } : {}),
      ...(datos.contacto_infotep_id !== undefined ? { contacto_infotep_id: datos.contacto_infotep_id } : {}),
      ...(datos.contacto_dgii_id !== undefined ? { contacto_dgii_id: datos.contacto_dgii_id } : {}),
    },
  });

  if (error) return { ok: false, error: mensajeErrorRpc(error) };

  revalidar("/dashboard/configuracion/nomina/laboral", "/dashboard/contabilidad/nomina");
  return { ok: true };
}

export async function guardarMapeoContable(entrada: unknown): Promise<ResultadoGuardarMapeo> {
  if (!(await puedeEscribir())) return { ok: false, error: "No tienes permiso para guardar el mapeo contable." };

  const resultado = mapeoContableSchema.safeParse(entrada);
  if (!resultado.success) return { ok: false, error: mensajeValidacion(resultado.error) };

  const mapeos = resultado.data.mapeos.map((fila) => ({
    segmento: fila.segmento,
    concepto_id: fila.concepto_id,
    ...(fila.cuenta_gasto_id !== undefined ? { cuenta_gasto_id: fila.cuenta_gasto_id } : {}),
    ...(fila.cuenta_pasivo_id !== undefined ? { cuenta_pasivo_id: fila.cuenta_pasivo_id } : {}),
  }));

  const supabase = await createClient();
  const cliente = clienteNominaPendiente(supabase);
  const { data, error } = await cliente.rpc("nomina_guardar_mapeo_contable", { p: { mapeos } });

  if (error) return { ok: false, error: mensajeErrorRpc(error) };
  if (typeof data !== "number") return { ok: false, error: "No se pudo guardar el mapeo contable." };

  revalidar("/dashboard/configuracion/nomina/mapeo");
  return { ok: true, guardados: data };
}

export async function guardarParametrosNomina(entrada: unknown): Promise<ResultadoNominaSimple> {
  if (!(await puedeEscribir())) return { ok: false, error: "No tienes permiso para guardar los parámetros de nómina." };

  const resultado = parametrosNominaSchema.safeParse(entrada);
  if (!resultado.success) return { ok: false, error: mensajeValidacion(resultado.error) };

  const datos = resultado.data;
  const supabase = await createClient();
  const cliente = clienteNominaPendiente(supabase);
  const { error } = await cliente.rpc("nomina_guardar_parametros_rd", { p: { ...datos } });

  if (error) return { ok: false, error: mensajeErrorRpc(error) };

  revalidar(
    "/dashboard/configuracion/nomina/parametros",
    "/dashboard/contabilidad/nomina",
    "/dashboard/contabilidad/nomina/periodos",
  );
  return { ok: true };
}

// ---------------------------------------------------------------------------
// Periodos y cálculo
// ---------------------------------------------------------------------------

export async function crearPeriodo(entrada: unknown): Promise<ResultadoNomina> {
  if (!(await puedeEscribir())) return { ok: false, error: "No tienes permiso para crear periodos de nómina." };

  const resultado = periodoSchema.safeParse(entrada);
  if (!resultado.success) return { ok: false, error: mensajeValidacion(resultado.error) };

  const datos = resultado.data;
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("nomina_crear_periodo", {
    p: {
      frecuencia: datos.frecuencia,
      fecha_inicio: datos.fecha_inicio,
      fecha_fin: datos.fecha_fin,
      ...(datos.fecha_pago ? { fecha_pago: datos.fecha_pago } : {}),
      ...(datos.observaciones ? { observaciones: datos.observaciones } : {}),
    },
  });

  if (error) return { ok: false, error: mensajeErrorRpc(error) };
  if (typeof data !== "string") return { ok: false, error: "No se pudo crear el periodo de nómina." };

  revalidarPeriodo(data);
  return { ok: true, id: data };
}

export async function calcularPeriodo(periodoId: string): Promise<ResultadoCalculoPeriodo> {
  if (!(await puedeEscribir())) return { ok: false, error: "No tienes permiso para calcular la nómina." };
  if (!idSchema.safeParse(periodoId).success) return { ok: false, error: "El periodo no es válido." };

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("nomina_calcular_periodo", { p_periodo_id: periodoId });

  if (error) return { ok: false, error: mensajeErrorRpc(error) };

  const respuesta = leerRespuestaCalculoPeriodo(data);
  if (!respuesta) return { ok: false, error: RESPUESTA_INESPERADA };

  revalidarPeriodo(periodoId);
  return { ok: true, ...respuesta };
}

export async function calcularRecibo(reciboId: string): Promise<ResultadoNomina> {
  if (!(await puedeEscribir())) return { ok: false, error: "No tienes permiso para calcular el recibo." };
  if (!idSchema.safeParse(reciboId).success) return { ok: false, error: "El recibo no es válido." };

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("nomina_calcular_recibo", { p_recibo_id: reciboId });

  if (error) return { ok: false, error: mensajeErrorRpc(error) };
  if (typeof data !== "string") return { ok: false, error: "No se pudo calcular el recibo." };

  revalidarRecibo(reciboId);
  return { ok: true, id: data };
}

// ---------------------------------------------------------------------------
// Novedades manuales del recibo
// ---------------------------------------------------------------------------

export async function guardarNovedadRecibo(entrada: unknown): Promise<ResultadoNovedad> {
  if (!(await puedeEscribir())) return { ok: false, error: "No tienes permiso para editar novedades del recibo." };

  const resultado = novedadReciboSchema.safeParse(entrada);
  if (!resultado.success) return { ok: false, error: mensajeValidacion(resultado.error) };

  const datos = resultado.data;
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("nomina_guardar_novedad_recibo", {
    p: {
      ...(datos.id ? { id: datos.id } : {}),
      recibo_id: datos.recibo_id,
      concepto_id: datos.concepto_id,
      ...(datos.cantidad !== undefined ? { cantidad: datos.cantidad } : {}),
      ...(datos.monto !== undefined ? { monto: datos.monto } : {}),
      ...(datos.porcentaje !== undefined ? { porcentaje: datos.porcentaje } : {}),
      notas: datos.notas ?? null,
    },
  });

  if (error) return { ok: false, error: mensajeErrorRpc(error) };

  const respuesta = leerRespuestaNovedadRecibo(data);
  if (!respuesta) return { ok: false, error: RESPUESTA_INESPERADA };

  revalidarRecibo(datos.recibo_id);
  return { ok: true, id: respuesta.lineaId, monto: respuesta.monto };
}

export async function eliminarNovedadRecibo(lineaId: string): Promise<ResultadoNominaSimple> {
  if (!(await puedeEscribir())) return { ok: false, error: "No tienes permiso para borrar novedades del recibo." };
  if (!idSchema.safeParse(lineaId).success) return { ok: false, error: "La novedad del recibo no es válida." };

  const supabase = await createClient();
  const { error } = await supabase.rpc("nomina_eliminar_novedad_recibo", { p_id: lineaId });

  if (error) return { ok: false, error: mensajeErrorRpc(error) };

  revalidar("/dashboard/contabilidad/nomina/periodos", "/dashboard/contabilidad/nomina");
  return { ok: true };
}

// ---------------------------------------------------------------------------
// Contabilización
// ---------------------------------------------------------------------------

export async function contabilizarRecibo(reciboId: string): Promise<ResultadoNomina> {
  if (!(await puedeEscribir())) return { ok: false, error: "No tienes permiso para contabilizar la nómina." };
  if (!idSchema.safeParse(reciboId).success) return { ok: false, error: "El recibo no es válido." };

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("nomina_contabilizar_recibo", { p_recibo_id: reciboId });

  if (error) return { ok: false, error: mensajeErrorRpc(error) };
  if (typeof data !== "string") return { ok: false, error: "No se pudo contabilizar el recibo." };

  revalidarRecibo(reciboId);
  revalidar("/dashboard/contabilidad/asientos", "/dashboard/contabilidad");
  return { ok: true, id: data };
}

export async function contabilizarPeriodo(periodoId: string): Promise<ResultadoContabilizarPeriodo> {
  if (!(await puedeEscribir())) return { ok: false, error: "No tienes permiso para contabilizar la nómina." };
  if (!idSchema.safeParse(periodoId).success) return { ok: false, error: "El periodo no es válido." };

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("nomina_contabilizar_periodo", { p_periodo_id: periodoId });

  if (error) return { ok: false, error: mensajeErrorRpc(error) };

  const respuesta = leerRespuestaContabilizarPeriodo(data);
  if (!respuesta) return { ok: false, error: RESPUESTA_INESPERADA };

  revalidarPeriodo(periodoId);
  revalidar("/dashboard/contabilidad/asientos", "/dashboard/contabilidad");
  return { ok: true, ...respuesta };
}

// ---------------------------------------------------------------------------
// Pago
// ---------------------------------------------------------------------------

export async function pagarRecibo(entrada: unknown): Promise<ResultadoPagoRecibo> {
  if (!(await puedeEscribir())) return { ok: false, error: "No tienes permiso para pagar la nómina." };

  const resultado = pagoReciboSchema.safeParse(entrada);
  if (!resultado.success) return { ok: false, error: mensajeValidacion(resultado.error) };

  const datos = resultado.data;
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("nomina_pagar_recibo", {
    p: {
      recibo_id: datos.recibo_id,
      ...(datos.fecha ? { fecha: datos.fecha } : {}),
      cuenta_pago_id: datos.cuenta_pago_id,
    },
  });

  if (error) return { ok: false, error: mensajeErrorRpc(error) };

  revalidarRecibo(datos.recibo_id);
  revalidar("/dashboard/contabilidad/nomina/pagos");
  return { ok: true, id: datos.recibo_id, asientoId: typeof data === "string" ? data : null };
}

export async function pagarPeriodo(entrada: unknown): Promise<ResultadoPagarPeriodo> {
  if (!(await puedeEscribir())) return { ok: false, error: "No tienes permiso para pagar la nómina." };

  const resultado = pagoPeriodoSchema.safeParse(entrada);
  if (!resultado.success) return { ok: false, error: mensajeValidacion(resultado.error) };

  const datos = resultado.data;
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("nomina_pagar_periodo", {
    p: {
      periodo_id: datos.periodo_id,
      ...(datos.fecha ? { fecha: datos.fecha } : {}),
      cuenta_pago_id: datos.cuenta_pago_id,
    },
  });

  if (error) return { ok: false, error: mensajeErrorRpc(error) };

  const respuesta = leerRespuestaPagarPeriodo(data);
  if (!respuesta) return { ok: false, error: RESPUESTA_INESPERADA };

  revalidarPeriodo(datos.periodo_id);
  revalidar("/dashboard/contabilidad/nomina/pagos", `/dashboard/contabilidad/nomina/pagos/${datos.periodo_id}`);
  return { ok: true, ...respuesta };
}

// ---------------------------------------------------------------------------
// Colillas
// ---------------------------------------------------------------------------

export async function registrarEnvioColillas(entrada: unknown): Promise<ResultadoEnvioColillas> {
  if (!(await puedeEscribir())) return { ok: false, error: "No tienes permiso para registrar envíos de colillas." };

  const resultado = envioColillasSchema.safeParse(entrada);
  if (!resultado.success) return { ok: false, error: mensajeValidacion(resultado.error) };

  const datos = resultado.data;
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("nomina_registrar_envio_colillas", {
    p: {
      periodo_id: datos.periodo_id,
      recibo_ids: datos.recibo_ids,
      ...(datos.enviado_a ? { enviado_a: datos.enviado_a } : {}),
    },
  });

  if (error) return { ok: false, error: mensajeErrorRpc(error) };
  if (typeof data !== "number") return { ok: false, error: "No se pudo registrar el envío de colillas." };

  revalidar("/dashboard/contabilidad/nomina/envios", `/dashboard/contabilidad/nomina/periodos/${datos.periodo_id}`);
  return { ok: true, enviados: data };
}

// ---------------------------------------------------------------------------
// Anulaciones
// ---------------------------------------------------------------------------

export async function anularPagoRecibo(reciboId: string): Promise<ResultadoPagoRecibo> {
  if (!(await puedeEscribir())) return { ok: false, error: "No tienes permiso para anular el pago de nómina." };
  if (!idSchema.safeParse(reciboId).success) return { ok: false, error: "El recibo no es válido." };

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("nomina_anular_pago_recibo", { p_recibo_id: reciboId });

  if (error) return { ok: false, error: mensajeErrorRpc(error) };

  revalidarRecibo(reciboId);
  revalidar("/dashboard/contabilidad/nomina/pagos", "/dashboard/contabilidad/asientos");
  return { ok: true, id: reciboId, asientoId: typeof data === "string" ? data : null };
}

export async function anularRecibo(reciboId: string): Promise<ResultadoPagoRecibo> {
  if (!(await puedeEscribir())) return { ok: false, error: "No tienes permiso para anular el recibo." };
  if (!idSchema.safeParse(reciboId).success) return { ok: false, error: "El recibo no es válido." };

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("nomina_anular_recibo", { p_recibo_id: reciboId });

  if (error) return { ok: false, error: mensajeErrorRpc(error) };

  revalidarRecibo(reciboId);
  revalidar("/dashboard/contabilidad/nomina/pagos", "/dashboard/contabilidad/asientos");
  return { ok: true, id: reciboId, asientoId: typeof data === "string" ? data : null };
}
