import { EsqueletoReporte } from "@/components/carga/esqueletos";

export default function Loading() {
  return (
    <EsqueletoReporte
      titulo="Estado de cuenta"
      descripcion="Documentos y movimientos del contacto."
      filtros={3}
      tarjetas={3}
      filas={10}
    />
  );
}
