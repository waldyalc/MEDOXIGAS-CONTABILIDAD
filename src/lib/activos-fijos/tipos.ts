export const TIPOS_ACTIVO = [
  "terrenos",
  "edificios",
  "maquinarias",
  "equipos_computacion",
  "equipos_oficina",
  "mobiliario",
  "equipos_transporte",
  "otros_tangibles",
  "intangible",
] as const;

export type TipoActivo = (typeof TIPOS_ACTIVO)[number];

export const ETIQUETAS_TIPO_ACTIVO: Record<TipoActivo, string> = {
  terrenos: "Terrenos",
  edificios: "Edificios o construcciones",
  maquinarias: "Maquinarias",
  equipos_computacion: "Equipos de computación",
  equipos_oficina: "Equipos de oficina",
  mobiliario: "Mobiliarios y enseres",
  equipos_transporte: "Equipos de transporte",
  otros_tangibles: "Otros tangibles",
  intangible: "Activo intangible",
};

export type PeriodoDepreciacion = "anual" | "mensual";

export interface CuentaActivo {
  id: string;
  codigo: string;
  nombre: string;
  tipo: string;
  naturaleza: string;
  acepta_movimientos: boolean;
  activa: boolean;
}

export interface ContactoActivo {
  id: string;
  nombre: string;
}

export interface DatosFormularioActivo {
  cuentasActivo: CuentaActivo[];
  cuentasDepreciacion: CuentaActivo[];
  cuentasGasto: CuentaActivo[];
  proveedores: ContactoActivo[];
  porDefecto: {
    activo: string;
    depreciacion: string;
    gasto: string;
  };
}

export interface ActivoLista {
  id: string;
  nombre: string;
  referencia: string | null;
  tipo_activo: string;
  fecha_adquisicion: string;
  monto_total: number;
  valor_residual: number;
  vida_util_meses: number;
  depreciado: number;
}

export interface DepreciacionRegistrada {
  periodo: string;
  monto: number;
  asiento_id: string;
  asiento_numero: number | null;
}

export interface ActivoDetalle {
  id: string;
  nombre: string;
  referencia: string | null;
  tipo_activo: string;
  fecha_adquisicion: string;
  costo_unitario: number;
  cantidad: number;
  monto_total: number;
  valor_residual: number;
  fecha_inicio_depreciacion: string;
  vida_util_meses: number;
  asiento_id: string | null;
  proveedor: { id: string; nombre: string } | null;
  cuenta_activo: { id: string; codigo: string; nombre: string } | null;
  cuenta_depreciacion: { id: string; codigo: string; nombre: string } | null;
  cuenta_gasto: { id: string; codigo: string; nombre: string } | null;
  depreciaciones: DepreciacionRegistrada[];
}
