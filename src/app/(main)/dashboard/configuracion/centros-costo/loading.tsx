import { EsqueletoLista } from "@/components/carga/esqueletos";

export default function Loading() {
  return (
    <EsqueletoLista
      titulo="Centros de costo"
      descripcion="Centros de costo para clasificar los asientos."
      columnas={4}
    />
  );
}
