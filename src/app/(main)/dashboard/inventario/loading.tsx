import { EsqueletoLista } from "@/components/carga/esqueletos";

export default function Loading() {
  return (
    <EsqueletoLista
      titulo="Inventario"
      descripcion="Ajustes, transferencias y existencias."
      acciones={1}
      columnas={6}
    />
  );
}
