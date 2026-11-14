import type { TipoRetencion } from "@/lib/retenciones/calculo";

export interface TerminoPago {
  id: string;
  nombre: string;
  dias: number;
  activo: boolean;
}

export interface RetencionOpcion {
  id: string;
  nombre: string;
  tipo: TipoRetencion;
  porcentaje: number;
}

export interface RetencionConfig extends RetencionOpcion {
  cuenta_id: string;
  cuenta_codigo: string;
  cuenta_nombre: string;
  cuenta_anticipo_id: string | null;
  cuenta_anticipo_codigo: string | null;
  cuenta_anticipo_nombre: string | null;
  activa: boolean;
}

export interface CuentaRetencion {
  id: string;
  codigo: string;
  nombre: string;
  tipo: string;
}

export type RolPerfil = "admin" | "contador" | "lector";

export interface PerfilUsuario {
  user_id: string;
  nombre: string | null;
  correo: string | null;
  rol: RolPerfil;
  creado_en: string;
}
