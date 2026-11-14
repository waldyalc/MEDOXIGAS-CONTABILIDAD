import { EsqueletoLista } from "@/components/carga/esqueletos";

export default function Loading() {
  return <EsqueletoLista titulo="Monedas" descripcion="Moneda base y tasas de cambio por fecha." columnas={5} />;
}
