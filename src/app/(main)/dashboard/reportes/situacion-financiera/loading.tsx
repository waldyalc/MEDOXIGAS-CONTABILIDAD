import { EsqueletoReporte } from "@/components/carga/esqueletos";

export default function Loading() {
  return (
    <EsqueletoReporte
      titulo="Estado de situación financiera"
      descripcion="Activos, pasivos y patrimonio a la fecha de corte, comparados con el año anterior."
      filtros={1}
      tarjetas={3}
      filas={12}
    />
  );
}
