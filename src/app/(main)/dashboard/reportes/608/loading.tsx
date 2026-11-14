import { EsqueletoReporte } from "@/components/carga/esqueletos";

export default function Loading() {
  return (
    <EsqueletoReporte
      titulo="Reporte 608"
      descripcion="Comprobantes fiscales anulados del período, con el formato de envío de la DGII."
      filtros={2}
      tarjetas={0}
      filas={8}
    />
  );
}
