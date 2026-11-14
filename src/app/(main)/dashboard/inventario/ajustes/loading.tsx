import { EsqueletoLista } from "@/components/carga/esqueletos";

export default function Loading() {
  return (
    <EsqueletoLista
      titulo="Ajustes de inventario"
      descripcion="Entradas y salidas que ajustan existencias."
      acciones={1}
      columnas={7}
    />
  );
}
