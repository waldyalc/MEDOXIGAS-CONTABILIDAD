import { EsqueletoReporte } from "@/components/carga/esqueletos";

export default function Loading() {
  return (
    <EsqueletoReporte
      titulo="Estado de flujo de efectivo"
      descripcion="Entradas y salidas de efectivo por operación, inversión y financiación mediante el método indirecto."
      filtros={2}
      tarjetas={3}
      filas={12}
    />
  );
}
