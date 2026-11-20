"use server";

import { revalidatePath } from "next/cache";
import { cookies } from "next/headers";

import { getPerfil } from "@/lib/auth/rol";
import { getDocumentoVista } from "@/lib/cotizaciones/consultas";
import { getEmpresa, getFacturaVista } from "@/lib/facturacion/consultas";
import { centavosATexto, centavosDeDecimal } from "@/lib/pos/calculo";
import {
  buscarProductoPorCodigo,
  getCotizacionesAbiertas,
  getProductosPOS,
  getResumenTurno,
  getTerminal,
} from "@/lib/pos/consultas";
import type {
  CierreTurnoPOS,
  ContactoPOS,
  DevolucionPOSResultado,
  EmpresaPOS,
  FacturaPOS,
  ImpuestoPOS,
  LineaDevolucionPOS,
  LineaVenta,
  MetodoPagoDB,
  MetodoPOS,
  ResumenTurnoVista,
  TerminalPOSResumen,
  TotalesPOS,
  TurnoResumenPOS,
  VentaPOSResultado,
} from "@/lib/pos/tipos";

import {
  COOKIE_TERMINAL,
  getContextoPOS,
  getContextoVentaPOS,
  getCuentasPOS,
  getDatosDevolucionPOS,
  getDevolucionesPOS,
  getDevolucionPOS,
  getEfectivoDevueltoPOS,
  getFacturasCandidatasPOS,
} from "./servidor";
import type {
  DatosDevolucionPOS,
  DetalleVentaPOS,
  DevolucionPOSDetalle,
  DevolucionPOSFila,
  FacturaCandidataPOS,
} from "./tipos";

type Resultado<T> = { ok: true; data: T } | { ok: false; error: string };

function errorDe(error: unknown): string {
  if (error instanceof Error && error.message.trim() !== "") return error.message;
  return "No se pudo conectar con el servidor. Revisa tu conexión e inténtalo de nuevo.";
}

function decimalDe(valor: number | string | null | undefined): string {
  return centavosATexto(centavosDeDecimal(String(valor ?? 0)) ?? 0);
}

function saldoDe(total: string, pagado: string, credito: string, retenido: string): string {
  return centavosATexto(
    (centavosDeDecimal(total) ?? 0) -
      (centavosDeDecimal(pagado) ?? 0) -
      (centavosDeDecimal(credito) ?? 0) -
      (centavosDeDecimal(retenido) ?? 0),
  );
}

function empresaPOS(
  empresa: {
    id: number;
    nombre: string;
    rnc: string | null;
    direccion: string | null;
    telefono: string | null;
    correo: string | null;
    logo_url: string | null;
  } | null,
): EmpresaPOS | null {
  if (!empresa) return null;
  return {
    id: empresa.id,
    nombre: empresa.nombre.trim() === "" ? null : empresa.nombre,
    rnc: empresa.rnc,
    direccion: empresa.direccion,
    telefono: empresa.telefono,
    correo: empresa.correo,
    logo_url: empresa.logo_url,
  };
}

// ---------------------------------------------------------------------------
// Terminal y lecturas puntuales
// ---------------------------------------------------------------------------

export async function seleccionarTerminalPOS(terminalId: string): Promise<Resultado<{ id: string }>> {
  const perfil = await getPerfil();
  if (perfil?.rol == null) return { ok: false, error: "Sin permiso." };

  try {
    const terminal = await getTerminal(terminalId);
    if (!terminal || !terminal.activa) {
      return { ok: false, error: "La terminal no está activa. Elige otra terminal." };
    }

    const store = await cookies();
    store.set(COOKIE_TERMINAL, terminal.id, {
      httpOnly: true,
      sameSite: "lax",
      path: "/pos",
      maxAge: 60 * 60 * 24 * 365,
    });
    revalidatePath("/pos", "layout");
    return { ok: true, data: { id: terminal.id } };
  } catch (error) {
    return { ok: false, error: errorDe(error) };
  }
}

export async function buscarCatalogoPOS(
  entrada: unknown,
): Promise<Resultado<Awaited<ReturnType<typeof getProductosPOS>>>> {
  try {
    return { ok: true, data: await getProductosPOS(entrada) };
  } catch (error) {
    return { ok: false, error: errorDe(error) };
  }
}

export async function buscarCodigoPOS(
  entrada: unknown,
): Promise<Resultado<Awaited<ReturnType<typeof buscarProductoPorCodigo>>>> {
  try {
    return { ok: true, data: await buscarProductoPorCodigo(entrada) };
  } catch (error) {
    return { ok: false, error: errorDe(error) };
  }
}

export async function resumenTurnoPOS(turnoId: string): Promise<Resultado<ResumenTurnoVista | null>> {
  try {
    return { ok: true, data: await getResumenTurno(turnoId) };
  } catch (error) {
    return { ok: false, error: errorDe(error) };
  }
}

export async function cuentasTurnoPOS() {
  try {
    return { ok: true as const, data: await getCuentasPOS() };
  } catch (error) {
    return { ok: false as const, error: errorDe(error) };
  }
}

// ---------------------------------------------------------------------------
// Cotizaciones
// ---------------------------------------------------------------------------

export async function cotizacionesAbiertasPOS(q: string) {
  try {
    return { ok: true as const, data: await getCotizacionesAbiertas({ q }) };
  } catch (error) {
    return { ok: false as const, error: errorDe(error) };
  }
}

export async function cargarCotizacionPOS(
  id: string,
): Promise<Resultado<Awaited<ReturnType<typeof getDocumentoVista>>>> {
  try {
    const vista = await getDocumentoVista("cotizacion", id);
    if (!vista) return { ok: false, error: "La cotización no existe o no está abierta." };
    if (vista.documento.estado !== "abierta") {
      return { ok: false, error: "La cotización no existe o no está abierta." };
    }
    return { ok: true, data: vista };
  } catch (error) {
    return { ok: false, error: errorDe(error) };
  }
}

/** Payload listo para el ticket y el PDF Carta de una cotización recién creada. */
export async function notasCotizacionPOS(): Promise<Resultado<{ notas: string | null; terminos: string | null }>> {
  try {
    const { getPlantillaImpresion } = await import("@/lib/plantillas-impresion/consultas");
    const plantilla = await getPlantillaImpresion("cotizacion");
    return { ok: true, data: { notas: plantilla.notas, terminos: plantilla.terminos } };
  } catch (error) {
    return { ok: false, error: errorDe(error) };
  }
}

// ---------------------------------------------------------------------------
// Ventas del historial
// ---------------------------------------------------------------------------

export async function detalleVentaPOS(id: string): Promise<Resultado<DetalleVentaPOS | null>> {
  try {
    const contexto = await getContextoPOS();
    const vista = await getFacturaVista(id);
    if (!vista) return { ok: true, data: null };

    const complemento = await getContextoVentaPOS(id, contexto.terminal);
    const factura = vista.factura;
    const total = decimalDe(factura.total);
    const pagado = decimalDe(factura.pagado);
    const credito = decimalDe(factura.credito);
    const retenido = decimalDe(factura.retenido);

    return {
      ok: true,
      data: {
        factura: {
          id: factura.id,
          numero: factura.numero,
          ncf: factura.ncf,
          tipo_comprobante: factura.tipo_comprobante,
          fecha: factura.fecha,
          creado_en: complemento.creado_en,
          vencimiento: factura.vencimiento,
          estado: factura.estado,
          subtotal: decimalDe(factura.subtotal),
          descuento: decimalDe(factura.descuento),
          itbis: decimalDe(factura.itbis),
          otros_impuestos: decimalDe(factura.otros_impuestos),
          propina: decimalDe(factura.propina),
          total,
          pagado,
          retenido,
          credito,
          saldo: saldoDe(total, pagado, credito, retenido),
          monto_recibido: complemento.monto_recibido,
          cambio: complemento.cambio,
          notas: factura.notas,
          terminos: factura.terminos,
        },
        contacto: {
          id: vista.contacto.id,
          nombre: vista.contacto.nombre,
          rnc_cedula: vista.contacto.rnc_cedula,
          telefono: vista.contacto.telefono ?? null,
        },
        lineas: vista.lineas.map((linea) => ({
          id: linea.id,
          descripcion: linea.descripcion,
          cantidad: decimalDe(linea.cantidad),
          precio: decimalDe(linea.precio),
          descuento_pct: decimalDe(linea.descuento_pct),
          itbis_tasa: decimalDe(linea.itbis_tasa),
          subtotal: decimalDe(linea.subtotal),
          itbis: decimalDe(linea.itbis),
          total: decimalDe(linea.total),
          unidad_nombre: null,
        })),
        pagos: complemento.pagos,
        notas_credito: vista.notasCredito.map((nota) => ({
          id: nota.id,
          numero: nota.numero,
          ncf: nota.ncf,
          fecha: nota.fecha,
          total: decimalDe(nota.total),
          estado: nota.estado,
        })),
        terminal_nombre: complemento.turno?.terminal_nombre ?? contexto.terminal?.nombre ?? null,
        turno: complemento.turno,
        cajero: complemento.cajero,
        vendedor: complemento.vendedor,
      },
    };
  } catch (error) {
    return { ok: false, error: errorDe(error) };
  }
}

/** Reconstruye la venta con los datos actuales para reimprimir ticket o Carta. */
export async function ticketVentaPOS(id: string): Promise<Resultado<VentaPOSResultado | null>> {
  try {
    const contexto = await getContextoPOS();
    const vista = await getFacturaVista(id);
    if (!vista) return { ok: true, data: null };

    const complemento = await getContextoVentaPOS(id, contexto.terminal);
    const factura = vista.factura;
    const total = decimalDe(factura.total);
    const pagado = decimalDe(factura.pagado);
    const credito = decimalDe(factura.credito);
    const retenido = decimalDe(factura.retenido);

    const facturaPOS: FacturaPOS = {
      id: factura.id,
      numero: factura.numero,
      ncf: factura.ncf,
      tipo_comprobante: factura.tipo_comprobante,
      fecha: factura.fecha,
      vencimiento: factura.vencimiento,
      estado: factura.estado,
      subtotal: decimalDe(factura.subtotal),
      descuento: decimalDe(factura.descuento),
      itbis: decimalDe(factura.itbis),
      otros_impuestos: decimalDe(factura.otros_impuestos),
      propina: decimalDe(factura.propina),
      total,
      pagado,
      retenido,
      credito,
      saldo: saldoDe(total, pagado, credito, retenido),
      monto_recibido: complemento.monto_recibido,
      cambio: complemento.cambio,
      notas: factura.notas,
      terminos: factura.terminos,
      pie: factura.pie,
      origen: complemento.origen,
      turno_id: complemento.turno?.id ?? null,
      almacen_id: null,
      vendedor_id: factura.vendedor_id,
      centro_costo_id: factura.centro_costo_id,
      asiento_id: factura.asiento_id,
      creado_en: complemento.creado_en,
    };

    const contacto: ContactoPOS = {
      id: vista.contacto.id,
      nombre: vista.contacto.nombre,
      rnc_cedula: vista.contacto.rnc_cedula,
      direccion: vista.contacto.direccion,
      telefono: vista.contacto.telefono ?? null,
      correo: null,
      tipo_identificacion: null,
      lista_precio_id: vista.contacto.lista_precio_id ?? null,
      limite_credito: null,
    };

    const terminal: TerminalPOSResumen = {
      id: contexto.terminal?.id ?? "",
      nombre: complemento.turno?.terminal_nombre ?? contexto.terminal?.nombre ?? "—",
      almacen_id: contexto.terminal?.almacen_id ?? null,
      cuenta_efectivo_id: contexto.terminal?.cuenta_efectivo_id ?? null,
      plantilla_ticket: contexto.terminal?.plantilla_ticket ?? null,
    };

    const turno: TurnoResumenPOS = {
      id: complemento.turno?.id ?? "",
      numero: complemento.turno?.numero ?? 0,
      abierto_en: complemento.turno?.abierto_en ?? null,
      base_inicial: complemento.turno?.base_inicial ?? "0.00",
      efectivo_esperado_actual: complemento.turno?.efectivo_esperado ?? null,
      estado: null,
    };

    const lineas: LineaVenta[] = vista.lineas.map((linea) => ({
      id: linea.id,
      producto_id: linea.producto_id,
      producto_nombre: null,
      referencia: null,
      descripcion: linea.descripcion,
      cantidad: decimalDe(linea.cantidad),
      unidad_id: null,
      unidad_nombre: null,
      factor_base: null,
      precio: decimalDe(linea.precio),
      descuento_pct: decimalDe(linea.descuento_pct),
      itbis_tasa: decimalDe(linea.itbis_tasa),
      impuesto_id: linea.impuesto_id,
      subtotal: decimalDe(linea.subtotal),
      itbis: decimalDe(linea.itbis),
      total: decimalDe(linea.total),
      costo_unitario: null,
    }));

    const impuestos: ImpuestoPOS[] = vista.impuestos.map((impuesto) => ({
      id: impuesto.id,
      codigo: impuesto.codigo,
      nombre: impuesto.nombre,
      tipo: impuesto.tipo,
      tarifa: decimalDe(impuesto.tarifa),
      cuenta_id: impuesto.cuenta_id,
      activo: impuesto.activo,
      orden: impuesto.orden,
    }));

    const totales: TotalesPOS = {
      subtotal: decimalDe(factura.subtotal),
      descuento: decimalDe(factura.descuento),
      itbis: decimalDe(factura.itbis),
      otros_impuestos: decimalDe(factura.otros_impuestos),
      propina: decimalDe(factura.propina),
      total,
      pagado,
      credito,
      saldo: saldoDe(total, pagado, credito, retenido),
      monto_recibido: complemento.monto_recibido,
      cambio: complemento.cambio,
    };

    return {
      ok: true,
      data: {
        factura: facturaPOS,
        contacto,
        empresa: empresaPOS(vista.empresa),
        terminal,
        turno,
        cajero: complemento.cajero,
        vendedor:
          factura.vendedor_id && complemento.vendedor
            ? { id: factura.vendedor_id, nombre: complemento.vendedor }
            : null,
        almacen: null,
        lista_precio: null,
        lineas,
        pagos: complemento.pagos.map((pago) => ({
          id: pago.id,
          numero: pago.numero,
          fecha: pago.fecha,
          metodo: (pago.metodo === "tarjeta" || pago.metodo === "transferencia" || pago.metodo === "cheque"
            ? pago.metodo
            : "efectivo") as MetodoPagoDB,
          metodo_pos: pago.metodo_pos as MetodoPOS,
          cuenta_id: pago.cuenta_id,
          cuenta_nombre: pago.cuenta_nombre,
          monto: pago.monto,
          monto_recibido: pago.metodo === "efectivo" ? (complemento.monto_recibido ?? pago.monto) : "0.00",
          cambio: pago.metodo === "efectivo" ? (complemento.cambio ?? "0.00") : "0.00",
          estado: pago.estado,
        })),
        impuestos,
        totales,
        ncf_vence: vista.ncfVence,
      },
    };
  } catch (error) {
    return { ok: false, error: errorDe(error) };
  }
}

// ---------------------------------------------------------------------------
// Turnos
// ---------------------------------------------------------------------------

/** Ticket de cierre a partir del resumen congelado del turno. */
export async function ticketCierrePOS(turnoId: string): Promise<Resultado<CierreTurnoPOS | null>> {
  try {
    const vista = await getResumenTurno(turnoId);
    if (!vista) return { ok: false, error: "El turno no existe." };
    return {
      ok: true,
      data: {
        turno: vista.turno,
        terminal: vista.terminal,
        empresa: vista.empresa,
        resumen: vista.resumen,
        asiento_diferencia: null,
      },
    };
  } catch (error) {
    return { ok: false, error: errorDe(error) };
  }
}

export async function facturasCandidatasPOS(q: string): Promise<Resultado<FacturaCandidataPOS[]>> {
  try {
    return { ok: true, data: await getFacturasCandidatasPOS(q) };
  } catch (error) {
    return { ok: false, error: errorDe(error) };
  }
}

// ---------------------------------------------------------------------------
// Devoluciones
// ---------------------------------------------------------------------------

export async function datosDevolucionPOS(facturaId: string): Promise<Resultado<DatosDevolucionPOS | null>> {
  try {
    const datos = await getDatosDevolucionPOS(facturaId);
    if (!datos) return { ok: false, error: "La factura no existe o está anulada." };
    return { ok: true, data: datos };
  } catch (error) {
    return { ok: false, error: errorDe(error) };
  }
}

export async function detalleDevolucionPOS(id: string): Promise<Resultado<DevolucionPOSDetalle | null>> {
  try {
    return { ok: true, data: await getDevolucionPOS(id) };
  } catch (error) {
    return { ok: false, error: errorDe(error) };
  }
}

export async function devolucionesPOS(entrada: {
  q?: string;
  desde?: string;
  hasta?: string;
  estado?: "activa" | "anulada";
  pagina?: number;
  tamano?: number;
}): Promise<Resultado<{ filas: DevolucionPOSFila[] }>> {
  try {
    const resultado = await getDevolucionesPOS(entrada);
    return { ok: true, data: { filas: resultado.filas } };
  } catch (error) {
    return { ok: false, error: errorDe(error) };
  }
}

/** Ticket de una nota de crédito del POS con los datos actuales. */
export async function ticketDevolucionPOS(id: string): Promise<Resultado<DevolucionPOSResultado | null>> {
  try {
    const contexto = await getContextoPOS();
    const detalle = await getDevolucionPOS(id);
    if (!detalle || !detalle.nota.turno_id) return { ok: true, data: null };

    const resumenVista = await getResumenTurno(detalle.nota.turno_id);
    if (!resumenVista) return { ok: false, error: "El turno de la devolución no existe." };

    const cuentaNombre = detalle.nota.cuenta_reembolso_id
      ? ((await getCuentasPOS()).find((cuenta) => cuenta.id === detalle.nota.cuenta_reembolso_id)?.nombre ?? null)
      : null;

    const contacto: ContactoPOS | null = detalle.contacto
      ? {
          id: detalle.contacto.id,
          nombre: detalle.contacto.nombre,
          rnc_cedula: detalle.contacto.rnc_cedula,
          direccion: null,
          telefono: null,
          correo: null,
          tipo_identificacion: null,
          lista_precio_id: null,
          limite_credito: null,
        }
      : null;

    const lineas: LineaDevolucionPOS[] = detalle.lineas.map((linea) => ({
      factura_linea_id: linea.factura_linea_id,
      producto_id: linea.producto_id,
      descripcion: linea.descripcion,
      cantidad: linea.cantidad,
      unidad_nombre: linea.unidad_nombre,
      factor_base: linea.factor_base,
      precio: linea.precio,
      descuento_pct: linea.descuento_pct,
      itbis_tasa: linea.itbis_tasa,
      subtotal: linea.subtotal,
      itbis: linea.itbis,
      total: linea.total,
      costo_unitario: linea.costo_unitario,
    }));

    const empresa = resumenVista.empresa ?? empresaPOS(await getEmpresa());
    const efectivo = centavosDeDecimal(detalle.nota.monto_reembolso_efectivo) ?? 0;
    const total = centavosDeDecimal(detalle.nota.total) ?? 0;

    return {
      ok: true,
      data: {
        nota: {
          id: detalle.nota.id,
          numero: detalle.nota.numero,
          ncf: detalle.nota.ncf,
          factura_id: detalle.nota.factura_id,
          contacto_id: detalle.nota.contacto_id,
          fecha: detalle.nota.fecha,
          subtotal: detalle.nota.subtotal,
          itbis: detalle.nota.itbis,
          total: detalle.nota.total,
          estado: detalle.nota.estado === "anulada" ? "anulada" : "activa",
          devuelve_inventario: true,
          tipo_reembolso: detalle.nota.tipo_reembolso,
          monto_reembolso_efectivo: detalle.nota.monto_reembolso_efectivo,
          cuenta_reembolso_id: detalle.nota.cuenta_reembolso_id,
          turno_id: detalle.nota.turno_id,
          notas: detalle.nota.notas,
          asiento_id: null,
          asiento_reembolso_id: null,
        },
        factura: {
          id: detalle.factura.id,
          numero: detalle.factura.numero,
          ncf: detalle.factura.ncf,
          total: detalle.factura.total,
          pagado: detalle.factura.pagado,
          credito: detalle.factura.credito,
          estado: detalle.factura.estado,
          saldo: detalle.factura.saldo,
        },
        contacto,
        empresa,
        terminal: {
          id: contexto.terminal?.id ?? resumenVista.terminal.id,
          nombre: resumenVista.terminal.nombre,
          almacen_id: resumenVista.terminal.almacen_id ?? null,
          cuenta_efectivo_id: resumenVista.terminal.cuenta_efectivo_id ?? null,
          plantilla_ticket: contexto.terminal?.plantilla_ticket ?? resumenVista.terminal.plantilla_ticket ?? null,
        },
        turno: {
          id: resumenVista.turno.id,
          numero: resumenVista.turno.numero,
          base_inicial: resumenVista.turno.base_inicial,
          estado: resumenVista.turno.estado,
        },
        lineas,
        reembolso: {
          tipo: detalle.nota.tipo_reembolso,
          efectivo: centavosATexto(efectivo),
          credito: centavosATexto(Math.max(0, total - efectivo)),
          cuenta_id: detalle.nota.cuenta_reembolso_id,
          cuenta_nombre: cuentaNombre,
        },
        totales: {
          subtotal: detalle.nota.subtotal,
          itbis: detalle.nota.itbis,
          total: detalle.nota.total,
          efectivo: centavosATexto(efectivo),
          credito: centavosATexto(Math.max(0, total - efectivo)),
        },
        resumen: resumenVista.resumen,
      },
    };
  } catch (error) {
    return { ok: false, error: errorDe(error) };
  }
}

export async function efectivoDevueltoPOS(facturaId: string): Promise<Resultado<string>> {
  try {
    return { ok: true, data: await getEfectivoDevueltoPOS(facturaId) };
  } catch (error) {
    return { ok: false, error: errorDe(error) };
  }
}

export type { DevolucionPOSFila };
