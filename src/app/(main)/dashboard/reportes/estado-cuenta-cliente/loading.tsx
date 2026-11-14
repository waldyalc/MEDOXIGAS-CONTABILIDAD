import { EsqueletoReporte } from "@/components/carga/esqueletos";

export default function Loading() {
  return (
    <EsqueletoReporte
      titulo="Estado de cuenta por cliente"
      descripcion="Documentos, pagos y saldo de cada cliente."
      filtros={4}
      tarjetas={3}
      filas={10}
    />
  );
}
