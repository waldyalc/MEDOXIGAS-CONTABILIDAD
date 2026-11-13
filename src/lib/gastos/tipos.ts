import type { ContactoResumen, EstadoDocumento } from "@/lib/facturacion/tipos";

export interface GastoLista {
  id: string;
  numero: number;
  fecha: string;
  contacto_id: string | null;
  cuenta_gasto_id: string;
  descripcion: string;
  subtotal: number;
  itbis: number;
  total: number;
  estado: EstadoDocumento;
  proveedor_nombre: string;
  cuenta_nombre: string;
}

export interface CuentaGasto {
  id: string;
  codigo: string;
  nombre: string;
}

export interface DatosFormularioGasto {
  cuentas: CuentaGasto[];
  proveedores: ContactoResumen[];
  cuentaPorDefecto: string;
}
