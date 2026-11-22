/**
 * Tipos de la capa TypeScript del punto de venta (fase 2B).
 *
 * Regla de dinero: todo `numeric` de Postgres se expone como texto decimal
 * (`Decimal`), nunca como `number` flotante. Los montos que llegan de una RPC
 * se imprimen y se vuelven a enviar tal cual. El único lugar donde un monto se
 * convierte a `number` es la presentación del PDF Carta, que reutiliza los
 * tipos existentes de `@/lib/facturacion`.
 */

import type { ProductoCatalogoPos, ProductoPosCodigo } from "@/lib/inventario/ferreteria/tipos";

/** `numeric` de Postgres como texto decimal; nunca se guarda como float. */
export type Decimal = string;

// ---------------------------------------------------------------------------
// Plantilla del ticket (`pos_terminales.plantilla_ticket`)
// ---------------------------------------------------------------------------

export const ESTILOS_TICKET = ["clasico", "minimalista", "detallado"] as const;
export type EstiloTicket = (typeof ESTILOS_TICKET)[number];

export const FUENTES_TICKET = ["clasica", "moderna", "compacta"] as const;
export type FuenteTicket = (typeof FUENTES_TICKET)[number];

export const TAMANOS_LETRA_TICKET = ["pequena", "mediana", "grande"] as const;
export type TamanoLetraTicket = (typeof TAMANOS_LETRA_TICKET)[number];

export const INTERLINEADOS_TICKET = ["compacto", "normal", "amplio"] as const;
export type InterlineadoTicket = (typeof INTERLINEADOS_TICKET)[number];

export const ANCHOS_TICKET = [80, 57] as const;
export type AnchoTicket = (typeof ANCHOS_TICKET)[number];

export interface PlantillaTicket {
  estilo: EstiloTicket;
  ancho_mm: AnchoTicket;
  fuente: FuenteTicket;
  tamano_letra: TamanoLetraTicket;
  interlineado: InterlineadoTicket;
  mostrar_logo: boolean;
  mostrar_vendedor: boolean;
  mostrar_descripcion: boolean;
  mostrar_referencia: boolean;
  mostrar_precio_unitario: boolean;
  mostrar_unidad: boolean;
  precios_con_impuestos: boolean;
  pie_ticket: string | null;
}

/** Default exacto de `docs/dominio-pos.md` §2.2.1. */
export const PLANTILLA_TICKET_DEFECTO: PlantillaTicket = {
  estilo: "clasico",
  ancho_mm: 80,
  fuente: "clasica",
  tamano_letra: "mediana",
  interlineado: "normal",
  mostrar_logo: true,
  mostrar_vendedor: true,
  mostrar_descripcion: true,
  mostrar_referencia: false,
  mostrar_precio_unitario: true,
  mostrar_unidad: true,
  precios_con_impuestos: true,
  pie_ticket: null,
};

// ---------------------------------------------------------------------------
// Catálogos y estados
// ---------------------------------------------------------------------------

export const METODOS_POS = ["efectivo", "tarjeta_debito", "tarjeta_credito", "transferencia"] as const;
export type MetodoPOS = (typeof METODOS_POS)[number];

export const METODOS_PAGO_DB = ["efectivo", "tarjeta", "transferencia", "cheque"] as const;
export type MetodoPagoDB = (typeof METODOS_PAGO_DB)[number];

export const TIPOS_MOVIMIENTO_POS = ["ingreso", "retiro"] as const;
export type TipoMovimientoPOS = (typeof TIPOS_MOVIMIENTO_POS)[number];

export const MOTIVOS_MOVIMIENTO_POS = [
  "fondo_caja",
  "cobro_factura",
  "retiro_caja",
  "gasto_menor",
  "deposito_banco",
  "otro",
] as const;
export type MotivoMovimientoPOS = (typeof MOTIVOS_MOVIMIENTO_POS)[number];

export const MOTIVOS_INGRESO_POS = ["fondo_caja", "cobro_factura", "otro"] as const;
export type MotivoIngresoPOS = (typeof MOTIVOS_INGRESO_POS)[number];

export const MOTIVOS_RETIRO_POS = ["retiro_caja", "gasto_menor", "deposito_banco", "otro"] as const;
export type MotivoRetiroPOS = (typeof MOTIVOS_RETIRO_POS)[number];

export const ESTADOS_TURNO_POS = ["abierto", "cerrado"] as const;
export type EstadoTurnoPOS = (typeof ESTADOS_TURNO_POS)[number];

export const ESTADOS_FACTURA_POS = ["abierta", "pagada", "anulada"] as const;
export type EstadoFacturaPOS = (typeof ESTADOS_FACTURA_POS)[number];

export const TIPOS_REEMBOLSO_POS = ["credito_factura", "efectivo", "combinado"] as const;
export type TipoReembolsoPOS = (typeof TIPOS_REEMBOLSO_POS)[number];

export const ESTADOS_NOTA_POS = ["activa", "anulada"] as const;
export type EstadoNotaPOS = (typeof ESTADOS_NOTA_POS)[number];

// ---------------------------------------------------------------------------
// Terminal y turnos
// ---------------------------------------------------------------------------

export interface TerminalPOS {
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
  plantilla_ticket: PlantillaTicket;
  activa: boolean;
  creado_en: string;
  actualizado_en: string;
}

/** Terminal dentro de un payload de RPC (solo los datos que devuelve). */
export interface TerminalPOSResumen {
  id: string;
  nombre: string;
  almacen_id?: string | null;
  cuenta_efectivo_id?: string | null;
  plantilla_ticket?: PlantillaTicket | null;
}

export interface TurnoPOS {
  id: string;
  numero: number;
  terminal_id: string;
  abierto_por: string;
  cerrado_por: string | null;
  abierto_en: string;
  cerrado_en: string | null;
  estado: EstadoTurnoPOS;
  base_inicial: Decimal;
  efectivo_esperado: Decimal | null;
  efectivo_real: Decimal | null;
  diferencia: Decimal | null;
  asiento_diferencia_id: string | null;
  observaciones: string | null;
  /** Nombre del usuario cuando es el de la sesión; `null` si no se puede leer. */
  abierto_por_nombre?: string | null;
  cerrado_por_nombre?: string | null;
}

/** Turno resumido que viaja dentro de la venta o la cotización. */
export interface TurnoResumenPOS {
  id: string;
  numero: number;
  abierto_en?: string | null;
  base_inicial: Decimal;
  efectivo_esperado_actual?: Decimal | null;
  estado?: EstadoTurnoPOS | null;
}

export interface CuentaResumenPOS {
  cuenta_id: string;
  cuenta_nombre: string | null;
  metodo: MetodoPagoDB;
  monto: Decimal;
}

export interface MovimientoTurnoPOS {
  id: string;
  numero: number;
  turno_id: string;
  tipo: TipoMovimientoPOS;
  motivo: MotivoMovimientoPOS;
  monto: Decimal;
  cuenta_contrapartida_id: string;
  cuenta_nombre: string | null;
  contacto_id: string | null;
  factura_id: string | null;
  factura_numero: number | null;
  pago_recibido_id: string | null;
  gasto_menor_id: string | null;
  asiento_id: string;
  notas: string | null;
  creado_en: string;
  creado_por: string;
  /** Los movimientos con documento anulado quedan fuera de los totales. */
  vigente: boolean;
}

export interface ResumenTurno {
  ventas: {
    total: Decimal;
    cantidad: number;
    cobrado: Decimal;
    por_metodo: {
      efectivo: Decimal;
      tarjeta: Decimal;
      transferencia: Decimal;
      credito: Decimal;
    };
    por_cuenta: CuentaResumenPOS[];
  };
  ingresos: {
    total: Decimal;
    cantidad: number;
    por_motivo: Record<MotivoIngresoPOS, Decimal>;
  };
  retiros: {
    total: Decimal;
    cantidad: number;
    por_motivo: Record<MotivoRetiroPOS, Decimal>;
  };
  devoluciones: {
    cantidad: number;
    total: Decimal;
    efectivo: Decimal;
    credito: Decimal;
  };
  efectivo: {
    base_inicial: Decimal;
    ventas_efectivo: Decimal;
    ingresos_efectivo: Decimal;
    retiros_efectivo: Decimal;
    devoluciones_efectivo: Decimal;
    efectivo_esperado: Decimal;
    efectivo_real: Decimal | null;
    diferencia: Decimal | null;
    congelado: boolean;
  };
  movimientos: MovimientoTurnoPOS[];
}

export interface ResumenTurnoVista {
  turno: TurnoPOS;
  terminal: TerminalPOSResumen;
  empresa: EmpresaPOS | null;
  resumen: ResumenTurno;
}

export interface AperturaTurnoPOS {
  turno: TurnoPOS;
  terminal: TerminalPOSResumen;
  empresa: EmpresaPOS | null;
  resumen: ResumenTurno;
}

export interface MovimientoTurnoPOSResultado {
  movimiento: MovimientoTurnoPOS & {
    factura_ncf: string | null;
    cajero: string | null;
  };
  turno: TurnoResumenPOS;
  terminal: TerminalPOSResumen;
  empresa: EmpresaPOS | null;
  asiento: AsientoResumenPOS | null;
  plantilla_ticket: PlantillaTicket;
  resumen: ResumenTurno;
}

export interface CierreTurnoPOS {
  turno: TurnoPOS;
  terminal: TerminalPOSResumen;
  empresa: EmpresaPOS | null;
  resumen: ResumenTurno;
  asiento_diferencia: AsientoResumenPOS | null;
}

export interface AsientoResumenPOS {
  id: string;
  numero: number;
  fecha: string;
  descripcion: string;
  total: Decimal;
}

// ---------------------------------------------------------------------------
// Venta, cotización y devolución
// ---------------------------------------------------------------------------

export interface EmpresaPOS {
  id: number;
  nombre: string | null;
  rnc: string | null;
  direccion: string | null;
  telefono: string | null;
  correo: string | null;
  logo_url: string | null;
  /** Pendiente: la tabla empresa aún no tiene sucursal ni régimen. */
  sucursal?: string | null;
  regimen?: string | null;
}

export interface ContactoPOS {
  id: string;
  nombre: string;
  rnc_cedula: string | null;
  direccion: string | null;
  telefono: string | null;
  correo: string | null;
  tipo_identificacion: string | null;
  lista_precio_id: string | null;
  limite_credito: Decimal | null;
}

export interface ImpuestoPOS {
  id: string;
  codigo: string;
  nombre: string;
  tipo: string;
  tarifa: Decimal;
  cuenta_id: string | null;
  activo: boolean;
  orden: number;
}

export interface TotalesPOS {
  subtotal: Decimal;
  descuento: Decimal;
  itbis: Decimal;
  otros_impuestos: Decimal;
  propina: Decimal;
  total: Decimal;
  pagado?: Decimal;
  retenido?: Decimal;
  credito?: Decimal;
  saldo?: Decimal;
  monto_recibido?: Decimal | null;
  cambio?: Decimal | null;
}

export interface FacturaPOS {
  id: string;
  numero: number;
  ncf: string | null;
  tipo_comprobante: string;
  fecha: string;
  vencimiento: string;
  estado: EstadoFacturaPOS;
  subtotal: Decimal;
  descuento: Decimal;
  itbis: Decimal;
  otros_impuestos: Decimal;
  propina: Decimal;
  total: Decimal;
  pagado: Decimal;
  retenido: Decimal;
  credito: Decimal;
  saldo: Decimal;
  monto_recibido: Decimal | null;
  cambio: Decimal | null;
  notas: string | null;
  terminos: string | null;
  pie: string | null;
  origen: string;
  turno_id: string | null;
  almacen_id: string | null;
  vendedor_id: string | null;
  centro_costo_id: string | null;
  asiento_id: string | null;
  /** `facturas.creado_en`; el detalle del historial lo trae para la hora. */
  creado_en?: string | null;
}

export interface LineaVenta {
  id: string;
  producto_id: string | null;
  producto_nombre: string | null;
  referencia: string | null;
  descripcion: string;
  cantidad: Decimal;
  unidad_id: string | null;
  unidad_nombre: string | null;
  factor_base: Decimal | null;
  precio: Decimal;
  descuento_pct: Decimal;
  itbis_tasa: Decimal;
  impuesto_id: string | null;
  subtotal: Decimal;
  itbis: Decimal;
  total: Decimal;
  costo_unitario?: Decimal | null;
}

export interface PagoVenta {
  id: string;
  numero: number;
  fecha: string;
  metodo: MetodoPagoDB;
  metodo_pos: MetodoPOS;
  cuenta_id: string;
  cuenta_nombre: string | null;
  monto: Decimal;
  monto_recibido: Decimal;
  cambio: Decimal;
  estado: string;
}

export interface VentaPOSResultado {
  factura: FacturaPOS;
  contacto: ContactoPOS;
  empresa: EmpresaPOS | null;
  terminal: TerminalPOSResumen;
  turno: TurnoResumenPOS;
  cajero: string | null;
  vendedor: { id: string; nombre: string } | null;
  almacen: { id: string; nombre: string } | null;
  lista_precio: { id: string; nombre: string } | null;
  lineas: LineaVenta[];
  pagos: PagoVenta[];
  impuestos: ImpuestoPOS[];
  totales: TotalesPOS;
  ncf_vence: string | null;
}

export interface CotizacionPOS {
  id: string;
  numero: number;
  contacto_id: string;
  fecha: string;
  vencimiento: string;
  estado: string;
  subtotal: Decimal;
  descuento: Decimal;
  itbis: Decimal;
  otros_impuestos: Decimal;
  propina: Decimal;
  total: Decimal;
  notas: string | null;
  terminos: string | null;
  vendedor_id: string | null;
  centro_costo_id: string | null;
  origen: string;
  turno_id: string | null;
}

export interface CotizacionPOSResultado {
  cotizacion: CotizacionPOS;
  contacto: ContactoPOS;
  empresa: EmpresaPOS | null;
  terminal: TerminalPOSResumen;
  turno: TurnoResumenPOS | null;
  vendedor: { id: string; nombre: string } | null;
  lineas: LineaVenta[];
  impuestos: ImpuestoPOS[];
  totales: TotalesPOS;
  plantilla_ticket: PlantillaTicket;
  lista_precio: { id: string; nombre: string } | null;
}

export interface NotaCreditoPOS {
  id: string;
  numero: number;
  ncf: string;
  factura_id: string;
  contacto_id: string;
  fecha: string;
  subtotal: Decimal;
  itbis: Decimal;
  total: Decimal;
  estado: EstadoNotaPOS;
  devuelve_inventario: boolean;
  tipo_reembolso: TipoReembolsoPOS;
  monto_reembolso_efectivo: Decimal;
  cuenta_reembolso_id: string | null;
  turno_id: string | null;
  notas: string | null;
  asiento_id: string | null;
  asiento_reembolso_id: string | null;
}

export interface LineaDevolucionPOS {
  factura_linea_id: string;
  producto_id: string | null;
  descripcion: string;
  cantidad: Decimal;
  unidad_nombre: string | null;
  factor_base: Decimal | null;
  precio: Decimal;
  descuento_pct: Decimal;
  itbis_tasa: Decimal;
  subtotal: Decimal;
  itbis: Decimal;
  total: Decimal;
  costo_unitario: Decimal | null;
}

export interface ReembolsoPOS {
  tipo: TipoReembolsoPOS;
  efectivo: Decimal;
  credito: Decimal;
  cuenta_id: string | null;
  cuenta_nombre: string | null;
}

export interface DevolucionPOSResultado {
  nota: NotaCreditoPOS;
  factura: {
    id: string;
    numero: number;
    ncf: string | null;
    total: Decimal;
    pagado: Decimal;
    credito: Decimal;
    estado: EstadoFacturaPOS;
    saldo: Decimal;
  };
  contacto: ContactoPOS | null;
  empresa: EmpresaPOS | null;
  terminal: TerminalPOSResumen;
  turno: TurnoResumenPOS;
  lineas: LineaDevolucionPOS[];
  reembolso: ReembolsoPOS;
  totales: {
    subtotal: Decimal;
    itbis: Decimal;
    total: Decimal;
    efectivo: Decimal;
    credito: Decimal;
  };
  resumen: ResumenTurno;
}

// ---------------------------------------------------------------------------
// Lecturas del POS
// ---------------------------------------------------------------------------

/**
 * Producto del catálogo del POS. Es el mismo que devuelve la fase 1 de
 * inventario (`pos_catalogo_productos`): se reutiliza el tipo para no
 * duplicar la consulta ni el mapeo.
 */
export type ProductoPOS = ProductoCatalogoPos;

/** Resultado de la pistola de código de barra (fase 1). */
export type ProductoPOSCodigo = ProductoPosCodigo;

export interface CotizacionAbiertaPOS {
  id: string;
  numero: number;
  contacto_id: string;
  cliente_nombre: string;
  fecha: string;
  vencimiento: string;
  total: Decimal;
  estado: string;
  vendedor_id: string | null;
}

export interface HistorialPOSFila {
  id: string;
  numero: number;
  ncf: string | null;
  tipo_comprobante: string;
  fecha: string;
  creado_en: string | null;
  contacto_id: string;
  cliente_nombre: string;
  terminal_id: string | null;
  terminal_nombre: string | null;
  turno_id: string | null;
  turno_numero: number | null;
  estado: EstadoFacturaPOS;
  total: Decimal;
  pagado: Decimal;
  retenido: Decimal;
  credito: Decimal;
  saldo: Decimal;
  /** Métodos de pago activos de la factura; vacío = venta a crédito. */
  metodos: MetodoPagoDB[];
}
