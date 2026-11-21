import { EsqueletoLista } from "@/components/carga/esqueletos";

export default function Loading() {
  return (
    <EsqueletoLista
      titulo="Conteos físicos"
      descripcion="Toma física del inventario y ajuste por diferencias."
      acciones={1}
      columnas={6}
    />
  );
}
