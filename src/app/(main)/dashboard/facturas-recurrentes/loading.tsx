import { EsqueletoLista } from "@/components/carga/esqueletos";

export default function Loading() {
  return (
    <EsqueletoLista
      titulo="Facturas recurrentes"
      descripcion="Plantillas que generan facturas por período."
      acciones={1}
      columnas={8}
    />
  );
}
