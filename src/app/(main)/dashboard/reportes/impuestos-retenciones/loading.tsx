import { EsqueletoReporte } from "@/components/carga/esqueletos";

export default function Loading() {
  return (
    <EsqueletoReporte
      titulo="Impuestos y retenciones"
      descripcion="ITBIS y retenciones de ventas y compras del período."
      filtros={2}
      tarjetas={4}
      filas={10}
    />
  );
}
