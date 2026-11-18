"use server";

import { revalidatePath } from "next/cache";

import { getRol } from "@/lib/auth/rol";
import { centavosAValor, valorACentavos } from "@/lib/facturacion/calculo";
import { mensajeErrorRpc } from "@/lib/facturacion/errores";
import { mensajeValidacion } from "@/lib/facturacion/validacion";
import { createClient } from "@/lib/supabase/server";

import { esquemaActualizarCuenta, esquemaCrearCuenta, esquemaSaldosIniciales } from "./validacion";

export type ResultadoCuenta = { ok: true } | { ok: false; error: string };
export type ResultadoSaldosIniciales = { ok: true; id: string } | { ok: false; error: string };

function texto(formData: FormData, campo: string) {
  const valor = formData.get(campo);
  return typeof valor === "string" ? valor : "";
}

function booleano(formData: FormData, campo: string) {
  const valor = texto(formData, campo).toLowerCase();
  return valor === "true" || valor === "on" || valor === "1";
}

function datosDesdeFormulario(formData: FormData) {
  return {
    codigo: texto(formData, "codigo"),
    nombre: texto(formData, "nombre"),
    tipo: texto(formData, "tipo"),
    naturaleza: texto(formData, "naturaleza"),
    padre_id: texto(formData, "padre_id"),
    acepta_movimientos: booleano(formData, "acepta_movimientos"),
    es_caja_banco: booleano(formData, "es_caja_banco"),
    activa: booleano(formData, "activa"),
  };
}

function idValido(id: string) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id);
}

export async function crearCuenta(formData: FormData): Promise<ResultadoCuenta> {
  const rol = await getRol();
  if (rol !== "admin" && rol !== "contador") {
    return { ok: false, error: "No tienes permiso para crear cuentas." };
  }

  const parseo = esquemaCrearCuenta.safeParse(datosDesdeFormulario(formData));
  if (!parseo.success) return { ok: false, error: mensajeValidacion(parseo.error) };

  const supabase = await createClient();
  const { error } = await supabase.rpc("crear_cuenta", { p: parseo.data });
  if (error) return { ok: false, error: mensajeErrorRpc(error) };

  revalidatePath("/dashboard/contabilidad");
  return { ok: true };
}

export async function actualizarCuenta(id: string, formData: FormData): Promise<ResultadoCuenta> {
  const rol = await getRol();
  if (rol !== "admin" && rol !== "contador") {
    return { ok: false, error: "No tienes permiso para editar cuentas." };
  }

  if (!idValido(id)) return { ok: false, error: "La cuenta no es válida" };

  const { codigo, tipo, naturaleza, ...resto } = datosDesdeFormulario(formData);
  const parseo = esquemaActualizarCuenta.safeParse({
    ...resto,
    ...(codigo.trim() === "" ? {} : { codigo }),
    ...(tipo === "" ? {} : { tipo }),
    ...(naturaleza === "" ? {} : { naturaleza }),
  });

  if (!parseo.success) return { ok: false, error: mensajeValidacion(parseo.error) };

  const supabase = await createClient();
  const { error } = await supabase.rpc("actualizar_cuenta", { p: { id, ...parseo.data } });
  if (error) return { ok: false, error: mensajeErrorRpc(error) };

  revalidatePath("/dashboard/contabilidad");
  revalidatePath(`/dashboard/contabilidad/cuentas/${id}`);
  return { ok: true };
}

export async function registrarSaldosIniciales(entrada: unknown): Promise<ResultadoSaldosIniciales> {
  const rol = await getRol();
  if (rol !== "admin" && rol !== "contador") {
    return { ok: false, error: "No tienes permiso para registrar saldos iniciales." };
  }

  const parseo = esquemaSaldosIniciales.safeParse(entrada);
  if (!parseo.success) return { ok: false, error: mensajeValidacion(parseo.error) };

  const datos = parseo.data;
  const payload = {
    fecha: datos.fecha,
    ...(datos.descripcion ? { descripcion: datos.descripcion } : {}),
    lineas: datos.lineas.map((linea) => ({
      cuenta_id: linea.cuenta_id,
      ...(linea.descripcion ? { descripcion: linea.descripcion } : {}),
      debito: centavosAValor(valorACentavos(linea.debito)),
      credito: centavosAValor(valorACentavos(linea.credito)),
    })),
  };

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("registrar_saldos_iniciales", { p: payload });

  if (error) return { ok: false, error: mensajeErrorRpc(error) };
  if (typeof data !== "string") {
    return { ok: false, error: "El registro se guardó pero no se recibió su identificador." };
  }

  revalidatePath("/dashboard/contabilidad");
  revalidatePath("/dashboard/contabilidad/asientos");
  return { ok: true, id: data };
}
