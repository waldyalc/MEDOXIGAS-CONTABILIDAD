import { EsqueletoReporte } from "@/components/carga/esqueletos";

export default function Loading() {
  return (
    <EsqueletoReporte
      titulo="Reporte 607"
      descripcion="Ventas de bienes y servicios del período, con notas de crédito y el formato de envío de la DGII."
      filtros={2}
      tarjetas={0}
      filas={12}
    />
  );
}
