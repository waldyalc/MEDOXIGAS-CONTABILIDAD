import { EsqueletoReporte } from "@/components/carga/esqueletos";

export default function Loading() {
  return (
    <EsqueletoReporte
      titulo="Ventas por cliente"
      descripcion="Ventas del período agrupadas por cliente, con subtotal, descuentos e impuestos."
      filtros={3}
      tarjetas={4}
      filas={10}
    />
  );
}
