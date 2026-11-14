import { EsqueletoReporte } from "@/components/carga/esqueletos";

export default function Loading() {
  return (
    <EsqueletoReporte
      titulo="Libro diario"
      descripcion="Todos los asientos del período con sus débitos y créditos."
      filtros={3}
      tarjetas={0}
      filas={12}
    />
  );
}
