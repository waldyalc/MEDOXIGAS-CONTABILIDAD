import { EsqueletoLista } from "@/components/carga/esqueletos";

export default function Loading() {
  return (
    <EsqueletoLista
      titulo="Conduces"
      descripcion="Conduces de entrega y su conversión a factura."
      acciones={1}
      columnas={8}
    />
  );
}
