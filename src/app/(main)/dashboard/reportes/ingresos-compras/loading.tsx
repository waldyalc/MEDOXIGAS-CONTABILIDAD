import { EsqueletoReporte } from "@/components/carga/esqueletos";

export default function Loading() {
  return (
    <EsqueletoReporte
      titulo="Ingresos y compras"
      descripcion="Ingresos, costos y gastos del período con el detalle de sus cuentas contables."
      filtros={2}
      tarjetas={3}
      filas={12}
    />
  );
}
