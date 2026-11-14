import { EsqueletoReporte } from "@/components/carga/esqueletos";

export default function Loading() {
  return (
    <EsqueletoReporte
      titulo="Movimientos por cuenta contable agrupado"
      descripcion="Movimientos agrupados por cuenta o tercero, con el detalle desplegable de cada grupo."
      filtros={4}
      tarjetas={2}
      filas={12}
    />
  );
}
