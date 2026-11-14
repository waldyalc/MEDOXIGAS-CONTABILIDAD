import { EsqueletoReporte } from "@/components/carga/esqueletos";

export default function Loading() {
  return (
    <EsqueletoReporte
      titulo="Valor de inventario"
      descripcion="Existencias y costo del inventario a la fecha de corte."
      filtros={3}
      tarjetas={2}
      filas={10}
    />
  );
}
