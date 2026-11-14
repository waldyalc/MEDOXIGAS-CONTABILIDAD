import { EsqueletoReporte } from "@/components/carga/esqueletos";

export default function Loading() {
  return (
    <EsqueletoReporte
      titulo="Estado de resultados"
      descripcion="Ingresos, costos y gastos del período comparados con el mismo período del año anterior."
      filtros={2}
      tarjetas={3}
      filas={12}
    />
  );
}
