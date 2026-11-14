import { EsqueletoLista } from "@/components/carga/esqueletos";

export default function Loading() {
  return (
    <EsqueletoLista
      titulo="Asientos"
      descripcion="Asientos contables del libro diario."
      acciones={1}
      filtros={2}
      columnas={6}
      filas={12}
    />
  );
}
