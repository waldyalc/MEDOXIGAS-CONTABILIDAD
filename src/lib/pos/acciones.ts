"use server";

import { revalidatePath } from "next/cache";

import { getRol } from "@/lib/auth/rol";
import { mensajeErrorRpc } from "@/lib/facturacion/errores";
import { createClient } from "@/lib/supabase/server";

import {
  type CotizacionEntrada,
  esquemaAbrirTurno,
  esquemaCerrarTurno,
  esquemaCotizacionPOS,
  esquemaDevolucion,
  esquemaMovimientoTurno,
  esquemaTerminal,
  esquemaTerminalEdicion,
  esquemaVenta,
  idSchema,
  mensajeValidacion,
  type PlantillaTicketEntrada,
  type TerminalEdicionEntrada,
  type TerminalEntrada,
} from "./esquemas";
import {
  esquemasRpcPOS,
  mapearAperturaTurno,
  mapearCierreTurno,
  mapearCotizacionPOS,
  mapearDevolucionPOS,
  mapearMovimientoResultado,
  mapearVentaPOS,
} from "./mapeo";
import { payloadFuenteVenta, payloadVentaCompleta } from "./payload-venta";
import type {
  AperturaTurnoPOS,
  CierreTurnoPOS,
  CotizacionPOSResultado,
  DevolucionPOSResultado,
  MovimientoTurnoPOSResultado,
  VentaPOSResultado,
} from "./tipos";

export type ResultadoPOS<T> = { ok: true; data: T } | { ok: false; error: string };

function puedeEscribir(rol: string | null) {
  return rol === "admin" || rol === "contador";
}

/** Plantilla plana y JSON-safe: nunca se envía una clave con `undefined`. */
function payloadPlantilla(plantilla: PlantillaTicketEntrada): Record<string, string | number | boolean | null> {
  const payload: Record<string, string | number | boolean | null> = {};

  if (plantilla.estilo !== undefined) payload.estilo = plantilla.estilo;
  if (plantilla.ancho_mm !== undefined) payload.ancho_mm = plantilla.ancho_mm;
  if (plantilla.fuente !== undefined) payload.fuente = plantilla.fuente;
  if (plantilla.tamano_letra !== undefined) payload.tamano_letra = plantilla.tamano_letra;
  if (plantilla.interlineado !== undefined) payload.interlineado = plantilla.interlineado;
  if (plantilla.mostrar_logo !== undefined) payload.mostrar_logo = plantilla.mostrar_logo;
  if (plantilla.mostrar_vendedor !== undefined) payload.mostrar_vendedor = plantilla.mostrar_vendedor;
  if (plantilla.mostrar_descripcion !== undefined) payload.mostrar_descripcion = plantilla.mostrar_descripcion;
  if (plantilla.mostrar_referencia !== undefined) payload.mostrar_referencia = plantilla.mostrar_referencia;
  if (plantilla.mostrar_precio_unitario !== undefined) {
    payload.mostrar_precio_unitario = plantilla.mostrar_precio_unitario;
  }
  if (plantilla.mostrar_unidad !== undefined) payload.mostrar_unidad = plantilla.mostrar_unidad;
  if (plantilla.precios_con_impuestos !== undefined) {
    payload.precios_con_impuestos = plantilla.precios_con_impuestos;
  }
  if (plantilla.pie_ticket !== undefined) payload.pie_ticket = plantilla.pie_ticket;

  return payload;
}

function payloadTerminalCreacion(datos: TerminalEntrada) {
  return {
    nombre: datos.nombre,
    almacen_id: datos.almacen_id,
    cuenta_efectivo_id: datos.cuenta_efectivo_id,
    numeracion_defecto_id: datos.numeracion_defecto_id,
    contacto_defecto_id: datos.contacto_defecto_id,
    activa: datos.activa ?? true,
    ...(datos.cuenta_tarjeta_debito_id !== undefined
      ? { cuenta_tarjeta_debito_id: datos.cuenta_tarjeta_debito_id }
      : {}),
    ...(datos.cuenta_tarjeta_credito_id !== undefined
      ? { cuenta_tarjeta_credito_id: datos.cuenta_tarjeta_credito_id }
      : {}),
    ...(datos.cuenta_transferencia_id !== undefined ? { cuenta_transferencia_id: datos.cuenta_transferencia_id } : {}),
    ...(datos.lista_precio_defecto_id !== undefined ? { lista_precio_defecto_id: datos.lista_precio_defecto_id } : {}),
    ...(datos.centro_costo_id !== undefined ? { centro_costo_id: datos.centro_costo_id } : {}),
    ...(datos.plantilla_ticket !== undefined ? { plantilla_ticket: payloadPlantilla(datos.plantilla_ticket) } : {}),
  };
}

function payloadTerminalEdicion(datos: TerminalEdicionEntrada) {
  return {
    ...(datos.nombre !== undefined ? { nombre: datos.nombre } : {}),
    ...(datos.almacen_id !== undefined ? { almacen_id: datos.almacen_id } : {}),
    ...(datos.cuenta_efectivo_id !== undefined ? { cuenta_efectivo_id: datos.cuenta_efectivo_id } : {}),
    ...(datos.cuenta_tarjeta_debito_id !== undefined
      ? { cuenta_tarjeta_debito_id: datos.cuenta_tarjeta_debito_id }
      : {}),
    ...(datos.cuenta_tarjeta_credito_id !== undefined
      ? { cuenta_tarjeta_credito_id: datos.cuenta_tarjeta_credito_id }
      : {}),
    ...(datos.cuenta_transferencia_id !== undefined ? { cuenta_transferencia_id: datos.cuenta_transferencia_id } : {}),
    ...(datos.numeracion_defecto_id !== undefined ? { numeracion_defecto_id: datos.numeracion_defecto_id } : {}),
    ...(datos.lista_precio_defecto_id !== undefined ? { lista_precio_defecto_id: datos.lista_precio_defecto_id } : {}),
    ...(datos.contacto_defecto_id !== undefined ? { contacto_defecto_id: datos.contacto_defecto_id } : {}),
    ...(datos.centro_costo_id !== undefined ? { centro_costo_id: datos.centro_costo_id } : {}),
    ...(datos.plantilla_ticket !== undefined ? { plantilla_ticket: payloadPlantilla(datos.plantilla_ticket) } : {}),
    ...(datos.activa !== undefined ? { activa: datos.activa } : {}),
  };
}

// ---------------------------------------------------------------------------
// Terminales
// ---------------------------------------------------------------------------

export async function crearTerminal(entrada: unknown): Promise<ResultadoPOS<{ id: string }>> {
  if (!puedeEscribir(await getRol())) return { ok: false, error: "No tienes permiso para crear terminales." };

  const resultado = esquemaTerminal.safeParse(entrada);
  if (!resultado.success) return { ok: false, error: mensajeValidacion(resultado.error) };

  const datos: TerminalEntrada = resultado.data;
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("pos_crear_terminal", { p: payloadTerminalCreacion(datos) });

  if (error) return { ok: false, error: mensajeErrorRpc(error) };
  if (typeof data !== "string") return { ok: false, error: "No se pudo crear la terminal." };

  revalidatePath("/dashboard/configuracion/pos");
  revalidatePath("/pos");
  return { ok: true, data: { id: data } };
}

export async function actualizarTerminal(id: string, entrada: unknown): Promise<ResultadoPOS<{ id: string }>> {
  if (!puedeEscribir(await getRol())) return { ok: false, error: "No tienes permiso para editar terminales." };
  if (!idSchema.safeParse(id).success) return { ok: false, error: "La terminal no es válida." };

  const resultado = esquemaTerminalEdicion.safeParse(entrada);
  if (!resultado.success) return { ok: false, error: mensajeValidacion(resultado.error) };

  const datos: TerminalEdicionEntrada = resultado.data;
  const supabase = await createClient();
  const { error } = await supabase.rpc("pos_actualizar_terminal", {
    p_id: id,
    p: payloadTerminalEdicion(datos),
  });

  if (error) return { ok: false, error: mensajeErrorRpc(error) };

  revalidatePath("/dashboard/configuracion/pos");
  revalidatePath("/pos");
  revalidatePath(`/dashboard/configuracion/pos/${id}`);
  return { ok: true, data: { id } };
}

// ---------------------------------------------------------------------------
// Turnos
// ---------------------------------------------------------------------------

export async function abrirTurno(entrada: unknown): Promise<ResultadoPOS<AperturaTurnoPOS>> {
  if (!puedeEscribir(await getRol())) return { ok: false, error: "No tienes permiso para abrir turnos." };

  const resultado = esquemaAbrirTurno.safeParse(entrada);
  if (!resultado.success) return { ok: false, error: mensajeValidacion(resultado.error) };

  const datos = resultado.data;
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("pos_abrir_turno", {
    p: {
      terminal_id: datos.terminal_id,
      base_inicial: datos.base_inicial,
      ...(datos.observaciones ? { observaciones: datos.observaciones } : {}),
    },
  });

  if (error) return { ok: false, error: mensajeErrorRpc(error) };

  const parseo = esquemasRpcPOS.apertura.safeParse(data);
  if (!parseo.success) return { ok: false, error: "La respuesta del turno no tiene el formato esperado." };

  revalidatePath("/pos");
  revalidatePath("/pos/turnos");
  revalidatePath("/dashboard");
  return { ok: true, data: mapearAperturaTurno(parseo.data) };
}

export async function registrarMovimientoTurno(entrada: unknown): Promise<ResultadoPOS<MovimientoTurnoPOSResultado>> {
  if (!puedeEscribir(await getRol())) {
    return { ok: false, error: "No tienes permiso para registrar movimientos de caja." };
  }

  const resultado = esquemaMovimientoTurno.safeParse(entrada);
  if (!resultado.success) return { ok: false, error: mensajeValidacion(resultado.error) };

  const datos = resultado.data;
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("pos_registrar_movimiento_turno", {
    p: {
      turno_id: datos.turno_id,
      tipo: datos.tipo,
      motivo: datos.motivo,
      monto: datos.monto,
      ...(datos.cuenta_contrapartida_id ? { cuenta_contrapartida_id: datos.cuenta_contrapartida_id } : {}),
      ...(datos.contacto_id ? { contacto_id: datos.contacto_id } : {}),
      ...(datos.factura_id ? { factura_id: datos.factura_id } : {}),
      ...(datos.cuenta_gasto_id ? { cuenta_gasto_id: datos.cuenta_gasto_id } : {}),
      ...(datos.subtotal !== undefined ? { subtotal: datos.subtotal } : {}),
      ...(datos.itbis_tasa !== undefined ? { itbis_tasa: datos.itbis_tasa } : {}),
      ...(datos.descripcion ? { descripcion: datos.descripcion } : {}),
      ...(datos.notas ? { notas: datos.notas } : {}),
    },
  });

  if (error) return { ok: false, error: mensajeErrorRpc(error) };

  const parseo = esquemasRpcPOS.movimiento.safeParse(data);
  if (!parseo.success) return { ok: false, error: "La respuesta del movimiento no tiene el formato esperado." };

  revalidatePath("/pos");
  revalidatePath("/pos/turnos");
  revalidatePath("/dashboard/bancos");
  return { ok: true, data: mapearMovimientoResultado(parseo.data) };
}

export async function cerrarTurno(entrada: unknown): Promise<ResultadoPOS<CierreTurnoPOS>> {
  if (!puedeEscribir(await getRol())) return { ok: false, error: "No tienes permiso para cerrar turnos." };

  const resultado = esquemaCerrarTurno.safeParse(entrada);
  if (!resultado.success) return { ok: false, error: mensajeValidacion(resultado.error) };

  const datos = resultado.data;
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("pos_cerrar_turno", {
    p: {
      turno_id: datos.turno_id,
      efectivo_real: datos.efectivo_real,
      registrar_diferencia: datos.registrar_diferencia,
      ...(datos.observaciones ? { observaciones: datos.observaciones } : {}),
    },
  });

  if (error) return { ok: false, error: mensajeErrorRpc(error) };

  const parseo = esquemasRpcPOS.cierre.safeParse(data);
  if (!parseo.success) return { ok: false, error: "La respuesta del cierre no tiene el formato esperado." };

  revalidatePath("/pos");
  revalidatePath("/pos/turnos");
  revalidatePath("/dashboard");
  revalidatePath("/dashboard/bancos");
  revalidatePath("/dashboard/contabilidad/asientos");
  return { ok: true, data: mapearCierreTurno(parseo.data) };
}

// ---------------------------------------------------------------------------
// Venta, cotización y devolución
// ---------------------------------------------------------------------------

function payloadCotizacionCompleta(datos: CotizacionEntrada) {
  return {
    terminal_id: datos.terminal_id,
    ...payloadFuenteVenta(datos),
    ...(datos.contacto_id ? { contacto_id: datos.contacto_id } : {}),
    ...(datos.lista_precio_id ? { lista_precio_id: datos.lista_precio_id } : {}),
    ...(datos.fecha ? { fecha: datos.fecha } : {}),
    ...(datos.vencimiento ? { vencimiento: datos.vencimiento } : {}),
    ...(datos.vendedor_id ? { vendedor_id: datos.vendedor_id } : {}),
    ...(datos.notas ? { notas: datos.notas } : {}),
    ...(datos.terminos ? { terminos: datos.terminos } : {}),
  };
}

export async function completarVenta(entrada: unknown): Promise<ResultadoPOS<VentaPOSResultado>> {
  if (!puedeEscribir(await getRol())) return { ok: false, error: "No tienes permiso para vender." };

  const resultado = esquemaVenta.safeParse(entrada);
  if (!resultado.success) return { ok: false, error: mensajeValidacion(resultado.error) };

  const datos = resultado.data;
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("pos_completar_venta", { p: payloadVentaCompleta(datos) });

  if (error) return { ok: false, error: mensajeErrorRpc(error) };

  const parseo = esquemasRpcPOS.venta.safeParse(data);
  if (!parseo.success) return { ok: false, error: "La respuesta de la venta no tiene el formato esperado." };

  revalidatePath("/pos");
  revalidatePath("/pos/historial");
  revalidatePath("/pos/turnos");
  revalidatePath("/pos/devoluciones");
  revalidatePath("/dashboard/facturacion");
  revalidatePath("/dashboard/pagos-recibidos");
  revalidatePath("/dashboard/inventario");
  revalidatePath("/dashboard/bancos");
  revalidatePath("/dashboard/contabilidad/asientos");
  return { ok: true, data: mapearVentaPOS(parseo.data) };
}

export async function crearCotizacionPOS(entrada: unknown): Promise<ResultadoPOS<CotizacionPOSResultado>> {
  if (!puedeEscribir(await getRol())) return { ok: false, error: "No tienes permiso para crear cotizaciones." };

  const resultado = esquemaCotizacionPOS.safeParse(entrada);
  if (!resultado.success) return { ok: false, error: mensajeValidacion(resultado.error) };

  const datos = resultado.data;
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("pos_crear_cotizacion", { p: payloadCotizacionCompleta(datos) });

  if (error) return { ok: false, error: mensajeErrorRpc(error) };

  const parseo = esquemasRpcPOS.cotizacion.safeParse(data);
  if (!parseo.success) return { ok: false, error: "La respuesta de la cotización no tiene el formato esperado." };

  revalidatePath("/pos");
  revalidatePath("/dashboard/cotizaciones");
  return { ok: true, data: mapearCotizacionPOS(parseo.data) };
}

export async function crearDevolucionPOS(entrada: unknown): Promise<ResultadoPOS<DevolucionPOSResultado>> {
  if (!puedeEscribir(await getRol())) return { ok: false, error: "No tienes permiso para crear devoluciones." };

  const resultado = esquemaDevolucion.safeParse(entrada);
  if (!resultado.success) return { ok: false, error: mensajeValidacion(resultado.error) };

  const datos = resultado.data;
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("pos_crear_devolucion", {
    p: {
      terminal_id: datos.terminal_id,
      factura_id: datos.factura_id,
      tipo_reembolso: datos.tipo_reembolso,
      lineas: datos.lineas.map((linea) => ({
        factura_linea_id: linea.factura_linea_id,
        cantidad: linea.cantidad,
      })),
      ...(datos.turno_id ? { turno_id: datos.turno_id } : {}),
      ...(datos.fecha ? { fecha: datos.fecha } : {}),
      ...(datos.monto_reembolso_efectivo !== undefined
        ? { monto_reembolso_efectivo: datos.monto_reembolso_efectivo }
        : {}),
      ...(datos.cuenta_reembolso_id ? { cuenta_reembolso_id: datos.cuenta_reembolso_id } : {}),
      ...(datos.notas ? { notas: datos.notas } : {}),
    },
  });

  if (error) return { ok: false, error: mensajeErrorRpc(error) };

  const parseo = esquemasRpcPOS.devolucion.safeParse(data);
  if (!parseo.success) return { ok: false, error: "La respuesta de la devolución no tiene el formato esperado." };

  revalidatePath("/pos/devoluciones");
  revalidatePath("/pos/historial");
  revalidatePath("/pos/turnos");
  revalidatePath("/dashboard/notas-credito");
  revalidatePath("/dashboard/facturacion");
  revalidatePath("/dashboard/inventario");
  revalidatePath("/dashboard/contabilidad/asientos");
  return { ok: true, data: mapearDevolucionPOS(parseo.data) };
}
