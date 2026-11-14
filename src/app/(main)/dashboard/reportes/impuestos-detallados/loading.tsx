import { EsqueletoReporte } from "@/components/carga/esqueletos";

export default function Loading() {
  return (
    <EsqueletoReporte
      titulo="Reporte detallado de impuestos"
      descripcion="ITBIS de ventas y compras por tasa, con el detalle por comprobante."
      filtros={2}
      tarjetas={4}
      filas={10}
    />
  );
}
