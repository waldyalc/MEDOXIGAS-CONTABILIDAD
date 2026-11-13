export const VISTAS_ANTIGUEDAD = [
  "vencidas-30",
  "vencidas-31-60",
  "vencidas-61-90",
  "vencidas-91",
  "no-vencidas",
] as const;

export type VistaConcreta = (typeof VISTAS_ANTIGUEDAD)[number];
export type VistaAntiguedad = "todas" | VistaConcreta;

export const ETIQUETAS_VISTA: Record<VistaConcreta, string> = {
  "vencidas-30": "Vencidas 30 días o menos",
  "vencidas-31-60": "Vencidas 31 a 60 días",
  "vencidas-61-90": "Vencidas 61 a 90 días",
  "vencidas-91": "Vencidas 91+",
  "no-vencidas": "No vencidas",
};

export interface FilaCartera {
  id: string;
  numero: number;
  ncf: string | null;
  tipoDocumento: string;
  contactoId: string;
  contactoNombre: string;
  creado: string;
  vencimiento: string;
  total: number;
  pagado: number;
  saldo: number;
  diasVencida: number;
  vista: VistaConcreta;
}

export interface FiltrosCartera {
  vista: VistaAntiguedad;
  ncf: string;
  contacto: string;
  creacionDesde: string | null;
  creacionHasta: string | null;
  vencimientoDesde: string | null;
  vencimientoHasta: string | null;
}

export interface FilaCompra {
  id: string;
  numero: number;
  ncf: string | null;
  contactoId: string;
  contactoNombre: string;
  fecha: string;
  subtotal: number;
  total: number;
}

export interface FilaInventario {
  id: string;
  nombre: string;
  referencia: string | null;
  descripcion: string | null;
  cantidad: number;
  unidad: string;
  activo: boolean;
  costo: number;
  total: number;
}
