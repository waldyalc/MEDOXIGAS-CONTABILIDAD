import type { ContactoResumen, Empresa, ProductoResumen, TipoComprobante } from "@/lib/facturacion/tipos";

export interface FacturaRecurrenteLista {
  id: string;
  numero: number;
  contacto_id: string;
  cliente_nombre: string;
  tipo_comprobante: TipoComprobante;
  fecha_inicio: string;
  vigencia_hasta: string | null;
  frecuencia_meses: number;
  plazo_dias: number;
  generaciones: number;
  ultimo_periodo: string | null;
}

export interface FacturaRecurrenteLinea {
  id: string;
  producto_id: string | null;
  descripcion: string;
  cantidad: number;
  precio: number;
  descuento_pct: number;
  itbis_tasa: number;
}

export interface GeneracionRecurrente {
  id: string;
  periodo: string;
  factura_id: string;
  factura_numero: number;
  factura_ncf: string | null;
  factura_fecha: string;
  factura_total: number;
  factura_estado: string;
}

export interface FacturaRecurrenteVista {
  id: string;
  numero: number;
  contacto_id: string;
  cliente_nombre: string;
  tipo_comprobante: TipoComprobante;
  fecha_inicio: string;
  vigencia_hasta: string | null;
  frecuencia_meses: number;
  plazo_dias: number;
  notas: string | null;
  terminos: string | null;
  pie: string | null;
  lineas: FacturaRecurrenteLinea[];
  generaciones: GeneracionRecurrente[];
}

export interface DatosFormularioRecurrente {
  empresa: Empresa | null;
  contactos: ContactoResumen[];
  productos: ProductoResumen[];
}
