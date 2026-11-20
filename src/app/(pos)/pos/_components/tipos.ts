import type { EstadoFacturaPOS, MetodoPOS, TipoReembolsoPOS } from "@/lib/pos/tipos";

/** Fila de la lista de devoluciones del POS (notas de crédito con turno). */
export interface DevolucionPOSFila {
  id: string;
  numero: number;
  ncf: string;
  fecha: string;
  total: string;
  estado: string;
  factura_id: string;
  factura_numero: number;
  factura_ncf: string | null;
  contacto_id: string;
  cliente_nombre: string;
  tipo_reembolso: TipoReembolsoPOS;
  monto_reembolso_efectivo: string;
  turno_numero: number | null;
}

export interface LineaDevolucionDetalle {
  id: string;
  factura_linea_id: string;
  producto_id: string | null;
  descripcion: string;
  cantidad: string;
  unidad_nombre: string | null;
  factor_base: string | null;
  precio: string;
  descuento_pct: string;
  itbis_tasa: string;
  subtotal: string;
  itbis: string;
  total: string;
  costo_unitario: string | null;
}

export interface DevolucionPOSDetalle {
  nota: {
    id: string;
    numero: number;
    ncf: string;
    fecha: string;
    subtotal: string;
    itbis: string;
    total: string;
    estado: string;
    tipo_reembolso: TipoReembolsoPOS;
    monto_reembolso_efectivo: string;
    cuenta_reembolso_id: string | null;
    turno_id: string | null;
    turno_numero: number | null;
    notas: string | null;
    factura_id: string;
    contacto_id: string;
  };
  factura: {
    id: string;
    numero: number;
    ncf: string | null;
    total: string;
    pagado: string;
    credito: string;
    estado: EstadoFacturaPOS;
    saldo: string;
  };
  contacto: { id: string; nombre: string; rnc_cedula: string | null } | null;
  lineas: LineaDevolucionDetalle[];
}

export interface PagoDetallePOS {
  id: string;
  numero: number;
  fecha: string;
  metodo: string;
  metodo_pos: MetodoPOS;
  cuenta_id: string;
  cuenta_nombre: string | null;
  monto: string;
  monto_recibido: string;
  cambio: string;
  estado: string;
}

export interface TurnoDetallePOS {
  id: string;
  numero: number;
  abierto_en: string;
  cerrado_en: string | null;
  base_inicial: string;
  efectivo_esperado: string | null;
  efectivo_real: string | null;
  diferencia: string | null;
  terminal_nombre: string | null;
}

export interface DetalleVentaPOS {
  factura: {
    id: string;
    numero: number;
    ncf: string | null;
    tipo_comprobante: string;
    fecha: string;
    creado_en: string | null;
    vencimiento: string;
    estado: EstadoFacturaPOS;
    subtotal: string;
    descuento: string;
    itbis: string;
    otros_impuestos: string;
    propina: string;
    total: string;
    pagado: string;
    retenido: string;
    credito: string;
    saldo: string;
    monto_recibido: string | null;
    cambio: string | null;
    notas: string | null;
    terminos: string | null;
  };
  contacto: { id: string; nombre: string; rnc_cedula: string | null; telefono: string | null };
  lineas: {
    id: string;
    descripcion: string;
    cantidad: string;
    precio: string;
    descuento_pct: string;
    itbis_tasa: string;
    subtotal: string;
    itbis: string;
    total: string;
    unidad_nombre: string | null;
  }[];
  pagos: PagoDetallePOS[];
  notas_credito: { id: string; numero: number; ncf: string; fecha: string; total: string; estado: string }[];
  terminal_nombre: string | null;
  turno: TurnoDetallePOS | null;
  cajero: string | null;
  vendedor: string | null;
}

/** Factura candidata para devolución o cobro de turno. */
export interface FacturaCandidataPOS {
  id: string;
  numero: number;
  ncf: string | null;
  fecha: string;
  total: string;
  pagado: string;
  credito: string;
  retenido: string;
  saldo: string;
  estado: EstadoFacturaPOS;
  origen: string;
  cliente_nombre: string;
}

/** Datos del paso 2 de la devolución. */
export interface DatosDevolucionPOS {
  factura: FacturaCandidataPOS;
  lineas: {
    id: string;
    producto_id: string | null;
    descripcion: string;
    cantidad: string;
    precio: string;
    descuento_pct: string;
    itbis_tasa: string;
    subtotal: string;
    itbis: string;
    total: string;
    pendiente: string;
  }[];
  efectivo_devuelto_previo: string;
}
