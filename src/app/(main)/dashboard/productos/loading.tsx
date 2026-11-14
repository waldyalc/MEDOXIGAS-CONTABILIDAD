import { EsqueletoLista } from "@/components/carga/esqueletos";

export default function Loading() {
  return (
    <EsqueletoLista
      titulo="Productos"
      descripcion="Administra los productos y servicios que vendes."
      grande
      acciones={1}
      filtros={1}
      columnas={6}
    />
  );
}
