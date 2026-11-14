import { EsqueletoReporte } from "@/components/carga/esqueletos";

export default function Loading() {
  return (
    <EsqueletoReporte
      titulo="Ventas generales"
      descripcion="Facturas de venta del período con subtotal, descuentos e impuestos."
      filtros={4}
      tarjetas={4}
      grafico
      filas={10}
    />
  );
}
