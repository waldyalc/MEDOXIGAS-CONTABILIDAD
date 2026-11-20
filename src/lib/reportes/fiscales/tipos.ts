export type ClaseDocumento = "venta" | "compra" | "gasto" | "devolucion-venta" | "devolucion-compra";

export interface FormasPago {
  efectivo: number;
  transferencia: number;
  tarjeta: number;
  credito: number;
  otras: number;
}

export interface PagoFactura {
  metodo: string;
  monto: number;
}

export interface DocumentoFiscal {
  id: string;
  numero: number;
  ncf: string;
  ncfModificado: string | null;
  fecha: string;
  tipoComprobante: string;
  contactoId: string | null;
  contactoNombre: string;
  rnc: string | null;
  base: number;
  baseBienes: number;
  baseServicios: number;
  itbis: number;
  otrosImpuestos: number;
  propina: number;
  total: number;
  pagado: number;
  credito: number;
  estado: string;
  clase: ClaseDocumento;
  ruta: string | null;
  pagos: FormasPago;

  // Clasificación fiscal por cuenta contable (606/607). La llena `consultas.ts`
  // a partir de `cuentas.categoria_dgii` / `tipo_compra` / `tipo_ingreso`.
  /** Categoría DGII de la cuenta del renglón (columna "Tipo de bienes" del 606). */
  tipoBienes?: string | null;
  /** Tipo de ingreso de la cuenta de ingreso (607, a 1 dígito). */
  tipoIngreso?: string | null;
  /** Fecha del primer pago cuando el documento está pagado (fecha de pago del 606). */
  fechaPago?: string | null;
  /** ITBIS retenido por terceros (607). */
  itbisRetenido?: number;
  /** Retención de renta por terceros (607). */
  retencionRenta?: number;
  /** Fecha de la retención (607). */
  fechaRetencion?: string | null;
  /** Motivo por el que el documento se excluye del TXT, ya en español. */
  exclusion?: string | null;
}

export interface DetalleImpuesto {
  documentoId: string;
  numero: number;
  ncf: string;
  tipoDocumento: string;
  contactoId: string | null;
  contactoNombre: string;
  fecha: string;
  tasa: number | null;
  tipo: "itbis" | "otro" | "propina" | "exento";
  impuestoNombre: string;
  base: number;
  impuesto: number;
  ruta: string | null;
  tieneNcf: boolean;
  baseBienes: number;
  baseServicios: number;
}

export interface FilaDgii {
  [clave: string]: string | number;
}

export interface RespuestaFiscal<T> {
  datos: T;
  error: string | null;
}

export function formasPagoVacias(): FormasPago {
  return { efectivo: 0, transferencia: 0, tarjeta: 0, credito: 0, otras: 0 };
}

export function sumarFormasPago(formas: readonly FormasPago[]): FormasPago {
  return formas.reduce<FormasPago>(
    (total, forma) => ({
      efectivo: total.efectivo + forma.efectivo,
      transferencia: total.transferencia + forma.transferencia,
      tarjeta: total.tarjeta + forma.tarjeta,
      credito: total.credito + forma.credito,
      otras: total.otras + forma.otras,
    }),
    formasPagoVacias(),
  );
}

export function sumarCampos(documentos: readonly DocumentoFiscal[], campo: "base" | "itbis" | "total"): number {
  return documentos.reduce((total, documento) => total + documento[campo], 0);
}
