import { EsqueletoLista } from "@/components/carga/esqueletos";

export default function Loading() {
  return (
    <EsqueletoLista
      titulo="Activos fijos"
      descripcion="Activos, depreciación y su asiento."
      acciones={1}
      columnas={7}
    />
  );
}
