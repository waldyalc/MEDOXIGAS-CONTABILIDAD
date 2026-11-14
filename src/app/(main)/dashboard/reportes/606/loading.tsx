import { EsqueletoReporte } from "@/components/carga/esqueletos";

export default function Loading() {
  return (
    <EsqueletoReporte
      titulo="Reporte 606"
      descripcion="Compras de bienes y servicios del período, con el formato de envío de la DGII."
      filtros={2}
      tarjetas={0}
      filas={12}
    />
  );
}
