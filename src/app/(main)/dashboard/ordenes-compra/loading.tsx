import { EsqueletoLista } from "@/components/carga/esqueletos";

export default function Loading() {
  return (
    <EsqueletoLista
      titulo="Órdenes de compra"
      descripcion="Documentos de control de compras."
      acciones={1}
      columnas={8}
    />
  );
}
