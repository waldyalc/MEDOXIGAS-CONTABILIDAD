import { EsqueletoReporte } from "@/components/carga/esqueletos";

export default function Loading() {
  return (
    <EsqueletoReporte
      titulo="Balanza de comprobación"
      descripcion="Saldo inicial, movimientos y saldo final por cuenta, con subtotales por grupo."
      filtros={2}
      tarjetas={3}
      filas={12}
    />
  );
}
