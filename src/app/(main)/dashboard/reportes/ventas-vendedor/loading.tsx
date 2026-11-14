import { EsqueletoReporte } from "@/components/carga/esqueletos";

export default function Loading() {
  return (
    <EsqueletoReporte
      titulo="Ventas por vendedor"
      descripcion="Ventas del período agrupadas por vendedor."
      filtros={3}
      tarjetas={3}
      filas={10}
    />
  );
}
