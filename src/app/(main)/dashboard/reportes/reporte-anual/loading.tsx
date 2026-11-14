import { EsqueletoReporte } from "@/components/carga/esqueletos";

export default function Loading() {
  return (
    <EsqueletoReporte
      titulo="Reporte anual"
      descripcion="Resumen de ventas, costos, gastos y rankings del año."
      filtros={1}
      tarjetas={4}
      grafico
      filas={10}
    />
  );
}
