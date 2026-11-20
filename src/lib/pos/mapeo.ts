import { z } from "zod";

import { decimal, decimalONulo, textoONulo } from "@/lib/inventario/ferreteria/mapeo";

import { centavosATexto, centavosDeDecimal } from "./calculo";
import { esquemaPlantillaTicket, type PlantillaTicketEntrada } from "./esquemas";
import {
  ANCHOS_TICKET,
  type AperturaTurnoPOS,
  type CierreTurnoPOS,
  type ContactoPOS,
  type CotizacionAbiertaPOS,
  type CotizacionPOSResultado,
  type DevolucionPOSResultado,
  type EmpresaPOS,
  ESTILOS_TICKET,
  type EstadoFacturaPOS,
  type EstadoNotaPOS,
  type EstadoTurnoPOS,
  type FacturaPOS,
  FUENTES_TICKET,
  type HistorialPOSFila,
  type ImpuestoPOS,
  INTERLINEADOS_TICKET,
  type LineaVenta,
  METODOS_PAGO_DB,
  METODOS_POS,
  type MetodoPagoDB,
  type MotivoMovimientoPOS,
  type MovimientoTurnoPOS,
  type MovimientoTurnoPOSResultado,
  type PagoVenta,
  PLANTILLA_TICKET_DEFECTO,
  type PlantillaTicket,
  type ResumenTurno,
  type ResumenTurnoVista,
  TAMANOS_LETRA_TICKET,
  type TerminalPOS,
  type TerminalPOSResumen,
  type TipoMovimientoPOS,
  type TipoReembolsoPOS,
  type TotalesPOS,
  type TurnoPOS,
  type TurnoResumenPOS,
  type VentaPOSResultado,
} from "./tipos";

// ---------------------------------------------------------------------------
// Plantilla del ticket
// ---------------------------------------------------------------------------

const plantillaCompletaSchema = z.object({
  estilo: z.enum(ESTILOS_TICKET),
  ancho_mm: z.union([z.literal(ANCHOS_TICKET[0]), z.literal(ANCHOS_TICKET[1])]),
  fuente: z.enum(FUENTES_TICKET),
  tamano_letra: z.enum(TAMANOS_LETRA_TICKET),
  interlineado: z.enum(INTERLINEADOS_TICKET),
  mostrar_logo: z.boolean(),
  mostrar_vendedor: z.boolean(),
  mostrar_descripcion: z.boolean(),
  mostrar_referencia: z.boolean(),
  mostrar_precio_unitario: z.boolean(),
  mostrar_unidad: z.boolean(),
  precios_con_impuestos: z.boolean(),
  pie_ticket: z.string().nullable(),
});

function completarPlantilla(datos: PlantillaTicketEntrada): PlantillaTicket {
  return {
    estilo: datos.estilo ?? PLANTILLA_TICKET_DEFECTO.estilo,
    ancho_mm: datos.ancho_mm ?? PLANTILLA_TICKET_DEFECTO.ancho_mm,
    fuente: datos.fuente ?? PLANTILLA_TICKET_DEFECTO.fuente,
    tamano_letra: datos.tamano_letra ?? PLANTILLA_TICKET_DEFECTO.tamano_letra,
    interlineado: datos.interlineado ?? PLANTILLA_TICKET_DEFECTO.interlineado,
    mostrar_logo: datos.mostrar_logo ?? PLANTILLA_TICKET_DEFECTO.mostrar_logo,
    mostrar_vendedor: datos.mostrar_vendedor ?? PLANTILLA_TICKET_DEFECTO.mostrar_vendedor,
    mostrar_descripcion: datos.mostrar_descripcion ?? PLANTILLA_TICKET_DEFECTO.mostrar_descripcion,
    mostrar_referencia: datos.mostrar_referencia ?? PLANTILLA_TICKET_DEFECTO.mostrar_referencia,
    mostrar_precio_unitario: datos.mostrar_precio_unitario ?? PLANTILLA_TICKET_DEFECTO.mostrar_precio_unitario,
    mostrar_unidad: datos.mostrar_unidad ?? PLANTILLA_TICKET_DEFECTO.mostrar_unidad,
    precios_con_impuestos: datos.precios_con_impuestos ?? PLANTILLA_TICKET_DEFECTO.precios_con_impuestos,
    pie_ticket: datos.pie_ticket === undefined ? PLANTILLA_TICKET_DEFECTO.pie_ticket : datos.pie_ticket,
  };
}

/**
 * Plantilla lista para imprimir. Si la fila trae una plantilla incompleta o
 * inválida se completa con el default; imprimir nunca falla por una plantilla
 * ausente (`docs/diseno/pos-ui.md` §8.5).
 */
export function normalizarPlantilla(valor: unknown): PlantillaTicket {
  const completa = plantillaCompletaSchema.safeParse(valor);
  if (completa.success) return completa.data;

  const parcial = esquemaPlantillaTicket.safeParse(valor ?? {});
  return parcial.success ? completarPlantilla(parcial.data) : PLANTILLA_TICKET_DEFECTO;
}

// ---------------------------------------------------------------------------
// Filas de tablas (lecturas directas)
// ---------------------------------------------------------------------------

export interface FilaTerminal {
  id: string;
  nombre: string;
  almacen_id: string;
  cuenta_efectivo_id: string;
  cuenta_tarjeta_debito_id: string | null;
  cuenta_tarjeta_credito_id: string | null;
  cuenta_transferencia_id: string | null;
  numeracion_defecto_id: string;
  lista_precio_defecto_id: string | null;
  contacto_defecto_id: string;
  centro_costo_id: string | null;
  plantilla_ticket: unknown;
  activa: boolean;
  creado_en: string;
  actualizado_en: string;
}

export interface FilaTurno {
  id: string;
  numero: number;
  terminal_id: string;
  abierto_por: string;
  cerrado_por: string | null;
  abierto_en: string;
  cerrado_en: string | null;
  estado: string;
  base_inicial: number | string;
  efectivo_esperado: number | string | null;
  efectivo_real: number | string | null;
  diferencia: number | string | null;
  asiento_diferencia_id: string | null;
  observaciones: string | null;
}

export interface FilaHistorialPOS {
  id: string;
  numero: number;
  ncf: string | null;
  tipo_comprobante: string;
  fecha: string;
  creado_en: string | null;
  contacto_id: string;
  turno_id: string | null;
  estado: string;
  total: number | string;
  pagado: number | string;
  retenido: number | string;
  credito: number | string;
  contactos: { nombre: string } | null;
  pos_turnos: {
    numero: number;
    pos_terminales: { id: string; nombre: string } | null;
  } | null;
}

export interface FilaCotizacionAbierta {
  id: string;
  numero: number;
  contacto_id: string;
  fecha: string;
  vencimiento: string;
  total: number | string;
  estado: string;
  vendedor_id: string | null;
  contactos: { nombre: string } | null;
}

function estadoTurno(valor: string | null | undefined): EstadoTurnoPOS {
  return valor === "cerrado" ? "cerrado" : "abierto";
}

function estadoFactura(valor: string | null | undefined): EstadoFacturaPOS {
  return valor === "anulada" || valor === "pagada" ? valor : "abierta";
}

function estadoNota(valor: string | null | undefined): EstadoNotaPOS {
  return valor === "anulada" ? "anulada" : "activa";
}

function metodoPagoDB(valor: string | null | undefined): MetodoPagoDB {
  return valor === "tarjeta" || valor === "transferencia" || valor === "cheque" ? valor : "efectivo";
}

export { metodoPagoDB };

function motivoMovimiento(valor: string | null | undefined): MotivoMovimientoPOS {
  if (
    valor === "fondo_caja" ||
    valor === "cobro_factura" ||
    valor === "retiro_caja" ||
    valor === "gasto_menor" ||
    valor === "deposito_banco" ||
    valor === "otro"
  ) {
    return valor;
  }
  return "otro";
}

function tipoMovimiento(valor: string | null | undefined): TipoMovimientoPOS {
  return valor === "retiro" ? "retiro" : "ingreso";
}

function tipoReembolso(valor: string | null | undefined): TipoReembolsoPOS {
  return valor === "efectivo" || valor === "combinado" ? valor : "credito_factura";
}

// ---------------------------------------------------------------------------
// Mapeadores de filas
// ---------------------------------------------------------------------------

export function mapearTerminal(fila: FilaTerminal): TerminalPOS {
  return {
    id: fila.id,
    nombre: fila.nombre,
    almacen_id: fila.almacen_id,
    cuenta_efectivo_id: fila.cuenta_efectivo_id,
    cuenta_tarjeta_debito_id: fila.cuenta_tarjeta_debito_id,
    cuenta_tarjeta_credito_id: fila.cuenta_tarjeta_credito_id,
    cuenta_transferencia_id: fila.cuenta_transferencia_id,
    numeracion_defecto_id: fila.numeracion_defecto_id,
    lista_precio_defecto_id: fila.lista_precio_defecto_id,
    contacto_defecto_id: fila.contacto_defecto_id,
    centro_costo_id: fila.centro_costo_id,
    plantilla_ticket: normalizarPlantilla(fila.plantilla_ticket),
    activa: fila.activa,
    creado_en: fila.creado_en,
    actualizado_en: fila.actualizado_en,
  };
}

export function mapearTurno(fila: FilaTurno): TurnoPOS {
  return {
    id: fila.id,
    numero: fila.numero,
    terminal_id: fila.terminal_id,
    abierto_por: fila.abierto_por,
    cerrado_por: fila.cerrado_por,
    abierto_en: fila.abierto_en,
    cerrado_en: fila.cerrado_en,
    estado: estadoTurno(fila.estado),
    base_inicial: decimal(fila.base_inicial),
    efectivo_esperado: decimalONulo(fila.efectivo_esperado),
    efectivo_real: decimalONulo(fila.efectivo_real),
    diferencia: decimalONulo(fila.diferencia),
    asiento_diferencia_id: fila.asiento_diferencia_id,
    observaciones: textoONulo(fila.observaciones),
  };
}

export function mapearHistorialPOS(fila: FilaHistorialPOS, metodos: readonly MetodoPagoDB[]): HistorialPOSFila {
  const total = decimal(fila.total);
  const pagado = decimal(fila.pagado);
  const retenido = decimal(fila.retenido);
  const credito = decimal(fila.credito);

  const saldoCentavos =
    (centavosDeDecimal(total) ?? 0) -
    (centavosDeDecimal(pagado) ?? 0) -
    (centavosDeDecimal(retenido) ?? 0) -
    (centavosDeDecimal(credito) ?? 0);

  return {
    id: fila.id,
    numero: fila.numero,
    ncf: textoONulo(fila.ncf),
    tipo_comprobante: fila.tipo_comprobante,
    fecha: fila.fecha,
    creado_en: fila.creado_en,
    contacto_id: fila.contacto_id,
    cliente_nombre: fila.contactos?.nombre ?? "—",
    terminal_id: fila.pos_turnos?.pos_terminales?.id ?? null,
    terminal_nombre: fila.pos_turnos?.pos_terminales?.nombre ?? null,
    turno_id: fila.turno_id,
    turno_numero: fila.pos_turnos?.numero ?? null,
    estado: estadoFactura(fila.estado),
    total,
    pagado,
    retenido,
    credito,
    saldo: centavosATexto(saldoCentavos),
    metodos: [...new Set(metodos)],
  };
}

export function mapearCotizacionAbierta(fila: FilaCotizacionAbierta): CotizacionAbiertaPOS {
  return {
    id: fila.id,
    numero: fila.numero,
    contacto_id: fila.contacto_id,
    cliente_nombre: fila.contactos?.nombre ?? "—",
    fecha: fila.fecha,
    vencimiento: fila.vencimiento,
    total: decimal(fila.total),
    estado: fila.estado,
    vendedor_id: fila.vendedor_id,
  };
}

// ---------------------------------------------------------------------------
// Esquemas de las respuestas JSON de las RPC
// ---------------------------------------------------------------------------

const numero = z.union([z.number(), z.string()]);
const numeroNulo = numero.nullable();

const esquemaEmpresaJson = z.object({
  id: z.number(),
  nombre: z.string().nullable(),
  rnc: z.string().nullable(),
  direccion: z.string().nullable(),
  telefono: z.string().nullable(),
  correo: z.string().nullable(),
  logo_url: z.string().nullable(),
});

const esquemaContactoJson = z.object({
  id: z.string(),
  nombre: z.string(),
  rnc_cedula: z.string().nullable(),
  direccion: z.string().nullable(),
  telefono: z.string().nullable().optional(),
  correo: z.string().nullable().optional(),
  tipo_identificacion: z.string().nullable().optional(),
  lista_precio_id: z.string().nullable().optional(),
  limite_credito: numeroNulo.optional(),
});

const esquemaTerminalResumenJson = z.object({
  id: z.string(),
  nombre: z.string(),
  almacen_id: z.string().nullable().optional(),
  cuenta_efectivo_id: z.string().nullable().optional(),
  plantilla_ticket: z.unknown().optional(),
});

const esquemaTurnoResumenJson = z.object({
  id: z.string(),
  numero: z.number(),
  terminal_id: z.string().optional(),
  abierto_por: z.string().optional(),
  abierto_en: z.string().nullable().optional(),
  base_inicial: numero,
  estado: z.string().nullable().optional(),
  efectivo_esperado_actual: numeroNulo.optional(),
});

const esquemaTurnoCompletoJson = esquemaTurnoResumenJson.extend({
  terminal_id: z.string(),
  abierto_por: z.string(),
  abierto_en: z.string(),
  cerrado_por: z.string().nullable().optional(),
  cerrado_en: z.string().nullable().optional(),
  efectivo_esperado: numeroNulo.optional(),
  efectivo_real: numeroNulo.optional(),
  diferencia: numeroNulo.optional(),
  asiento_diferencia_id: z.string().nullable().optional(),
  observaciones: z.string().nullable().optional(),
});

const esquemaLineaJson = z.object({
  id: z.string(),
  producto_id: z.string().nullable(),
  producto_nombre: z.string().nullable().optional(),
  referencia: z.string().nullable().optional(),
  descripcion: z.string(),
  cantidad: numero,
  unidad_id: z.string().nullable().optional(),
  unidad_nombre: z.string().nullable().optional(),
  factor_base: numeroNulo.optional(),
  precio: numero,
  descuento_pct: numero,
  itbis_tasa: numero,
  impuesto_id: z.string().nullable().optional(),
  subtotal: numero,
  itbis: numero,
  total: numero,
  costo_unitario: numeroNulo.optional(),
});

const esquemaPagoJson = z.object({
  id: z.string(),
  numero: z.number(),
  fecha: z.string(),
  metodo: z.enum(METODOS_PAGO_DB),
  metodo_pos: z.enum(METODOS_POS),
  cuenta_id: z.string(),
  cuenta_nombre: z.string().nullable(),
  monto: numero,
  monto_recibido: numero,
  cambio: numero,
  estado: z.string(),
});

const esquemaImpuestoJson = z.object({
  id: z.string(),
  codigo: z.string(),
  nombre: z.string(),
  tipo: z.string(),
  tarifa: numero,
  cuenta_id: z.string().nullable(),
  activo: z.boolean(),
  orden: z.number(),
});

const esquemaTotalesJson = z.object({
  subtotal: numero,
  descuento: numero,
  itbis: numero,
  otros_impuestos: numero,
  propina: numero,
  total: numero,
  pagado: numero.optional(),
  retenido: numero.optional(),
  credito: numero.optional(),
  saldo: numero.optional(),
  monto_recibido: numeroNulo.optional(),
  cambio: numeroNulo.optional(),
});

const esquemaFacturaJson = z.object({
  id: z.string(),
  numero: z.number(),
  ncf: z.string().nullable(),
  tipo_comprobante: z.string(),
  fecha: z.string(),
  vencimiento: z.string(),
  estado: z.string(),
  subtotal: numero,
  descuento: numero,
  itbis: numero,
  otros_impuestos: numero,
  propina: numero,
  total: numero,
  pagado: numero,
  retenido: numero,
  credito: numero,
  saldo: numero,
  monto_recibido: numeroNulo,
  cambio: numeroNulo,
  notas: z.string().nullable(),
  terminos: z.string().nullable(),
  pie: z.string().nullable(),
  origen: z.string(),
  turno_id: z.string().nullable(),
  almacen_id: z.string().nullable(),
  vendedor_id: z.string().nullable(),
  centro_costo_id: z.string().nullable(),
  asiento_id: z.string().nullable(),
  creado_en: z.string().nullable().optional(),
});

const esquemaMovimientoJson = z.object({
  id: z.string(),
  numero: z.number(),
  turno_id: z.string(),
  tipo: z.string(),
  motivo: z.string(),
  monto: numero,
  cuenta_contrapartida_id: z.string(),
  cuenta_nombre: z.string().nullable(),
  contacto_id: z.string().nullable(),
  factura_id: z.string().nullable(),
  factura_numero: z.number().nullable(),
  pago_recibido_id: z.string().nullable(),
  gasto_menor_id: z.string().nullable(),
  asiento_id: z.string(),
  notas: z.string().nullable(),
  creado_en: z.string(),
  creado_por: z.string(),
  vigente: z.boolean(),
});

const esquemaResumenJson = z.object({
  ventas: z.object({
    total: numero,
    cantidad: z.number(),
    cobrado: numero,
    por_metodo: z.object({
      efectivo: numero,
      tarjeta: numero,
      transferencia: numero,
      credito: numero,
    }),
    por_cuenta: z.array(
      z.object({
        cuenta_id: z.string(),
        cuenta_nombre: z.string().nullable(),
        metodo: z.enum(METODOS_PAGO_DB),
        monto: numero,
      }),
    ),
  }),
  ingresos: z.object({
    total: numero,
    cantidad: z.number(),
    por_motivo: z.object({
      fondo_caja: numero,
      cobro_factura: numero,
      otro: numero,
    }),
  }),
  retiros: z.object({
    total: numero,
    cantidad: z.number(),
    por_motivo: z.object({
      retiro_caja: numero,
      gasto_menor: numero,
      deposito_banco: numero,
      otro: numero,
    }),
  }),
  devoluciones: z.object({
    cantidad: z.number(),
    total: numero,
    efectivo: numero,
    credito: numero,
  }),
  efectivo: z.object({
    base_inicial: numero,
    ventas_efectivo: numero,
    ingresos_efectivo: numero,
    retiros_efectivo: numero,
    devoluciones_efectivo: numero,
    efectivo_esperado: numero,
    efectivo_real: numeroNulo,
    diferencia: numeroNulo,
    congelado: z.boolean(),
  }),
  movimientos: z.array(esquemaMovimientoJson),
});

const esquemaResumenTurnoVistaJson = z.object({
  turno: esquemaTurnoCompletoJson,
  terminal: esquemaTerminalResumenJson,
  empresa: esquemaEmpresaJson.nullable(),
  resumen: esquemaResumenJson,
});

const esquemaVentaJson = z.object({
  factura: esquemaFacturaJson,
  contacto: esquemaContactoJson,
  empresa: esquemaEmpresaJson.nullable(),
  terminal: esquemaTerminalResumenJson,
  turno: esquemaTurnoResumenJson,
  cajero: z.string().nullable().optional(),
  vendedor: z.object({ id: z.string(), nombre: z.string() }).nullable().optional(),
  almacen: z.object({ id: z.string(), nombre: z.string() }).nullable().optional(),
  lista_precio: z.object({ id: z.string(), nombre: z.string() }).nullable().optional(),
  lineas: z.array(esquemaLineaJson),
  pagos: z.array(esquemaPagoJson),
  impuestos: z.array(esquemaImpuestoJson),
  totales: esquemaTotalesJson,
  ncf_vence: z.string().nullable().optional(),
});

const esquemaCotizacionJson = z.object({
  cotizacion: z.object({
    id: z.string(),
    numero: z.number(),
    contacto_id: z.string(),
    fecha: z.string(),
    vencimiento: z.string(),
    estado: z.string(),
    subtotal: numero,
    descuento: numero,
    itbis: numero,
    otros_impuestos: numero,
    propina: numero,
    total: numero,
    notas: z.string().nullable(),
    terminos: z.string().nullable(),
    vendedor_id: z.string().nullable(),
    centro_costo_id: z.string().nullable(),
    origen: z.string(),
    turno_id: z.string().nullable(),
  }),
  contacto: esquemaContactoJson,
  empresa: esquemaEmpresaJson.nullable(),
  terminal: esquemaTerminalResumenJson,
  turno: esquemaTurnoResumenJson.nullable(),
  vendedor: z.object({ id: z.string(), nombre: z.string() }).nullable().optional(),
  lineas: z.array(esquemaLineaJson),
  impuestos: z.array(esquemaImpuestoJson),
  totales: esquemaTotalesJson,
  plantilla_ticket: z.unknown(),
  lista_precio: z.object({ id: z.string(), nombre: z.string() }).nullable().optional(),
});

const esquemaDevolucionJson = z.object({
  nota: z.object({
    id: z.string(),
    numero: z.number(),
    ncf: z.string(),
    factura_id: z.string(),
    contacto_id: z.string(),
    fecha: z.string(),
    subtotal: numero,
    itbis: numero,
    total: numero,
    estado: z.string(),
    devuelve_inventario: z.boolean(),
    tipo_reembolso: z.string(),
    monto_reembolso_efectivo: numero,
    cuenta_reembolso_id: z.string().nullable(),
    turno_id: z.string().nullable(),
    notas: z.string().nullable(),
    asiento_id: z.string().nullable().optional(),
    asiento_reembolso_id: z.string().nullable().optional(),
  }),
  factura: z.object({
    id: z.string(),
    numero: z.number(),
    ncf: z.string().nullable(),
    total: numero,
    pagado: numero,
    credito: numero,
    estado: z.string(),
    saldo: numero,
  }),
  contacto: esquemaContactoJson.nullable(),
  empresa: esquemaEmpresaJson.nullable(),
  terminal: esquemaTerminalResumenJson,
  turno: esquemaTurnoResumenJson,
  lineas: z.array(
    z.object({
      factura_linea_id: z.string(),
      producto_id: z.string().nullable(),
      descripcion: z.string(),
      cantidad: numero,
      unidad_nombre: z.string().nullable().optional(),
      factor_base: numeroNulo.optional(),
      precio: numero,
      descuento_pct: numero,
      itbis_tasa: numero,
      subtotal: numero,
      itbis: numero,
      total: numero,
      costo_unitario: numeroNulo.optional(),
    }),
  ),
  reembolso: z.object({
    tipo: z.string(),
    efectivo: numero,
    credito: numero,
    cuenta_id: z.string().nullable(),
    cuenta_nombre: z.string().nullable(),
  }),
  totales: z.object({
    subtotal: numero,
    itbis: numero,
    total: numero,
    efectivo: numero,
    credito: numero,
  }),
  resumen: esquemaResumenJson,
});

const esquemaAsientoJson = z.object({
  id: z.string(),
  numero: z.number(),
  fecha: z.string(),
  descripcion: z.string(),
  total: numero,
});

const esquemaAperturaJson = z.object({
  turno: esquemaTurnoCompletoJson,
  terminal: esquemaTerminalResumenJson,
  empresa: esquemaEmpresaJson.nullable(),
  resumen: esquemaResumenJson,
});

const esquemaMovimientoResultadoJson = z.object({
  movimiento: esquemaMovimientoJson.extend({
    vigente: z.boolean().optional(),
    factura_ncf: z.string().nullable().optional(),
    cajero: z.string().nullable().optional(),
  }),
  turno: esquemaTurnoResumenJson,
  terminal: esquemaTerminalResumenJson,
  empresa: esquemaEmpresaJson.nullable(),
  asiento: esquemaAsientoJson.nullable(),
  plantilla_ticket: z.unknown(),
  resumen: esquemaResumenJson,
});

const esquemaCierreJson = z.object({
  turno: esquemaTurnoCompletoJson,
  terminal: esquemaTerminalResumenJson,
  empresa: esquemaEmpresaJson.nullable(),
  resumen: esquemaResumenJson,
  asiento_diferencia: esquemaAsientoJson.nullable(),
});

export type VentaJson = z.infer<typeof esquemaVentaJson>;
export type CotizacionJson = z.infer<typeof esquemaCotizacionJson>;
export type DevolucionJson = z.infer<typeof esquemaDevolucionJson>;
export type AperturaJson = z.infer<typeof esquemaAperturaJson>;
export type MovimientoResultadoJson = z.infer<typeof esquemaMovimientoResultadoJson>;
export type CierreJson = z.infer<typeof esquemaCierreJson>;
export type ResumenTurnoVistaJson = z.infer<typeof esquemaResumenTurnoVistaJson>;

export const esquemasRpcPOS = {
  venta: esquemaVentaJson,
  cotizacion: esquemaCotizacionJson,
  devolucion: esquemaDevolucionJson,
  apertura: esquemaAperturaJson,
  movimiento: esquemaMovimientoResultadoJson,
  cierre: esquemaCierreJson,
  resumen: esquemaResumenTurnoVistaJson,
};

// ---------------------------------------------------------------------------
// Mapeadores de las RPC
// ---------------------------------------------------------------------------

function mapearEmpresa(fila: z.infer<typeof esquemaEmpresaJson> | null): EmpresaPOS | null {
  if (!fila) return null;
  return {
    id: fila.id,
    nombre: textoONulo(fila.nombre),
    rnc: textoONulo(fila.rnc),
    direccion: textoONulo(fila.direccion),
    telefono: textoONulo(fila.telefono),
    correo: textoONulo(fila.correo),
    logo_url: textoONulo(fila.logo_url),
  };
}

function mapearContacto(fila: z.infer<typeof esquemaContactoJson>): ContactoPOS {
  return {
    id: fila.id,
    nombre: fila.nombre,
    rnc_cedula: textoONulo(fila.rnc_cedula),
    direccion: textoONulo(fila.direccion),
    telefono: textoONulo(fila.telefono),
    correo: textoONulo(fila.correo),
    tipo_identificacion: textoONulo(fila.tipo_identificacion),
    lista_precio_id: fila.lista_precio_id ?? null,
    limite_credito: decimalONulo(fila.limite_credito),
  };
}

function mapearTerminalResumen(fila: z.infer<typeof esquemaTerminalResumenJson>): TerminalPOSResumen {
  return {
    id: fila.id,
    nombre: fila.nombre,
    almacen_id: fila.almacen_id ?? null,
    cuenta_efectivo_id: fila.cuenta_efectivo_id ?? null,
    plantilla_ticket: fila.plantilla_ticket === undefined ? null : normalizarPlantilla(fila.plantilla_ticket),
  };
}

function mapearTurnoCompleto(fila: z.infer<typeof esquemaTurnoCompletoJson>): TurnoPOS {
  return {
    id: fila.id,
    numero: fila.numero,
    terminal_id: fila.terminal_id,
    abierto_por: fila.abierto_por,
    cerrado_por: fila.cerrado_por ?? null,
    abierto_en: fila.abierto_en,
    cerrado_en: fila.cerrado_en ?? null,
    estado: estadoTurno(fila.estado),
    base_inicial: decimal(fila.base_inicial),
    efectivo_esperado: decimalONulo(fila.efectivo_esperado),
    efectivo_real: decimalONulo(fila.efectivo_real),
    diferencia: decimalONulo(fila.diferencia),
    asiento_diferencia_id: fila.asiento_diferencia_id ?? null,
    observaciones: textoONulo(fila.observaciones),
  };
}

function estadoTurnoOpcional(valor: string | null | undefined): EstadoTurnoPOS | null {
  if (valor === "abierto" || valor === "cerrado") return valor;
  return null;
}

function mapearTurnoResumen(fila: z.infer<typeof esquemaTurnoResumenJson>): TurnoResumenPOS {
  return {
    id: fila.id,
    numero: fila.numero,
    abierto_en: fila.abierto_en ?? null,
    base_inicial: decimal(fila.base_inicial),
    efectivo_esperado_actual: decimalONulo(fila.efectivo_esperado_actual),
    estado: estadoTurnoOpcional(fila.estado),
  };
}

function mapearResumen(fila: z.infer<typeof esquemaResumenJson>): ResumenTurno {
  return {
    ventas: {
      total: decimal(fila.ventas.total),
      cantidad: fila.ventas.cantidad,
      cobrado: decimal(fila.ventas.cobrado),
      por_metodo: {
        efectivo: decimal(fila.ventas.por_metodo.efectivo),
        tarjeta: decimal(fila.ventas.por_metodo.tarjeta),
        transferencia: decimal(fila.ventas.por_metodo.transferencia),
        credito: decimal(fila.ventas.por_metodo.credito),
      },
      por_cuenta: fila.ventas.por_cuenta.map((cuenta) => ({
        cuenta_id: cuenta.cuenta_id,
        cuenta_nombre: textoONulo(cuenta.cuenta_nombre),
        metodo: cuenta.metodo,
        monto: decimal(cuenta.monto),
      })),
    },
    ingresos: {
      total: decimal(fila.ingresos.total),
      cantidad: fila.ingresos.cantidad,
      por_motivo: {
        fondo_caja: decimal(fila.ingresos.por_motivo.fondo_caja),
        cobro_factura: decimal(fila.ingresos.por_motivo.cobro_factura),
        otro: decimal(fila.ingresos.por_motivo.otro),
      },
    },
    retiros: {
      total: decimal(fila.retiros.total),
      cantidad: fila.retiros.cantidad,
      por_motivo: {
        retiro_caja: decimal(fila.retiros.por_motivo.retiro_caja),
        gasto_menor: decimal(fila.retiros.por_motivo.gasto_menor),
        deposito_banco: decimal(fila.retiros.por_motivo.deposito_banco),
        otro: decimal(fila.retiros.por_motivo.otro),
      },
    },
    devoluciones: {
      cantidad: fila.devoluciones.cantidad,
      total: decimal(fila.devoluciones.total),
      efectivo: decimal(fila.devoluciones.efectivo),
      credito: decimal(fila.devoluciones.credito),
    },
    efectivo: {
      base_inicial: decimal(fila.efectivo.base_inicial),
      ventas_efectivo: decimal(fila.efectivo.ventas_efectivo),
      ingresos_efectivo: decimal(fila.efectivo.ingresos_efectivo),
      retiros_efectivo: decimal(fila.efectivo.retiros_efectivo),
      devoluciones_efectivo: decimal(fila.efectivo.devoluciones_efectivo),
      efectivo_esperado: decimal(fila.efectivo.efectivo_esperado),
      efectivo_real: decimalONulo(fila.efectivo.efectivo_real),
      diferencia: decimalONulo(fila.efectivo.diferencia),
      congelado: fila.efectivo.congelado,
    },
    movimientos: fila.movimientos.map(mapearMovimiento),
  };
}

function mapearMovimiento(fila: z.infer<typeof esquemaMovimientoJson>): MovimientoTurnoPOS {
  return {
    id: fila.id,
    numero: fila.numero,
    turno_id: fila.turno_id,
    tipo: tipoMovimiento(fila.tipo),
    motivo: motivoMovimiento(fila.motivo),
    monto: decimal(fila.monto),
    cuenta_contrapartida_id: fila.cuenta_contrapartida_id,
    cuenta_nombre: textoONulo(fila.cuenta_nombre),
    contacto_id: fila.contacto_id,
    factura_id: fila.factura_id,
    factura_numero: fila.factura_numero,
    pago_recibido_id: fila.pago_recibido_id,
    gasto_menor_id: fila.gasto_menor_id,
    asiento_id: fila.asiento_id,
    notas: textoONulo(fila.notas),
    creado_en: fila.creado_en,
    creado_por: fila.creado_por,
    vigente: fila.vigente,
  };
}

function mapearTotales(fila: z.infer<typeof esquemaTotalesJson>): TotalesPOS {
  return {
    subtotal: decimal(fila.subtotal),
    descuento: decimal(fila.descuento),
    itbis: decimal(fila.itbis),
    otros_impuestos: decimal(fila.otros_impuestos),
    propina: decimal(fila.propina),
    total: decimal(fila.total),
    pagado: fila.pagado === undefined ? undefined : decimal(fila.pagado),
    retenido: fila.retenido === undefined ? undefined : decimal(fila.retenido),
    credito: fila.credito === undefined ? undefined : decimal(fila.credito),
    saldo: fila.saldo === undefined ? undefined : decimal(fila.saldo),
    monto_recibido: decimalONulo(fila.monto_recibido),
    cambio: decimalONulo(fila.cambio),
  };
}

function mapearLinea(fila: z.infer<typeof esquemaLineaJson>): LineaVenta {
  return {
    id: fila.id,
    producto_id: fila.producto_id,
    producto_nombre: textoONulo(fila.producto_nombre),
    referencia: textoONulo(fila.referencia),
    descripcion: fila.descripcion,
    cantidad: decimal(fila.cantidad),
    unidad_id: fila.unidad_id ?? null,
    unidad_nombre: textoONulo(fila.unidad_nombre),
    factor_base: decimalONulo(fila.factor_base),
    precio: decimal(fila.precio),
    descuento_pct: decimal(fila.descuento_pct),
    itbis_tasa: decimal(fila.itbis_tasa),
    impuesto_id: fila.impuesto_id ?? null,
    subtotal: decimal(fila.subtotal),
    itbis: decimal(fila.itbis),
    total: decimal(fila.total),
    costo_unitario: decimalONulo(fila.costo_unitario),
  };
}

function mapearPago(fila: z.infer<typeof esquemaPagoJson>): PagoVenta {
  return {
    id: fila.id,
    numero: fila.numero,
    fecha: fila.fecha,
    metodo: fila.metodo,
    metodo_pos: fila.metodo_pos,
    cuenta_id: fila.cuenta_id,
    cuenta_nombre: textoONulo(fila.cuenta_nombre),
    monto: decimal(fila.monto),
    monto_recibido: decimal(fila.monto_recibido),
    cambio: decimal(fila.cambio),
    estado: fila.estado,
  };
}

function mapearImpuesto(fila: z.infer<typeof esquemaImpuestoJson>): ImpuestoPOS {
  return {
    id: fila.id,
    codigo: fila.codigo,
    nombre: fila.nombre,
    tipo: fila.tipo,
    tarifa: decimal(fila.tarifa),
    cuenta_id: fila.cuenta_id,
    activo: fila.activo,
    orden: fila.orden,
  };
}

function mapearFactura(fila: z.infer<typeof esquemaFacturaJson>): FacturaPOS {
  return {
    id: fila.id,
    numero: fila.numero,
    ncf: textoONulo(fila.ncf),
    tipo_comprobante: fila.tipo_comprobante,
    fecha: fila.fecha,
    vencimiento: fila.vencimiento,
    estado: estadoFactura(fila.estado),
    subtotal: decimal(fila.subtotal),
    descuento: decimal(fila.descuento),
    itbis: decimal(fila.itbis),
    otros_impuestos: decimal(fila.otros_impuestos),
    propina: decimal(fila.propina),
    total: decimal(fila.total),
    pagado: decimal(fila.pagado),
    retenido: decimal(fila.retenido),
    credito: decimal(fila.credito),
    saldo: decimal(fila.saldo),
    monto_recibido: decimalONulo(fila.monto_recibido),
    cambio: decimalONulo(fila.cambio),
    notas: textoONulo(fila.notas),
    terminos: textoONulo(fila.terminos),
    pie: textoONulo(fila.pie),
    origen: fila.origen,
    turno_id: fila.turno_id,
    almacen_id: fila.almacen_id,
    vendedor_id: fila.vendedor_id,
    centro_costo_id: fila.centro_costo_id,
    asiento_id: fila.asiento_id,
    creado_en: fila.creado_en ?? null,
  };
}

function mapearAsiento(
  fila: z.infer<typeof esquemaAsientoJson> | null,
): { id: string; numero: number; fecha: string; descripcion: string; total: string } | null {
  if (!fila) return null;
  return {
    id: fila.id,
    numero: fila.numero,
    fecha: fila.fecha,
    descripcion: fila.descripcion,
    total: decimal(fila.total),
  };
}

export function mapearVentaPOS(datos: VentaJson): VentaPOSResultado {
  return {
    factura: mapearFactura(datos.factura),
    contacto: mapearContacto(datos.contacto),
    empresa: mapearEmpresa(datos.empresa),
    terminal: mapearTerminalResumen(datos.terminal),
    turno: mapearTurnoResumen(datos.turno),
    cajero: textoONulo(datos.cajero),
    vendedor: datos.vendedor ?? null,
    almacen: datos.almacen ?? null,
    lista_precio: datos.lista_precio ?? null,
    lineas: datos.lineas.map(mapearLinea),
    pagos: datos.pagos.map(mapearPago),
    impuestos: datos.impuestos.map(mapearImpuesto),
    totales: mapearTotales(datos.totales),
    ncf_vence: textoONulo(datos.ncf_vence),
  };
}

export function mapearCotizacionPOS(datos: CotizacionJson): CotizacionPOSResultado {
  return {
    cotizacion: {
      id: datos.cotizacion.id,
      numero: datos.cotizacion.numero,
      contacto_id: datos.cotizacion.contacto_id,
      fecha: datos.cotizacion.fecha,
      vencimiento: datos.cotizacion.vencimiento,
      estado: datos.cotizacion.estado,
      subtotal: decimal(datos.cotizacion.subtotal),
      descuento: decimal(datos.cotizacion.descuento),
      itbis: decimal(datos.cotizacion.itbis),
      otros_impuestos: decimal(datos.cotizacion.otros_impuestos),
      propina: decimal(datos.cotizacion.propina),
      total: decimal(datos.cotizacion.total),
      notas: textoONulo(datos.cotizacion.notas),
      terminos: textoONulo(datos.cotizacion.terminos),
      vendedor_id: datos.cotizacion.vendedor_id,
      centro_costo_id: datos.cotizacion.centro_costo_id,
      origen: datos.cotizacion.origen,
      turno_id: datos.cotizacion.turno_id,
    },
    contacto: mapearContacto(datos.contacto),
    empresa: mapearEmpresa(datos.empresa),
    terminal: mapearTerminalResumen(datos.terminal),
    turno: datos.turno ? mapearTurnoResumen(datos.turno) : null,
    vendedor: datos.vendedor ?? null,
    lineas: datos.lineas.map(mapearLinea),
    impuestos: datos.impuestos.map(mapearImpuesto),
    totales: mapearTotales(datos.totales),
    plantilla_ticket: normalizarPlantilla(datos.plantilla_ticket),
    lista_precio: datos.lista_precio ?? null,
  };
}

export function mapearDevolucionPOS(datos: DevolucionJson): DevolucionPOSResultado {
  return {
    nota: {
      id: datos.nota.id,
      numero: datos.nota.numero,
      ncf: datos.nota.ncf,
      factura_id: datos.nota.factura_id,
      contacto_id: datos.nota.contacto_id,
      fecha: datos.nota.fecha,
      subtotal: decimal(datos.nota.subtotal),
      itbis: decimal(datos.nota.itbis),
      total: decimal(datos.nota.total),
      estado: estadoNota(datos.nota.estado),
      devuelve_inventario: datos.nota.devuelve_inventario,
      tipo_reembolso: tipoReembolso(datos.nota.tipo_reembolso),
      monto_reembolso_efectivo: decimal(datos.nota.monto_reembolso_efectivo),
      cuenta_reembolso_id: datos.nota.cuenta_reembolso_id,
      turno_id: datos.nota.turno_id,
      notas: textoONulo(datos.nota.notas),
      asiento_id: datos.nota.asiento_id ?? null,
      asiento_reembolso_id: datos.nota.asiento_reembolso_id ?? null,
    },
    factura: {
      id: datos.factura.id,
      numero: datos.factura.numero,
      ncf: textoONulo(datos.factura.ncf),
      total: decimal(datos.factura.total),
      pagado: decimal(datos.factura.pagado),
      credito: decimal(datos.factura.credito),
      estado: estadoFactura(datos.factura.estado),
      saldo: decimal(datos.factura.saldo),
    },
    contacto: datos.contacto ? mapearContacto(datos.contacto) : null,
    empresa: mapearEmpresa(datos.empresa),
    terminal: mapearTerminalResumen(datos.terminal),
    turno: mapearTurnoResumen(datos.turno),
    lineas: datos.lineas.map((linea) => ({
      factura_linea_id: linea.factura_linea_id,
      producto_id: linea.producto_id,
      descripcion: linea.descripcion,
      cantidad: decimal(linea.cantidad),
      unidad_nombre: textoONulo(linea.unidad_nombre),
      factor_base: decimalONulo(linea.factor_base),
      precio: decimal(linea.precio),
      descuento_pct: decimal(linea.descuento_pct),
      itbis_tasa: decimal(linea.itbis_tasa),
      subtotal: decimal(linea.subtotal),
      itbis: decimal(linea.itbis),
      total: decimal(linea.total),
      costo_unitario: decimalONulo(linea.costo_unitario),
    })),
    reembolso: {
      tipo: tipoReembolso(datos.reembolso.tipo),
      efectivo: decimal(datos.reembolso.efectivo),
      credito: decimal(datos.reembolso.credito),
      cuenta_id: datos.reembolso.cuenta_id,
      cuenta_nombre: textoONulo(datos.reembolso.cuenta_nombre),
    },
    totales: {
      subtotal: decimal(datos.totales.subtotal),
      itbis: decimal(datos.totales.itbis),
      total: decimal(datos.totales.total),
      efectivo: decimal(datos.totales.efectivo),
      credito: decimal(datos.totales.credito),
    },
    resumen: mapearResumen(datos.resumen),
  };
}

export function mapearAperturaTurno(datos: AperturaJson): AperturaTurnoPOS {
  return {
    turno: mapearTurnoCompleto(datos.turno),
    terminal: mapearTerminalResumen(datos.terminal),
    empresa: mapearEmpresa(datos.empresa),
    resumen: mapearResumen(datos.resumen),
  };
}

export function mapearMovimientoResultado(datos: MovimientoResultadoJson): MovimientoTurnoPOSResultado {
  return {
    movimiento: {
      ...mapearMovimiento({ ...datos.movimiento, vigente: datos.movimiento.vigente ?? true }),
      factura_ncf: textoONulo(datos.movimiento.factura_ncf),
      cajero: textoONulo(datos.movimiento.cajero),
    },
    turno: mapearTurnoResumen(datos.turno),
    terminal: mapearTerminalResumen(datos.terminal),
    empresa: mapearEmpresa(datos.empresa),
    asiento: mapearAsiento(datos.asiento),
    plantilla_ticket: normalizarPlantilla(datos.plantilla_ticket),
    resumen: mapearResumen(datos.resumen),
  };
}

export function mapearCierreTurno(datos: CierreJson): CierreTurnoPOS {
  return {
    turno: mapearTurnoCompleto(datos.turno),
    terminal: mapearTerminalResumen(datos.terminal),
    empresa: mapearEmpresa(datos.empresa),
    resumen: mapearResumen(datos.resumen),
    asiento_diferencia: mapearAsiento(datos.asiento_diferencia),
  };
}

export function mapearResumenTurnoVista(datos: ResumenTurnoVistaJson): ResumenTurnoVista {
  return {
    turno: mapearTurnoCompleto(datos.turno),
    terminal: mapearTerminalResumen(datos.terminal),
    empresa: mapearEmpresa(datos.empresa),
    resumen: mapearResumen(datos.resumen),
  };
}
