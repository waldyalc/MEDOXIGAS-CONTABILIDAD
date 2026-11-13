"use server";

import { revalidatePath } from "next/cache";

import type { SupabaseClient } from "@supabase/supabase-js";

import { getRol } from "@/lib/auth/rol";
import { centavosAValor, valorACentavos } from "@/lib/facturacion/calculo";
import { mensajeErrorRpc } from "@/lib/facturacion/errores";
import { mensajeValidacion } from "@/lib/facturacion/validacion";
import { avisoSaldoCuenta } from "@/lib/reportes/saldos";
import { createClient } from "@/lib/supabase/server";

import { desdeSugerido } from "./conciliacion";
import { getInicioConciliacion } from "./conciliaciones";
import {
  conciliacionSchema,
  cuentaBancoSchema,
  depositoSchema,
  iniciarConciliacionSchema,
  transferenciaSchema,
  validarConciliacion,
  validarCuentaBanco,
  validarDeposito,
  validarTransferencia,
} from "./validacion";

export type ResultadoBanco = { ok: true; id: string; aviso?: string } | { ok: false; error: string };

async function avisosCuentas(cuentaIds: string[], fecha: string): Promise<string | undefined> {
  const avisos = await Promise.all(cuentaIds.map((cuentaId) => avisoSaldoCuenta(cuentaId, fecha)));
  const unicos = [...new Set(avisos.filter((aviso): aviso is string => aviso !== null))];
  return unicos.length > 0 ? unicos.join(" ") : undefined;
}

export async function transferirEntreCuentas(entrada: unknown): Promise<ResultadoBanco> {
  const rol = await getRol();
  if (rol !== "admin" && rol !== "contador") {
    return { ok: false, error: "No tienes permiso para transferir entre cuentas." };
  }

  const resultado = transferenciaSchema.safeParse(entrada);
  if (!resultado.success) return { ok: false, error: mensajeValidacion(resultado.error) };

  const datos = resultado.data;
  const montoCentavos = valorACentavos(datos.monto);
  const errorValidacion = validarTransferencia({
    cuenta_origen_id: datos.cuenta_origen_id,
    cuenta_destino_id: datos.cuenta_destino_id,
    montoCentavos,
  });
  if (errorValidacion) return { ok: false, error: errorValidacion };

  const payload = {
    cuenta_origen_id: datos.cuenta_origen_id,
    cuenta_destino_id: datos.cuenta_destino_id,
    monto: centavosAValor(montoCentavos),
    fecha: datos.fecha,
    ...(datos.descripcion ? { descripcion: datos.descripcion } : {}),
    ...(datos.numeracion_ingreso ? { numeracion_ingreso: datos.numeracion_ingreso } : {}),
    ...(datos.numeracion_egreso ? { numeracion_egreso: datos.numeracion_egreso } : {}),
  };

  const supabase = (await createClient()) as unknown as SupabaseClient;
  const { data, error } = await supabase.rpc("transferir_entre_cuentas", { p: payload }).returns<string>();

  if (error) return { ok: false, error: mensajeErrorRpc(error) };
  if (typeof data !== "string") return { ok: false, error: "No se pudo registrar la transferencia." };

  const aviso = await avisosCuentas([datos.cuenta_origen_id, datos.cuenta_destino_id], datos.fecha);

  revalidatePath("/dashboard/bancos");
  return { ok: true, id: data, ...(aviso ? { aviso } : {}) };
}

export async function crearCuentaBanco(entrada: unknown): Promise<ResultadoBanco> {
  const rol = await getRol();
  if (rol !== "admin" && rol !== "contador") {
    return { ok: false, error: "No tienes permiso para crear cuentas de banco." };
  }

  const resultado = cuentaBancoSchema.safeParse(entrada);
  if (!resultado.success) return { ok: false, error: mensajeValidacion(resultado.error) };

  const datos = resultado.data;
  const saldoCentavos = valorACentavos(datos.saldo_inicial);
  const errorValidacion = validarCuentaBanco({
    nombre: datos.nombre,
    tipo_banco: datos.tipo_banco,
    saldoCentavos,
    fecha_saldo_inicial: datos.fecha_saldo_inicial,
  });
  if (errorValidacion) return { ok: false, error: errorValidacion };

  const payload = {
    nombre: datos.nombre,
    tipo_banco: datos.tipo_banco,
    saldo_inicial: centavosAValor(saldoCentavos),
    fecha_saldo_inicial: datos.fecha_saldo_inicial,
    ...(datos.numero_cuenta ? { numero_cuenta: datos.numero_cuenta } : {}),
    ...(datos.descripcion ? { descripcion: datos.descripcion } : {}),
  };

  const supabase = (await createClient()) as unknown as SupabaseClient;
  const { data, error } = await supabase.rpc("crear_cuenta_banco", { p: payload }).returns<string>();

  if (error) return { ok: false, error: mensajeErrorRpc(error) };
  if (typeof data !== "string") return { ok: false, error: "No se pudo crear la cuenta de banco." };

  revalidatePath("/dashboard/bancos");
  return { ok: true, id: data };
}

export async function iniciarConciliacion(entrada: unknown): Promise<ResultadoBanco> {
  const rol = await getRol();
  if (rol !== "admin" && rol !== "contador") {
    return { ok: false, error: "No tienes permiso para conciliar cuentas." };
  }

  const resultado = iniciarConciliacionSchema.safeParse(entrada);
  if (!resultado.success) return { ok: false, error: mensajeValidacion(resultado.error) };

  const datos = resultado.data;
  const inicio = await getInicioConciliacion(datos.cuenta_id);

  if (inicio.borradorId != null) {
    return { ok: true, id: inicio.borradorId };
  }

  const desde = desdeSugerido(inicio.ultimoCorte, inicio.primerMovimiento, datos.fecha_hasta);
  if (desde > datos.fecha_hasta) {
    return { ok: false, error: "La fecha de corte debe ser posterior al último corte conciliado." };
  }

  const supabase = (await createClient()) as unknown as SupabaseClient;
  const { data, error } = await supabase
    .rpc("guardar_borrador_conciliacion", {
      p: {
        cuenta_id: datos.cuenta_id,
        fecha_desde: desde,
        fecha_hasta: datos.fecha_hasta,
        saldo_bancario: centavosAValor(valorACentavos(datos.saldo_bancario)),
        lineas: [],
      },
    })
    .returns<string>();

  if (error) return { ok: false, error: mensajeErrorRpc(error) };
  if (typeof data !== "string") return { ok: false, error: "No se pudo iniciar la conciliación." };

  revalidatePath("/dashboard/bancos");
  revalidatePath("/dashboard/bancos/conciliaciones");
  return { ok: true, id: data };
}

export async function guardarConciliacionBorrador(entrada: unknown): Promise<ResultadoBanco> {
  return guardarConciliacion(entrada, false);
}

export async function conciliarCuenta(entrada: unknown): Promise<ResultadoBanco> {
  return guardarConciliacion(entrada, true);
}

async function guardarConciliacion(entrada: unknown, conciliar: boolean): Promise<ResultadoBanco> {
  const rol = await getRol();
  if (rol !== "admin" && rol !== "contador") {
    return { ok: false, error: "No tienes permiso para conciliar cuentas." };
  }

  const resultado = conciliacionSchema.safeParse(entrada);
  if (!resultado.success) return { ok: false, error: mensajeValidacion(resultado.error) };

  const datos = resultado.data;
  const saldoCentavos = valorACentavos(datos.saldo_bancario);
  const errorValidacion = validarConciliacion({
    fecha_desde: datos.fecha_desde,
    fecha_hasta: datos.fecha_hasta,
    saldoCentavos,
    lineas: datos.lineas,
    requiereMovimientos: conciliar,
  });
  if (errorValidacion) return { ok: false, error: errorValidacion };

  const payload = {
    conciliacion_id: datos.conciliacion_id,
    cuenta_id: datos.cuenta_id,
    fecha_desde: datos.fecha_desde,
    fecha_hasta: datos.fecha_hasta,
    saldo_bancario: centavosAValor(saldoCentavos),
    gastos_bancarios: centavosAValor(valorACentavos(datos.gastos_bancarios)),
    entradas_bancarias: centavosAValor(valorACentavos(datos.entradas_bancarias)),
    lineas: datos.lineas,
  };

  const supabase = (await createClient()) as unknown as SupabaseClient;
  const { data, error } = conciliar
    ? await supabase.rpc("conciliar_cuenta", { p: payload }).returns<string>()
    : await supabase.rpc("guardar_borrador_conciliacion", { p: payload }).returns<string>();

  if (error) return { ok: false, error: mensajeErrorRpc(error) };
  if (typeof data !== "string") return { ok: false, error: "No se pudo guardar la conciliación." };

  revalidatePath("/dashboard/bancos");
  revalidatePath("/dashboard/bancos/conciliaciones");
  revalidatePath(`/dashboard/bancos/conciliaciones/${data}`);
  revalidatePath(`/dashboard/bancos/${datos.cuenta_id}`);
  return { ok: true, id: data };
}

export async function registrarDeposito(entrada: unknown): Promise<ResultadoBanco> {
  const rol = await getRol();
  if (rol !== "admin" && rol !== "contador") {
    return { ok: false, error: "No tienes permiso para registrar depósitos." };
  }

  const resultado = depositoSchema.safeParse(entrada);
  if (!resultado.success) return { ok: false, error: mensajeValidacion(resultado.error) };

  const datos = resultado.data;
  const montoCentavos = valorACentavos(datos.monto);
  const errorValidacion = validarDeposito({
    cuenta_destino_id: datos.cuenta_destino_id,
    cuenta_contrapartida_id: datos.cuenta_contrapartida_id,
    montoCentavos,
  });
  if (errorValidacion) return { ok: false, error: errorValidacion };

  const payload = {
    cuenta_destino_id: datos.cuenta_destino_id,
    cuenta_contrapartida_id: datos.cuenta_contrapartida_id,
    monto: centavosAValor(montoCentavos),
    fecha: datos.fecha,
    ...(datos.descripcion ? { descripcion: datos.descripcion } : {}),
  };

  const supabase = (await createClient()) as unknown as SupabaseClient;
  const { data, error } = await supabase.rpc("registrar_deposito", { p: payload }).returns<string>();

  if (error) return { ok: false, error: mensajeErrorRpc(error) };
  if (typeof data !== "string") return { ok: false, error: "No se pudo registrar el depósito." };

  const aviso = await avisosCuentas([datos.cuenta_destino_id, datos.cuenta_contrapartida_id], datos.fecha);

  revalidatePath("/dashboard/bancos");
  return { ok: true, id: data, ...(aviso ? { aviso } : {}) };
}
