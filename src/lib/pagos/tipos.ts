import type { RetencionOpcion } from "@/lib/configuracion/tipos";
import type { ContactoResumen, CuentaCajaBanco, EstadoDocumento } from "@/lib/facturacion/tipos";

export type MetodoPago = "efectivo" | "transferencia" | "tarjeta" | "cheque";

export interface FacturaAbierta {
  id: string;
  numero: number;
  ncf: string | null;
  contacto_id: string;
  fecha: string;
  subtotal: number;
  itbis: number;
  total: number;
  pagado: number;
  credito: number;
  retenido: number;
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
  retenciones: RetencionOpcion[];
}
