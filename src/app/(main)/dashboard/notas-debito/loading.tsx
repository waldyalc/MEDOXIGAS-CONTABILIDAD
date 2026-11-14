import { EsqueletoLista } from "@/components/carga/esqueletos";

export default function Loading() {
  return (
    <EsqueletoLista
      titulo="Notas de débito"
      descripcion="Notas de débito de venta ligadas a sus facturas."
      acciones={1}
      columnas={8}
    />
  );
}
