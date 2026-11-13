export interface Numeracion {
  id: string;
  tipo_comprobante: string;
  nombre: string;
  prefijo: string;
  siguiente: number;
  hasta: number | null;
  vence: string | null;
  activa: boolean;
}
