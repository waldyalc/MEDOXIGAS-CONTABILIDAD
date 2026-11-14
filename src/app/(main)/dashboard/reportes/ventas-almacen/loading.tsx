import { EsqueletoReporte } from "@/components/carga/esqueletos";

export default function Loading() {
  return (
    <EsqueletoReporte
      titulo="Ventas por almacén"
      descripcion="Facturas de venta del período agrupadas por almacén, con subtotal, descuentos e impuestos."
      filtros={3}
      tarjetas={4}
      filas={10}
    />
  );
}
