import { EsqueletoReporte } from "@/components/carga/esqueletos";

export default function Loading() {
  return (
    <EsqueletoReporte
      titulo="Reporte IT-1"
      descripcion="Anexo A y casillas principales del IT-1."
      filtros={2}
      tarjetas={0}
      filas={12}
    />
  );
}
