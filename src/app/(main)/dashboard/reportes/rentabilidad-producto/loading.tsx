import { EsqueletoReporte } from "@/components/carga/esqueletos";

export default function Loading() {
  return (
    <EsqueletoReporte
      titulo="Rentabilidad por producto/servicio"
      descripcion="Total vendido, costo y rentabilidad por producto o servicio en el período seleccionado."
      filtros={3}
      tarjetas={3}
      filas={10}
    />
  );
}
