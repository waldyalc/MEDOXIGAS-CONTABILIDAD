import { EsqueletoLista } from "@/components/carga/esqueletos";

export default function Loading() {
  return (
    <EsqueletoLista
      titulo="Transferencias"
      descripcion="Movimientos de inventario entre almacenes."
      acciones={1}
      columnas={7}
    />
  );
}
