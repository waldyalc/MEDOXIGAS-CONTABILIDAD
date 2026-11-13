export interface TerminoPago {
  id: string;
  nombre: string;
  dias: number;
  activo: boolean;
}

export type RolPerfil = "admin" | "contador" | "lector";

export interface PerfilUsuario {
  user_id: string;
  nombre: string | null;
  correo: string | null;
  rol: RolPerfil;
  creado_en: string;
}
