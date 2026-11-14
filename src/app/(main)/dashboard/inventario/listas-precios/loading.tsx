import { EsqueletoLista } from "@/components/carga/esqueletos";

export default function Loading() {
  return (
    <EsqueletoLista titulo="Listas de precios" descripcion="Precios por lista y su tipo de ajuste." columnas={5} />
  );
}
