import type { ContactoResumen, EstadoDocumento } from "@/lib/facturacion/tipos";

export interface GastoLista {
  id: string;
  numero: number;
  ncf: string | null;
  fecha: string;
  contacto_id: string | null;
  cuenta_gasto_id: string;
  cuenta_pago_id: string;
  descripcion: string;
  subtotal: number;
  itbis: number;
  total: number;
  estado: EstadoDocumento;
  proveedor_nombre: string;
  cuenta_nombre: string;
  cuenta_pago_nombre: string;
}

export interface CuentaGasto {
  id: string;
  codigo: string;
  nombre: string;
}

export interface CuentaCajaBanco {
  id: string;
  codigo: string;
  nombre: string;
}

export interface CuentaContable extends CuentaGasto {
  tipo: string;
  acepta_movimientos: boolean;
  activa: boolean;
  es_caja_banco: boolean;
}

export interface DatosFormularioGasto {
  cuentas: CuentaGasto[];
  cuentasCajaBanco: CuentaCajaBanco[];
  proveedores: ContactoResumen[];
  cuentaPorDefecto: string;
  cuentaPagoPorDefecto: string;
}
