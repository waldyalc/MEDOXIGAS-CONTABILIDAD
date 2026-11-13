import type { ContactoResumen, CuentaCajaBanco, EstadoDocumento } from "@/lib/facturacion/tipos";

export type MetodoPago = "efectivo" | "transferencia" | "tarjeta" | "cheque";

export interface FacturaAbierta {
  id: string;
  numero: number;
  ncf: string | null;
  contacto_id: string;
  fecha: string;
  total: number;
  pagado: number;
}

export interface PagoLista {
  id: string;
  numero: number;
  fecha: string;
  contacto_id: string;
  factura_id: string | null;
  monto: number;
  metodo: MetodoPago;
  estado: EstadoDocumento;
  cliente_nombre: string;
  factura_numero: number | null;
  factura_ncf: string | null;
}

export interface DatosFormularioPago {
  contactos: ContactoResumen[];
  facturas: FacturaAbierta[];
  cuentas: CuentaCajaBanco[];
}
