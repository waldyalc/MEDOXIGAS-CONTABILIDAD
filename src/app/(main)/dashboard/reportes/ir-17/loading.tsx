import { EsqueletoReporte } from "@/components/carga/esqueletos";

export default function Loading() {
  return (
    <EsqueletoReporte
      titulo="Reporte IR-17"
      descripcion="Retenciones a proveedores por tipo y totales."
      filtros={2}
      tarjetas={3}
      filas={10}
    />
  );
}
