import { EsqueletoLista } from "@/components/carga/esqueletos";

export default function Loading() {
  return (
    <EsqueletoLista
      titulo="Conciliaciones"
      descripcion="Conciliaciones bancarias y sus borradores."
      acciones={1}
      columnas={6}
    />
  );
}
