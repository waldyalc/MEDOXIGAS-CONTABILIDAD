import { EsqueletoReporte } from "@/components/carga/esqueletos";

export default function Loading() {
  return (
    <EsqueletoReporte
      titulo="Exportar para el contador"
      descripcion="Facturas de venta, compras y libro diario en Excel o PDF."
      filtros={3}
      tarjetas={0}
      filas={8}
    />
  );
}
