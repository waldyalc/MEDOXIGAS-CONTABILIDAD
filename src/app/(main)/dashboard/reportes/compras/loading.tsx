import { EsqueletoReporte } from "@/components/carga/esqueletos";

export default function Loading() {
  return (
    <EsqueletoReporte
      titulo="Compras"
      descripcion="Facturas de proveedor del período con sus totales."
      filtros={4}
      tarjetas={3}
      filas={10}
    />
  );
}
