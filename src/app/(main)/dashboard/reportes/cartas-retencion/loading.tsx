import { EsqueletoReporte } from "@/components/carga/esqueletos";

export default function Loading() {
  return (
    <EsqueletoReporte
      titulo="Cartas de retención"
      descripcion="Retenciones por proveedor y período con su carta imprimible."
      filtros={3}
      tarjetas={0}
      filas={10}
    />
  );
}
