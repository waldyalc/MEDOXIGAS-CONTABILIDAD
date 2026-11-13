export const TIPOS_PLANTILLA = ["factura", "cotizacion", "conduce"] as const;

export type TipoPlantilla = (typeof TIPOS_PLANTILLA)[number];

export interface PlantillaImpresion {
  tipo_documento: TipoPlantilla;
  notas_pie: string | null;
  terminos: string | null;
  mostrar_logo: boolean;
  actualizado_en: string;
}

export interface PlantillaResuelta {
  notas: string;
  terminos: string;
  mostrarLogo: boolean;
}

export const ETIQUETAS_PLANTILLA: Record<TipoPlantilla, string> = {
  factura: "Factura",
  cotizacion: "Cotización",
  conduce: "Conduce",
};
