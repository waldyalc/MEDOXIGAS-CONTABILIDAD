import type { ContactoOpcion, CuentaOpcion } from "@/lib/compras/tipos";

export interface PagoRecurrenteLista {
  id: string;
  nombre: string;
  contacto_id: string | null;
  cuenta_gasto_id: string;
  cuenta_pago_id: string;
  subtotal: number;
  itbis_tasa: number;
  frecuencia_meses: number;
  fecha_inicio: string;
  vigencia_hasta: string | null;
  activo: boolean;
  contacto_nombre: string | null;
  cuenta_gasto_nombre: string;
  cuenta_pago_nombre: string;
}

export interface GastoGenerado {
  id: string;
  numero: number;
  ncf: string | null;
  fecha: string;
  periodo: string | null;
  total: number;
  estado: "activo" | "anulado";
  asiento_id: string | null;
}

export interface PagoRecurrenteVista extends PagoRecurrenteLista {
  notas: string | null;
  gastos: GastoGenerado[];
}

export interface OpcionesPagoRecurrente {
  cuentasGasto: CuentaOpcion[];
  cuentasCajaBanco: CuentaOpcion[];
  contactos: ContactoOpcion[];
}

export interface PeriodosPlantilla {
  fechaInicio: string;
  frecuenciaMeses: number;
  vigenciaHasta: string | null;
}
