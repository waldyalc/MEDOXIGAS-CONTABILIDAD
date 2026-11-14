import { EsqueletoReporte } from "@/components/carga/esqueletos";

export default function Loading() {
  return (
    <EsqueletoReporte
      titulo="Movimientos por cuenta contable"
      descripcion="Movimientos de una cuenta con saldo corrido y totales del período."
      filtros={4}
      tarjetas={2}
      filas={12}
    />
  );
}
