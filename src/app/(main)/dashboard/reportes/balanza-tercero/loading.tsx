import { EsqueletoReporte } from "@/components/carga/esqueletos";

export default function Loading() {
  return (
    <EsqueletoReporte
      titulo="Balanza de comprobación por tercero"
      descripcion="Saldos iniciales, movimientos y saldos finales por cuenta y tercero."
      filtros={3}
      tarjetas={3}
      filas={12}
    />
  );
}
