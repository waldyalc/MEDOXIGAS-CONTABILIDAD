import { EsqueletoLista } from "@/components/carga/esqueletos";

export default function Loading() {
  return (
    <EsqueletoLista
      titulo="Numeraciones"
      descripcion="Secuencias del NCF por tipo de comprobante."
      grande
      acciones={0}
      columnas={8}
    />
  );
}
