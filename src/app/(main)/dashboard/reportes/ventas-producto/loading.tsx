import { EsqueletoReporte } from "@/components/carga/esqueletos";

export default function Loading() {
  return (
    <EsqueletoReporte
      titulo="Ventas por producto/servicio"
      descripcion="Ventas agrupadas por producto o servicio en el período seleccionado."
      filtros={3}
      tarjetas={3}
      filas={10}
    />
  );
}
